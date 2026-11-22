-- ---------------------------------------------------------------------------
-- Agendamento do avaliador de violacoes de isolamento por organizacao
-- ---------------------------------------------------------------------------
-- A function `org-violation-alerts` documenta no proprio cabecalho que roda
-- "por cron (pg_cron + pg_net), a cada 5 minutos", mas nenhum cron jamais foi
-- criado: `cron.job` nao tinha entrada apontando para ela e a tabela
-- `org_violation_alerts` estava com 0 linhas. O codigo estava pronto e a
-- funcionalidade nunca foi ligada — alerta de seguranca que ninguem recebia.
--
-- A chave vem do vault (mesmo padrao de 20261121230000) em vez de texto plano.
--
-- Idempotente: cron.unschedule em DO block com guarda, igual as demais
-- migrations de agendamento, para poder rodar em banco que ja tenha o job.

do $$
begin
  if exists (select 1 from cron.job where jobname = 'org-violation-alerts-5min') then
    perform cron.unschedule('org-violation-alerts-5min');
  end if;
end;
$$;

select cron.schedule(
  'org-violation-alerts-5min',
  '4-59/5 * * * *',
  $$
    SELECT net.http_post(
      url := 'https://pttzwlbidamibjssqiqb.supabase.co/functions/v1/org-violation-alerts',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'SUPABASE_SERVICE_ROLE_KEY'),
        'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'SUPABASE_SERVICE_ROLE_KEY')
      ),
      body := jsonb_build_object('trigger', 'cron', 'at', now()::text)
    );
  $$
);