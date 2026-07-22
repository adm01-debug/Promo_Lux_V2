
-- BRIN em tabelas append-only sem BRIN ainda
CREATE INDEX IF NOT EXISTS idx_autoexec_created_brin
  ON public.automation_execution_logs USING BRIN (created_at) WITH (pages_per_range = 32);

CREATE INDEX IF NOT EXISTS idx_db_health_captured_brin
  ON public.db_health_snapshots USING BRIN (captured_at) WITH (pages_per_range = 32);

CREATE INDEX IF NOT EXISTS idx_pgnet_health_captured_brin
  ON public.pg_net_health_snapshots USING BRIN (captured_at) WITH (pages_per_range = 32);

-- Health consolidado para DR
CREATE OR REPLACE FUNCTION public.system_recovery_health()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_result jsonb;
  v_crons jsonb;
  v_scrape_backlog bigint;
  v_web_backlog bigint;
  v_dlq_legacy_pending bigint;
  v_dlq_web_pending bigint;
  v_pg_net_last timestamptz;
  v_db_health_last timestamptz;
BEGIN
  -- Últimas execuções dos crons críticos (últimas 24h)
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    EXECUTE $q$
      SELECT jsonb_agg(jsonb_build_object(
        'jobname', j.jobname,
        'schedule', j.schedule,
        'active', j.active,
        'last_run', r.start_time,
        'last_status', r.status
      ))
      FROM cron.job j
      LEFT JOIN LATERAL (
        SELECT start_time, status FROM cron.job_run_details
        WHERE jobid = j.jobid ORDER BY start_time DESC LIMIT 1
      ) r ON true
      WHERE j.active = true
    $q$ INTO v_crons;
  ELSE
    v_crons := '[]'::jsonb;
  END IF;

  SELECT count(*) INTO v_scrape_backlog FROM public.scrape_queue WHERE status = 'queued';
  SELECT count(*) INTO v_web_backlog FROM public.web_scrape_queue WHERE status = 'queued';
  SELECT count(*) INTO v_dlq_legacy_pending FROM public.scrape_dead_letter WHERE replayed_at IS NULL;
  SELECT count(*) INTO v_dlq_web_pending FROM public.web_scrape_dead_letter WHERE replayed_at IS NULL;

  SELECT max(captured_at) INTO v_pg_net_last FROM public.pg_net_health_snapshots;
  SELECT max(captured_at) INTO v_db_health_last FROM public.db_health_snapshots;

  v_result := jsonb_build_object(
    'generated_at', now(),
    'crons', COALESCE(v_crons, '[]'::jsonb),
    'queues', jsonb_build_object(
      'scrape_backlog', v_scrape_backlog,
      'web_scrape_backlog', v_web_backlog,
      'dlq_legacy_pending', v_dlq_legacy_pending,
      'dlq_web_pending', v_dlq_web_pending
    ),
    'snapshots', jsonb_build_object(
      'pg_net_last', v_pg_net_last,
      'pg_net_age_secs', EXTRACT(EPOCH FROM (now() - v_pg_net_last)),
      'db_health_last', v_db_health_last,
      'db_health_age_secs', EXTRACT(EPOCH FROM (now() - v_db_health_last))
    )
  );

  RETURN v_result;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.system_recovery_health() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.system_recovery_health() TO service_role;
