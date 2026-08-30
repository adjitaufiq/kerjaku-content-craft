CREATE TABLE public.meta_token_meta (
  id text PRIMARY KEY DEFAULT 'default',
  token_fingerprint text NOT NULL,
  token_type text NOT NULL DEFAULT 'long_lived_user_token',
  token_created_at timestamptz NOT NULL DEFAULT now(),
  token_expires_at timestamptz NOT NULL,
  token_last_updated_at timestamptz NOT NULL DEFAULT now(),
  expires_in_exact boolean NOT NULL DEFAULT false,
  meta_expires_in_seconds bigint,
  last_checked_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.meta_token_meta TO anon;
GRANT SELECT ON public.meta_token_meta TO authenticated;
GRANT ALL ON public.meta_token_meta TO service_role;

ALTER TABLE public.meta_token_meta ENABLE ROW LEVEL SECURITY;

CREATE POLICY "meta_token_meta readable" ON public.meta_token_meta FOR SELECT TO anon, authenticated USING (true);