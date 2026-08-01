
-- ============================================================================
-- Rodada #39 · G3 — Fairness round-robin no claim do Instagram
-- Estratégia: dentro do batch, rankeia tarefas por organization_id (rank
-- crescente = mais antigas primeiro DENTRO da org) e ordena globalmente por
-- (rank_no_org ASC, priority DESC, next_run_at ASC). Isso garante que cada
-- organização receba pelo menos 1 tarefa antes de uma org dar 2 saídas.
-- ============================================================================

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
    SELECT id FROM (
      SELECT id,
             row_number() OVER (
               PARTITION BY organization_id
               ORDER BY priority DESC, next_run_at ASC
             ) AS org_rank,
             priority,
             next_run_at
        FROM public.instagram_scrape_queue
       WHERE status = 'queued'
         AND next_run_at <= now()
       FOR UPDATE SKIP LOCKED
    ) ranked
    ORDER BY org_rank ASC, priority DESC, next_run_at ASC
    LIMIT p_batch_size
  )
  RETURNING q.*;
END;
$function$;
