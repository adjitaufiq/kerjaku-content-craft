-- PREPARED ONLY; apply after unchanged 001 and the approved recovery/ownership gates.
BEGIN;
CREATE TABLE public.craft_distribution (
  id text PRIMARY KEY, user_id uuid NOT NULL, task_id uuid NOT NULL, campaign_id uuid NOT NULL,
  content_id uuid NOT NULL, platform text NOT NULL, format text NOT NULL, package jsonb NOT NULL,
  state text NOT NULL DEFAULT 'awaiting_authorization', reason text, available_at timestamptz,
  lease_owner text, lease_until timestamptz, submission_id text, platform_post_id text, post_url text,
  attempt integer NOT NULL DEFAULT 0, last_error text, authorized_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(task_id,user_id) REFERENCES public.craft_tasks(id,user_id),
  FOREIGN KEY(content_id,user_id) REFERENCES public.craft_bank(id,user_id), UNIQUE(id,user_id)
);
GRANT SELECT ON public.craft_distribution TO authenticated;
GRANT ALL ON public.craft_distribution TO service_role;
ALTER TABLE public.craft_distribution ENABLE ROW LEVEL SECURITY;
CREATE POLICY distribution_owner ON public.craft_distribution FOR SELECT TO authenticated USING(user_id=auth.uid());

CREATE TABLE public.craft_metric_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, distribution_id text NOT NULL,
  content_id uuid NOT NULL, platform text NOT NULL, platform_post_id text NOT NULL,
  views bigint, likes bigint, comments bigint, shares bigint, measured_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(distribution_id,user_id) REFERENCES public.craft_distribution(id,user_id),
  FOREIGN KEY(content_id,user_id) REFERENCES public.craft_bank(id,user_id),
  CHECK(views>=0 AND likes>=0 AND comments>=0 AND shares>=0)
);
GRANT SELECT ON public.craft_metric_snapshots TO authenticated;
GRANT ALL ON public.craft_metric_snapshots TO service_role;
ALTER TABLE public.craft_metric_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY metrics_owner ON public.craft_metric_snapshots FOR SELECT TO authenticated USING(user_id=auth.uid());

CREATE OR REPLACE FUNCTION public.craft_enqueue_distribution(task_id uuid,worker text,packages jsonb)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE owner uuid; campaign uuid; d jsonb; n integer:=0; source jsonb;
BEGIN
  SELECT t.user_id,t.campaign_id,t.output INTO owner,campaign,source FROM craft_tasks t
    WHERE t.id=task_id AND t.stage='distribution' AND t.state='running' AND t.lease_owner=worker AND t.lease_until>now() FOR UPDATE;
  IF owner IS NULL OR coalesce(source->'qc'->>'passed','false')<>'true' THEN RAISE EXCEPTION 'LEASE_LOST_OR_QC'; END IF;
  FOR d IN SELECT value FROM jsonb_array_elements(packages) LOOP
    IF d->>'campaignId'<>campaign::text OR d->>'contentId'<>source->'content'->>'id' OR d->>'id'<>campaign::text||':'||(d->>'contentId')||':'||(d->>'platform')||':'||(d->>'format') THEN RAISE EXCEPTION 'Package owner mismatch'; END IF;
    IF d->>'state' NOT IN ('awaiting_authorization','unsupported_format') THEN RAISE EXCEPTION 'Platform authorization required'; END IF;
    INSERT INTO craft_distribution(id,user_id,task_id,campaign_id,content_id,platform,format,package,state,reason)
      VALUES(d->>'id',owner,task_id,campaign,(d->>'contentId')::uuid,d->>'platform',d->>'format',d,d->>'state',d->>'reason') ON CONFLICT(id) DO NOTHING;
    n:=n+1;
  END LOOP;
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.craft_enqueue_distribution(uuid,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.craft_enqueue_distribution(uuid,text,jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.craft_claim_distribution(worker text)
RETURNS SETOF public.craft_distribution LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  UPDATE craft_distribution SET state='reconciliation_required',last_error='Lease expired; no automatic repost',lease_owner=NULL,lease_until=NULL
    WHERE lease_until<now() AND state IN ('leased','creating_container','container_ready','publishing');
  IF NOT EXISTS(SELECT 1 FROM craft_runtime_health WHERE id='default' AND server_scheduler_enabled AND scheduler_verified_at IS NOT NULL) THEN RETURN; END IF;
  RETURN QUERY WITH candidate AS (
    SELECT id FROM craft_distribution WHERE state='ready' AND authorized_at IS NOT NULL AND available_at<=now() AND attempt<5
    ORDER BY available_at FOR UPDATE SKIP LOCKED LIMIT 1
  ) UPDATE craft_distribution d SET state='leased',lease_owner=worker,lease_until=now()+interval '30 minutes',attempt=attempt+1,updated_at=now()
    FROM candidate c WHERE d.id=c.id RETURNING d.*;
END $$;
REVOKE ALL ON FUNCTION public.craft_claim_distribution(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.craft_claim_distribution(text) TO service_role;

CREATE OR REPLACE FUNCTION public.craft_complete_task(task_id uuid,worker text,result jsonb,next_stage text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE expected text; current_stage text; video boolean; stills boolean;
BEGIN
  SELECT t.stage,CASE WHEN c.config->'seedContents'->(t.ordinal-1) IS NOT NULL THEN t.output->'content'->'production'->>'format'='Video' ELSE coalesce(c.config->'formats','["Foto","Carousel","Video"]') ? 'Video' END,
    CASE WHEN c.config->'seedContents'->(t.ordinal-1) IS NOT NULL THEN t.output->'content'->'production'->>'format'<>'Video' ELSE coalesce(c.config->'formats','["Foto","Carousel","Video"]') ?| array['Foto','Carousel'] END
    INTO current_stage,video,stills FROM craft_tasks t JOIN craft_campaigns c ON c.id=t.campaign_id
    WHERE t.id=task_id AND t.state='running' AND t.lease_owner=worker AND t.lease_until>now() FOR UPDATE OF t;
  expected:=CASE current_stage WHEN 'research' THEN 'script' WHEN 'script' THEN 'image'
    WHEN 'image' THEN CASE WHEN stills THEN 'design' ELSE 'voice' END
    WHEN 'design' THEN CASE WHEN video THEN 'voice' ELSE 'quality' END
    WHEN 'voice' THEN 'render' WHEN 'render' THEN 'quality' WHEN 'quality' THEN 'distribution' WHEN 'distribution' THEN 'complete' END;
  IF expected IS NULL OR expected<>next_stage THEN RETURN false; END IF;
  UPDATE craft_tasks SET output=result,stage=next_stage,state=CASE WHEN next_stage='complete' THEN 'succeeded' ELSE 'queued' END,lease_owner=NULL,lease_until=NULL,updated_at=now() WHERE id=task_id;
  UPDATE craft_campaigns c SET state='produced' WHERE c.id=(SELECT campaign_id FROM craft_tasks WHERE id=task_id) AND NOT EXISTS(SELECT 1 FROM craft_tasks t WHERE t.campaign_id=c.id AND t.state<>'succeeded');
  RETURN true;
END $$;
COMMIT;