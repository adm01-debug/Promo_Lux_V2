-- ---------------------------------------------------------------------------
-- Warmup da API publica: nao agendar quando o secret da chave nao existe.
--
-- Medido em 25/11/2026 (producao, api_request_logs):
--   preview branch da PR #205 (`odexhqzszcdynuqodrkf`, criado 12:04:14) tinha
--   1 job de API - `public-api-warmup-15min @ 1,16,31,46` - e `vault.secrets`
--   com 0 entradas em `PUBLIC_API_SMOKE_KEY`. Resultado: 2 requests sem chave
--   em producao (12:16:01 e 12:31:00, IP 18.227.5.44, `Missing X-API-Key
--   header`), o mesmo padrao de 4 401/h que o warmup com chave veio corrigir.
--
-- Causa: num replay do zero (preview branch, banco efemero de CI) o secret nao
-- existe, mas
--   * `20261124210000_public_api_warmup_cron.sql` agenda o job sem chave, e
--   * `20261125130000_warmup_api_publica_com_chave.sql` mantem o job anterior
--     quando o secret falta (return).
-- Como a URL do cron e absoluta (producao), o ambiente sem secret passa a
-- bater na API de producao sem chave.
--
-- Correcao: sem o secret (ou sem o schema `vault`), nenhum job de warmup fica
-- agendado. Com o secret, nada muda - o job com chave da `20261125130000`
-- permanece.
-- ---------------------------------------------------------------------------

do $$
declare
  v_job bigint;
  v_tem_secret boolean;
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    raise notice 'pg_cron ausente: nada a fazer no warmup';
    return;
  end if;

  if exists (select 1 from pg_namespace where nspname = 'vault') then
    select exists(
      select 1 from vault.decrypted_secrets where name = 'PUBLIC_API_SMOKE_KEY'
    ) into v_tem_secret;
  else
    v_tem_secret := false;
  end if;

  if v_tem_secret then
    raise notice 'PUBLIC_API_SMOKE_KEY presente: warmup com chave mantido';
    return;
  end if;

  begin
    perform cron.unschedule('public-api-warmup-15min');
    raise notice 'PUBLIC_API_SMOKE_KEY ausente: public-api-warmup-15min desagendado';
  exception
    when others then
      raise notice 'PUBLIC_API_SMOKE_KEY ausente e nenhum warmup agendado';
  end;
end $$;