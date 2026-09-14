ALTER TABLE public.source_extractions
  ADD COLUMN IF NOT EXISTS pipeline_stage text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS failed_stage text,
  ADD COLUMN IF NOT EXISTS video_metadata jsonb NOT NULL DEFAULT '{}'::jsonb;