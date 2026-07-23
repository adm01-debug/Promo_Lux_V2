
-- ============================================================================
-- Rodada #39 · G4 — Consistência: attempts sempre incrementa no claim
-- claim_scrape_tasks era a única exceção (não incrementava).
-- ============================================================================
CREATE OR REPLACE FUNCTION public.claim_scrape_tasks(
  _limit integer DEFAULT 5,
  _worker text DEFAULT 'worker'::text
)
RETURNS SETOF public.scrape_queue
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION 'Somente o worker do sistema pode reservar tarefas';
  END IF;

  RETURN QUERY
  WITH due AS (
    SELECT q.id
    FROM public.scrape_queue q
    WHERE q.status = 'queued' AND q.next_run_at <= now()
    ORDER BY q.priority DESC, q.next_run_at ASC
    LIMIT GREATEST(_limit, 1)
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.scrape_queue q
     SET status = 'processing',
         locked_at = now(),
         locked_by = _worker,
         attempts = q.attempts + 1,
         updated_at = now()
    FROM due
   WHERE q.id = due.id
  RETURNING q.*;
END;
$function$;
