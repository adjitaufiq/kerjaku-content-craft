-- PREPARED ONLY. Apply after 001 and 002, backup evidence and explicit production approval.
-- Re-running this function-only migration is safe; it never backfills or deletes rows.
BEGIN;
CREATE OR REPLACE FUNCTION public.craft_renew_lease(task_id uuid,worker text)
RETURNS timestamptz LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE renewed timestamptz;
BEGIN
  -- Lock campaign before task, so cancellation and renewal cannot cross silently.
  PERFORM c.id FROM public.craft_campaigns c JOIN public.craft_tasks t ON t.campaign_id=c.id
    WHERE t.id=task_id AND c.state IN ('queued','running') FOR UPDATE OF c;
  IF NOT FOUND THEN RETURN NULL; END IF;
  UPDATE public.craft_tasks t SET lease_until=clock_timestamp()+interval '30 minutes',updated_at=clock_timestamp()
    WHERE t.id=task_id AND t.state='running' AND t.lease_owner=worker
      AND t.lease_until>clock_timestamp()
    RETURNING t.lease_until INTO renewed;
  RETURN renewed;
END $$;
REVOKE ALL ON FUNCTION public.craft_renew_lease(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.craft_renew_lease(uuid,text) TO service_role;
COMMIT;