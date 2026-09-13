CREATE TYPE public.content_approval_status AS ENUM ('draft','revision_needed','approved','ready_publish','published');
CREATE TYPE public.quality_gate_status AS ENUM ('ready_production','revision_needed');
CREATE TYPE public.performance_period AS ENUM ('24h','7d','30d');

CREATE TABLE public.quality_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  version_id uuid NOT NULL UNIQUE REFERENCES public.kerjaku_versions(id) ON DELETE CASCADE,
  atm_mode public.atm_mode NOT NULL DEFAULT 'conservative',
  structural_result jsonb NOT NULL DEFAULT '{}'::jsonb,
  rule_result jsonb NOT NULL DEFAULT '{}'::jsonb,
  judge_result jsonb NOT NULL DEFAULT '{}'::jsonb,
  pattern_score integer NOT NULL DEFAULT 0,
  trigger_score integer NOT NULL DEFAULT 0,
  curiosity_score integer NOT NULL DEFAULT 0,
  power_score integer NOT NULL DEFAULT 0,
  cta_score integer NOT NULL DEFAULT 0,
  source_fidelity_score integer NOT NULL DEFAULT 0,
  brand_safety integer NOT NULL DEFAULT 0,
  overall_score integer NOT NULL DEFAULT 0,
  status public.quality_gate_status NOT NULL DEFAULT 'revision_needed',
  hard_failures text[] NOT NULL DEFAULT '{}',
  failed_criteria jsonb NOT NULL DEFAULT '[]'::jsonb,
  repair_attempted boolean NOT NULL DEFAULT false,
  repair_note text NOT NULL DEFAULT '',
  model text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quality_scores TO authenticated;
GRANT ALL ON public.quality_scores TO service_role;
ALTER TABLE public.quality_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own quality scores" ON public.quality_scores FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER update_quality_scores_updated_at BEFORE UPDATE ON public.quality_scores FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.content_library (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  source_id uuid REFERENCES public.viral_sources(id) ON DELETE SET NULL,
  version_id uuid NOT NULL UNIQUE REFERENCES public.kerjaku_versions(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT '',
  category text,
  atm_mode public.atm_mode NOT NULL DEFAULT 'conservative',
  hook_type text NOT NULL DEFAULT '',
  source_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  viral_attributes jsonb NOT NULL DEFAULT '{}'::jsonb,
  content_assets jsonb NOT NULL DEFAULT '{}'::jsonb,
  quality_result jsonb NOT NULL DEFAULT '{}'::jsonb,
  approval_status public.content_approval_status NOT NULL DEFAULT 'draft',
  override_note text NOT NULL DEFAULT '',
  overridden_at timestamptz,
  overridden_by uuid,
  content_log_id uuid,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.content_library TO authenticated;
GRANT ALL ON public.content_library TO service_role;
ALTER TABLE public.content_library ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own content library" ON public.content_library FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER update_content_library_updated_at BEFORE UPDATE ON public.content_library FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_content_library_status ON public.content_library(user_id, approval_status);
CREATE INDEX idx_content_library_hook ON public.content_library(user_id, hook_type);

CREATE TABLE public.content_performance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  content_id uuid NOT NULL REFERENCES public.content_library(id) ON DELETE CASCADE,
  measurement_period public.performance_period NOT NULL,
  views integer NOT NULL DEFAULT 0,
  likes integer NOT NULL DEFAULT 0,
  comments integer NOT NULL DEFAULT 0,
  shares integer NOT NULL DEFAULT 0,
  saves integer NOT NULL DEFAULT 0,
  engagement_rate numeric NOT NULL DEFAULT 0,
  measured_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (content_id, measurement_period)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.content_performance TO authenticated;
GRANT ALL ON public.content_performance TO service_role;
ALTER TABLE public.content_performance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own content performance" ON public.content_performance FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER update_content_performance_updated_at BEFORE UPDATE ON public.content_performance FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.account_baseline (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users ON DELETE CASCADE,
  window_days integer NOT NULL DEFAULT 30,
  avg_views numeric NOT NULL DEFAULT 0,
  avg_engagement_rate numeric NOT NULL DEFAULT 0,
  sample_size integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.account_baseline TO authenticated;
GRANT ALL ON public.account_baseline TO service_role;
ALTER TABLE public.account_baseline ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own account baseline" ON public.account_baseline FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER update_account_baseline_updated_at BEFORE UPDATE ON public.account_baseline FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();