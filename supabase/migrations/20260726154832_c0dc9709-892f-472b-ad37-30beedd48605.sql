-- Rodada #41 · Escalonamento EDF (Earliest Deadline First) sensível a SLA
CREATE OR REPLACE FUNCTION public.sla_deadline(_created_at timestamptz, _sla_seconds integer)
RETURNS timestamptz
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT COALESCE(_created_at, now()) + make_interval(secs => GREATEST(COALESCE(_sla_seconds, 600), 30));
$$;

REVOKE ALL ON FUNCTION public.sla_deadline(timestamptz, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sla_deadline(timestamptz, integer) TO authenticated, service_role;

CREATE INDEX IF NOT EXISTS idx_scrape_queue_sla_due
  ON public.scrape_queue (status, next_run_at, created_at, sla_seconds);
CREATE INDEX IF NOT EXISTS idx_web_scrape_queue_sla_due
  ON public.web_scrape_queue (status, next_run_at, created_at, sla_seconds);
CREATE INDEX IF NOT EXISTS idx_ig_queue_sla_due
  ON public.instagram_scrape_queue (status, next_run_at, created_at, sla_seconds);

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
    ORDER BY
      (public.sla_deadline(q.created_at, q.sla_seconds) <= now() + interval '30 seconds') DESC,
      q.priority DESC,
      public.sla_deadline(q.created_at, q.sla_seconds) ASC,
      q.next_run_at ASC
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

CREATE OR REPLACE FUNCTION public.claim_web_scrape_tasks(
  _limit integer DEFAULT 8,
  _worker text DEFAULT 'web-worker'::text
)
RETURNS SETOF public.web_scrape_queue
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
    SELECT q.id FROM public.web_scrape_queue q
    WHERE q.status = 'queued' AND q.next_run_at <= now()
    ORDER BY
      (public.sla_deadline(q.created_at, q.sla_seconds) <= now() + interval '30 seconds') DESC,
      q.priority DESC,
      public.sla_deadline(q.created_at, q.sla_seconds) ASC,
      q.next_run_at ASC
    LIMIT GREATEST(_limit, 1) FOR UPDATE SKIP LOCKED
  )
  UPDATE public.web_scrape_queue q
  SET status = 'processing', locked_at = now(), locked_by = _worker,
      attempts = q.attempts + 1, updated_at = now()
  FROM due WHERE q.id = due.id
  RETURNING q.*;
END;
$function$;

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
               ORDER BY
                 (public.sla_deadline(created_at, sla_seconds) <= now() + interval '30 seconds') DESC,
                 priority DESC,
                 public.sla_deadline(created_at, sla_seconds) ASC
             ) AS org_rank,
             priority,
             next_run_at,
             (public.sla_deadline(created_at, sla_seconds) <= now() + interval '30 seconds') AS breaching,
             public.sla_deadline(created_at, sla_seconds) AS deadline
        FROM public.instagram_scrape_queue
       WHERE status = 'queued'
         AND next_run_at <= now()
       FOR UPDATE SKIP LOCKED
    ) ranked
    ORDER BY breaching DESC, org_rank ASC, priority DESC, deadline ASC
    LIMIT p_batch_size
  )
  RETURNING q.*;
END;
$function$;

CREATE OR REPLACE FUNCTION public.claim_instagram_tasks(
  _organization_id uuid DEFAULT NULL::uuid,
  _limit integer DEFAULT 6,
  _worker text DEFAULT 'ig-worker'::text
)
RETURNS SETOF public.instagram_scrape_queue
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
    ORDER BY
      (public.sla_deadline(created_at, sla_seconds) <= now() + interval '30 seconds') DESC,
      priority DESC,
      public.sla_deadline(created_at, sla_seconds) ASC,
      next_run_at ASC
    LIMIT v_limit
    FOR UPDATE SKIP LOCKED
  )
  RETURNING q.*;
END;
$function$;