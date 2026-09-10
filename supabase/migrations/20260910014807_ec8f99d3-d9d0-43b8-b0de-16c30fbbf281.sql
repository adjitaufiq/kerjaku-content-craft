CREATE TYPE public.viral_source_status AS ENUM (
  'draft','processing','understanding','source_extracted','analysis_complete','production','approved','published','failed'
);

CREATE TABLE public.viral_sources (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform text NOT NULL DEFAULT 'upload',
  source_url text,
  creator_name text,
  title text NOT NULL DEFAULT '',
  category text,
  notes text NOT NULL DEFAULT '',
  thumbnail_url text,
  video_path text,
  status public.viral_source_status NOT NULL DEFAULT 'draft',
  expires_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.viral_sources TO authenticated;
GRANT ALL ON public.viral_sources TO service_role;

ALTER TABLE public.viral_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own viral sources"
ON public.viral_sources FOR ALL TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_viral_sources_user_created ON public.viral_sources (user_id, created_at DESC);
CREATE INDEX idx_viral_sources_status ON public.viral_sources (status);

CREATE TRIGGER update_viral_sources_updated_at
BEFORE UPDATE ON public.viral_sources
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "Users manage own viral source files"
ON storage.objects FOR ALL TO authenticated
USING (bucket_id = 'viral-sources' AND owner = auth.uid())
WITH CHECK (bucket_id = 'viral-sources' AND owner = auth.uid());