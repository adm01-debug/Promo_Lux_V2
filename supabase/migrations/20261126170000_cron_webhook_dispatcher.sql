-- ---------------------------------------------------------------------------
-- Agendamento do entregador de webhooks (G16-2 / etapa 056)
-- ---------------------------------------------------------------------------
-- O gatilho de banco enfileira cada evento como entrega `pending` em
-- `webhook_deliveries` (20260422203255, gatilhos em :119-124), mas nenhuma
-- migration agendava `webhook-dispatcher`: a busca pelo nome em
-- `supabase/migrations/` devolvia apenas comentarios. O consumidor existe
-- desde entao — o unico chamador no repositorio era o botao de reenvio da
-- interface (`src/hooks/useWebhooks.ts:125`). Resultado: entrega enfileirada
-- ficava parada, sem erro nenhum, esperando alguem clicar.
--
-- Por que a cada minuto: a espera entre tentativas e 30s, 2m, 8m e 30m
-- (`webhook-dispatcher/index.ts:27-31`, `nextRetry`). Um ciclo por minuto
-- atende a primeira retentativa com ate 30s de atraso e nao paga chamada
-- demais: cada invocacao envia no maximo BATCH = 25 entregas (`:16`) e a
-- reserva e atomica (`:99-104`).
--
-- Backlog acumulado nao sai "todo de uma vez": o teto e por invocacao, nao por
-- fila — 25 entregas por minuto. Ciclo sobreposto ou reenvio manual nao
-- duplicam envio: a segunda invocacao reencontra as linhas ja em `sending` e
-- nao as envia de novo.
--
-- Idempotente por comando, nao so por nome: antes de agendar, remove qualquer
-- job de `cron.job` cujo comando cite `webhook-dispatcher`. Se o painel tiver
-- um agendamento com outro nome, dois agendadores passariam a disputar a mesma
-- fila — a reserva atomica evita envio duplicado, mas nao o trabalho dobrado.
--
-- A chave e resolvida em tempo de execucao do job (subquery no vault), como nos
-- 18 crons de 20261121190000: o replay do zero (vault vazio) aplica sem erro e o
-- job passa a autenticar quando o secret existir. Nada de segredo versionado.
--
-- O gatilho de banco NAO chama o entregador: chamada de rede dentro do gatilho
-- travaria a transacao de escrita do cliente.
-- ---------------------------------------------------------------------------

do $$
declare
  v_job bigint;
  r record;
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    raise notice 'pg_cron ausente: webhook-dispatcher-1min nao agendado';
    return;
  end if;

  for r in select jobid from cron.job where command ilike '%webhook-dispatcher%' loop
    perform cron.unschedule(r.jobid);
  end loop;

  v_job := cron.schedule(
    'webhook-dispatcher-1min',
    '* * * * *',
    $job$
      select net.http_post(
        url := 'https://pttzwlbidamibjssqiqb.supabase.co/functions/v1/webhook-dispatcher',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'SUPABASE_SERVICE_ROLE_KEY'),
          'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'SUPABASE_SERVICE_ROLE_KEY')
        ),
        body := jsonb_build_object('trigger', 'cron', 'at', now()),
        timeout_milliseconds := 60000
      );
    $job$
  );

  raise notice 'webhook-dispatcher-1min agendado (jobid %)', v_job;
end $$;
