-- O-1: Observabilidade de latência p95 das APIs/edge functions.
-- Agrega api_request_logs por rota numa janela de tempo, calculando
-- percentis (p50/p95/p99), volume e taxa de erro. SECURITY DEFINER com
-- isolamento explícito por organização (fail-closed).
CREATE OR REPLACE FUNCTION public.api_latency_stats(_hours integer DEFAULT 24, _limit integer DEFAULT 20)
RETURNS TABLE(
  path text,
  requests bigint,
  errors bigint,
  error_rate numeric,
  p50_ms numeric,
  p95_ms numeric,
  p99_ms numeric,
  max_ms integer,
  avg_ms numeric
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    l.path,
    count(*)::bigint AS requests,
    count(*) FILTER (WHERE l.status_code >= 400)::bigint AS errors,
    ROUND(100.0 * count(*) FILTER (WHERE l.status_code >= 400) / NULLIF(count(*), 0), 2) AS error_rate,
    ROUND(percentile_cont(0.50) WITHIN GROUP (ORDER BY l.duration_ms)::numeric, 1) AS p50_ms,
    ROUND(percentile_cont(0.95) WITHIN GROUP (ORDER BY l.duration_ms)::numeric, 1) AS p95_ms,
    ROUND(percentile_cont(0.99) WITHIN GROUP (ORDER BY l.duration_ms)::numeric, 1) AS p99_ms,
    max(l.duration_ms) AS max_ms,
    ROUND(avg(l.duration_ms)::numeric, 1) AS avg_ms
  FROM public.api_request_logs l
  WHERE auth.uid() IS NOT NULL
    AND l.organization_id IS NOT NULL
    AND public.is_org_member(l.organization_id, auth.uid())
    AND l.duration_ms IS NOT NULL
    AND l.created_at >= now() - make_interval(hours => GREATEST(_hours, 1))
  GROUP BY l.path
  ORDER BY p95_ms DESC NULLS LAST
  LIMIT GREATEST(LEAST(_limit, 100), 1);
$function$;

REVOKE EXECUTE ON FUNCTION public.api_latency_stats(integer, integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.api_latency_stats(integer, integer) TO authenticated, service_role;