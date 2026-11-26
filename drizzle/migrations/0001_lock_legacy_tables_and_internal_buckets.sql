-- Legacy tables: add owner column (existing rows stay NULL = quarantined from clients, never auto-assigned).
ALTER TABLE public.content_bank ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.content_logs ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.content_downloads ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.content_bank ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE public.content_logs ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE public.content_downloads ALTER COLUMN user_id SET DEFAULT auth.uid();
CREATE INDEX IF NOT EXISTS content_logs_user_id_idx ON public.content_logs(user_id);
CREATE INDEX IF NOT EXISTS content_downloads_user_id_idx ON public.content_downloads(user_id);

-- Content numbers are unique per owner, not globally.
ALTER TABLE public.content_bank DROP CONSTRAINT IF EXISTS content_bank_content_number_key;
CREATE UNIQUE INDEX IF NOT EXISTS content_bank_owner_number_unique ON public.content_bank(user_id, content_number);

REVOKE ALL ON public.content_bank FROM anon;
REVOKE ALL ON public.content_logs FROM anon;
REVOKE ALL ON public.content_downloads FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.content_bank TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.content_logs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.content_downloads TO authenticated;
GRANT ALL ON public.content_bank TO service_role;
GRANT ALL ON public.content_logs TO service_role;
GRANT ALL ON public.content_downloads TO service_role;
ALTER TABLE public.content_bank ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_downloads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "content_bank open access" ON public.content_bank;
DROP POLICY IF EXISTS "content_logs open access" ON public.content_logs;
DROP POLICY IF EXISTS "Authenticated users manage content downloads" ON public.content_downloads;

CREATE POLICY "Owners manage their content bank" ON public.content_bank
  FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Owners manage their content logs" ON public.content_logs
  FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Owners manage their content downloads" ON public.content_downloads
  FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Meta token metadata is server-only.
DROP POLICY IF EXISTS "meta_token_meta readable" ON public.meta_token_meta;
REVOKE ALL ON public.meta_token_meta FROM anon, authenticated;
GRANT ALL ON public.meta_token_meta TO service_role;
ALTER TABLE public.meta_token_meta ENABLE ROW LEVEL SECURITY;

-- Storage: bind read/update/delete to the uploader or the owner-prefixed folder.
DROP POLICY IF EXISTS "instagram media read" ON storage.objects;
DROP POLICY IF EXISTS "instagram media update" ON storage.objects;
DROP POLICY IF EXISTS "instagram media delete" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated read content research" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated update content research" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated delete content research" ON storage.objects;

CREATE POLICY "Owners read instagram media" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'instagram-media' AND (owner_id = (select auth.uid()::text) OR (storage.foldername(name))[1] = (select auth.uid()::text)));
CREATE POLICY "Owners update instagram media" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'instagram-media' AND (owner_id = (select auth.uid()::text) OR (storage.foldername(name))[1] = (select auth.uid()::text)))
  WITH CHECK (bucket_id = 'instagram-media' AND (storage.foldername(name))[1] = (select auth.uid()::text));
CREATE POLICY "Owners delete instagram media" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'instagram-media' AND (owner_id = (select auth.uid()::text) OR (storage.foldername(name))[1] = (select auth.uid()::text)));

CREATE POLICY "Owners read content research" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'content-research' AND (owner_id = (select auth.uid()::text) OR (storage.foldername(name))[1] = (select auth.uid()::text)));
CREATE POLICY "Owners update content research" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'content-research' AND (owner_id = (select auth.uid()::text) OR (storage.foldername(name))[1] = (select auth.uid()::text)))
  WITH CHECK (bucket_id = 'content-research' AND (storage.foldername(name))[1] = (select auth.uid()::text));
CREATE POLICY "Owners delete content research" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'content-research' AND (owner_id = (select auth.uid()::text) OR (storage.foldername(name))[1] = (select auth.uid()::text)));