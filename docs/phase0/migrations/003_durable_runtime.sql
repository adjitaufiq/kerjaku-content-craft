-- PREPARED ONLY. Scheduler remains disabled until a real authenticated callback is observed.
BEGIN;
CREATE TABLE public.craft_runtime_health (
  id text PRIMARY KEY DEFAULT 'default',
  server_scheduler_enabled boolean NOT NULL DEFAULT false,
  scheduler_verified_at timestamptz,
  last_heartbeat_at timestamptz,
  last_success_at timestamptz,
  worker_heartbeat_at timestamptz,
  ai_paused_until timestamptz,
  ai_pause_reason text
);
GRANT SELECT ON public.craft_runtime_health TO authenticated;
GRANT ALL ON public.craft_runtime_health TO service_role;
ALTER TABLE public.craft_runtime_health ENABLE ROW LEVEL SECURITY;
CREATE POLICY health_admin_read ON public.craft_runtime_health FOR SELECT TO authenticated USING(public.has_role(auth.uid(),'admin'));
INSERT INTO public.craft_runtime_health(id) VALUES ('default');

CREATE TABLE public.ai_usage_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL,
  capability text NOT NULL, model text NOT NULL, provider text NOT NULL,
  state text NOT NULL, input_tokens bigint, output_tokens bigint,
  estimated_cost_credits numeric, error_code text, created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ai_usage_events TO authenticated;
GRANT ALL ON public.ai_usage_events TO service_role;
ALTER TABLE public.ai_usage_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY usage_owner_read ON public.ai_usage_events FOR SELECT TO authenticated USING(user_id=auth.uid());

CREATE TABLE public.publishing_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL,
  content_log_id uuid NOT NULL UNIQUE REFERENCES public.content_logs(id),
  idempotency_key text NOT NULL UNIQUE,
  state text NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','leased','creating_container','container_ready','publishing','reconciliation_required','succeeded','failed','cancelled')),
  attempt integer NOT NULL DEFAULT 0, max_attempts integer NOT NULL DEFAULT 5,
  available_at timestamptz NOT NULL DEFAULT now(), lease_owner text, lease_until timestamptz,
  creation_id text, platform_post_id text, last_error jsonb NOT NULL DEFAULT '{}',
  image_refs text[] NOT NULL DEFAULT '{}', caption text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.publishing_jobs TO authenticated;
GRANT ALL ON public.publishing_jobs TO service_role;
ALTER TABLE public.publishing_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY publishing_owner_read ON public.publishing_jobs FOR SELECT TO authenticated USING(user_id=auth.uid());
CREATE INDEX publishing_job_due_idx ON public.publishing_jobs(state,available_at);

CREATE OR REPLACE FUNCTION public.enqueue_publish_job(log_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE content public.content_logs; job_id uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Forbidden'; END IF;
  SELECT * INTO content FROM public.content_logs WHERE id=log_id AND user_id=auth.uid() FOR UPDATE;
  IF content.id IS NULL THEN RAISE EXCEPTION 'Content not found'; END IF;
  IF content.status='published' OR content.ig_post_id IS NOT NULL THEN RAISE EXCEPTION 'Already published'; END IF;
  INSERT INTO public.publishing_jobs(user_id,content_log_id,idempotency_key,image_refs,caption,available_at)
    VALUES(content.user_id,content.id,'instagram:' || content.id::text,
      CASE WHEN cardinality(content.image_urls)>0 THEN content.image_urls ELSE ARRAY[content.image_url] END,
      content.caption,coalesce(content.scheduled_at,now()))
    ON CONFLICT(content_log_id) DO NOTHING;
  SELECT id INTO job_id FROM public.publishing_jobs WHERE content_log_id=content.id;
  RETURN job_id;
END $$;
REVOKE ALL ON FUNCTION public.enqueue_publish_job(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.enqueue_publish_job(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.claim_publish_job(worker_id text, lease_seconds integer DEFAULT 180, only_job_id uuid DEFAULT NULL)
RETURNS SETOF public.publishing_jobs LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF lease_seconds < 30 OR lease_seconds > 600 THEN RAISE EXCEPTION 'Invalid lease'; END IF;
  RETURN QUERY WITH candidate AS (
    SELECT id FROM public.publishing_jobs WHERE state IN ('pending','container_ready') AND attempt<max_attempts
      AND (available_at<=now()) AND (only_job_id IS NULL OR id=only_job_id)
      ORDER BY available_at FOR UPDATE SKIP LOCKED LIMIT 1
  ) UPDATE public.publishing_jobs j SET state=CASE WHEN j.creation_id IS NULL THEN 'leased' ELSE 'container_ready' END,
    lease_owner=worker_id, lease_until=now()+make_interval(secs=>lease_seconds), attempt=attempt+1, updated_at=now()
    FROM candidate c WHERE j.id=c.id RETURNING j.*;
END $$;
REVOKE ALL ON FUNCTION public.claim_publish_job(text,integer,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_publish_job(text,integer,uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.recover_publish_jobs()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE recovered integer;
BEGIN
  UPDATE public.publishing_jobs SET state=CASE
      WHEN state='publishing' THEN 'reconciliation_required'
      WHEN attempt>=max_attempts THEN 'failed'
      WHEN creation_id IS NOT NULL THEN 'container_ready' ELSE 'pending' END,
    lease_owner=NULL,lease_until=NULL,updated_at=now(),last_error=jsonb_build_object('code','LEASE_EXPIRED','previous_state',state)
    WHERE lease_until<now() AND state IN ('leased','creating_container','container_ready','publishing');
  GET DIAGNOSTICS recovered=ROW_COUNT;
  RETURN recovered;
END $$;
REVOKE ALL ON FUNCTION public.recover_publish_jobs() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.recover_publish_jobs() TO service_role;

CREATE OR REPLACE FUNCTION public.phase0_schedule_content()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NEW.status IN ('scheduled','publishing','published') AND auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Only admins can publish with shared credentials'; END IF;
  IF NEW.status='scheduled' AND NEW.user_id IS NOT NULL THEN
    INSERT INTO public.publishing_jobs(user_id,content_log_id,idempotency_key,image_refs,caption,available_at)
      VALUES(NEW.user_id,NEW.id,'instagram:' || NEW.id::text,
        CASE WHEN cardinality(NEW.image_urls)>0 THEN NEW.image_urls ELSE ARRAY[NEW.image_url] END,
        NEW.caption,coalesce(NEW.scheduled_at,now())) ON CONFLICT(content_log_id) DO NOTHING;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER phase0_schedule_content AFTER INSERT OR UPDATE ON public.content_logs FOR EACH ROW EXECUTE FUNCTION public.phase0_schedule_content();
-- All old scheduled jobs are copied; jobs already in publishing are quarantined, never blindly reset.
INSERT INTO public.publishing_jobs(user_id,content_log_id,idempotency_key,state,creation_id,platform_post_id,image_refs,caption,available_at)
SELECT user_id,id,'instagram:' || id::text,CASE WHEN status='publishing' THEN 'reconciliation_required' ELSE 'pending' END,
  ig_creation_id,ig_post_id,CASE WHEN cardinality(image_urls)>0 THEN image_urls ELSE ARRAY[image_url] END,caption,coalesce(scheduled_at,now())
FROM public.content_logs WHERE status IN ('scheduled','publishing') ON CONFLICT(content_log_id) DO NOTHING;
COMMIT;
