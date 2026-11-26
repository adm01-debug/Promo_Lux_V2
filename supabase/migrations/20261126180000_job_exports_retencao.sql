-- ---------------------------------------------------------------------------
-- Retencao dos CSVs de exportacao de leads (bucket privado `job-exports`)
-- ---------------------------------------------------------------------------
-- Estado medido antes desta migration:
--   * `job_exports.file_url` passou a guardar o caminho do CSV no bucket
--     privado (`<user_id>/<job_id>/<export_id>.csv`) e nenhum processo apagava
--     esse arquivo: cada exportacao deixava nome, telefone e e-mail de lead
--     parado no storage para sempre.
--   * O dado em si NAO depende do arquivo: o CSV e derivado de
--     `scrape_results`, que segue intacto e pode ser exportado de novo em um
--     clique. Expurgar o arquivo antigo encerra a copia esquecida sem perder
--     funcionalidade.
--
-- O que entra aqui:
--   1. convergencia do CHECK de `job_exports.status` (ver nota abaixo);
--   2. indice parcial para a varredura do expurgo;
--   3. agendamento diario da function `prune-job-exports`, que apaga o objeto
--      pela Storage API e marca a linha como `expired`.
--
-- Nota sobre o status: o CHECK criado em 20260711194630 aceita
-- ('pending','processing','ready','failed'), mas as duas funcoes de exportacao
-- gravam 'completed' e o expurgo grava 'expired'. A constraint passa a ser o
-- superconjunto - nao invalida nenhuma linha existente e faz o UPDATE do
-- arquivo gravado passar a ser aceito.
--
-- Por que o expurgo e uma edge function: DELETE em `storage.objects` nao
-- remove o byte do backend; o arquivo tem de sair pela Storage API, o que exige
-- a service role. O SQL apenas agenda.
--
-- Idempotente: constraint recriada do zero, indice com IF NOT EXISTS e cron
-- com unschedule previo.
-- ---------------------------------------------------------------------------

alter table public.job_exports
  drop constraint if exists job_exports_status_check;

alter table public.job_exports
  add constraint job_exports_status_check
  check (status in ('pending','processing','ready','completed','expired','failed'));

comment on column public.job_exports.file_url is
  'Caminho do CSV no bucket privado job-exports. NULL quando o arquivo nunca foi gravado ou ja foi expurgado pela retencao (status = expired).';

create index if not exists idx_job_exports_expiravel
  on public.job_exports (created_at)
  where file_url is not null;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'job-exports-retencao-diaria') then
    perform cron.unschedule('job-exports-retencao-diaria');
  end if;
end;
$$;

-- 04:20 UTC: fora da janela dos demais crons (arquivamento 10 min, workers de
-- fila por minuto) para o expurgo nao competir com o processamento normal.
-- A chave vem do vault, mesmo padrao de 20261121230000/20261122280000.
select cron.schedule(
  'job-exports-retencao-diaria',
  '20 4 * * *',
  $$
    select net.http_post(
      url := 'https://pttzwlbidamibjssqiqb.supabase.co/functions/v1/prune-job-exports',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'SUPABASE_SERVICE_ROLE_KEY'),
        'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'SUPABASE_SERVICE_ROLE_KEY')
      ),
      body := jsonb_build_object('trigger', 'cron', 'retencao_dias', 90, 'at', now()::text)
    );
  $$
);