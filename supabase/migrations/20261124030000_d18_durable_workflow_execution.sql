-- ============================================================
-- D18 (reconstrucao): Durable Workflow Execution
-- ============================================================
-- A migration original (20260722000001) foi commitada como blob base64
-- corrompido e neutralizada como no-op. Nenhum objeto dela existe hoje:
-- workflow_run_events, claim_workflow_run, complete_workflow_step,
-- fail_workflow_step.
--
-- Efeito real em producao: `workflow-engine` (supabase/functions/
-- workflow-engine/index.ts:241) cria UM registro em `workflow_runs` com
-- status="running" e executa os 3 passos dentro da mesma invocacao HTTP.
-- Nao existe lock nem idempotencia:
--   * dois cliques simultaneos em "Executar" criam dois runs que duplicam
--     scrape + enrich + score sobre os mesmos dados;
--   * a Edge Function tem timeout de 150s/400s; se estourar no meio, o run
--     fica travado em "running" para sempre, sem retomada;
--   * "retry-step" (linha 172) volta o step para "pending" mas nada reivindica
--     o trabalho — o retry nunca executa.
--
-- Esta migration reconstroi a intencao original com o minimo que o runtime
-- realmente precisa: uma fila de eventos por run, um claim atomico com lease
-- (evita dois workers no mesmo run) e funcoes de conclusao/falha por passo.
-- ============================================================

create table if not exists public.workflow_run_events (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.workflow_runs(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  -- Tipo do evento: registro de estado por passo + marcos do run.
  event_type text not null,
  step_name text,
  -- Chave de idempotencia: evita registrar o mesmo evento duas vezes quando
  -- o worker e reinvocado apos um lease expirado.
  dedupe_key text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint workflow_run_events_type_check check (
    event_type in ('run_claimed','step_started','step_completed','step_failed','run_completed','run_failed')
  )
);

create unique index if not exists uq_workflow_run_events_dedupe
  on public.workflow_run_events(run_id, dedupe_key)
  where dedupe_key is not null;
create index if not exists idx_workflow_run_events_run
  on public.workflow_run_events(run_id, created_at desc);
create index if not exists idx_workflow_run_events_org
  on public.workflow_run_events(organization_id, created_at desc);

-- Lease do worker. Separa "o run esta em execucao" (status) de "quem esta
-- executando agora" (lock): um worker morto deixa o lease expirar e outro
-- assume, sem precisar de processo de reaper.
alter table public.workflow_runs
  add column if not exists locked_by text,
  add column if not exists locked_until timestamptz,
  add column if not exists heartbeat_at timestamptz,
  add column if not exists attempt integer not null default 0;

create index if not exists idx_workflow_runs_claim
  on public.workflow_runs(status, locked_until)  where status in ('pending','queued','running');

-- Um workflow nao pode ter dois runs ativos ao mesmo tempo. Este e o guard real
-- contra clique duplo: mesmo que duas requisicoes passem pela checagem
-- otimista do claim, o banco rejeita a segunda insercao.
--
-- Bancos existentes podem ja ter runs orfaos em 'running' (de antes desta
-- migration, quando o catch do handler nao marcava failed). Sem este backfill o
-- indice unico falharia na criacao. Runs sem lease e com mais de 1h sao
-- comprovadamente mortos: nenhuma execucao do workflow-engine dura isso.
update public.workflow_runs
   set status = 'failed',
       error_message = coalesce(error_message, 'run orfao: processo morreu sem marcar failed'),
       completed_at = coalesce(completed_at, now()),
       locked_by = null,
       locked_until = null
 where status in ('pending','queued','running')
   and locked_by is null
   and created_at < now() - interval '1 hour';

create unique index if not exists uq_workflow_runs_one_active
  on public.workflow_runs(workflow_id) where status in ('pending','queued','running');

alter table public.workflow_run_events enable row level security;

create policy "Members view workflow_run_events" on public.workflow_run_events
  for select to authenticated
  using (public.is_org_member(organization_id, auth.uid()));
create policy "Service manage workflow_run_events" on public.workflow_run_events
  for all to service_role using (true) with check (true);

-- Eventos sao append-only: o runtime so insere. DELETE em cascata quando o
-- run e removido continua funcionando (a FK e on delete cascade); UPDATE e
-- bloqueado por trigger porque corromperia a trilha de auditoria da execucao.
revoke insert, update, delete on public.workflow_run_events from authenticated;

create or replace function public.prevent_workflow_run_events_update()
returns trigger
language plpgsql
as $$
begin
  raise exception 'workflow_run_events e append-only: UPDATE nao permitido (run %)', old.run_id
    using errcode = '42501';
end;
$$;

create trigger trg_workflow_run_events_no_update
  before update on public.workflow_run_events
  for each row execute function public.prevent_workflow_run_events_update();

-- Funcao de trigger nao precisa ser chamavel por cliente; sem o revoke,
-- authenticated poderia executa-la diretamente e receber o erro 42501 de forma
-- confusa em vez de nunca enxergar a funcao.
revoke execute on function public.prevent_workflow_run_events_update() from public;

-- ------------------------------------------------------------
-- claim_workflow_run(_worker_id, _lease_seconds, _workflow_id, _run_id)
-- Reivindica atomicamente UM run executavel. Retorna no maximo uma linha.
-- SKIP LOCKED garante que dois workers concorrentes pegam runs diferentes em
-- vez de disputar o mesmo.
--
-- Elegivel:
--   * status 'pending'/'queued' (nunca reivindicado), ou
--   * status 'running' com lease vencido (worker morreu), ou
--   * status 'running' sem lock (run legado anterior a esta migration).
--
-- _workflow_id restringe a busca a um workflow: e o caso de uso do
-- workflow-engine, onde o usuario clica "executar" num workflow especifico e o
-- run resultante e criado na mesma chamada. Sem esse filtro o claim pegaria o
-- run pendente mais antigo do banco inteiro, de qualquer organizacao.
-- _run_id existe para retomar um run pontual (retry de etapa).
-- ------------------------------------------------------------
create or replace function public.claim_workflow_run(
  _worker_id text,
  _lease_seconds integer default 300,
  _workflow_id uuid default null,
  _run_id uuid default null
)
returns table (
  run_id uuid,
  workflow_id uuid,
  organization_id uuid,
  current_step text,
  attempt integer
)
language plpgsql
volatile
security definer
set search_path to 'public'
as $$
declare
  v_run public.workflow_runs%rowtype;
  v_lease interval;
begin
  if _worker_id is null or length(trim(_worker_id)) = 0 then
    raise exception 'worker_id obrigatorio' using errcode = '22023';
  end if;
  v_lease := make_interval(secs => greatest(coalesce(_lease_seconds, 300), 30));

  select * into v_run
  from public.workflow_runs r
  where (
      r.status in ('pending','queued')
      or (r.status = 'running' and (r.locked_until is null or r.locked_until < now()))
    )
    and (_run_id is null or r.id = _run_id)
    and (_workflow_id is null or r.workflow_id = _workflow_id)
  order by r.created_at
  for update skip locked
  limit 1;

  if not found then
    return;
  end if;

  update public.workflow_runs as r
     set status = 'running',
         locked_by = _worker_id,
         locked_until = now() + v_lease,
         heartbeat_at = now(),
         attempt = r.attempt + 1,
         started_at = coalesce(r.started_at, now())
   where r.id = v_run.id
   returning * into v_run;

  insert into public.workflow_run_events (run_id, organization_id, event_type, dedupe_key, payload)
  values (
    v_run.id, v_run.organization_id, 'run_claimed',
    format('claim:%s:%s', _worker_id, v_run.attempt),
    jsonb_build_object('worker_id', _worker_id, 'attempt', v_run.attempt, 'lease_seconds', _lease_seconds)
  )
  on conflict do nothing;

  return query select v_run.id, v_run.workflow_id, v_run.organization_id, v_run.current_step, v_run.attempt;
end;
$$;

-- ------------------------------------------------------------
-- heartbeat_workflow_run(_run_id, _worker_id, _lease_seconds)
-- Renova o lease durante execucao longa. Falha se o lease ja foi tomado por
-- outro worker — o chamador deve abortar para nao duplicar trabalho.
-- ------------------------------------------------------------
create or replace function public.heartbeat_workflow_run(
  _run_id uuid,
  _worker_id text,
  _lease_seconds integer default 300
)
returns boolean
language plpgsql
volatile
security definer
set search_path to 'public'
as $$
declare
  v_updated integer;
begin
  update public.workflow_runs as r
     set locked_until = now() + make_interval(secs => greatest(coalesce(_lease_seconds, 300), 30)),
         heartbeat_at = now()
   where r.id = _run_id
     and r.locked_by = _worker_id
     and r.status = 'running';

  get diagnostics v_updated = row_count;
  return v_updated > 0;
end;
$$;

-- ------------------------------------------------------------
-- complete_workflow_step(_run_id, _worker_id, _step_name, _payload)
-- Marca um passo como concluido e registra o evento. Idempotente por
-- (run_id, step_name): reenvio do mesmo passo nao duplica o evento nem o
-- resultado. Recusa se o worker perdeu o lease.
-- ------------------------------------------------------------
create or replace function public.complete_workflow_step(
  _run_id uuid,
  _worker_id text,
  _step_name text,
  _payload jsonb default '{}'::jsonb
)
returns boolean
language plpgsql
volatile
security definer
set search_path to 'public'
as $$
declare
  v_run public.workflow_runs%rowtype;
  v_org uuid;
begin
  select * into v_run
  from public.workflow_runs
  where id = _run_id
  for update;

  if not found then
    raise exception 'run % nao existe', _run_id using errcode = 'P0002';
  end if;

  if v_run.locked_by is distinct from _worker_id then
    -- Lease perdido: outro worker assumiu. Nao grava nada.
    return false;
  end if;

  v_org := v_run.organization_id;

  insert into public.workflow_run_events (run_id, organization_id, event_type, step_name, dedupe_key, payload)
  values (_run_id, v_org, 'step_completed', _step_name,
          format('step:%s', _step_name), coalesce(_payload, '{}'::jsonb))
  on conflict do nothing;

  -- Avanca o passo corrente e acumula o resultado do passo no run.
  update public.workflow_runs as r
     set current_step = _step_name,
         results = coalesce(r.results, '{}'::jsonb)
                   || jsonb_build_object(_step_name, coalesce(_payload, '{}'::jsonb)),
         locked_until = now() + interval '300 seconds',
         heartbeat_at = now()
   where r.id = _run_id;

  return true;
end;
$$;

-- ------------------------------------------------------------
-- fail_workflow_step(_run_id, _worker_id, _step_name, _error, _retry)
-- Registra a falha do passo. Com _retry=true devolve o run para a fila
-- (status 'queued', lease liberado) respeitando um teto de tentativas;
-- sem retry, encerra o run como 'failed'.
-- ------------------------------------------------------------
create or replace function public.fail_workflow_step(
  _run_id uuid,
  _worker_id text,
  _step_name text,
  _error text,
  _retry boolean default false
)
returns boolean
language plpgsql
volatile
security definer
set search_path to 'public'
as $$
declare
  v_run public.workflow_runs%rowtype;
  v_max_attempts constant integer := 3;
  v_requeue boolean;
begin
  select * into v_run
  from public.workflow_runs
  where id = _run_id
  for update;

  if not found then
    raise exception 'run % nao existe', _run_id using errcode = 'P0002';
  end if;

  if v_run.locked_by is distinct from _worker_id then
    return false;
  end if;

  insert into public.workflow_run_events (run_id, organization_id, event_type, step_name, dedupe_key, payload)
  values (_run_id, v_run.organization_id, 'step_failed', _step_name,
          format('fail:%s:%s', _step_name, v_run.attempt),
          jsonb_build_object('error', _error, 'attempt', v_run.attempt))
  on conflict do nothing;

  v_requeue := coalesce(_retry, false) and v_run.attempt < v_max_attempts;

  if v_requeue then
    update public.workflow_runs as r
       set status = 'queued',
           current_step = _step_name,
           error_message = left(coalesce(_error, ''), 1000),
           locked_by = null,
           locked_until = null,
           heartbeat_at = null
     where r.id = _run_id;
  else
    update public.workflow_runs as r
       set status = 'failed',
           current_step = null,
           error_message = left(coalesce(_error, ''), 1000),
           completed_at = now(),
           locked_by = null,
           locked_until = null
     where r.id = _run_id;

    insert into public.workflow_run_events (run_id, organization_id, event_type, dedupe_key, payload)
    values (_run_id, v_run.organization_id, 'run_failed', null,
            jsonb_build_object('step', _step_name, 'error', _error, 'attempt', v_run.attempt))
    on conflict do nothing;
  end if;

  return true;
end;
$$;

-- ------------------------------------------------------------
-- finish_workflow_run(_run_id, _worker_id)
-- Fecha o run com sucesso e libera o lease.
-- ------------------------------------------------------------
create or replace function public.finish_workflow_run(
  _run_id uuid,
  _worker_id text
)
returns boolean
language plpgsql
volatile
security definer
set search_path to 'public'
as $$
declare
  v_updated integer;
  v_org uuid;
begin
  select organization_id into v_org from public.workflow_runs where id = _run_id;
  if not found then
    raise exception 'run % nao existe', _run_id using errcode = 'P0002';
  end if;

  update public.workflow_runs as r
     set status = 'completed',
         current_step = null,
         completed_at = now(),
         locked_by = null,
         locked_until = null
   where r.id = _run_id
     and r.locked_by = _worker_id
     and r.status = 'running';

  get diagnostics v_updated = row_count;
  if v_updated = 0 then
    return false;
  end if;

  insert into public.workflow_run_events (run_id, organization_id, event_type, dedupe_key, payload)
  values (_run_id, v_org, 'run_completed', null, jsonb_build_object('worker_id', _worker_id))
  on conflict do nothing;

  return true;
end;
$$;

-- BUG capturado pelos testes T13: como o Postgres concede EXECUTE a PUBLIC por
-- padrao, sem este revoke "authenticated" poderia chamar as RPCs de lease e
-- declarar um worker_id arbitrario, roubando (ou travando) um run de outra org.
revoke execute on function public.claim_workflow_run(text, integer, uuid, uuid) from public;
revoke execute on function public.heartbeat_workflow_run(uuid, text, integer) from public;
revoke execute on function public.complete_workflow_step(uuid, text, text, jsonb) from public;
revoke execute on function public.fail_workflow_step(uuid, text, text, text, boolean) from public;
revoke execute on function public.finish_workflow_run(uuid, text) from public;

grant execute on function public.claim_workflow_run(text, integer, uuid, uuid) to service_role;
grant execute on function public.heartbeat_workflow_run(uuid, text, integer) to service_role;
grant execute on function public.complete_workflow_step(uuid, text, text, jsonb) to service_role;
grant execute on function public.fail_workflow_step(uuid, text, text, text, boolean) to service_role;
grant execute on function public.finish_workflow_run(uuid, text) to service_role;

grant select on public.workflow_run_events to authenticated;
grant all on public.workflow_run_events to service_role;