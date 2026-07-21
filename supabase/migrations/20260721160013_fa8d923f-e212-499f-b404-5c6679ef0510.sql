
-- Melhoria #1: Adaptive polling do scrape-queue-worker
-- Reduz invocações ociosas via backoff exponencial quando a fila está vazia.

CREATE TABLE IF NOT EXISTS public.scrape_worker_state (
  worker_name TEXT PRIMARY KEY,
  next_run_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  consecutive_empty_batches INT NOT NULL DEFAULT 0,
  last_batch_size INT NOT NULL DEFAULT 0,
  last_run_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.scrape_worker_state TO authenticated;
GRANT ALL ON public.scrape_worker_state TO service_role;

ALTER TABLE public.scrape_worker_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "worker state readable by authenticated"
  ON public.scrape_worker_state
  FOR SELECT
  TO authenticated
  USING (true);

-- Backoff: 20s (base) → 40 → 80 → 160 (cap 300s).
-- Reset imediato quando batch tem trabalho.
CREATE OR REPLACE FUNCTION public.worker_should_run(_worker TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_next TIMESTAMPTZ;
BEGIN
  SELECT next_run_at INTO v_next
    FROM public.scrape_worker_state
   WHERE worker_name = _worker
   FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.scrape_worker_state(worker_name, next_run_at)
      VALUES (_worker, now())
      ON CONFLICT (worker_name) DO NOTHING;
    RETURN TRUE;
  END IF;

  RETURN now() >= v_next;
END;
$$;

CREATE OR REPLACE FUNCTION public.worker_report_batch(_worker TEXT, _size INT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empty INT;
  v_delay_secs INT;
BEGIN
  IF _size > 0 THEN
    UPDATE public.scrape_worker_state
       SET consecutive_empty_batches = 0,
           last_batch_size = _size,
           last_run_at = now(),
           next_run_at = now(),
           updated_at = now()
     WHERE worker_name = _worker;
  ELSE
    UPDATE public.scrape_worker_state
       SET consecutive_empty_batches = LEAST(consecutive_empty_batches + 1, 8),
           last_batch_size = 0,
           last_run_at = now(),
           updated_at = now()
     WHERE worker_name = _worker
     RETURNING consecutive_empty_batches INTO v_empty;

    -- 20s * 2^(n-1) capped at 300s
    v_delay_secs := LEAST(20 * POWER(2, GREATEST(v_empty - 1, 0))::INT, 300);
    UPDATE public.scrape_worker_state
       SET next_run_at = now() + (v_delay_secs || ' seconds')::INTERVAL
     WHERE worker_name = _worker;
  END IF;
END;
$$;

-- Restrito: só service_role (worker) e authenticated (leitura em dashboards).
REVOKE ALL ON FUNCTION public.worker_should_run(TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.worker_report_batch(TEXT, INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.worker_should_run(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.worker_report_batch(TEXT, INT) TO service_role;
