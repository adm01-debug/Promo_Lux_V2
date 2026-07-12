CREATE OR REPLACE FUNCTION public.dlq_health_metrics()
RETURNS TABLE(
  total_items        bigint,
  pending_items      bigint,
  replayed_items     bigint,
  oldest_pending_age_secs numeric,
  added_last_24h     bigint,
  replayed_last_24h  bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH scoped AS (
    SELECT d.*
    FROM public.scrape_dead_letter d
    WHERE auth.uid() IS NOT NULL
      AND public.is_org_member(d.organization_id, auth.uid())
  )
  SELECT
    count(*)::bigint AS total_items,
    count(*) FILTER (WHERE replayed_at IS NULL)::bigint AS pending_items,
    count(*) FILTER (WHERE replayed_at IS NOT NULL)::bigint AS replayed_items,
    COALESCE(
      EXTRACT(EPOCH FROM (now() - min(failed_at) FILTER (WHERE replayed_at IS NULL))),
      0
    )::numeric AS oldest_pending_age_secs,
    count(*) FILTER (WHERE failed_at >= now() - interval '24 hours')::bigint AS added_last_24h,
    count(*) FILTER (WHERE replayed_at >= now() - interval '24 hours')::bigint AS replayed_last_24h
  FROM scoped;
$function$;

REVOKE ALL ON FUNCTION public.dlq_health_metrics() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dlq_health_metrics() TO authenticated, service_role;