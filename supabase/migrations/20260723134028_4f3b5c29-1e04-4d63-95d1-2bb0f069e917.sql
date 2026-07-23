
-- ============================================================================
-- Rodada #39 · G2 — Reaper de tarefas travadas nas filas
-- Recupera tarefas que ficaram em running/processing após crash de worker.
-- ============================================================================

-- 1) Log de execuções do reaper (observabilidade)
CREATE TABLE IF NOT EXISTS public.qa_reaper_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ran_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  stale_after_seconds INT NOT NULL,
  instagram_requeued INT NOT NULL DEFAULT 0,
  instagram_dead INT NOT NULL DEFAULT 0,
  scrape_requeued INT NOT NULL DEFAULT 0,
  scrape_dead INT NOT NULL DEFAULT 0,
  web_requeued INT NOT NULL DEFAULT 0,
  web_dead INT NOT NULL DEFAULT 0,
  duration_ms INT
);

GRANT SELECT ON public.qa_reaper_runs TO authenticated;
GRANT ALL ON public.qa_reaper_runs TO service_role;

ALTER TABLE public.qa_reaper_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated can read reaper runs"
  ON public.qa_reaper_runs FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "service_role manages reaper runs"
  ON public.qa_reaper_runs FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_qa_reaper_runs_ran_at
  ON public.qa_reaper_runs (ran_at DESC);

-- 2) Função reaper — service_role only
CREATE OR REPLACE FUNCTION public.reap_stuck_queue_tasks(
  p_stale_after_seconds INT DEFAULT 900  -- 15 min default
)
RETURNS public.qa_reaper_runs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_started TIMESTAMPTZ := clock_timestamp();
  v_threshold TIMESTAMPTZ := now() - make_interval(secs => p_stale_after_seconds);
  v_ig_requeued INT := 0;
  v_ig_dead INT := 0;
  v_sq_requeued INT := 0;
  v_sq_dead INT := 0;
  v_ws_requeued INT := 0;
  v_ws_dead INT := 0;
  v_row public.qa_reaper_runs;
BEGIN
  -- --- Instagram ---
  WITH stuck AS (
    SELECT id, attempt, max_attempts
    FROM public.instagram_scrape_queue
    WHERE status = 'running'
      AND locked_at IS NOT NULL
      AND locked_at < v_threshold
    FOR UPDATE SKIP LOCKED
  ),
  dead AS (
    UPDATE public.instagram_scrape_queue q
       SET status = 'dead',
           locked_at = NULL,
           locked_by = NULL,
           last_error = COALESCE(NULLIF(q.last_error, ''), '') ||
                        CASE WHEN q.last_error IS NOT NULL AND q.last_error <> '' THEN ' | ' ELSE '' END ||
                        '[reaper] worker timeout — exceeded max_attempts',
           updated_at = now()
      FROM stuck s
     WHERE q.id = s.id AND s.attempt >= s.max_attempts
     RETURNING q.id
  ),
  requeue AS (
    UPDATE public.instagram_scrape_queue q
       SET status = 'queued',
           locked_at = NULL,
           locked_by = NULL,
           next_run_at = now(),
           last_error = COALESCE(NULLIF(q.last_error, ''), '') ||
                        CASE WHEN q.last_error IS NOT NULL AND q.last_error <> '' THEN ' | ' ELSE '' END ||
                        '[reaper] requeued after worker timeout',
           updated_at = now()
      FROM stuck s
     WHERE q.id = s.id AND s.attempt < s.max_attempts
     RETURNING q.id
  )
  SELECT (SELECT count(*) FROM requeue), (SELECT count(*) FROM dead)
    INTO v_ig_requeued, v_ig_dead;

  -- Insere DLQ para dead instagram
  INSERT INTO public.instagram_scrape_dead_letter (
    queue_id, organization_id, target_type, target_value, params,
    attempts, last_error, error_class
  )
  SELECT q.id, q.organization_id, q.target_type, q.target_value, q.params,
         q.attempt, COALESCE(q.last_error, '[reaper] worker timeout'), 'reaper_timeout'
    FROM public.instagram_scrape_queue q
   WHERE q.status = 'dead'
     AND q.updated_at >= v_started
     AND NOT EXISTS (
       SELECT 1 FROM public.instagram_scrape_dead_letter d WHERE d.queue_id = q.id
     );

  -- --- scrape_queue (legado) ---
  WITH stuck AS (
    SELECT id, attempts, max_attempts
    FROM public.scrape_queue
    WHERE status = 'processing'
      AND locked_at IS NOT NULL
      AND locked_at < v_threshold
    FOR UPDATE SKIP LOCKED
  ),
  dead AS (
    UPDATE public.scrape_queue q
       SET status = 'dead',
           locked_at = NULL,
           locked_by = NULL,
           last_error = COALESCE(NULLIF(q.last_error, ''), '') ||
                        CASE WHEN q.last_error IS NOT NULL AND q.last_error <> '' THEN ' | ' ELSE '' END ||
                        '[reaper] worker timeout — exceeded max_attempts',
           updated_at = now()
      FROM stuck s
     WHERE q.id = s.id AND s.attempts >= s.max_attempts
     RETURNING q.id
  ),
  requeue AS (
    UPDATE public.scrape_queue q
       SET status = 'queued',
           locked_at = NULL,
           locked_by = NULL,
           next_run_at = now(),
           last_error = COALESCE(NULLIF(q.last_error, ''), '') ||
                        CASE WHEN q.last_error IS NOT NULL AND q.last_error <> '' THEN ' | ' ELSE '' END ||
                        '[reaper] requeued after worker timeout',
           updated_at = now()
      FROM stuck s
     WHERE q.id = s.id AND s.attempts < s.max_attempts
     RETURNING q.id
  )
  SELECT (SELECT count(*) FROM requeue), (SELECT count(*) FROM dead)
    INTO v_sq_requeued, v_sq_dead;

  -- --- web_scrape_queue ---
  WITH stuck AS (
    SELECT id, attempts, max_attempts
    FROM public.web_scrape_queue
    WHERE status = 'processing'
      AND locked_at IS NOT NULL
      AND locked_at < v_threshold
    FOR UPDATE SKIP LOCKED
  ),
  dead AS (
    UPDATE public.web_scrape_queue q
       SET status = 'dead',
           locked_at = NULL,
           locked_by = NULL,
           last_error = COALESCE(NULLIF(q.last_error, ''), '') ||
                        CASE WHEN q.last_error IS NOT NULL AND q.last_error <> '' THEN ' | ' ELSE '' END ||
                        '[reaper] worker timeout — exceeded max_attempts',
           updated_at = now()
      FROM stuck s
     WHERE q.id = s.id AND s.attempts >= s.max_attempts
     RETURNING q.id
  ),
  requeue AS (
    UPDATE public.web_scrape_queue q
       SET status = 'queued',
           locked_at = NULL,
           locked_by = NULL,
           next_run_at = now(),
           last_error = COALESCE(NULLIF(q.last_error, ''), '') ||
                        CASE WHEN q.last_error IS NOT NULL AND q.last_error <> '' THEN ' | ' ELSE '' END ||
                        '[reaper] requeued after worker timeout',
           updated_at = now()
      FROM stuck s
     WHERE q.id = s.id AND s.attempts < s.max_attempts
     RETURNING q.id
  )
  SELECT (SELECT count(*) FROM requeue), (SELECT count(*) FROM dead)
    INTO v_ws_requeued, v_ws_dead;

  INSERT INTO public.qa_reaper_runs (
    stale_after_seconds,
    instagram_requeued, instagram_dead,
    scrape_requeued, scrape_dead,
    web_requeued, web_dead,
    duration_ms
  ) VALUES (
    p_stale_after_seconds,
    v_ig_requeued, v_ig_dead,
    v_sq_requeued, v_sq_dead,
    v_ws_requeued, v_ws_dead,
    EXTRACT(MILLISECOND FROM (clock_timestamp() - v_started))::INT
  )
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.reap_stuck_queue_tasks(INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reap_stuck_queue_tasks(INT) TO service_role;

-- 3) Agendamento a cada minuto (idempotente)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname='pg_cron') THEN
    PERFORM cron.unschedule(jobid)
      FROM cron.job WHERE jobname = 'reap-stuck-queue-tasks';
    PERFORM cron.schedule(
      'reap-stuck-queue-tasks',
      '* * * * *',
      $cron$ SELECT public.reap_stuck_queue_tasks(900); $cron$
    );
  END IF;
END $$;
