CREATE TABLE public.photo_to_video_packages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  version_id UUID NOT NULL UNIQUE,
  source_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'NOT_GENERATED',
  default_duration INTEGER NOT NULL DEFAULT 8,
  scene_count INTEGER NOT NULL DEFAULT 0,
  package JSONB NOT NULL DEFAULT '{}'::jsonb,
  scenes JSONB NOT NULL DEFAULT '[]'::jsonb,
  validation JSONB NOT NULL DEFAULT '{}'::jsonb,
  model TEXT NOT NULL DEFAULT '',
  approved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.photo_to_video_packages TO authenticated;
GRANT ALL ON public.photo_to_video_packages TO service_role;

ALTER TABLE public.photo_to_video_packages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own photo to video packages"
ON public.photo_to_video_packages FOR ALL TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_photo_to_video_version ON public.photo_to_video_packages (version_id);

CREATE TRIGGER update_photo_to_video_packages_updated_at
BEFORE UPDATE ON public.photo_to_video_packages
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();