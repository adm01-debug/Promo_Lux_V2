
-- #5 Rate limiting
CREATE TABLE IF NOT EXISTS public.org_scrape_rate_limits (
  organization_id UUID PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  max_concurrent INT NOT NULL DEFAULT 5 CHECK (max_concurrent > 0 AND max_concurrent <= 100),
  max_per_hour INT NOT NULL DEFAULT 100 CHECK (max_per_hour > 0 AND max_per_hour <= 10000),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_scrape_rate_limits TO authenticated;
GRANT ALL ON public.org_scrape_rate_limits TO service_role;
ALTER TABLE public.org_scrape_rate_limits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org admins manage rate limits" ON public.org_scrape_rate_limits;
CREATE POLICY "Org admins manage rate limits"
  ON public.org_scrape_rate_limits FOR ALL TO authenticated
  USING (public.has_org_role(auth.uid(), organization_id, 'admin'))
  WITH CHECK (public.has_org_role(auth.uid(), organization_id, 'admin'));

DROP POLICY IF EXISTS "Org members view rate limits" ON public.org_scrape_rate_limits;
CREATE POLICY "Org members view rate limits"
  ON public.org_scrape_rate_limits FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));

DROP TRIGGER IF EXISTS org_scrape_rate_limits_updated_at ON public.org_scrape_rate_limits;
CREATE TRIGGER org_scrape_rate_limits_updated_at
  BEFORE UPDATE ON public.org_scrape_rate_limits
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- #6 DLQ auto-triagem
CREATE OR REPLACE FUNCTION public.dlq_top_reasons(_limit INT DEFAULT 10)
RETURNS TABLE(
  failure_reason TEXT, occurrences BIGINT,
  first_seen TIMESTAMPTZ, last_seen TIMESTAMPTZ, sample_error TEXT
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    COALESCE(substring(last_error FROM '^([a-zA-Z_0-9]+)'), 'unknown'),
    COUNT(*), MIN(failed_at), MAX(failed_at),
    (array_agg(last_error ORDER BY failed_at DESC))[1]
  FROM public.scrape_dead_letter
  WHERE replayed_at IS NULL
    AND organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid())
  GROUP BY 1 ORDER BY 2 DESC LIMIT _limit;
$$;
REVOKE ALL ON FUNCTION public.dlq_top_reasons(INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dlq_top_reasons(INT) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.dlq_purge_stale_network_errors(_days INT DEFAULT 30)
RETURNS INT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_deleted INT;
BEGIN
  WITH deleted AS (
    DELETE FROM public.scrape_dead_letter
    WHERE replayed_at IS NULL
      AND failed_at < now() - (_days || ' days')::INTERVAL
      AND last_error ILIKE 'network_error%'
    RETURNING 1)
  SELECT COUNT(*) INTO v_deleted FROM deleted;
  RETURN v_deleted;
END; $$;
REVOKE ALL ON FUNCTION public.dlq_purge_stale_network_errors(INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.dlq_purge_stale_network_errors(INT) TO service_role;

-- #7 Percentis (agrupa snapshots pré-agregados por endpoint × hora)
CREATE OR REPLACE FUNCTION public.api_latency_percentiles(
  _path TEXT DEFAULT NULL, _hours INT DEFAULT 24
)
RETURNS TABLE(
  path TEXT, bucket TIMESTAMPTZ, samples BIGINT,
  p50_ms NUMERIC, p95_ms NUMERIC, p99_ms NUMERIC,
  avg_error_rate NUMERIC
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    s.path,
    date_trunc('hour', s.captured_at) AS bucket,
    SUM(s.requests)::BIGINT,
    AVG(s.p50_ms)::NUMERIC,
    MAX(s.p95_ms)::NUMERIC,
    MAX(s.p99_ms)::NUMERIC,
    AVG(s.error_rate)::NUMERIC
  FROM public.api_latency_snapshots s
  WHERE s.captured_at >= now() - (_hours || ' hours')::INTERVAL
    AND s.organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid())
    AND (_path IS NULL OR s.path = _path)
  GROUP BY 1, 2 ORDER BY 2 DESC, 1;
$$;
REVOKE ALL ON FUNCTION public.api_latency_percentiles(TEXT, INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.api_latency_percentiles(TEXT, INT) TO authenticated, service_role;
