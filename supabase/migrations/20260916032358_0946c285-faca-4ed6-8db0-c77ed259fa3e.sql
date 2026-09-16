CREATE TABLE IF NOT EXISTS public.carousel_prompt_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  version_id uuid NOT NULL UNIQUE REFERENCES public.kerjaku_versions(id) ON DELETE CASCADE,
  source_id uuid NOT NULL REFERENCES public.viral_sources(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'DRAFT',
  slide_count integer NOT NULL DEFAULT 7,
  visual_style text NOT NULL DEFAULT 'brand_center',
  text_level text NOT NULL DEFAULT 'sedang',
  package jsonb NOT NULL DEFAULT '{}'::jsonb,
  slides jsonb NOT NULL DEFAULT '[]'::jsonb,
  validation jsonb NOT NULL DEFAULT '{}'::jsonb,
  model text NOT NULL DEFAULT '',
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.carousel_prompt_packages TO authenticated;
GRANT ALL ON public.carousel_prompt_packages TO service_role;

ALTER TABLE public.carousel_prompt_packages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own carousel prompt packages"
ON public.carousel_prompt_packages FOR ALL TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_carousel_prompt_packages_updated_at
BEFORE UPDATE ON public.carousel_prompt_packages
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS carousel_prompt_packages_source_idx ON public.carousel_prompt_packages(source_id);