-- Rodada #41 #2 · Recomendação automática de SLA por fila (baseada em p95 real)
CREATE OR REPLACE FUNCTION public.sla_recommendations(p_hours integer DEFAULT 168)
RETURNS TABLE(
  queue_kind text,
  sample_size bigint,
  current_sla_p50 numeric,
  p50_seconds numeric,
  p95_seconds numeric,
  recommended_sla_seconds integer,
  delta_seconds numeric,
  verdict text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
    SELECT 'web'::text,
           EXTRACT(EPOCH FROM (updated_at - created_at))::numeric,
           sla_seconds
      FROM public.web_scrape_queue, cutoff
     WHERE updated_at >= cutoff.since
       AND status::text IN ('succeeded','failed','dead')
  ),
  i AS (
    SELECT 'instagram'::text,
           EXTRACT(EPOCH FROM (updated_at - created_at))::numeric,
           sla_seconds
      FROM public.instagram_scrape_queue, cutoff
     WHERE updated_at >= cutoff.since
       AND status IN ('succeeded','failed','dead')
  ),
  u AS (SELECT * FROM s UNION ALL SELECT * FROM w UNION ALL SELECT * FROM i),
  agg AS (
    SELECT
      queue_kind,
      COUNT(*)::bigint AS sample_size,
      percentile_cont(0.5) WITHIN GROUP (ORDER BY sla_seconds)::numeric AS current_sla_p50,
      percentile_cont(0.5) WITHIN GROUP (ORDER BY dur)::numeric AS p50_seconds,
      percentile_cont(0.95) WITHIN GROUP (ORDER BY dur)::numeric AS p95_seconds
    FROM u
    WHERE dur IS NOT NULL AND dur >= 0
    GROUP BY queue_kind
  )
  SELECT
    a.queue_kind,
    a.sample_size,
    a.current_sla_p50,
    ROUND(a.p50_seconds, 2),
    ROUND(a.p95_seconds, 2),
    LEAST(3600, GREATEST(60, CEIL(a.p95_seconds * 1.3)))::integer AS recommended_sla_seconds,
    ROUND(LEAST(3600, GREATEST(60, CEIL(a.p95_seconds * 1.3)))::numeric - COALESCE(a.current_sla_p50, 0), 2) AS delta_seconds,
    CASE
      WHEN a.sample_size < 20 THEN 'insufficient_data'
      WHEN a.current_sla_p50 IS NULL THEN 'unset'
      WHEN a.current_sla_p50 < a.p95_seconds THEN 'too_tight'
      WHEN a.current_sla_p50 > a.p95_seconds * 3 THEN 'too_loose'
      ELSE 'ok'
    END AS verdict
  FROM agg a
  ORDER BY a.queue_kind;
$function$;

REVOKE ALL ON FUNCTION public.sla_recommendations(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sla_recommendations(integer) TO authenticated, service_role;