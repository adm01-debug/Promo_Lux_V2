
-- ============================================================
-- Rodada #12 — Índices otimizados + retenção de logs
-- ============================================================

-- 1) BRIN em created_at (footprint mínimo, ideal para tabelas append-only grandes)
CREATE INDEX IF NOT EXISTS idx_api_request_logs_created_brin
  ON public.api_request_logs USING BRIN (created_at) WITH (pages_per_range = 32);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_brin
  ON public.audit_logs USING BRIN (created_at) WITH (pages_per_range = 32);

-- 2) Índice parcial para dashboards de erro (status_code >= 400)
CREATE INDEX IF NOT EXISTS idx_api_request_logs_errors
  ON public.api_request_logs (organization_id, status_code, created_at DESC)
  WHERE status_code >= 400;

-- 3) Correlação por trace_id
CREATE INDEX IF NOT EXISTS idx_api_request_logs_trace
  ON public.api_request_logs (trace_id)
  WHERE trace_id IS NOT NULL;

-- 4) Funções de retenção (SECURITY DEFINER, restrito a service_role)
CREATE OR REPLACE FUNCTION public.prune_api_request_logs(retention_days int DEFAULT 90)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count int;
BEGIN
  DELETE FROM public.api_request_logs
  WHERE created_at < now() - (retention_days || ' days')::interval;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.prune_audit_logs(retention_days int DEFAULT 180)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count int;
BEGIN
  DELETE FROM public.audit_logs
  WHERE created_at < now() - (retention_days || ' days')::interval;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.prune_automation_execution_logs(retention_days int DEFAULT 60)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count int;
BEGIN
  DELETE FROM public.automation_execution_logs
  WHERE created_at < now() - (retention_days || ' days')::interval;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- 5) ADR-009: revogar EXECUTE de anon/authenticated, manter só service_role
REVOKE ALL ON FUNCTION public.prune_api_request_logs(int) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.prune_audit_logs(int) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.prune_automation_execution_logs(int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prune_api_request_logs(int) TO service_role;
GRANT EXECUTE ON FUNCTION public.prune_audit_logs(int) TO service_role;
GRANT EXECUTE ON FUNCTION public.prune_automation_execution_logs(int) TO service_role;

-- 6) Cron diário 03:15 UTC — expurgo consolidado
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('daily-log-retention') WHERE EXISTS (
      SELECT 1 FROM cron.job WHERE jobname = 'daily-log-retention'
    );
    PERFORM cron.schedule(
      'daily-log-retention',
      '15 3 * * *',
      $CRON$
        SELECT public.prune_api_request_logs(90);
        SELECT public.prune_audit_logs(180);
        SELECT public.prune_automation_execution_logs(60);
      $CRON$
    );
  END IF;
END $$;
