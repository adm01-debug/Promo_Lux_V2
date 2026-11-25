-- ---------------------------------------------------------------------------
-- Consolida o alerta de latencia numa unica fonte: evaluate_api_latency_alerts()
-- ---------------------------------------------------------------------------
-- O mesmo alerta vinha sendo decidido por duas rotinas com regras diferentes:
--
--   job 20  latency-alerts-15min  (*/15, minutos 0/15/30/45)
--           -> edge function `latency-alerts`: notifica no PRIMEIRO p95 acima de
--              `p95_critical_ms` observado nos ultimos 30 min; cooldown por
--              organizacao, ignorando a rota; nunca avaliou taxa de erro.
--
--   job 117 evaluate-api-latency-15min (minutos 5/20/35/50)
--           -> evaluate_api_latency_alerts(): exige `consecutive` ciclos
--              consecutivos, cooldown por rota, e tambem cobre a taxa de erro
--              5xx (migration 20261124240000).
--
-- As duas escrevem em `api_latency_alert_history` e o cooldown de latencia da
-- funcao SQL (`... and error_rate is null`) nao distingue a origem, entao uma
-- linha gravada pela edge function bloqueia a SQL pelo cooldown inteiro.
--
-- Medido em producao em 25/11/2026: as 4 unicas linhas do historico (24/11
-- 14:50 e 15:20) estao TODAS nos minutos 20/50, que sao a agenda do job 117.
-- Nenhuma linha em minuto 0/15/30/45. Ou seja, quem decide hoje e a funcao SQL
-- - e o limiar de 3 ciclos que ela aplica e o que vale.
--
-- Fica uma fonte so: a SQL, que aplica o limiar de 3 ciclos e enxerga 5xx.
-- A edge function `latency-alerts` sai do repositorio no mesmo commit. Nenhum
-- chamador no repositorio aponta para ela (verificado por grep) e nenhuma outra
-- rotina le as linhas que ela gravava.
-- ---------------------------------------------------------------------------

do $$
declare
  v_job bigint;
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    raise notice 'pg_cron ausente: nada a desagendar';
    return;
  end if;

  select jobid into v_job from cron.job where jobname = 'latency-alerts-15min';
  if v_job is null then
    raise notice 'latency-alerts-15min ja nao existe';
    return;
  end if;

  perform cron.unschedule(v_job);
  raise notice 'latency-alerts-15min desagendado (jobid %)', v_job;
end $$;