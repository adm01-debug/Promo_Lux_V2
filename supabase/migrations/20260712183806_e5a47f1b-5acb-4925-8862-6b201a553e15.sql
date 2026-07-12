-- ============================================================
-- DB HEALTH MONITORING: snapshots + capture function + cron
-- ============================================================

CREATE TABLE IF NOT EXISTS public.db_health_snapshots (
  id                 UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  captured_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  active_connections INTEGER NOT NULL,
  max_connections    INTEGER NOT NULL,
  connection_pct     NUMERIC(5,2) NOT NULL,
  db_size_bytes      BIGINT NOT NULL,
  postmaster_start   TIMESTAMPTZ NOT NULL,
  restart_detected   BOOLEAN NOT NULL DEFAULT false,
  commits            BIGINT NOT NULL DEFAULT 0,
  rollbacks          BIGINT NOT NULL DEFAULT 0,
  deadlocks          BIGINT NOT NULL DEFAULT 0,
  cache_hit_ratio    NUMERIC(5,2) NOT NULL DEFAULT 0,
  longest_query_secs NUMERIC NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_db_health_snapshots_captured_at
  ON public.db_health_snapshots (captured_at DESC);

GRANT SELECT ON public.db_health_snapshots TO authenticated;
GRANT ALL ON public.db_health_snapshots TO service_role;

ALTER TABLE public.db_health_snapshots ENABLE ROW LEVEL SECURITY;

-- Infra data: only admins may read.
CREATE POLICY "Admins can view db health snapshots"
  ON public.db_health_snapshots
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- ------------------------------------------------------------
-- Capture function: reads live pg_stat catalogs and stores a row.
-- SECURITY DEFINER so it can read system catalogs from cron.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.capture_db_health_snapshot()
RETURNS public.db_health_snapshots
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $$
DECLARE
  v_active      INTEGER;
  v_max         INTEGER;
  v_size        BIGINT;
  v_start       TIMESTAMPTZ;
  v_prev_start  TIMESTAMPTZ;
  v_restart     BOOLEAN := false;
  v_commits     BIGINT;
  v_rollbacks   BIGINT;
  v_deadlocks   BIGINT;
  v_blks_hit    BIGINT;
  v_blks_read   BIGINT;
  v_cache       NUMERIC(5,2);
  v_longest     NUMERIC;
  v_row         public.db_health_snapshots;
BEGIN
  SELECT count(*) INTO v_active FROM pg_stat_activity;
  v_max  := current_setting('max_connections')::int;
  v_size := pg_database_size(current_database());
  v_start := pg_postmaster_start_time();

  SELECT xact_commit, xact_rollback, deadlocks, blks_hit, blks_read
    INTO v_commits, v_rollbacks, v_deadlocks, v_blks_hit, v_blks_read
  FROM pg_stat_database WHERE datname = current_database();

  v_cache := CASE WHEN (v_blks_hit + v_blks_read) > 0
    THEN ROUND(100.0 * v_blks_hit / (v_blks_hit + v_blks_read), 2) ELSE 100 END;

  SELECT COALESCE(EXTRACT(EPOCH FROM max(now() - query_start)), 0)
    INTO v_longest
  FROM pg_stat_activity
  WHERE state = 'active' AND query NOT ILIKE '%pg_stat_activity%';

  SELECT postmaster_start INTO v_prev_start
  FROM public.db_health_snapshots
  ORDER BY captured_at DESC LIMIT 1;

  IF v_prev_start IS NOT NULL AND v_prev_start <> v_start THEN
    v_restart := true;
  END IF;

  INSERT INTO public.db_health_snapshots (
    active_connections, max_connections, connection_pct, db_size_bytes,
    postmaster_start, restart_detected, commits, rollbacks, deadlocks,
    cache_hit_ratio, longest_query_secs
  ) VALUES (
    v_active, v_max, ROUND(100.0 * v_active / NULLIF(v_max,0), 2), v_size,
    v_start, v_restart, v_commits, v_rollbacks, v_deadlocks,
    v_cache, ROUND(v_longest, 2)
  ) RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.capture_db_health_snapshot() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.capture_db_health_snapshot() TO authenticated, service_role;

-- ------------------------------------------------------------
-- Periodic capture every 5 minutes (internal SQL, no secrets).
-- ------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('capture-db-health')
      WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'capture-db-health');
    PERFORM cron.schedule(
      'capture-db-health',
      '*/5 * * * *',
      $cron$ SELECT public.capture_db_health_snapshot(); $cron$
    );
  END IF;
END $$;

-- Seed an initial snapshot so the dashboard has data immediately.
SELECT public.capture_db_health_snapshot();