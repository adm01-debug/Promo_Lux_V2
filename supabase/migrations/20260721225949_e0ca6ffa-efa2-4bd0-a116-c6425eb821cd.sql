
-- Rodada #13 — BRIN + retenção em campaign_events e email_sync_log

CREATE INDEX IF NOT EXISTS idx_campaign_events_occurred_brin
  ON public.campaign_events USING BRIN (occurred_at) WITH (pages_per_range = 32);

CREATE INDEX IF NOT EXISTS idx_email_sync_log_created_brin
  ON public.email_sync_log USING BRIN (created_at) WITH (pages_per_range = 32);

CREATE OR REPLACE FUNCTION public.prune_campaign_events(retention_days int DEFAULT 365)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE deleted_count int;
BEGIN
  DELETE FROM public.campaign_events
  WHERE occurred_at < now() - (retention_days || ' days')::interval;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.prune_email_sync_log(retention_days int DEFAULT 30)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE deleted_count int;
BEGIN
  DELETE FROM public.email_sync_log
  WHERE created_at < now() - (retention_days || ' days')::interval;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

REVOKE ALL ON FUNCTION public.prune_campaign_events(int) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.prune_email_sync_log(int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prune_campaign_events(int) TO service_role;
GRANT EXECUTE ON FUNCTION public.prune_email_sync_log(int) TO service_role;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('daily-campaign-logs-retention') WHERE EXISTS (
      SELECT 1 FROM cron.job WHERE jobname = 'daily-campaign-logs-retention'
    );
    PERFORM cron.schedule(
      'daily-campaign-logs-retention',
      '30 3 * * *',
      $CRON$
        SELECT public.prune_campaign_events(365);
        SELECT public.prune_email_sync_log(30);
      $CRON$
    );
  END IF;
END $$;
