ALTER TABLE public.source_extractions
  ADD COLUMN IF NOT EXISTS completeness_score numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS coverage_score numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS source_confidence numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS report_confidence numeric NOT NULL DEFAULT 0;