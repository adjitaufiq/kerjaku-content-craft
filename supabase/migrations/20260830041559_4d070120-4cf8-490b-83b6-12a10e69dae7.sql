
-- Roles
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own roles"
ON public.user_roles FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

-- Secure runtime credential store (service role only)
CREATE TABLE public.meta_credentials (
  id text PRIMARY KEY DEFAULT 'default',
  token_ciphertext text NOT NULL,
  token_fingerprint text NOT NULL,
  ig_account_id text,
  token_type text NOT NULL DEFAULT 'long_lived_user_token',
  scopes text[] NOT NULL DEFAULT '{}',
  app_id text,
  status text NOT NULL DEFAULT 'active',
  expires_in_exact boolean NOT NULL DEFAULT false,
  token_created_at timestamptz NOT NULL DEFAULT now(),
  token_expires_at timestamptz NOT NULL,
  token_last_updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  version integer NOT NULL DEFAULT 1
);

-- No grants for anon/authenticated: only the service role may touch raw tokens.
GRANT ALL ON public.meta_credentials TO service_role;
ALTER TABLE public.meta_credentials ENABLE ROW LEVEL SECURITY;
