ALTER TABLE public.source_extractions
  ADD COLUMN IF NOT EXISTS last_heartbeat_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS stage_changed_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.viral_sources
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

CREATE TABLE IF NOT EXISTS public.source_extraction_archives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  source_id uuid NOT NULL,
  archived_reason text NOT NULL DEFAULT 'retry',
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, DELETE ON public.source_extraction_archives TO authenticated;
GRANT ALL ON public.source_extraction_archives TO service_role;

ALTER TABLE public.source_extraction_archives ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner can read archives" ON public.source_extraction_archives
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Owner can insert archives" ON public.source_extraction_archives
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Owner can delete archives" ON public.source_extraction_archives
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS source_extraction_archives_source_idx
  ON public.source_extraction_archives (source_id, created_at DESC);
CREATE INDEX IF NOT EXISTS viral_sources_deleted_idx
  ON public.viral_sources (deleted_at);