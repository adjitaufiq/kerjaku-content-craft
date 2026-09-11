ALTER TABLE public.brand_profile
  ADD COLUMN IF NOT EXISTS description text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS customer_problem text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS customer_desire text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS personality text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS writing_style text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS visual_direction text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS preferred_style text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS forbidden_style text NOT NULL DEFAULT '';

ALTER TABLE public.brand_products
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS features text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS target_user text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS allowed_claims text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS forbidden_claims text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';

ALTER TABLE public.brand_products
  ADD CONSTRAINT brand_products_status_check CHECK (status IN ('active','inactive'));

ALTER TABLE public.brand_rules
  ADD COLUMN IF NOT EXISTS rule_category text NOT NULL DEFAULT 'allow',
  ADD COLUMN IF NOT EXISTS severity text NOT NULL DEFAULT 'warning';

UPDATE public.brand_rules SET rule_category = 'forbidden' WHERE rule_type = 'dont';

ALTER TABLE public.brand_rules
  ADD CONSTRAINT brand_rules_category_check CHECK (rule_category IN ('allow','forbidden','claim_control')),
  ADD CONSTRAINT brand_rules_severity_check CHECK (severity IN ('warning','hard_fail'));

ALTER TABLE public.brand_power_words
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS usage_example text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS forbidden_usage text NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS public.brand_knowledge_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  version text NOT NULL,
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  readiness text NOT NULL DEFAULT 'incomplete',
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.brand_knowledge_versions TO authenticated;
GRANT ALL ON public.brand_knowledge_versions TO service_role;

ALTER TABLE public.brand_knowledge_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner can read brand versions" ON public.brand_knowledge_versions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Owner can insert brand versions" ON public.brand_knowledge_versions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS brand_knowledge_versions_user_created_idx
  ON public.brand_knowledge_versions (user_id, created_at DESC);