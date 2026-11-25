-- ---------------------------------------------------------------------------
-- Aquecimento da API publica passa a exercitar o caminho autenticado
-- ---------------------------------------------------------------------------
-- O job `public-api-warmup-15min` (migration 20261124210000) chamava
-- `/public-api/me` SEM chave de proposito: o 401 pagava o boot do isolate sem
-- criar request autenticado, e `capture_api_latency_snapshots` filtra
-- `organization_id is not null`, entao o request frio nao entrava no p95.
--
-- O que ficou de fora: o 401 nao exercita o PostgREST nem a consulta. O
-- primeiro request autenticado do ciclo (o primeiro do smoke, 1 min depois)
-- ainda pagava o estabelecimento da conexao - medido em 24/11/2026:
--
--   instancia ociosa : 1963 ms | 711 ms | 843 ms
--   apos aquecimento : 1109 ms | 834 ms | 1124 ms
--
-- Custo medido em producao em 25/11/2026: 26 respostas 401 em 7 horas, todas
-- `Missing X-API-Key header`, que aparecem em `api_request_logs` como erro de
-- visitante e nao aquecem nada do caminho de dados.
--
-- Esta migration reagenda o job com a mesma chave do smoke
-- (`PUBLIC_API_SMOKE_KEY`, resolvida no Vault em tempo de execucao). Efeito:
-- o request do warmup passa a ter `organization_id`, portanto entra no
-- snapshot e na quota - trade-off aceito, e o 401 fantasma desaparece.
--
-- Sem segredo versionado: se o secret nao existir (replay do zero), o job NAO
-- e reagendado e continua o comportamento anterior (GET sem chave).
-- ---------------------------------------------------------------------------

do $$
declare
  v_job bigint;
  v_tem_secret boolean;
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    raise notice 'pg_cron ausente: public-api-warmup-15min nao reagendado';
    return;
  end if;

  if not exists (select 1 from pg_namespace where nspname = 'vault') then
    raise notice 'schema vault ausente: public-api-warmup-15min nao reagendado';
    return;
  end if;

  select exists(
    select 1 from vault.decrypted_secrets where name = 'PUBLIC_API_SMOKE_KEY'
  ) into v_tem_secret;

  if not v_tem_secret then
    raise notice 'PUBLIC_API_SMOKE_KEY ausente: mantendo o warmup sem chave';
    return;
  end if;

  begin
    perform cron.unschedule('public-api-warmup-15min');
  exception
    when others then
      null; -- job ainda nao existia
  end;

  v_job := cron.schedule(
    'public-api-warmup-15min',
    '1,16,31,46 * * * *',
    $cron$
      select net.http_get(
        url := 'https://pttzwlbidamibjssqiqb.supabase.co/functions/v1/public-api/me',
        headers := jsonb_build_object(
          'x-api-key', (select decrypted_secret from vault.decrypted_secrets where name = 'PUBLIC_API_SMOKE_KEY')
        ),
        timeout_milliseconds := 10000
      );
    $cron$
  );

  raise notice 'public-api-warmup-15min reagendado com chave (jobid %)', v_job;
end $$;