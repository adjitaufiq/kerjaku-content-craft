CREATE TABLE public.content_remix_results (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  reference_id uuid NOT NULL REFERENCES public.viral_content_references(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content_angle text NOT NULL DEFAULT '',
  angle_rationale text NOT NULL DEFAULT '',
  structure_type text NOT NULL DEFAULT '',
  content_type public.generated_content_type NOT NULL DEFAULT 'carousel',
  slides jsonb NOT NULL DEFAULT '[]'::jsonb,
  captions jsonb NOT NULL DEFAULT '[]'::jsonb,
  hashtags text[] NOT NULL DEFAULT '{}'::text[],
  ctas jsonb NOT NULL DEFAULT '[]'::jsonb,
  quality_check jsonb NOT NULL DEFAULT '{}'::jsonb,
  model text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (reference_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.content_remix_results TO authenticated;
GRANT ALL ON public.content_remix_results TO service_role;

ALTER TABLE public.content_remix_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own remix results"
ON public.content_remix_results FOR ALL TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_content_remix_results_user ON public.content_remix_results(user_id);

CREATE TRIGGER update_content_remix_results_updated_at
BEFORE UPDATE ON public.content_remix_results
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();