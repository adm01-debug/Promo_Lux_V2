
CREATE OR REPLACE FUNCTION public.sla_compliance_stats(p_hours integer DEFAULT 24)
RETURNS TABLE (
  queue_kind text,
  sample_size bigint,
  with_sla bigint,
  breaches bigint,
  breach_rate numeric,
  p50_seconds numeric,
  p95_seconds numeric,
  p99_seconds numeric,
  sla_p50 numeric,
  sla_p95 numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH cutoff AS (
    SELECT now() - make_interval(hours => GREATEST(1, LEAST(720, p_hours))) AS since
  ),
  s AS (
    SELECT 'scrape'::text AS queue_kind,
           EXTRACT(EPOCH FROM (updated_at - created_at))::numeric AS dur,
           sla_seconds
    FROM public.scrape_queue, cutoff
    WHERE updated_at >= cutoff.since
      AND status::text IN ('succeeded','failed','dead')
  ),
  w AS (
    SELECT 'web'::text AS queue_kind,
           EXTRACT(EPOCH FROM (updated_at - created_at))::numeric AS dur,
           sla_seconds
    FROM public.web_scrape_queue, cutoff
    WHERE updated_at >= cutoff.since
      AND status::text IN ('succeeded','failed','dead')
  ),
  i AS (
    SELECT 'instagram'::text AS queue_kind,
           EXTRACT(EPOCH FROM (updated_at - created_at))::numeric AS dur,
           sla_seconds
    FROM public.instagram_scrape_queue, cutoff
    WHERE updated_at >= cutoff.since
      AND status IN ('succeeded','failed','dead')
  ),
  u AS (SELECT * FROM s UNION ALL SELECT * FROM w UNION ALL SELECT * FROM i)
  SELECT
    queue_kind,
    COUNT(*)::bigint AS sample_size,
    COUNT(sla_seconds)::bigint AS with_sla,
    COUNT(*) FILTER (WHERE sla_seconds IS NOT NULL AND dur > sla_seconds)::bigint AS breaches,
    ROUND(
      COALESCE(
        COUNT(*) FILTER (WHERE sla_seconds IS NOT NULL AND dur > sla_seconds)::numeric
        / NULLIF(COUNT(sla_seconds), 0),
        0
      ),
      4
    ) AS breach_rate,
    ROUND(percentile_disc(0.50) WITHIN GROUP (ORDER BY dur)::numeric, 2) AS p50_seconds,
    ROUND(percentile_disc(0.95) WITHIN GROUP (ORDER BY dur)::numeric, 2) AS p95_seconds,
    ROUND(percentile_disc(0.99) WITHIN GROUP (ORDER BY dur)::numeric, 2) AS p99_seconds,
    ROUND(percentile_disc(0.50) WITHIN GROUP (ORDER BY sla_seconds)::numeric, 2) AS sla_p50,
    ROUND(percentile_disc(0.95) WITHIN GROUP (ORDER BY sla_seconds)::numeric, 2) AS sla_p95
  FROM u
  GROUP BY queue_kind
  ORDER BY queue_kind;
$$;

REVOKE ALL ON FUNCTION public.sla_compliance_stats(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sla_compliance_stats(integer) TO authenticated, service_role;
