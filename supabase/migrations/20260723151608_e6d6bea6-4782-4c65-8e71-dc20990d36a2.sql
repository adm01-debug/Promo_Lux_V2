
CREATE TABLE IF NOT EXISTS public.sla_snapshots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  queue_kind TEXT NOT NULL CHECK (queue_kind IN ('scrape','web','instagram')),
  window_hours INTEGER NOT NULL,
  sample_size INTEGER NOT NULL DEFAULT 0,
  with_sla INTEGER NOT NULL DEFAULT 0,
  breaches INTEGER NOT NULL DEFAULT 0,
  breach_rate NUMERIC NOT NULL DEFAULT 0,
  p50_seconds NUMERIC,
  p95_seconds NUMERIC,
  p99_seconds NUMERIC,
  sla_p50 NUMERIC,
  sla_p95 NUMERIC,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.sla_snapshots TO authenticated;
GRANT ALL ON public.sla_snapshots TO service_role;

ALTER TABLE public.sla_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sla_snapshots_auth_select" ON public.sla_snapshots;
CREATE POLICY "sla_snapshots_auth_select" ON public.sla_snapshots
  FOR SELECT TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS sla_snapshots_captured_idx
  ON public.sla_snapshots (captured_at DESC);
CREATE INDEX IF NOT EXISTS sla_snapshots_queue_captured_idx
  ON public.sla_snapshots (queue_kind, captured_at DESC);

CREATE OR REPLACE FUNCTION public.capture_sla_snapshot(p_hours INTEGER DEFAULT 24)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inserted INTEGER := 0;
BEGIN
  INSERT INTO public.sla_snapshots (
    queue_kind, window_hours, sample_size, with_sla, breaches, breach_rate,
    p50_seconds, p95_seconds, p99_seconds, sla_p50, sla_p95
  )
  SELECT
    s.queue_kind, p_hours, s.sample_size, s.with_sla, s.breaches, s.breach_rate,
    s.p50_seconds, s.p95_seconds, s.p99_seconds, s.sla_p50, s.sla_p95
  FROM public.sla_compliance_stats(p_hours) s;
  GET DIAGNOSTICS inserted = ROW_COUNT;
  RETURN inserted;
END;
$$;

REVOKE ALL ON FUNCTION public.capture_sla_snapshot(INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.capture_sla_snapshot(INTEGER) TO service_role;
