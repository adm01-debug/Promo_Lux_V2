-- Retenção de health_checks — fecha gap deixado pela remoção de audit-logs-prune
--
-- A edge `audit-logs-prune` (removida na PR #209) era a única rotina que tentava
-- expurgar `health_checks`. Ela filtrava por `created_at`, coluna que esta tabela
-- não possui (o carimbo é `last_check`), então o DELETE falhava e o erro abortava
-- a função: o prune nunca aconteceu. `audit_logs`, `api_request_logs` e
-- `email_sync_log` seguem cobertos por jobs SQL próprios.
-- `supabase/functions/health/index.ts` insere uma linha a cada verificação de
-- saúde, sem nenhum teto de crescimento desde a criação da tabela.

CREATE OR REPLACE FUNCTION public.prune_health_checks(retention_days int DEFAULT 90)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE deleted_count int;
BEGIN
  DELETE FROM public.health_checks
  WHERE last_check < now() - (retention_days || ' days')::interval;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

REVOKE ALL ON FUNCTION public.prune_health_checks(int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prune_health_checks(int) TO service_role;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('daily-health-checks-retention') WHERE EXISTS (
      SELECT 1 FROM cron.job WHERE jobname = 'daily-health-checks-retention'
    );
    PERFORM cron.schedule(
      'daily-health-checks-retention',
      '45 3 * * *',
      $CRON$
        SELECT public.prune_health_checks(90);
      $CRON$
    );
  END IF;
END $$;