-- Retencao para as duas tabelas de log que crescem sem poda.
--
-- Levantamento em producao (21/11/2026):
--   cron.job_run_details  1.108.334 linhas  ~1013 MB  (cresce ~4 MB/dia)
--   qa_reaper_runs          164.631 linhas    ~26 MB  (cresce ~1.300 linhas/dia)
--
-- `cron.job_run_details` e a maior relacao do banco inteiro e nenhuma das duas
-- tinha poda: dos 12 `prune_*`/`purge_*` existentes, nenhum cobria essas duas.
-- Sem retencao o banco cresce para sempre e o backup/restore fica mais caro a
-- cada dia. Com 30 dias sobram ~293k linhas em job_run_details (de 1,1M).
--
-- `cron.job_run_details` pertence a `supabase_admin` e o role de aplicacao nao
-- tem CREATE no schema `cron`, entao o DELETE e feito em lotes pelo runid
-- (unico indice da tabela) para nao gerar um unico DELETE gigante e travar.

create or replace function public.prune_cron_job_run_details(
  _retention_days integer default 30,
  _batch integer default 20000
)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_total integer := 0;
  v_batch integer := 0;
begin
  -- Guarda: cron nao tem auth.uid(), mas se alguem chamar pela API REST com
  -- papel de usuario a funcao nao pode servir de ferramenta de limpeza.
  if auth.uid() is not null and not public.has_role(auth.uid(), 'admin') then
    raise exception 'Acesso negado: requer papel de administrador';
  end if;

  if _retention_days is null or _retention_days < 1 then
    raise exception 'retencao invalida: % (minimo 1 dia)', _retention_days;
  end if;

  if _batch is null or _batch < 1 or _batch > 200000 then
    raise exception 'lote invalido: % (entre 1 e 200000)', _batch;
  end if;

  loop
    delete from cron.job_run_details
    where runid in (
      select runid
      from cron.job_run_details
      where start_time < now() - make_interval(days => _retention_days)
      limit _batch
    );
    get diagnostics v_batch = row_count;
    v_total := v_total + v_batch;
    exit when v_batch < _batch;
  end loop;

  return v_total;
end;
$function$;

revoke all on function public.prune_cron_job_run_details(integer, integer)
  from public, anon, authenticated;
grant execute on function public.prune_cron_job_run_details(integer, integer)
  to service_role;

-- qa_reaper_runs: mesma retencao, no mesmo padrao dos outros prune_*.
create or replace function public.prune_qa_reaper_runs(_retention_days integer default 30)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_count integer := 0;
begin
  if auth.uid() is not null and not public.has_role(auth.uid(), 'admin') then
    raise exception 'Acesso negado: requer papel de administrador';
  end if;

  if _retention_days is null or _retention_days < 1 then
    raise exception 'retencao invalida: % (minimo 1 dia)', _retention_days;
  end if;

  with del as (
    delete from public.qa_reaper_runs
    where ran_at < now() - make_interval(days => _retention_days)
    returning 1
  )
  select count(*) into v_count from del;

  return v_count;
end;
$function$;

revoke all on function public.prune_qa_reaper_runs(integer) from public, anon, authenticated;
grant execute on function public.prune_qa_reaper_runs(integer) to service_role;

-- Agenda diaria, no mesmo horario da familia prune-*-daily (03h) para nao
-- competir com os jobs de coleta. cron.schedule e idempotente pelo nome: reaplicar
-- a migration atualiza o agendamento em vez de duplicar.
select cron.schedule(
  'prune-cron-job-run-details-daily',
  '41 3 * * *',
  $$SELECT public.prune_cron_job_run_details(30, 20000);$$
);

select cron.schedule(
  'prune-qa-reaper-runs-daily',
  '47 3 * * *',
  $$SELECT public.prune_qa_reaper_runs(30);$$
);
