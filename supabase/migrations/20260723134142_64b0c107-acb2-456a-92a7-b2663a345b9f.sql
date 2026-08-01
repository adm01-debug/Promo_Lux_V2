
-- ============================================================================
-- Rodada #39 · G1 — Prioridade na fila Instagram
-- ============================================================================
ALTER TABLE public.instagram_scrape_queue
  ADD COLUMN IF NOT EXISTS priority INTEGER NOT NULL DEFAULT 0;

DROP INDEX IF EXISTS public.idx_ig_queue_status_next;
CREATE INDEX IF NOT EXISTS idx_ig_queue_due
  ON public.instagram_scrape_queue (status, next_run_at, priority DESC)
  WHERE status IN ('queued', 'running');

CREATE OR REPLACE FUNCTION public.claim_instagram_job(
  p_worker_id text,
  p_batch_size integer DEFAULT 1
)
RETURNS SETOF public.instagram_scrape_queue
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  UPDATE public.instagram_scrape_queue q
  SET status = 'running',
      locked_at = now(),
      locked_by = p_worker_id,
      attempt = q.attempt + 1,
      updated_at = now()
  WHERE q.id IN (
    SELECT id FROM public.instagram_scrape_queue
    WHERE status = 'queued'
      AND next_run_at <= now()
    ORDER BY priority DESC, next_run_at ASC
    LIMIT p_batch_size
    FOR UPDATE SKIP LOCKED
  )
  RETURNING q.*;
END;
$function$;
