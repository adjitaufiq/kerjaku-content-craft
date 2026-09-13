CREATE TABLE public.video_storyboards (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  version_id uuid NOT NULL UNIQUE REFERENCES public.kerjaku_versions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  atm_mode public.atm_mode NOT NULL,
  video_concept jsonb NOT NULL DEFAULT '{}'::jsonb,
  scenes jsonb NOT NULL DEFAULT '[]'::jsonb,
  video_package jsonb NOT NULL DEFAULT '{}'::jsonb,
  scene_count integer NOT NULL DEFAULT 0,
  total_duration integer NOT NULL DEFAULT 0,
  model text NOT NULL DEFAULT '',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.video_storyboards TO authenticated;
GRANT ALL ON public.video_storyboards TO service_role;

ALTER TABLE public.video_storyboards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own video storyboards"
ON public.video_storyboards FOR ALL TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_video_storyboards_updated_at
BEFORE UPDATE ON public.video_storyboards
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_video_storyboards_user ON public.video_storyboards(user_id, created_at DESC);