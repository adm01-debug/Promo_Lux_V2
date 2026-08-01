
-- 1) Prune de snapshots antigos (retenção 90 dias)
CREATE OR REPLACE FUNCTION public.prune_pg_net_health_snapshots(retention_days integer DEFAULT 90)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count integer;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Acesso negado: requer papel de administrador';
  END IF;
  DELETE FROM public.pg_net_health_snapshots
  WHERE created_at < now() - (retention_days || ' days')::interval;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.prune_pg_net_health_snapshots(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prune_pg_net_health_snapshots(integer) TO service_role;

-- 2) Dedup por cooldown (60 min) para notificações do watchdog
CREATE OR REPLACE FUNCTION public.pg_net_watchdog_should_notify(_admin_id uuid, _cooldown_minutes integer DEFAULT 60)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.notifications
    WHERE user_id = _admin_id
      AND title = 'pg_net degradado'
      AND created_at > now() - make_interval(mins => _cooldown_minutes)
  );
$$;

REVOKE EXECUTE ON FUNCTION public.pg_net_watchdog_should_notify(uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pg_net_watchdog_should_notify(uuid, integer) TO service_role;

-- 3) Advisory lock para evitar overlap do watchdog
CREATE OR REPLACE FUNCTION public.pg_net_watchdog_try_lock()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT pg_try_advisory_xact_lock(hashtext('pg_net_watchdog'));
$$;

REVOKE EXECUTE ON FUNCTION public.pg_net_watchdog_try_lock() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pg_net_watchdog_try_lock() TO service_role;

-- 4) Cron semanal de prune
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('pg-net-snapshots-prune-weekly')
      WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'pg-net-snapshots-prune-weekly');

    PERFORM cron.schedule(
      'pg-net-snapshots-prune-weekly',
      '0 3 * * 0',
      $cron$ SELECT public.prune_pg_net_health_snapshots(90); $cron$
    );
  END IF;
END $$;
