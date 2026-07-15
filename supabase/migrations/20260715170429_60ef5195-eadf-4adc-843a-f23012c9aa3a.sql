
DROP VIEW IF EXISTS public.oracle_v2_health;

CREATE VIEW public.oracle_v2_health
WITH (security_invoker = true)
AS
SELECT
  organization_id,
  source,
  count(*) FILTER (WHERE created_at >= now() - interval '24 hours') AS events_24h,
  count(*) FILTER (WHERE status = 'error' AND created_at >= now() - interval '24 hours') AS errors_24h,
  count(*) FILTER (WHERE status = 'success' AND created_at >= now() - interval '24 hours') AS success_24h,
  ROUND(
    100.0 * count(*) FILTER (WHERE status = 'success' AND created_at >= now() - interval '24 hours')
    / NULLIF(count(*) FILTER (WHERE created_at >= now() - interval '24 hours'), 0),
    2
  ) AS success_rate_pct,
  max(created_at) AS last_event_at
FROM public.automation_execution_logs
WHERE source IN ('oracle-search-decisors', 'oracle-enrich-contact', 'oracle-cookies-preflight')
GROUP BY organization_id, source;

GRANT SELECT ON public.oracle_v2_health TO authenticated, service_role;
