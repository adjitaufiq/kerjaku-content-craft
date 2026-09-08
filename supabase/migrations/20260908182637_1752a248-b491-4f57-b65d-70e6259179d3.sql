CREATE TABLE public.content_downloads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_platform text NOT NULL DEFAULT 'instagram',
  source_url text NOT NULL,
  creator_username text,
  content_type text NOT NULL DEFAULT 'reel',
  caption text NOT NULL DEFAULT '',
  thumbnail_url text,
  video_url text,
  thumbnail_path text,
  video_path text,
  resolution text,
  duration numeric,
  category text,
  notes text NOT NULL DEFAULT '',
  tags text[] NOT NULL DEFAULT '{}',
  is_favorite boolean NOT NULL DEFAULT false,
  hook_analysis text,
  content_structure text,
  cta_analysis text,
  editing_style text,
  audience_type text,
  viral_pattern text,
  status text NOT NULL DEFAULT 'processing',
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.content_downloads TO authenticated;
GRANT ALL ON public.content_downloads TO service_role;

ALTER TABLE public.content_downloads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users manage content downloads"
ON public.content_downloads FOR ALL TO authenticated
USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$
LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_content_downloads_updated_at
BEFORE UPDATE ON public.content_downloads
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX content_downloads_created_at_idx ON public.content_downloads (created_at DESC);