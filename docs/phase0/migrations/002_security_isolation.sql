-- PREPARED ONLY. Apply byte-for-byte through the migration tool after ownership review.
-- Fail/rollback the entire transaction on unresolved ownership. No existing data is deleted.
BEGIN;
DO $$
DECLARE tab text; unresolved bigint; policy record; item record;
BEGIN
  FOREACH tab IN ARRAY ARRAY['content_bank','content_logs','content_downloads'] LOOP
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS user_id uuid DEFAULT auth.uid()', tab);
    -- ADD COLUMN with a default can populate old rows with the migration caller's uid.
    -- Migration execution is service-role (auth.uid() IS NULL); refuse any authenticated execution.
    IF auth.uid() IS NOT NULL THEN RAISE EXCEPTION 'Use authorized migration executor, not a user session'; END IF;
    EXECUTE format('UPDATE public.%I t SET user_id = m.user_id FROM public.phase0_ownership_manifest m WHERE m.resource_table = %L AND m.resource_id = t.id::text AND t.user_id IS NULL',tab,tab);
    EXECUTE format('SELECT count(*) FROM public.%I WHERE user_id IS NULL',tab) INTO unresolved;
    IF unresolved > 0 THEN RAISE EXCEPTION 'Unresolved ownership in %: % rows. Review manifest before retrying.',tab,unresolved; END IF;
  END LOOP;
  FOR item IN SELECT table_name FROM information_schema.columns WHERE table_schema='public' AND column_name='user_id' AND table_name NOT IN ('user_roles','phase0_ownership_manifest','phase0_asset_manifest') LOOP
    tab := item.table_name;
    EXECUTE format('SELECT count(*) FROM public.%I WHERE user_id IS NULL',tab) INTO unresolved;
    IF unresolved > 0 THEN RAISE EXCEPTION 'Missing ownership in %',tab; END IF;
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN user_id SET NOT NULL',tab);
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN user_id SET DEFAULT auth.uid()',tab);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon',tab);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated',tab);
    EXECUTE format('GRANT ALL ON public.%I TO service_role',tab);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',tab);
    FOR policy IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=tab LOOP
      EXECUTE format('DROP POLICY %I ON public.%I',policy.policyname,tab);
    END LOOP;
    EXECUTE format('CREATE POLICY owner_access ON public.%I FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid())',tab);
  END LOOP;
END $$;

ALTER TABLE public.content_bank DROP CONSTRAINT IF EXISTS content_bank_content_number_key;
CREATE UNIQUE INDEX content_bank_owner_number_unique ON public.content_bank(user_id, content_number);

-- Credential tables remain server-only; being signed in does not grant access to shared tokens.
DO $$ DECLARE tab text; policy record;
BEGIN
  FOREACH tab IN ARRAY ARRAY['meta_credentials','meta_token_meta'] LOOP
    IF to_regclass('public.' || tab) IS NOT NULL THEN
      EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated',tab);
      EXECUTE format('GRANT ALL ON public.%I TO service_role',tab);
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',tab);
      FOR policy IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=tab LOOP
        EXECUTE format('DROP POLICY %I ON public.%I',policy.policyname,tab);
      END LOOP;
    END IF;
  END LOOP;
END $$;
REVOKE ALL ON public.user_roles FROM anon, authenticated;
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
DO $$ DECLARE policy record; BEGIN
  FOR policy IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='user_roles' LOOP
    EXECUTE format('DROP POLICY %I ON public.user_roles',policy.policyname);
  END LOOP;
END $$;
CREATE POLICY own_roles_read ON public.user_roles FOR SELECT TO authenticated USING(user_id=auth.uid());
-- has_role must remain callable by authenticated users for authorization BEFORE service-role work.
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

CREATE OR REPLACE FUNCTION public.phase0_asset_owner(bucket_name text, object_path text)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT user_id FROM public.phase0_asset_manifest WHERE bucket_id=bucket_name AND phase0_asset_manifest.object_path=$2
$$;
REVOKE ALL ON FUNCTION public.phase0_asset_owner(text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.phase0_asset_owner(text,text) TO service_role;

CREATE OR REPLACE FUNCTION public.phase0_owns_asset(bucket_name text, object_path text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT auth.uid() IS NOT NULL AND (
    split_part(object_path,'/',1)=auth.uid()::text OR EXISTS (
      SELECT 1 FROM public.phase0_asset_manifest m WHERE m.bucket_id=bucket_name AND m.object_path=$2 AND m.user_id=auth.uid()
    )
  )
$$;
REVOKE ALL ON FUNCTION public.phase0_owns_asset(text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.phase0_owns_asset(text,text) TO authenticated;

-- Remove known permissive policies, then add restrictive fences so any unknown sibling policy
-- cannot re-open these buckets. Restrictive policies are ANDed with all permissive policies.
DO $$ DECLARE policy record; BEGIN
  FOR policy IN SELECT policyname FROM pg_policies WHERE schemaname='storage' AND tablename='objects'
    AND (coalesce(qual,'') || coalesce(with_check,'')) ~ '(instagram-media|viral-sources|content-research)' LOOP
    EXECUTE format('DROP POLICY %I ON storage.objects',policy.policyname);
  END LOOP;
END $$;
CREATE POLICY internal_asset_owner ON storage.objects FOR ALL TO authenticated
  USING(bucket_id IN ('instagram-media','viral-sources','content-research') AND public.phase0_owns_asset(bucket_id,name))
  WITH CHECK(bucket_id IN ('instagram-media','viral-sources','content-research') AND split_part(name,'/',1)=auth.uid()::text);
CREATE POLICY internal_asset_fence ON storage.objects AS RESTRICTIVE FOR ALL TO authenticated
  USING(bucket_id NOT IN ('instagram-media','viral-sources','content-research') OR public.phase0_owns_asset(bucket_id,name))
  WITH CHECK(bucket_id NOT IN ('instagram-media','viral-sources','content-research') OR split_part(name,'/',1)=auth.uid()::text);
CREATE POLICY internal_asset_anon_deny ON storage.objects AS RESTRICTIVE FOR ALL TO anon
  USING(bucket_id NOT IN ('instagram-media','viral-sources','content-research'))
  WITH CHECK(bucket_id NOT IN ('instagram-media','viral-sources','content-research'));
-- Bucket public=false is a separate Storage API action, NOT a SQL update to storage.buckets.
COMMIT;
