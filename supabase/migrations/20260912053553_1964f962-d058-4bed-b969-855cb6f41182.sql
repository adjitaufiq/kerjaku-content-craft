CREATE TABLE public.content_production_results (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  version_id uuid NOT NULL UNIQUE REFERENCES public.kerjaku_versions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  atm_mode public.atm_mode NOT NULL,
  content_info jsonb NOT NULL DEFAULT '{}'::jsonb,
  carousel_structure jsonb NOT NULL DEFAULT '[]'::jsonb,
  visual_prompts jsonb NOT NULL DEFAULT '[]'::jsonb,
  caption_options jsonb NOT NULL DEFAULT '[]'::jsonb,
  hashtags jsonb NOT NULL DEFAULT '{}'::jsonb,
  cta_options jsonb NOT NULL DEFAULT '[]'::jsonb,
  model text NOT NULL DEFAULT '',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.content_production_results TO authenticated;
GRANT ALL ON public.content_production_results TO service_role;

ALTER TABLE public.content_production_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own content production results"
ON public.content_production_results
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_content_production_results_user ON public.content_production_results(user_id);

CREATE TRIGGER update_content_production_results_updated_at
BEFORE UPDATE ON public.content_production_results
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();