-- PREPARED ONLY: database paused. No legacy backfill or changes to existing content.
-- Apply through the migration tool only after recovery/backup and ownership approval.
BEGIN;
CREATE TABLE public.craft_bank (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL DEFAULT auth.uid(),
  content_number integer NOT NULL CHECK(content_number > 0), document jsonb NOT NULL,
  revision integer NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id,content_number), UNIQUE(id,user_id),
  CHECK(document->>'classification' = 'PERSONAL_CONTENT'), CHECK(document->>'id' = id::text)
);
GRANT SELECT,INSERT,UPDATE,DELETE ON public.craft_bank TO authenticated;
GRANT ALL ON public.craft_bank TO service_role;
ALTER TABLE public.craft_bank ENABLE ROW LEVEL SECURITY;
CREATE POLICY own_bank ON public.craft_bank FOR ALL TO authenticated USING(user_id=auth.uid()) WITH CHECK(user_id=auth.uid());

CREATE TABLE public.craft_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL DEFAULT auth.uid(),
  command text NOT NULL, config jsonb NOT NULL, state text NOT NULL DEFAULT 'queued', created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(id,user_id)
);
GRANT SELECT ON public.craft_campaigns TO authenticated;
GRANT ALL ON public.craft_campaigns TO service_role;
ALTER TABLE public.craft_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY own_campaign ON public.craft_campaigns FOR SELECT TO authenticated USING(user_id=auth.uid());

CREATE TABLE public.craft_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), campaign_id uuid NOT NULL, user_id uuid NOT NULL,
  ordinal integer NOT NULL, stage text NOT NULL DEFAULT 'research', state text NOT NULL DEFAULT 'queued',
  attempt integer NOT NULL DEFAULT 0, lease_owner text, lease_until timestamptz, output jsonb NOT NULL DEFAULT '{}', error text,
  available_at timestamptz NOT NULL DEFAULT now(), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(campaign_id,user_id) REFERENCES public.craft_campaigns(id,user_id), UNIQUE(campaign_id,ordinal), UNIQUE(id,user_id)
);
GRANT SELECT ON public.craft_tasks TO authenticated;
GRANT ALL ON public.craft_tasks TO service_role;
ALTER TABLE public.craft_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY own_task ON public.craft_tasks FOR SELECT TO authenticated USING(user_id=auth.uid());

CREATE TABLE public.craft_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, task_id uuid NOT NULL, campaign_id uuid NOT NULL,
  kind text NOT NULL, bucket text NOT NULL, path text NOT NULL, mime text NOT NULL, bytes bigint NOT NULL, checksum text NOT NULL,
  duration numeric, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(bucket,path),
  FOREIGN KEY(task_id,user_id) REFERENCES public.craft_tasks(id,user_id),
  FOREIGN KEY(campaign_id,user_id) REFERENCES public.craft_campaigns(id,user_id), CHECK(split_part(path,'/',1)=user_id::text)
);
GRANT SELECT ON public.craft_media TO authenticated;
GRANT ALL ON public.craft_media TO service_role;
ALTER TABLE public.craft_media ENABLE ROW LEVEL SECURITY;
CREATE POLICY own_media ON public.craft_media FOR SELECT TO authenticated USING(user_id=auth.uid());

CREATE OR REPLACE FUNCTION public.craft_create_campaign(command_text text,campaign_config jsonb,item_count integer)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE campaign uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  IF item_count < 1 OR item_count > 100 OR length(command_text)<10 THEN RAISE EXCEPTION 'Invalid campaign'; END IF;
  INSERT INTO public.craft_campaigns(user_id,command,config) VALUES(auth.uid(),command_text,campaign_config) RETURNING id INTO campaign;
  INSERT INTO public.craft_tasks(campaign_id,user_id,ordinal) SELECT campaign,auth.uid(),n FROM generate_series(1,item_count) n;
  RETURN campaign;
END $$;
REVOKE ALL ON FUNCTION public.craft_create_campaign(text,jsonb,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.craft_create_campaign(text,jsonb,integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.craft_claim_task(worker text) RETURNS SETOF public.craft_tasks
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  -- Never replay timed-out inference or publishing: absence of output is NOT proof of no side effect.
  UPDATE public.craft_tasks SET state='reconciliation_required',error='Worker lease expired; inspect provider/job outcome before retry',lease_owner=NULL,lease_until=NULL
    WHERE state='running' AND lease_until<now();
  RETURN QUERY WITH candidate AS (
    SELECT t.id FROM public.craft_tasks t JOIN public.craft_campaigns c ON c.id=t.campaign_id
    WHERE t.state='queued' AND t.available_at<=now() AND c.state IN ('queued','running')
    ORDER BY t.created_at,t.ordinal FOR UPDATE OF t SKIP LOCKED LIMIT 1
  ) UPDATE public.craft_tasks t SET state='running',attempt=attempt+1,lease_owner=worker,lease_until=now()+interval '30 minutes',updated_at=now()
    FROM candidate c WHERE t.id=c.id RETURNING t.*;
END $$;
REVOKE ALL ON FUNCTION public.craft_claim_task(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.craft_claim_task(text) TO service_role;

CREATE OR REPLACE FUNCTION public.craft_complete_task(task_id uuid,worker text,result jsonb,next_stage text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE expected text;
BEGIN
  SELECT CASE stage WHEN 'research' THEN 'script' WHEN 'script' THEN 'image' WHEN 'image' THEN 'voice' WHEN 'voice' THEN 'render' WHEN 'render' THEN 'quality' WHEN 'quality' THEN 'distribution' WHEN 'distribution' THEN 'analytics' WHEN 'analytics' THEN 'complete' END
    INTO expected FROM public.craft_tasks WHERE id=task_id AND state='running' AND lease_owner=worker AND lease_until>now() FOR UPDATE;
  IF expected IS NULL OR next_stage<>expected THEN RETURN false; END IF;
  UPDATE public.craft_tasks SET output=result,stage=next_stage,state=CASE WHEN next_stage='complete' THEN 'succeeded' ELSE 'queued' END,lease_owner=NULL,lease_until=NULL,updated_at=now() WHERE id=task_id;
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.craft_complete_task(uuid,text,jsonb,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.craft_complete_task(uuid,text,jsonb,text) TO service_role;

CREATE OR REPLACE FUNCTION public.craft_save_bank(documents jsonb) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE d jsonb; current_revision integer; n integer:=0;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  IF jsonb_typeof(documents)<>'array' THEN RAISE EXCEPTION 'Invalid bank'; END IF;
  FOR d IN SELECT value FROM jsonb_array_elements(documents) LOOP
    IF d->>'classification'<>'PERSONAL_CONTENT' THEN RAISE EXCEPTION 'System templates cannot be overwritten'; END IF;
    IF d->>'status' NOT IN ('draft','approved') THEN RAISE EXCEPTION 'Publishing states are not user editable'; END IF;
    SELECT revision INTO current_revision FROM public.craft_bank WHERE id=(d->>'id')::uuid AND user_id=auth.uid() FOR UPDATE;
    IF current_revision IS NOT NULL AND (d->>'revision')::integer<>current_revision+1 THEN RAISE EXCEPTION 'Revision conflict'; END IF;
    INSERT INTO public.craft_bank(id,user_id,content_number,document,revision) VALUES((d->>'id')::uuid,auth.uid(),(d->>'no')::integer,d,(d->>'revision')::integer)
    ON CONFLICT(id) DO UPDATE SET document=EXCLUDED.document,revision=EXCLUDED.revision,updated_at=now() WHERE craft_bank.user_id=auth.uid();
    IF NOT FOUND THEN RAISE EXCEPTION 'Access denied'; END IF;
    n:=n+1;
  END LOOP;
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.craft_save_bank(jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.craft_save_bank(jsonb) TO authenticated;
COMMIT;