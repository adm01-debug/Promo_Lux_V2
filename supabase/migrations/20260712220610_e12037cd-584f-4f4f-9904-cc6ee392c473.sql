CREATE OR REPLACE FUNCTION public.api_latency_trend(_hours integer DEFAULT 24, _bucket_minutes integer DEFAULT 60)
RETURNS TABLE(
  bucket timestamp with time zone,
  requests bigint,
  errors bigint,
  error_rate numeric,
  p50_ms numeric,
  p95_ms numeric
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH win AS (
    SELECT GREATEST(_hours, 1) AS h,
           GREATEST(LEAST(_bucket_minutes, 1440), 5) AS bm
  ),
  logs AS (
    SELECT
      to_timestamp(
        floor(extract(epoch FROM l.created_at) / (w.bm * 60)) * (w.bm * 60)
      ) AS bucket,
      l.duration_ms,
      l.status_code
    FROM public.api_request_logs l, win w
    WHERE l.created_at >= now() - make_interval(hours => w.h)
      AND l.organization_id IS NOT NULL
      AND public.is_org_member(l.organization_id, auth.uid())
  )
  SELECT
    logs.bucket,
    count(*)::bigint AS requests,
    count(*) FILTER (WHERE logs.status_code >= 400)::bigint AS errors,
    ROUND(100.0 * count(*) FILTER (WHERE logs.status_code >= 400) / NULLIF(count(*), 0), 2) AS error_rate,
    ROUND(percentile_cont(0.5) WITHIN GROUP (ORDER BY logs.duration_ms)::numeric, 0) AS p50_ms,
    ROUND(percentile_cont(0.95) WITHIN GROUP (ORDER BY logs.duration_ms)::numeric, 0) AS p95_ms
  FROM logs
  WHERE auth.uid() IS NOT NULL
  GROUP BY logs.bucket
  ORDER BY logs.bucket ASC;
$function$;

REVOKE ALL ON FUNCTION public.api_latency_trend(integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.api_latency_trend(integer, integer) TO authenticated, service_role;