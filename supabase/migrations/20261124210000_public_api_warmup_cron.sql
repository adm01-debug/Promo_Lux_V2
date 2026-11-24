-- ---------------------------------------------------------------------------
-- Aquecimento da API publica 1 min antes do smoke: tira o cold start do p95
-- ---------------------------------------------------------------------------
-- Medido em producao em `api_request_logs` (3 dias, so o trafego do smoke):
--
--   resource      n    p50   p95   pico
--   me           96    967  2226  2759
--   events       30    686  2129  2703
--   companies    29    668  1720  2097
--   deals        29    707  1643  1895
--   stakeholders 18    428  1283  1406
--   (sem chave)  23      2   478   487
--
-- `me` e o primeiro item do array do smoke (migration 20261124190000), entao
-- paga o boot da instancia depois de 15 min de ociosidade. Com 5 amostras por
-- ciclo, 1 request frio ja e o p95: o alerta de 1500 ms mede provisionamento,
-- nao latencia. Medido chamando /me em sequencia em 24/11/2026:
--
--   instancia ociosa : 1963 ms  |  711 ms  |  843 ms
--   apos aquecimento : 1109 ms  |  834 ms  | 1124 ms
--
-- O aquecimento corta ~850 ms do primeiro request, mas NAO zera: o primeiro uso
-- autenticado ainda estabelece a conexao do supabase-js com o PostgREST. Por
-- isso ele e um job separado, 1 min antes (warmup 1/16/31/46 -> smoke
-- 2/17/32/47) e sem chave: o 401 paga o boot do isolate sem criar trafego
-- autenticado. `capture_api_latency_snapshots` filtra `organization_id IS NOT
-- NULL` (verificado em producao), entao esse request nunca entra em snapshot,
-- alerta ou quota - o p95 passa a medir a API quente.
--
-- `net.http_get` e assincrono e os 5 endpoints do smoke saem no mesmo statement,
-- por isso nao da para aquecer dentro do proprio ciclo.
--
-- Sem segredo versionado: o job nao depende do Vault e no replay do zero e
-- inofensivo (um GET que recebe 401).
-- ---------------------------------------------------------------------------

do $$
declare
  v_job bigint;
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    raise notice 'pg_cron ausente: public-api-warmup-15min nao agendado';
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
        timeout_milliseconds := 10000
      );
    $cron$
  );

  raise notice 'public-api-warmup-15min agendado (jobid %)', v_job;
end $$;