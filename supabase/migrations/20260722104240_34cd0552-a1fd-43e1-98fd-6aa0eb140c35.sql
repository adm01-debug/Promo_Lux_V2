
-- Rodada #17 — Passos 1+2: queue_kind discriminator + web DLQ snapshotter
ALTER TABLE public.retry_policy_advisories
  ADD COLUMN IF NOT EXISTS queue_kind TEXT NOT NULL DEFAULT 'scrape'
    CHECK (queue_kind IN ('scrape','web'));

ALTER TABLE public.dlq_health_snapshots
  ADD COLUMN IF NOT EXISTS queue_kind TEXT NOT NULL DEFAULT 'scrape'
    CHECK (queue_kind IN ('scrape','web'));

ALTER TABLE public.dlq_alert_history
  ADD COLUMN IF NOT EXISTS queue_kind TEXT NOT NULL DEFAULT 'scrape'
    CHECK (queue_kind IN ('scrape','web'));

ALTER TABLE public.dlq_alert_settings
  ADD COLUMN IF NOT EXISTS queue_kind TEXT NOT NULL DEFAULT 'scrape'
    CHECK (queue_kind IN ('scrape','web'));

-- Compor PK por (org, queue_kind) para permitir settings distintos por fila.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'dlq_alert_settings_pkey' AND conrelid = 'public.dlq_alert_settings'::regclass
  ) THEN
    ALTER TABLE public.dlq_alert_settings DROP CONSTRAINT dlq_alert_settings_pkey;
    ALTER TABLE public.dlq_alert_settings
      ADD CONSTRAINT dlq_alert_settings_pkey PRIMARY KEY (organization_id, queue_kind);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_dlq_snapshots_org_kind_time
  ON public.dlq_health_snapshots (organization_id, queue_kind, captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_dlq_alert_history_org_kind_time
  ON public.dlq_alert_history (organization_id, queue_kind, triggered_at DESC);

-- Snapshotter da DLQ web (espelha capture_dlq_health_snapshots).
CREATE OR REPLACE FUNCTION public.capture_web_dlq_health_snapshots()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_count integer := 0;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Acesso negado: requer papel de administrador';
  END IF;

  INSERT INTO public.dlq_health_snapshots (
    organization_id, queue_kind, total_items, pending_items, replayed_items, oldest_pending_age_secs
  )
  SELECT
    d.organization_id,
    'web'::text,
    count(*)::bigint,
    count(*) FILTER (WHERE d.replayed_at IS NULL)::bigint,
    count(*) FILTER (WHERE d.replayed_at IS NOT NULL)::bigint,
    COALESCE(
      EXTRACT(EPOCH FROM (now() - min(d.failed_at) FILTER (WHERE d.replayed_at IS NULL))),
      0
    )::numeric
  FROM public.web_scrape_dead_letter d
  GROUP BY d.organization_id;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$function$;

REVOKE ALL ON FUNCTION public.capture_web_dlq_health_snapshots() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.capture_web_dlq_health_snapshots() TO service_role;
