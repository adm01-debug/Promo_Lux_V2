-- ---------------------------------------------------------------------------
-- Fecha o ciclo dos alertas de latencia da API
-- ---------------------------------------------------------------------------
-- `capture-api-latency-15min` grava snapshots a cada 15 min, mas
-- `public.evaluate_api_latency_alerts()` — que compara os snapshots com os
-- limites de `api_latency_alert_settings` e notifica os admins da organizacao —
-- nunca era chamada por nenhum agendamento: sua unica chamada vinha da edge
-- function `api-latency-alerts`, sem invocador no app, nos workflows ou no
-- pg_cron. Efeito: `api_latency_alert_history` ficava permanentemente vazia e
-- nenhum alerta era emitido, mesmo com limites configurados pela UI.
--
-- Avaliacao roda 5 min depois de cada captura (captura: 0/15/30/45 ->
-- avaliacao: 5/20/35/50), sobre snapshots recem-gravados.
-- ---------------------------------------------------------------------------

do $$
declare
  v_job bigint;
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    raise notice 'pg_cron ausente: evaluate-api-latency-15min nao agendado';
    return;
  end if;

  begin
    perform cron.unschedule('evaluate-api-latency-15min');
  exception
    when others then
      null; -- job ainda nao existia
  end;

  v_job := cron.schedule(
    'evaluate-api-latency-15min',
    '5,20,35,50 * * * *',
    $cron$ SELECT public.evaluate_api_latency_alerts(); $cron$
  );

  raise notice 'evaluate-api-latency-15min agendado (jobid %)', v_job;
end $$;