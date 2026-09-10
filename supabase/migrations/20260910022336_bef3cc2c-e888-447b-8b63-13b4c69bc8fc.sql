CREATE TYPE public.atm_mode AS ENUM ('conservative','creative');
CREATE TYPE public.atm_version_status AS ENUM ('draft','pending_approval','approved','rejected');

CREATE TABLE public.viral_intelligence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid NOT NULL UNIQUE REFERENCES public.viral_sources(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  hook text NOT NULL DEFAULT '',
  hook_type text NOT NULL DEFAULT '',
  hook_reason text NOT NULL DEFAULT '',
  pattern_interrupt text NOT NULL DEFAULT '',
  psychological_trigger text NOT NULL DEFAULT '',
  curiosity_gap text NOT NULL DEFAULT '',
  power_words text[] NOT NULL DEFAULT '{}'::text[],
  structure_type text NOT NULL DEFAULT '',
  story_beats jsonb NOT NULL DEFAULT '[]'::jsonb,
  retention_factor text NOT NULL DEFAULT '',
  engagement_factor text NOT NULL DEFAULT '',
  evidence jsonb NOT NULL DEFAULT '[]'::jsonb,
  model text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.viral_intelligence TO authenticated;
GRANT ALL ON public.viral_intelligence TO service_role;
ALTER TABLE public.viral_intelligence ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own viral intelligence" ON public.viral_intelligence FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_viral_intelligence_source ON public.viral_intelligence(source_id);
CREATE TRIGGER update_viral_intelligence_updated_at BEFORE UPDATE ON public.viral_intelligence FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.kerjaku_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid NOT NULL REFERENCES public.viral_sources(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  atm_mode public.atm_mode NOT NULL DEFAULT 'conservative',
  angle text NOT NULL DEFAULT '',
  source_mapping jsonb NOT NULL DEFAULT '{}'::jsonb,
  adaptation jsonb NOT NULL DEFAULT '{}'::jsonb,
  reason text NOT NULL DEFAULT '',
  brand_profile_version text NOT NULL DEFAULT '',
  status public.atm_version_status NOT NULL DEFAULT 'pending_approval',
  approved_at timestamptz,
  approval_note text NOT NULL DEFAULT '',
  model text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kerjaku_versions TO authenticated;
GRANT ALL ON public.kerjaku_versions TO service_role;
ALTER TABLE public.kerjaku_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own kerjaku versions" ON public.kerjaku_versions FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_kerjaku_versions_source ON public.kerjaku_versions(source_id);
CREATE TRIGGER update_kerjaku_versions_updated_at BEFORE UPDATE ON public.kerjaku_versions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.brand_profile (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  brand_name text NOT NULL DEFAULT '@kerjaku.space',
  positioning text NOT NULL DEFAULT '',
  audience text NOT NULL DEFAULT '',
  tone_of_voice text NOT NULL DEFAULT '',
  mission text NOT NULL DEFAULT '',
  version text NOT NULL DEFAULT 'v1',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.brand_profile TO authenticated;
GRANT ALL ON public.brand_profile TO service_role;
ALTER TABLE public.brand_profile ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own brand profile" ON public.brand_profile FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER update_brand_profile_updated_at BEFORE UPDATE ON public.brand_profile FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.brand_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  benefit text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.brand_products TO authenticated;
GRANT ALL ON public.brand_products TO service_role;
ALTER TABLE public.brand_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own brand products" ON public.brand_products FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER update_brand_products_updated_at BEFORE UPDATE ON public.brand_products FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.brand_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rule text NOT NULL DEFAULT '',
  rule_type text NOT NULL DEFAULT 'do',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.brand_rules TO authenticated;
GRANT ALL ON public.brand_rules TO service_role;
ALTER TABLE public.brand_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own brand rules" ON public.brand_rules FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER update_brand_rules_updated_at BEFORE UPDATE ON public.brand_rules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.brand_power_words (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  word text NOT NULL DEFAULT '',
  context text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.brand_power_words TO authenticated;
GRANT ALL ON public.brand_power_words TO service_role;
ALTER TABLE public.brand_power_words ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own brand power words" ON public.brand_power_words FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER update_brand_power_words_updated_at BEFORE UPDATE ON public.brand_power_words FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();