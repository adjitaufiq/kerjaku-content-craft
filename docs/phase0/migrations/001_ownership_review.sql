-- PREPARED ONLY. Database paused: do not apply until backup + inventory are verified.
-- This staging migration does not assign historical content to an arbitrary administrator.
BEGIN;
CREATE TABLE public.phase0_ownership_manifest (
  resource_table text NOT NULL,
  resource_id text NOT NULL,
  user_id uuid NOT NULL,
  evidence text NOT NULL,
  reviewed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(resource_table, resource_id)
);
GRANT ALL ON public.phase0_ownership_manifest TO service_role;
ALTER TABLE public.phase0_ownership_manifest ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.phase0_ownership_manifest FROM anon, authenticated;

CREATE TABLE public.phase0_asset_manifest (
  bucket_id text NOT NULL,
  object_path text NOT NULL,
  user_id uuid NOT NULL,
  evidence text NOT NULL,
  reviewed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(bucket_id, object_path)
);
GRANT ALL ON public.phase0_asset_manifest TO service_role;
ALTER TABLE public.phase0_asset_manifest ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.phase0_asset_manifest FROM anon, authenticated;
COMMIT;
