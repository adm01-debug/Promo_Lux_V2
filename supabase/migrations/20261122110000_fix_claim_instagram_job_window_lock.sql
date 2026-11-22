-- Corrige claim_instagram_job: FOR UPDATE SKIP LOCKED nao pode conviver com
-- window function na mesma subconsulta (Postgres: 0A000 "FOR UPDATE is not
-- allowed with window functions"). A funcao levantava erro em TODA chamada,
-- entao o worker do Instagram nunca reservava job.
--
-- Correcao: a trava (FOR UPDATE SKIP LOCKED) fica numa CTE materializada que
-- so faz SELECT ... LIMIT; a ordenacao por organizacao (row_number) roda numa
-- CTE separada, depois da trava. Mesma semantica de reserva, mesmo
-- ordenamento final; o CTE "travas" e materializado porque tem FOR UPDATE.

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
  WITH travas AS MATERIALIZED (
    SELECT q.id
      FROM public.instagram_scrape_queue q
     WHERE q.status = 'queued'
       AND q.next_run_at <= now()
     ORDER BY (public.sla_deadline(q.created_at, q.sla_seconds) <= now() + interval '30 seconds') DESC,
              q.priority DESC,
              public.sla_deadline(q.created_at, q.sla_seconds) ASC
     LIMIT GREATEST(p_batch_size, 1)
     FOR UPDATE SKIP LOCKED
  ),
  rankeados AS (
    SELECT t.id,
           row_number() OVER (
             PARTITION BY q.organization_id
             ORDER BY (public.sla_deadline(q.created_at, q.sla_seconds) <= now() + interval '30 seconds') DESC,
                      q.priority DESC,
                      public.sla_deadline(q.created_at, q.sla_seconds) ASC
           ) AS org_rank,
           (public.sla_deadline(q.created_at, q.sla_seconds) <= now() + interval '30 seconds') AS breaching,
           q.priority,
           public.sla_deadline(q.created_at, q.sla_seconds) AS deadline
      FROM travas t
      JOIN public.instagram_scrape_queue q ON q.id = t.id
  )
  UPDATE public.instagram_scrape_queue q
     SET status = 'running',
         locked_at = now(),
         locked_by = p_worker_id,
         attempt = q.attempt + 1,
         updated_at = now()
    FROM rankeados r
   WHERE q.id = r.id
  RETURNING q.*;
END;
$function$;