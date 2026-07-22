
-- 1) Tabela de snapshots
CREATE TABLE IF NOT EXISTS public.pg_net_health_snapshots (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  captured_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  window_hours  INTEGER NOT NULL DEFAULT 24,
  total_requests BIGINT NOT NULL DEFAULT 0,
  error_count    BIGINT NOT NULL DEFAULT 0,
  error_rate_pct NUMERIC(5,2) NOT NULL DEFAULT 0,
  p95_latency_ms NUMERIC(10,2),
  backlog_pending BIGINT NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pg_net_health_snapshots_captured_at
  ON public.pg_net_health_snapshots (captured_at DESC);

GRANT SELECT ON public.pg_net_health_snapshots TO authenticated;
GRANT ALL    ON public.pg_net_health_snapshots TO service_role;

ALTER TABLE public.pg_net_health_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins read pg_net snapshots" ON public.pg_net_health_snapshots;
CREATE POLICY "admins read pg_net snapshots"
  ON public.pg_net_health_snapshots FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 2) Função de saúde do pg_net
CREATE OR REPLACE FUNCTION public.pg_net_health(_window_hours INTEGER DEFAULT 24)
RETURNS TABLE (
  total_requests  BIGINT,
  error_count     BIGINT,
  error_rate_pct  NUMERIC,
  p95_latency_ms  NUMERIC,
  backlog_pending BIGINT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, net, pg_catalog
AS $$
DECLARE
  v_total   BIGINT := 0;
  v_errors  BIGINT := 0;
  v_p95     NUMERIC := NULL;
  v_backlog BIGINT := 0;
BEGIN
  -- Somente worker do sistema (service_role — auth.uid() NULL) ou admin
  IF auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Acesso negado: requer service_role ou admin';
  END IF;

  -- Best-effort: pg_net expõe net._http_response; se schema não existir, devolve zeros.
  BEGIN
    EXECUTE format($q$
      SELECT count(*),
             count(*) FILTER (WHERE status_code IS NULL OR status_code >= 500),
             percentile_cont(0.95) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (created - created)) * 1000)
      FROM net._http_response
      WHERE created >= now() - ($1 || ' hours')::interval
    $q$)
    INTO v_total, v_errors, v_p95
    USING _window_hours;
  EXCEPTION WHEN OTHERS THEN
    v_total := 0; v_errors := 0; v_p95 := NULL;
  END;

  BEGIN
    EXECUTE 'SELECT count(*) FROM net.http_request_queue' INTO v_backlog;
  EXCEPTION WHEN OTHERS THEN
    v_backlog := 0;
  END;

  RETURN QUERY SELECT
    v_total,
    v_errors,
    CASE WHEN v_total > 0 THEN ROUND(100.0 * v_errors / v_total, 2) ELSE 0::numeric END,
    v_p95,
    v_backlog;
END;
$$;

REVOKE ALL ON FUNCTION public.pg_net_health(INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pg_net_health(INTEGER) TO service_role;
