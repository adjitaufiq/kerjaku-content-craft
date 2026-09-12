ALTER TABLE public.viral_intelligence
  ADD COLUMN IF NOT EXISTS save_trigger text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS share_trigger text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS comment_trigger text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS hook_category text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS structure_category text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS trigger_category text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS confidence_score numeric NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS viral_intelligence_hook_category_idx ON public.viral_intelligence (hook_category);
CREATE INDEX IF NOT EXISTS viral_intelligence_structure_category_idx ON public.viral_intelligence (structure_category);