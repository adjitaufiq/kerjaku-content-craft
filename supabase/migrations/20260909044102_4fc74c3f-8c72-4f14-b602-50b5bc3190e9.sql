CREATE TYPE public.viral_workflow_status AS ENUM ('draft','analyzing','analyzed','revision_needed','approved','ready_production','published');
CREATE TYPE public.viral_analysis_status AS ENUM ('not_started','queued','in_progress','completed','failed');
CREATE TYPE public.generated_content_type AS ENUM ('carousel','photo_to_video','video_content');

CREATE TABLE public.viral_content_references (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_platform text NOT NULL DEFAULT 'instagram',
  source_url text,
  uploaded_file text,
  title text NOT NULL DEFAULT '',
  category text,
  status public.viral_workflow_status NOT NULL DEFAULT 'draft',
  content_analysis_status public.viral_analysis_status NOT NULL DEFAULT 'not_started',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.viral_content_references TO authenticated;
GRANT ALL ON public.viral_content_references TO service_role;
ALTER TABLE public.viral_content_references ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own viral references" ON public.viral_content_references
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER update_viral_content_references_updated_at BEFORE UPDATE ON public.viral_content_references
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_viral_refs_user_created ON public.viral_content_references (user_id, created_at DESC);

CREATE TABLE public.generated_content_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_id uuid NOT NULL REFERENCES public.viral_content_references(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content_title text NOT NULL DEFAULT '',
  content_type public.generated_content_type NOT NULL DEFAULT 'carousel',
  status public.viral_workflow_status NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.generated_content_drafts TO authenticated;
GRANT ALL ON public.generated_content_drafts TO service_role;
ALTER TABLE public.generated_content_drafts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own generated drafts" ON public.generated_content_drafts
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER update_generated_content_drafts_updated_at BEFORE UPDATE ON public.generated_content_drafts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_generated_drafts_ref ON public.generated_content_drafts (reference_id, created_at DESC);