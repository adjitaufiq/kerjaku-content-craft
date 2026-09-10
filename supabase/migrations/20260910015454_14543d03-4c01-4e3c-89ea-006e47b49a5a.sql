CREATE TYPE public.source_extraction_status AS ENUM (
  'processing','completed','partial','failed','needs_review'
);

CREATE TABLE public.source_extractions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source_id uuid NOT NULL UNIQUE REFERENCES public.viral_sources(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  transcript jsonb NOT NULL DEFAULT '[]'::jsonb,
  snapshot_data jsonb NOT NULL DEFAULT '[]'::jsonb,
  visual_analysis jsonb NOT NULL DEFAULT '[]'::jsonb,
  on_screen_text jsonb NOT NULL DEFAULT '[]'::jsonb,
  source_report jsonb NOT NULL DEFAULT '{}'::jsonb,
  verification_status public.source_extraction_status NOT NULL DEFAULT 'processing',
  confidence_score numeric NOT NULL DEFAULT 0,
  has_audio boolean NOT NULL DEFAULT true,
  model text NOT NULL DEFAULT '',
  error_message text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.source_extractions TO authenticated;
GRANT ALL ON public.source_extractions TO service_role;

ALTER TABLE public.source_extractions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own source extractions"
ON public.source_extractions FOR ALL TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_source_extractions_source ON public.source_extractions (source_id);

CREATE TRIGGER update_source_extractions_updated_at
BEFORE UPDATE ON public.source_extractions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();