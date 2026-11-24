-- Taxa de erro da API passa a medir falha do servidor (5xx), nao 4xx.
--
-- Antes: as tres funcoes contavam `status_code >= 400` como erro. Efeito medido
-- em producao (24/11): `/public-api/events` aparecia com 83% de erro porque dois
-- scanners bateram sem chave (401) e porque 500 reais de 14:07-14:11 ainda
-- estavam dentro da janela de 1h do snapshot. O painel (LATENCY_THRESHOLDS em
-- src/hooks/useApiLatency.ts: errorRateWarn 1%, errorRateCritical 5%) pintava
-- vermelho sem nenhuma falha de servico acontecendo.
--
-- Depois: `errors`/`error_rate` contam apenas 5xx. Pedido sem credencial (401),
-- recurso inexistente (404) e validacao (400) continuam gravados em
-- api_request_logs.status_code - nada de dado se perde, so deixa de ser
-- classificado como indisponibilidade.
--
-- Snapshots ja gravados mantem o numero antigo: nao reescrevemos historico.

CREATE OR REPLACE FUNCTION public.capture_api_latency_snapshots(_hours integer DEFAULT 1)
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

  INSERT INTO public.api_latency_snapshots (
    organization_id, path, requests, errors, error_rate, p50_ms, p95_ms, p99_ms
  )
  SELECT
    l.organization_id,
    l.path,
    count(*)::bigint,
    count(*) FILTER (WHERE l.status_code >= 500)::bigint,
    ROUND(100.0 * count(*) FILTER (WHERE l.status_code >= 500) / NULLIF(count(*), 0), 2),
    ROUND(percentile_cont(0.5) WITHIN GROUP (ORDER BY l.duration_ms)::numeric, 0),
    ROUND(percentile_cont(0.95) WITHIN GROUP (ORDER BY l.duration_ms)::numeric, 0),
    ROUND(percentile_cont(0.99) WITHIN GROUP (ORDER BY l.duration_ms)::numeric, 0)
  FROM public.api_request_logs l
  JOIN public.organizations o ON o.id = l.organization_id
  WHERE l.created_at >= now() - make_interval(hours => GREATEST(_hours, 1))
    AND l.organization_id IS NOT NULL
  GROUP BY l.organization_id, l.path;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$function$;

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
    count(*) FILTER (WHERE l.status_code >= 500)::bigint AS errors,
    ROUND(100.0 * count(*) FILTER (WHERE l.status_code >= 500) / NULLIF(count(*), 0), 2) AS error_rate,
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
    count(*) FILTER (WHERE logs.status_code >= 500)::bigint AS errors,
    ROUND(100.0 * count(*) FILTER (WHERE logs.status_code >= 500) / NULLIF(count(*), 0), 2) AS error_rate,
    ROUND(percentile_cont(0.5) WITHIN GROUP (ORDER BY logs.duration_ms)::numeric, 0) AS p50_ms,
    ROUND(percentile_cont(0.95) WITHIN GROUP (ORDER BY logs.duration_ms)::numeric, 0) AS p95_ms
  FROM logs
  WHERE auth.uid() IS NOT NULL
  GROUP BY logs.bucket
  ORDER BY logs.bucket ASC;
$function$;