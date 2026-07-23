
CREATE OR REPLACE FUNCTION public.claim_instagram_tasks(
  _organization_id uuid DEFAULT NULL,
  _limit integer DEFAULT 6,
  _worker text DEFAULT 'ig-worker'
)
RETURNS SETOF public.instagram_scrape_queue
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_limit integer := LEAST(GREATEST(COALESCE(_limit, 6), 1), 6);
BEGIN
  IF auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION 'Somente o worker do sistema pode reservar tarefas do Instagram';
  END IF;

  RETURN QUERY
  UPDATE public.instagram_scrape_queue q
  SET status     = 'running',
      locked_at  = now(),
      locked_by  = _worker,
      attempt    = q.attempt + 1,
      updated_at = now()
  WHERE q.id IN (
    SELECT id
    FROM public.instagram_scrape_queue
    WHERE status = 'queued'
      AND next_run_at <= now()
      AND (_organization_id IS NULL OR organization_id = _organization_id)
    ORDER BY next_run_at ASC
    LIMIT v_limit
    FOR UPDATE SKIP LOCKED
  )
  RETURNING q.*;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_instagram_tasks(uuid, integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_instagram_tasks(uuid, integer, text) TO service_role;
