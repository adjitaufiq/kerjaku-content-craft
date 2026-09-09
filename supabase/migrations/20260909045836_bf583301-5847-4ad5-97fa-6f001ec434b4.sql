CREATE TABLE public.viral_analysis_reports (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  reference_id uuid NOT NULL REFERENCES public.viral_content_references(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content_summary text NOT NULL DEFAULT '',
  main_topic text NOT NULL DEFAULT '',
  content_category text NOT NULL DEFAULT '',
  storytelling_style text NOT NULL DEFAULT '',
  emotional_angle text NOT NULL DEFAULT '',
  hook_formula text NOT NULL DEFAULT '',
  pattern_interrupt text NOT NULL DEFAULT '',
  psychological_trigger text NOT NULL DEFAULT '',
  curiosity_gap text NOT NULL DEFAULT '',
  power_word text NOT NULL DEFAULT '',
  why_this_works text NOT NULL DEFAULT '',
  audience text NOT NULL DEFAULT '',
  problem text NOT NULL DEFAULT '',
  solution text NOT NULL DEFAULT '',
  modification_ideas text NOT NULL DEFAULT '',
  model text NOT NULL DEFAULT '',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (reference_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.viral_analysis_reports TO authenticated;
GRANT ALL ON public.viral_analysis_reports TO service_role;

ALTER TABLE public.viral_analysis_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own viral analysis reports"
ON public.viral_analysis_reports FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_viral_analysis_reports_reference ON public.viral_analysis_reports(reference_id);

CREATE TRIGGER update_viral_analysis_reports_updated_at
BEFORE UPDATE ON public.viral_analysis_reports
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();