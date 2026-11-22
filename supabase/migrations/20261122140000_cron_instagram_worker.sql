-- ---------------------------------------------------------------------------
-- Agendamento do worker de scraping do Instagram
-- ---------------------------------------------------------------------------
-- A function `instagram-worker` consome `instagram_scrape_queue` via
-- `claim_instagram_job`, mas nunca teve cron: `cron.job` nao tinha entrada
-- apontando para ela. Efeito pratico medido antes desta migration:
--   * `instagram_scrape_queue`, `_results` e `_dead_letter` com 0 linhas;
--   * o painel de enfileiramento insere a tarefa (status `queued`) e nada a
--     consome, porque o worker so roda quando alguem o invoca na mao.
-- O codigo estava pronto e a funcionalidade nunca foi ligada.
--
-- Schedule de 1 minuto: o worker processa um batch (INSTAGRAM_WORKER_BATCH,
-- default 3) e retorna; com fila vazia ele responde 200 `processed: 0` e
-- encerra sem custo relevante.
--
-- A chave vem do vault (mesmo padrao de 20261121230000/20261122130000) em vez
-- de texto plano.
--
-- Idempotente: cron.unschedule em DO block com guarda, igual as demais
-- migrations de agendamento, para poder rodar em banco que ja tenha o job.

do $$
begin
  if exists (select 1 from cron.job where jobname = 'instagram-worker-1min') then
    perform cron.unschedule('instagram-worker-1min');
  end if;
end;
$$;

select cron.schedule(
  'instagram-worker-1min',
  '* * * * *',
  $$
    SELECT net.http_post(
      url := 'https://pttzwlbidamibjssqiqb.supabase.co/functions/v1/instagram-worker',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'SUPABASE_SERVICE_ROLE_KEY'),
        'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'SUPABASE_SERVICE_ROLE_KEY')
      ),
      body := jsonb_build_object('trigger', 'cron', 'at', now()::text)
    );
  $$
);