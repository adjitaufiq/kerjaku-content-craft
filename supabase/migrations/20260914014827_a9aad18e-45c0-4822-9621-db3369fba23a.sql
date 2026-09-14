ALTER TYPE public.viral_source_status ADD VALUE IF NOT EXISTS 'ready_for_prompt_generation';
ALTER TABLE public.kerjaku_versions
  ADD COLUMN IF NOT EXISTS hook_candidates jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS selected_hook jsonb,
  ADD COLUMN IF NOT EXISTS hook_selected_at timestamptz;