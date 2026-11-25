-- ---------------------------------------------------------------------------
-- Arquivo de 7 dias do resultado HTTP das edge functions chamadas pelo cron
-- ---------------------------------------------------------------------------
-- Medido em producao em 25/11/2026, na auditoria de `cron.job_run_details`:
--
--   * 41 rotinas com execucao em 7 dias, 0 `failed` - o pg_cron nao perdeu
--     nenhuma execucao do statement.
--   * `net._http_response` guarda apenas ~6 h (2.509 linhas no momento da
--     medicao, com prune automatico do pg_net).
--   * `net.http_request_queue` esta vazia: a URL do request e descartada
--     depois que o worker processa, entao a resposta nao vem com o destino.
--
-- Consequencia: o cron chama as edge functions por `net.http_post`, que e
-- assincrono. O statement termina em milissegundos e o pg_cron grava
-- `succeeded` mesmo quando a funcao responde 500. Somando com as 6 h de
-- retencao, uma funcao que quebra de madrugada nao deixa prova nenhuma no dia
-- seguinte - foi exatamente o que aconteceu com `latency-alerts` (672
-- execucoes `succeeded` em 7 dias enquanto a funcao nao produzia alerta).
--
-- Esta migration cria o arquivo:
--   1. copia `net._http_response` para `public.cron_http_archive` a cada 10
--      min, antes do prune do pg_net;
--   2. resolve o `jobname` casando `response.created` com
--      `cron.job_run_details.start_time` numa janela de 10 s (o request nasce
--      no inicio do run e a resposta chega ate 5 s depois, que e o timeout
--      maximo usado pelos jobs);
--   3. poda tudo com mais de 7 dias;
--   4. notifica os admins quando aparece 5xx ou timeout, com dedupe de 1 h
--      por `jobname` - sem isso o arquivo seria uma tabela que ninguem olha.
--
-- A tabela e de infraestrutura: RLS ligada, sem policy e sem grant para
-- `anon`/`authenticated`. Quem consulta e a service role e a notificacao.
-- ---------------------------------------------------------------------------

create table if not exists public.cron_http_archive (
  response_id      bigint primary key,
  jobid            bigint,
  jobname          text,
  status_code      integer,
  timed_out        boolean not null default false,
  error_msg        text,
  response_created timestamptz not null,
  archived_at      timestamptz not null default now()
);

comment on table public.cron_http_archive is
  'Resposta HTTP das edge functions agendadas pelo cron, preservada por 7 dias. O pg_net mantem apenas ~6 h.';

create index if not exists cron_http_archive_created_idx
  on public.cron_http_archive (response_created desc);

create index if not exists cron_http_archive_falhas_idx
  on public.cron_http_archive (response_created desc)
  where status_code >= 500 or timed_out;

alter table public.cron_http_archive enable row level security;
revoke all on public.cron_http_archive from anon, authenticated;
grant select on public.cron_http_archive to service_role;

create or replace function public.archive_cron_http_results()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_linhas integer := 0;
  v_falha  record;
  v_org    uuid;
  v_admin  uuid;
begin
  if to_regclass('net._http_response') is null then
    raise notice 'pg_net ausente: nada a arquivar';
    return 0;
  end if;

  insert into public.cron_http_archive
    (response_id, jobid, jobname, status_code, timed_out, error_msg, response_created)
  select
    r.id,
    d.jobid,
    d.jobname,
    r.status_code,
    coalesce(r.timed_out, false),
    r.error_msg,
    r.created
  from net._http_response r
  left join lateral (
    select x.jobid, j.jobname
    from cron.job_run_details x
    join cron.job j on j.jobid = x.jobid
    where x.start_time between r.created - interval '10 seconds' and r.created + interval '2 seconds'
    order by abs(extract(epoch from (x.start_time - r.created)))
    limit 1
  ) d on true
  where r.created > now() - interval '60 minutes'
  on conflict (response_id) do nothing;

  get diagnostics v_linhas = row_count;

  delete from public.cron_http_archive
  where response_created < now() - interval '7 days';

  for v_falha in
    select a.jobname,
           count(*)              as chamadas,
           max(a.status_code)    as pior_status,
           bool_or(a.timed_out)  as teve_timeout
    from public.cron_http_archive a
    where a.response_created > now() - interval '15 minutes'
      and (a.status_code >= 500 or a.timed_out)
    group by a.jobname
  loop
    if exists (
      select 1
      from public.notifications n
      where n.metadata->>'kind' = 'cron_http_error'
        and coalesce(n.metadata->>'jobname', '') = coalesce(v_falha.jobname, '')
        and n.created_at > now() - interval '1 hour'
    ) then
      continue;
    end if;

    for v_org in
      select organization_id from public.api_latency_alert_settings where enabled
    loop
      for v_admin in
        select user_id from public.organization_members
        where organization_id = v_org and role = 'admin'
      loop
        insert into public.notifications (user_id, organization_id, type, title, message, metadata)
        values (
          v_admin,
          v_org,
          'system',
          'Edge function agendada falhando',
          format(
            '%s: %s chamada(s) com %s nos ultimos 15 min.',
            coalesce(v_falha.jobname, 'job sem correlacao de horario'),
            v_falha.chamadas,
            case when v_falha.teve_timeout then 'timeout' else 'HTTP ' || coalesce(v_falha.pior_status::text, '?') end
          ),
          jsonb_build_object(
            'kind', 'cron_http_error',
            'jobname', v_falha.jobname,
            'status_code', v_falha.pior_status,
            'timed_out', v_falha.teve_timeout,
            'calls', v_falha.chamadas
          )
        );
      end loop;
    end loop;
  end loop;

  return v_linhas;
end
$fn$;

comment on function public.archive_cron_http_results() is
  'Copia net._http_response para cron_http_archive (7 dias), resolve o jobname pelo horario do run e notifica 5xx/timeout.';

do $$
declare
  v_job bigint;
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    raise notice 'pg_cron ausente: cron-http-archive-10min nao agendado';
    return;
  end if;

  begin
    perform cron.unschedule('cron-http-archive-10min');
  exception
    when others then
      null; -- job ainda nao existia
  end;

  v_job := cron.schedule(
    'cron-http-archive-10min',
    '*/10 * * * *',
    $cron$ select public.archive_cron_http_results(); $cron$
  );

  raise notice 'cron-http-archive-10min agendado (jobid %)', v_job;
end $$;