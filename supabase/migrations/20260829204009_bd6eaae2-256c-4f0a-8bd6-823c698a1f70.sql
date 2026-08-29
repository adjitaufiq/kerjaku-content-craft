CREATE TABLE public.content_bank (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_number int NOT NULL UNIQUE,
  title text NOT NULL DEFAULT '',
  prompt text NOT NULL DEFAULT '',
  caption text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.content_bank TO anon, authenticated;
GRANT ALL ON public.content_bank TO service_role;
ALTER TABLE public.content_bank ENABLE ROW LEVEL SECURITY;
CREATE POLICY "content_bank open access" ON public.content_bank FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.content_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_number int NOT NULL,
  title text NOT NULL DEFAULT '',
  image_url text,
  caption text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'draft',
  ig_creation_id text,
  ig_post_id text,
  error_message text,
  scheduled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX content_logs_number_idx ON public.content_logs (content_number);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.content_logs TO anon, authenticated;
GRANT ALL ON public.content_logs TO service_role;
ALTER TABLE public.content_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "content_logs open access" ON public.content_logs FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);