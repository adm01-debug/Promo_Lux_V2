-- Versiona os 18 crons HTTP de edge functions que viviam apenas no dashboard.
-- A chave e resolvida em tempo de execucao do job (subquery no vault), nunca na
-- migration: assim o replay do zero (banco efemero, vault vazio) aplica sem erro
-- e o job so passa a autenticar quando o secret existir.

do $$
declare
  r record;
begin

  -- job 15: campaign-dispatch-10min
  perform cron.schedule('campaign-dispatch-10min', '*/10 * * * *', $job$
      SELECT net.http_post(url:='https://pttzwlbidamibjssqiqb.supabase.co/functions/v1/campaign-dispatch',headers:=('{"Content-Type":"application/json"}'::jsonb || jsonb_build_object('apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'SUPABASE_SERVICE_ROLE_KEY'), 'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'SUPABASE_SERVICE_ROLE_KEY'))),body:=concat('{"time":"',now(),'"}')::jsonb);
  $job$);

  -- job 16: circuit-breaker-alerts-every-5min
  perform cron.schedule('circuit-breaker-alerts-every-5min', '*/5 * * * *', $job$
      SELECT net.http_post(url:='https://pttzwlbidamibjssqiqb.supabase.co/functions/v1/circuit-breaker-alerts',headers:=('{"Content-Type":"application/json"}'::jsonb || jsonb_build_object('apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'SUPABASE_SERVICE_ROLE_KEY'), 'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'SUPABASE_SERVICE_ROLE_KEY'))),body:=jsonb_build_object('scheduled_at',now()));
  $job$);

  -- job 17: cnpj-enrich-worker-every-2min
  perform cron.schedule('cnpj-enrich-worker-every-2min', '*/2 * * * *', $job$
      
        SELECT net.http_post(
          url := 'https://pttzwlbidamibjssqiqb.supabase.co/functions/v1/cnpj-enrich-worker',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'SUPABASE_SERVICE_ROLE_KEY'),
            'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'SUPABASE_SERVICE_ROLE_KEY')
          ),
          body := jsonb_build_object('trigger','cron','at',now())
        );
  $job$);

  -- job 18: dlq-alerts-15min
  perform cron.schedule('dlq-alerts-15min', '*/15 * * * *', $job$
      SELECT net.http_post(url:='https://pttzwlbidamibjssqiqb.supabase.co/functions/v1/dlq-alerts',headers:=('{"Content-Type":"application/json"}'::jsonb || jsonb_build_object('apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'SUPABASE_SERVICE_ROLE_KEY'), 'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'SUPABASE_SERVICE_ROLE_KEY'))),body:='{}'::jsonb);
  $job$);

  -- job 19: email-poll-replies-5min
  perform cron.schedule('email-poll-replies-5min', '*/5 * * * *', $job$
      SELECT net.http_post(url:='https://pttzwlbidamibjssqiqb.supabase.co/functions/v1/email-poll-replies',headers:=('{"Content-Type":"application/json"}'::jsonb || jsonb_build_object('apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'SUPABASE_SERVICE_ROLE_KEY'), 'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'SUPABASE_SERVICE_ROLE_KEY'))),body:=concat('{"time":"',now(),'"}')::jsonb);
  $job$);

  -- job 20: latency-alerts-15min
  perform cron.schedule('latency-alerts-15min', '*/15 * * * *', $job$
      SELECT net.http_post(url:='https://pttzwlbidamibjssqiqb.supabase.co/functions/v1/latency-alerts',headers:=('{"Content-Type":"application/json"}'::jsonb || jsonb_build_object('apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'SUPABASE_SERVICE_ROLE_KEY'), 'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'SUPABASE_SERVICE_ROLE_KEY'))),body:='{}'::jsonb);
  $job$);

  -- job 21: pg-net-watchdog-30m
  perform cron.schedule('pg-net-watchdog-30m', '*/30 * * * *', $job$
      SELECT net.http_post(url:='https://pttzwlbidamibjssqiqb.supabase.co/functions/v1/pg-net-watchdog',headers:=('{"Content-Type":"application/json"}'::jsonb || jsonb_build_object('apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'SUPABASE_SERVICE_ROLE_KEY'), 'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'SUPABASE_SERVICE_ROLE_KEY'))),body:=jsonb_build_object('trigger','cron','ts',now()));
  $job$);

  -- job 22: process-scrape-queue
  perform cron.schedule('process-scrape-queue', '* * * * *', $job$
      SELECT net.http_post(url:='https://pttzwlbidamibjssqiqb.supabase.co/functions/v1/scrape-queue-worker',headers:=('{"Content-Type":"application/json"}'::jsonb || jsonb_build_object('apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'SUPABASE_SERVICE_ROLE_KEY'), 'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'SUPABASE_SERVICE_ROLE_KEY'))),body:=concat('{"ts":"',now(),'"}')::jsonb);
  $job$);

  -- job 23: purge-soft-deleted-daily
  perform cron.schedule('purge-soft-deleted-daily', '0 3 * * *', $job$
      SELECT net.http_post(url:='https://pttzwlbidamibjssqiqb.supabase.co/functions/v1/purge-soft-deleted',headers:=('{"Content-Type":"application/json"}'::jsonb || jsonb_build_object('apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'SUPABASE_SERVICE_ROLE_KEY'), 'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'SUPABASE_SERVICE_ROLE_KEY'))),body:=concat('{"time":"',now(),'"}')::jsonb);
  $job$);

  -- job 24: reaper-alerts-30min
  perform cron.schedule('reaper-alerts-30min', '*/30 * * * *', $job$
      SELECT net.http_post(url:='https://pttzwlbidamibjssqiqb.supabase.co/functions/v1/reaper-alerts',headers:=('{"Content-Type":"application/json"}'::jsonb || jsonb_build_object('apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'SUPABASE_SERVICE_ROLE_KEY'), 'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'SUPABASE_SERVICE_ROLE_KEY'))),body:='{}'::jsonb);
  $job$);

  -- job 25: retry-policy-tuner-daily
  perform cron.schedule('retry-policy-tuner-daily', '0 3 * * *', $job$
      SELECT net.http_post(url:='https://pttzwlbidamibjssqiqb.supabase.co/functions/v1/retry-policy-tuner',headers:=('{"Content-Type":"application/json"}'::jsonb || jsonb_build_object('apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'SUPABASE_SERVICE_ROLE_KEY'), 'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'SUPABASE_SERVICE_ROLE_KEY'))),body:='{}'::jsonb);
  $job$);

  -- job 26: sla-alerts-hourly
  perform cron.schedule('sla-alerts-hourly', '7 * * * *', $job$
      SELECT net.http_post(url:='https://pttzwlbidamibjssqiqb.supabase.co/functions/v1/sla-alerts',headers:=('{"Content-Type":"application/json"}'::jsonb || jsonb_build_object('apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'SUPABASE_SERVICE_ROLE_KEY'), 'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'SUPABASE_SERVICE_ROLE_KEY'))),body:=concat('{"time":"',now(),'"}')::jsonb);
  $job$);

  -- job 27: sla-auto-tune-daily
  perform cron.schedule('sla-auto-tune-daily', '20 4 * * *', $job$
      SELECT net.http_post(url:='https://pttzwlbidamibjssqiqb.supabase.co/functions/v1/sla-auto-tune',headers:=('{"Content-Type":"application/json"}'::jsonb || jsonb_build_object('apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'SUPABASE_SERVICE_ROLE_KEY'), 'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'SUPABASE_SERVICE_ROLE_KEY'))),body:=concat('{"hours":168,"min_drift_pct":20,"at":"',now(),'"}')::jsonb);
  $job$);

  -- job 28: sync-gmaps-jobs
  perform cron.schedule('sync-gmaps-jobs', '* * * * *', $job$
      SELECT net.http_get(url:='https://pttzwlbidamibjssqiqb.supabase.co/functions/v1/gmaps-proxy?action=list',headers:=('{"Content-Type":"application/json"}'::jsonb || jsonb_build_object('apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'SUPABASE_SERVICE_ROLE_KEY'), 'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'SUPABASE_SERVICE_ROLE_KEY'))));
  $job$);

  -- job 29: vault-cookie-health-daily
  perform cron.schedule('vault-cookie-health-daily', '0 9 * * *', $job$
      SELECT net.http_post(url:='https://pttzwlbidamibjssqiqb.supabase.co/functions/v1/vault-cookie-health',headers:=jsonb_build_object('Content-Type','application/json','apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'SUPABASE_SERVICE_ROLE_KEY'), 'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'SUPABASE_SERVICE_ROLE_KEY')),body:=jsonb_build_object('trigger','cron','scheduled_at',now()::text));
  $job$);

  -- job 30: web-scrape-worker-30s
  perform cron.schedule('web-scrape-worker-30s', '30 seconds', $job$
      SELECT net.http_post(url:='https://pttzwlbidamibjssqiqb.supabase.co/functions/v1/web-scrape-worker',headers:=('{"Content-Type":"application/json"}'::jsonb || jsonb_build_object('apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'SUPABASE_SERVICE_ROLE_KEY'), 'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'SUPABASE_SERVICE_ROLE_KEY'))),body:='{}'::jsonb);
  $job$);

  -- job 31: campaign-dispatch-every-10min
  perform cron.schedule('campaign-dispatch-every-10min', '*/10 * * * *', $job$
      select net.http_post(
          url:='https://pttzwlbidamibjssqiqb.supabase.co/functions/v1/campaign-dispatch',
          headers:=('{"Content-Type":"application/json"}'::jsonb || jsonb_build_object('apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'SUPABASE_SERVICE_ROLE_KEY'), 'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'SUPABASE_SERVICE_ROLE_KEY'))),
          body:=concat('{"scheduled_at": "', now(), '"}')::jsonb
        ) as request_id;
  $job$);
  perform cron.alter_job((select jobid from cron.job where jobname = 'campaign-dispatch-every-10min'), active := false);

  -- job 32: round18-dlq-alerts-15m
  perform cron.schedule('round18-dlq-alerts-15m', '*/15 * * * *', $job$
      SELECT net.http_post(
          url := 'https://pttzwlbidamibjssqiqb.supabase.co/functions/v1/dlq-alerts',
          headers:=('{"Content-Type":"application/json"}'::jsonb || jsonb_build_object('apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'SUPABASE_SERVICE_ROLE_KEY'), 'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'SUPABASE_SERVICE_ROLE_KEY'))),
          body := jsonb_build_object('trigger','cron','ts', now())
        );
  $job$);
  perform cron.alter_job((select jobid from cron.job where jobname = 'round18-dlq-alerts-15m'), active := false);
end $$;
