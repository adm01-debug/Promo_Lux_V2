-- ---------------------------------------------------------------------------
-- Smoke tambem chama o filtro `?action=` do GET /events
-- ---------------------------------------------------------------------------
-- Em 24/11/2026 o `?action=` do GET /events respondia 500 em 100% das chamadas
-- (corrigido na 20261124220000: `audit_logs.user_id` nao existia). Ninguem
-- usava o filtro, entao nada quebrou do lado do cliente - e o smoke de 15 min
-- tambem nao cobria esse caminho: os 5 GETs agendados na 20261124190000 nao
-- passam query string nenhuma. Se a regressao voltar, fica invisivel de novo.
--
-- Verificado em producao antes de reagendar (24/11/2026 17:25 UTC), com a chave
-- do proprio smoke: os 7 GETs abaixo respondem 200, incluindo
-- `events?limit=3&action=UPDATE` (4140 bytes) e `events?limit=3&action=INSERT`
-- (3726 bytes).
--
-- Por que isso vira alarme: um 500 no `?action=` entra em
-- `api_request_logs.status_code` (o painel de monitoramento mostra a taxa de
-- erro por rota, aviso em 1%) e em `net._http_response`, que `pg_net_health(24)`
-- conta como erro (`status_code IS NULL OR status_code >= 500`) e o
-- `pg-net-watchdog` alerta acima de 5%. `evaluate_api_latency_alerts()` so olha
-- p95 - taxa de erro nao gera alerta hoje.
--
-- 7 GETs por ciclo (eram 5), no mesmo horario: 2/17/32/47, depois do aquecimento
-- (1/16/31/46), depois da captura (0/15/30/45) e antes da avaliacao
-- (5/20/35/50). `me` continua sendo o primeiro da lista para pagar o boot logo
-- depois do warmup.
--
-- A chave NAO esta versionada: o job resolve o valor em tempo de execucao em
-- `vault.decrypted_secrets`. No replay do zero o Vault esta vazio, entao o job
-- nem e agendado - nada de 401 fantasma.
-- ---------------------------------------------------------------------------

do $$
declare
  v_job bigint;
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    raise notice 'pg_cron ausente: public-api-smoke-15min nao agendado';
    return;
  end if;

  if not exists (select 1 from pg_namespace where nspname = 'vault') then
    raise notice 'schema vault ausente: public-api-smoke-15min nao agendado';
    return;
  end if;

  if not exists (select 1 from vault.decrypted_secrets where name = 'PUBLIC_API_SMOKE_KEY') then
    raise notice 'secret PUBLIC_API_SMOKE_KEY ausente: public-api-smoke-15min nao agendado';
    return;
  end if;

  begin
    perform cron.unschedule('public-api-smoke-15min');
  exception
    when others then
      null; -- job ainda nao existia
  end;

  v_job := cron.schedule(
    'public-api-smoke-15min',
    '2,17,32,47 * * * *',
    $cron$
      select net.http_get(
        url := 'https://pttzwlbidamibjssqiqb.supabase.co/functions/v1/public-api/' || p,
        headers := jsonb_build_object(
          'x-api-key', (select decrypted_secret from vault.decrypted_secrets where name = 'PUBLIC_API_SMOKE_KEY')
        ),
        timeout_milliseconds := 10000
      )
      from unnest(array[
        'me',
        'companies',
        'deals',
        'events',
        'events?limit=3&action=UPDATE',
        'events?limit=3&action=INSERT',
        'stakeholders'
      ]) as p;
    $cron$
  );

  raise notice 'public-api-smoke-15min reagendado com o filtro action (jobid %)', v_job;
end $$;