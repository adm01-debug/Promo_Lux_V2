
-- 1) Coluna sla_seconds (nullable) nas três filas
ALTER TABLE public.instagram_scrape_queue ADD COLUMN IF NOT EXISTS sla_seconds INT;
ALTER TABLE public.scrape_queue           ADD COLUMN IF NOT EXISTS sla_seconds INT;
ALTER TABLE public.web_scrape_queue       ADD COLUMN IF NOT EXISTS sla_seconds INT;

CREATE INDEX IF NOT EXISTS idx_ig_queue_sla   ON public.instagram_scrape_queue(sla_seconds) WHERE sla_seconds IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sq_queue_sla   ON public.scrape_queue(sla_seconds)           WHERE sla_seconds IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ws_queue_sla   ON public.web_scrape_queue(sla_seconds)       WHERE sla_seconds IS NOT NULL;

-- 2) Função de backoff sensível ao SLA
-- Faixas (do auto-tuner):
--   curto  (<=60s):  base 2s,  cap 30s
--   médio  (61..300):base 5s,  cap 120s
--   longo  (>300):   base 20s, cap 600s
-- Backoff exponencial com jitter determinístico leve.
CREATE OR REPLACE FUNCTION public.compute_sla_backoff(
  p_sla_seconds INT,
  p_attempt     INT
) RETURNS INTERVAL
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_base INT;
  v_cap  INT;
  v_attempt INT := GREATEST(COALESCE(p_attempt, 1), 1);
  v_delay INT;
BEGIN
  IF p_sla_seconds IS NULL OR p_sla_seconds <= 60 THEN
    v_base := 2;  v_cap := 30;
  ELSIF p_sla_seconds <= 300 THEN
    v_base := 5;  v_cap := 120;
  ELSE
    v_base := 20; v_cap := 600;
  END IF;

  -- exp backoff: base * 2^(attempt-1), com teto = cap
  v_delay := LEAST(v_cap, v_base * (1 << LEAST(v_attempt - 1, 10)));
  -- jitter determinístico de +/- 20% baseado em attempt
  v_delay := v_delay + ((v_delay / 5) * ((v_attempt % 3) - 1));
  v_delay := GREATEST(v_delay, 1);
  RETURN make_interval(secs => v_delay);
END;
$$;

REVOKE ALL ON FUNCTION public.compute_sla_backoff(INT, INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.compute_sla_backoff(INT, INT) TO service_role;

-- 3) Reaper com stale threshold e requeue sensíveis ao SLA
CREATE OR REPLACE FUNCTION public.reap_stuck_queue_tasks(
  p_stale_after_seconds INT DEFAULT 900
)
RETURNS public.qa_reaper_runs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_started TIMESTAMPTZ := clock_timestamp();
  v_ig_requeued INT := 0;
  v_ig_dead INT := 0;
  v_sq_requeued INT := 0;
  v_sq_dead INT := 0;
  v_ws_requeued INT := 0;
  v_ws_dead INT := 0;
  v_row public.qa_reaper_runs;
BEGIN
  -- Um item é "travado" se locked_at < now() - stale_threshold(row),
  -- onde stale_threshold = clamp(coalesce(sla*3, p_stale_after_seconds), 120s, 4h).
  -- Isso evita reaper prematuro de tarefas longas (fonte dos warnings de runtime)
  -- sem deixar tarefas curtas presas por 15 min.

  -- --- Instagram ---
  WITH stuck AS (
    SELECT id, attempt, max_attempts, sla_seconds
      FROM public.instagram_scrape_queue
     WHERE status = 'running'
       AND locked_at IS NOT NULL
       AND locked_at < now() - make_interval(
             secs => LEAST(14400, GREATEST(120,
                       COALESCE(sla_seconds * 3, p_stale_after_seconds)))
           )
     FOR UPDATE SKIP LOCKED
  ),
  dead AS (
    UPDATE public.instagram_scrape_queue q
       SET status = 'dead',
           locked_at = NULL, locked_by = NULL,
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
           locked_at = NULL, locked_by = NULL,
           next_run_at = now() + public.compute_sla_backoff(s.sla_seconds, s.attempt + 1),
           last_error = COALESCE(NULLIF(q.last_error, ''), '') ||
                        CASE WHEN q.last_error IS NOT NULL AND q.last_error <> '' THEN ' | ' ELSE '' END ||
                        '[reaper] requeued (SLA-aware backoff)',
           updated_at = now()
      FROM stuck s
     WHERE q.id = s.id AND s.attempt < s.max_attempts
     RETURNING q.id
  )
  SELECT (SELECT count(*) FROM requeue), (SELECT count(*) FROM dead)
    INTO v_ig_requeued, v_ig_dead;

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
    SELECT id, attempts, max_attempts, sla_seconds
      FROM public.scrape_queue
     WHERE status = 'processing'
       AND locked_at IS NOT NULL
       AND locked_at < now() - make_interval(
             secs => LEAST(14400, GREATEST(120,
                       COALESCE(sla_seconds * 3, p_stale_after_seconds)))
           )
     FOR UPDATE SKIP LOCKED
  ),
  dead AS (
    UPDATE public.scrape_queue q
       SET status = 'dead',
           locked_at = NULL, locked_by = NULL,
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
           locked_at = NULL, locked_by = NULL,
           next_run_at = now() + public.compute_sla_backoff(s.sla_seconds, s.attempts + 1),
           last_error = COALESCE(NULLIF(q.last_error, ''), '') ||
                        CASE WHEN q.last_error IS NOT NULL AND q.last_error <> '' THEN ' | ' ELSE '' END ||
                        '[reaper] requeued (SLA-aware backoff)',
           updated_at = now()
      FROM stuck s
     WHERE q.id = s.id AND s.attempts < s.max_attempts
     RETURNING q.id
  )
  SELECT (SELECT count(*) FROM requeue), (SELECT count(*) FROM dead)
    INTO v_sq_requeued, v_sq_dead;

  -- --- web_scrape_queue ---
  WITH stuck AS (
    SELECT id, attempts, max_attempts, sla_seconds
      FROM public.web_scrape_queue
     WHERE status = 'processing'
       AND locked_at IS NOT NULL
       AND locked_at < now() - make_interval(
             secs => LEAST(14400, GREATEST(120,
                       COALESCE(sla_seconds * 3, p_stale_after_seconds)))
           )
     FOR UPDATE SKIP LOCKED
  ),
  dead AS (
    UPDATE public.web_scrape_queue q
       SET status = 'dead',
           locked_at = NULL, locked_by = NULL,
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
           locked_at = NULL, locked_by = NULL,
           next_run_at = now() + public.compute_sla_backoff(s.sla_seconds, s.attempts + 1),
           last_error = COALESCE(NULLIF(q.last_error, ''), '') ||
                        CASE WHEN q.last_error IS NOT NULL AND q.last_error <> '' THEN ' | ' ELSE '' END ||
                        '[reaper] requeued (SLA-aware backoff)',
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
    scrape_requeued,    scrape_dead,
    web_requeued,       web_dead,
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
