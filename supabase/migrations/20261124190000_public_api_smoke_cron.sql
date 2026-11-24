-- ---------------------------------------------------------------------------
-- Smoke recorrente da API publica: gera trafego real a cada 15 min
-- ---------------------------------------------------------------------------
-- Medido em producao (24/11/2026): `api_request_logs` so tinha 13+10
-- requisicoes, todas 401 sem chave. Sem requisicao autenticada nao existe
-- snapshot (`capture_api_latency_snapshots` filtra organization_id), e sem
-- snapshot ficam vazios a latencia por rota, a quota (`api_rate_limits`) e os
-- alertas - nem `evaluate_api_latency_alerts()` nem `latency-alerts` tem o que
-- avaliar.
--
-- As 187 respostas 200 de 24/11 vieram de um smoke manual; sem invocador
-- recorrente a serie esvazia em 1h (janela do snapshot). Esta migration agenda
-- o cliente: 5 GETs autenticados por ciclo, sempre 3 min depois da captura
-- anterior e 3 min antes da proxima (smoke 2/17/32/47 -> captura 0/15/30/45 ->
-- avaliacao 5/20/35/50), para que todo snapshot tenha dado fresco do ciclo.
--
-- A chave NAO esta versionada: o job resolve o valor em tempo de execucao em
-- `vault.decrypted_secrets`, mesmo padrao de
-- `20261121190000_version_crons_with_vault_key.sql`. No replay do zero o Vault
-- esta vazio, entao o job nem e agendado - nada de 401 fantasma.
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
      from unnest(array['me','companies','deals','events','stakeholders']) as p;
    $cron$
  );

  raise notice 'public-api-smoke-15min agendado (jobid %)', v_job;
end $$;