-- ---------------------------------------------------------------------------
-- Snapshoters de saude: guarda de integridade por organizacao
-- ---------------------------------------------------------------------------
-- `scrape_dead_letter.organization_id` e `api_request_logs.organization_id` sao
-- UUID NOT NULL *sem* foreign key para `organizations` (ver
-- 20260712184225 e 20260423120419). Basta entrar um orfao — por exemplo a org
-- sentinela 00000000-0000-0000-0000-000000000099 usada como fixture de teste em
-- `src/pages/AdminCompanies.tsx:30` — para o INSERT ... SELECT violar
-- `dlq_health_snapshots_organization_id_fkey` e abortar o snapshot de TODAS as
-- organizacoes.
--
-- Efeito medido em producao antes desta migration:
--   * capture-dlq-health-hourly         0 ok / 415 falhas (100%)
--   * round18-capture-dlq-snapshots-10m 6 ok / 2.486 falhas (99,8%)
--   * api_latency_snapshots             0 linhas  -> evaluate_api_latency_alerts
--                                       nunca dispara e api_latency_alert_history
--                                       fica vazio
--
-- A correcao e um JOIN com `organizations`: linhas orfas passam a ser ignoradas
-- e as organizacoes validas continuam sendo snapshotadas.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.capture_dlq_health_snapshots()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_count integer := 0;
BEGIN
  -- service_role (auth.uid() NULL) passa; caso contrario exige papel admin.
  IF auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Acesso negado: requer papel de administrador';
  END IF;

  INSERT INTO public.dlq_health_snapshots (
    organization_id, total_items, pending_items, replayed_items, oldest_pending_age_secs
  )
  SELECT
    d.organization_id,
    count(*)::bigint,
    count(*) FILTER (WHERE d.replayed_at IS NULL)::bigint,
    count(*) FILTER (WHERE d.replayed_at IS NOT NULL)::bigint,
    COALESCE(
      EXTRACT(EPOCH FROM (now() - min(d.failed_at) FILTER (WHERE d.replayed_at IS NULL))),
      0
    )::numeric
  FROM public.scrape_dead_letter d
  JOIN public.organizations o ON o.id = d.organization_id
  GROUP BY d.organization_id;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

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
  JOIN public.organizations o ON o.id = d.organization_id
  GROUP BY d.organization_id;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$function$;

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
    count(*) FILTER (WHERE l.status_code >= 400)::bigint,
    ROUND(100.0 * count(*) FILTER (WHERE l.status_code >= 400) / NULLIF(count(*), 0), 2),
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

-- ---------------------------------------------------------------------------
-- Versionamento dos crons que viviam apenas no dashboard
-- ---------------------------------------------------------------------------
-- Os 8 jobs abaixo existem em producao mas nao estavam em nenhuma migration:
-- recriar o banco do zero perdia o agendamento sem nenhum rastro. As expressoes
-- cron abaixo reproduzem exatamente o que roda hoje (derivadas de
-- `cron.job_run_details`: capturas horaria, 10min e 15min; podas e SLA diarios;
-- regressao web de hora em hora).
-- ---------------------------------------------------------------------------

do $$
declare
  r record;
begin
  for r in
    select j.jobid from cron.job j where j.jobname in (
    'capture-dlq-health-hourly',
    'round18-capture-dlq-snapshots-10m',
    'capture-api-latency-15min',
    'prune-dlq-health-snapshots-daily',
    'prune-api-latency-snapshots-daily',
    'purge-dead-letter-daily',
    'sla-snapshot-daily',
    'round19-web-scrape-regression-1h'
    )
  loop
    perform cron.unschedule(r.jobid);
  end loop;
end;
$$;

-- Snapshot da DLQ da fila `scrape`, de hora em hora.
select cron.schedule(
  'capture-dlq-health-hourly',
  '0 * * * *',
  $cron$ SELECT public.capture_dlq_health_snapshots(); $cron$
);

-- Mesmo snapshot em janela de 10 minutos (job legado da Rodada #18).
select cron.schedule(
  'round18-capture-dlq-snapshots-10m',
  '*/10 * * * *',
  $cron$ SELECT public.capture_dlq_health_snapshots(); $cron$
);

-- Snapshot de latencia por rota (ultima hora), a cada 15 minutos.
select cron.schedule(
  'capture-api-latency-15min',
  '*/15 * * * *',
  $cron$ SELECT public.capture_api_latency_snapshots(1); $cron$
);

-- Retencoes diarias (30 dias de tendencia para os dois snapshots).
select cron.schedule(
  'prune-dlq-health-snapshots-daily',
  '23 3 * * *',
  $cron$ SELECT public.prune_dlq_health_snapshots(); $cron$
);

select cron.schedule(
  'prune-api-latency-snapshots-daily',
  '29 3 * * *',
  $cron$ SELECT public.prune_api_latency_snapshots(); $cron$
);

-- Expurgo diario da dead-letter da fila `scrape`.
select cron.schedule(
  'purge-dead-letter-daily',
  '17 3 * * *',
  $cron$ SELECT public.purge_dead_letter(); $cron$
);

-- Snapshot diario de SLA por motor de scraping.
select cron.schedule(
  'sla-snapshot-daily',
  '0 3 * * *',
  $cron$ SELECT public.capture_sla_snapshot(24); $cron$
);

-- Regressao do motor de scrape web: compara 24h contra os 7 dias anteriores.
select cron.schedule(
  'round19-web-scrape-regression-1h',
  '7 * * * *',
  $cron$ SELECT * FROM public.fn_web_scrape_regression_check(); $cron$
);
