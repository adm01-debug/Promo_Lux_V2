-- Fecha os 3 gaps funcionais que sobraram da auditoria de 21/11:
--   scheduled_reports  relatorio agendado por email (gap de Analytics)
--   bulk_imports       historico auditavel das importacoes CSV
--   role_permissions   matriz de permissao granular por recurso
--
-- Os tres seguem o padrao das tabelas de negocio existentes: user_id/org_id +
-- RLS por organizacao + soft delete onde faz sentido.

-- ---------------------------------------------------------------------------
-- 1. scheduled_reports
-- ---------------------------------------------------------------------------
create table if not exists public.scheduled_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  name text not null,
  metric text not null check (metric in ('conversion','enrichment','pipeline','campaigns')),
  frequency text not null default 'weekly' check (frequency in ('daily','weekly','monthly')),
  -- dia da semana (0=domingo) para weekly, dia do mes para monthly
  day_of_week smallint check (day_of_week between 0 and 6),
  day_of_month smallint check (day_of_month between 1 and 28),
  hour_utc smallint not null default 9 check (hour_utc between 0 and 23),
  recipients text[] not null default '{}',
  filters jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  last_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists idx_scheduled_reports_user
  on public.scheduled_reports(user_id) where deleted_at is null;
create index if not exists idx_scheduled_reports_due
  on public.scheduled_reports(hour_utc) where deleted_at is null and active;

alter table public.scheduled_reports enable row level security;

create policy "Users view own scheduled_reports" on public.scheduled_reports
  for select to authenticated using (user_id = auth.uid() and deleted_at is null);
create policy "Users insert own scheduled_reports" on public.scheduled_reports
  for insert to authenticated with check (user_id = auth.uid());
create policy "Users update own scheduled_reports" on public.scheduled_reports
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Service manage scheduled_reports" on public.scheduled_reports
  for all to service_role using (true) with check (true);

create trigger trg_scheduled_reports_updated before update on public.scheduled_reports
  for each row execute function public.update_updated_at_column();

-- Trilha de envio: uma linha por periodo. O unique index abaixo e o que
-- garante que duas invocacoes concorrentes nao enviem o mesmo relatorio duas
-- vezes (a segunda colide em 23505 e vira 'skipped').
create table if not exists public.scheduled_report_runs (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.scheduled_reports(id) on delete cascade,
  user_id uuid not null,
  period_start timestamptz not null,
  period_end timestamptz not null,
  status text not null default 'pending' check (status in ('pending','sent','failed','skipped')),
  recipients_count integer not null default 0,
  error_message text,
  payload jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_sched_report_runs_report
  on public.scheduled_report_runs(report_id, created_at desc);
create unique index if not exists uq_sched_report_runs_period
  on public.scheduled_report_runs(report_id, period_start) where status in ('pending','sent');

alter table public.scheduled_report_runs enable row level security;

create policy "Users view own scheduled_report_runs" on public.scheduled_report_runs
  for select to authenticated using (user_id = auth.uid());
create policy "Service manage scheduled_report_runs" on public.scheduled_report_runs
  for all to service_role using (true) with check (true);

-- ---------------------------------------------------------------------------
-- 2. bulk_imports
-- ---------------------------------------------------------------------------
-- O import em si ja funciona (ImportCompaniesDialog); falta a trilha para
-- auditar uma carga errada e saber o que foi ignorado e por que.
create table if not exists public.bulk_imports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  entity text not null default 'companies' check (entity in ('companies','stakeholders','deals')),
  file_name text,
  total_rows integer not null default 0,
  inserted_count integer not null default 0,
  skipped_count integer not null default 0,
  invalid_count integer not null default 0,
  errors jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_bulk_imports_user on public.bulk_imports(user_id, created_at desc);
create index if not exists idx_bulk_imports_org on public.bulk_imports(organization_id, created_at desc);

alter table public.bulk_imports enable row level security;

create policy "Users view own bulk_imports" on public.bulk_imports
  for select to authenticated using (user_id = auth.uid());
create policy "Users insert own bulk_imports" on public.bulk_imports
  for insert to authenticated with check (user_id = auth.uid());
create policy "Service manage bulk_imports" on public.bulk_imports
  for all to service_role using (true) with check (true);

-- ---------------------------------------------------------------------------
-- 3. role_permissions
-- ---------------------------------------------------------------------------
-- O RBAC atual e fixo no codigo (src/lib/permissions.ts). Esta matriz permite
-- que o admin da organizacao ajuste um recurso especifico sem alterar o papel
-- do usuario. Sem linha para (org, role, resource) vale o padrao do papel.
create table if not exists public.role_permissions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  role public.app_role not null,
  resource text not null,
  can_view boolean not null default true,
  can_create boolean not null default false,
  can_update boolean not null default false,
  can_delete boolean not null default false,
  can_manage boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, role, resource)
);

create index if not exists idx_role_permissions_org on public.role_permissions(organization_id);

alter table public.role_permissions enable row level security;

create policy "Members view role_permissions" on public.role_permissions
  for select to authenticated
  using (public.is_org_member(organization_id, auth.uid()));
create policy "Admins insert role_permissions" on public.role_permissions
  for insert to authenticated
  with check (public.has_org_role(organization_id, auth.uid(), 'admin'));
create policy "Admins update role_permissions" on public.role_permissions
  for update to authenticated
  using (public.has_org_role(organization_id, auth.uid(), 'admin'))
  with check (public.has_org_role(organization_id, auth.uid(), 'admin'));
create policy "Admins delete role_permissions" on public.role_permissions
  for delete to authenticated
  using (public.has_org_role(organization_id, auth.uid(), 'admin'));
create policy "Service manage role_permissions" on public.role_permissions
  for all to service_role using (true) with check (true);

create trigger trg_role_permissions_updated before update on public.role_permissions
  for each row execute function public.update_updated_at_column();

-- Matriz padrao: copia 1:1 de src/lib/permissions.ts (PERMISSION_MATRIX).
-- Escrita explicitamente em vez de derivada por regra, para que uma mudanca no
-- TS nao altere silenciosamente o banco e vice-versa.
create or replace function public.default_role_permissions()
returns table (
  resource text, role public.app_role,
  can_view boolean, can_create boolean, can_update boolean, can_delete boolean, can_manage boolean
)
language sql
immutable
as $function$
  values
    ('companies',    'admin'::public.app_role, true,  true,  true,  true,  true),
    ('companies',    'sdr',                     true,  true,  true,  false, false),
    ('companies',    'viewer',                  true,  false, false, false, false),
    ('stakeholders', 'admin',                   true,  true,  true,  true,  true),
    ('stakeholders', 'sdr',                     true,  true,  true,  false, false),
    ('stakeholders', 'viewer',                  true,  false, false, false, false),
    ('deals',        'admin',                   true,  true,  true,  true,  true),
    ('deals',        'sdr',                     true,  true,  true,  false, false),
    ('deals',        'viewer',                  true,  false, false, false, false),
    ('campaigns',    'admin',                   true,  true,  true,  true,  true),
    ('campaigns',    'sdr',                     true,  true,  true,  false, false),
    ('campaigns',    'viewer',                  true,  false, false, false, false),
    ('workflows',    'admin',                   true,  true,  true,  true,  true),
    ('workflows',    'sdr',                     true,  true,  true,  false, false),
    ('workflows',    'viewer',                  true,  false, false, false, false),
    ('scrape_jobs',  'admin',                   true,  true,  true,  true,  true),
    ('scrape_jobs',  'sdr',                     true,  true,  true,  false, false),
    ('scrape_jobs',  'viewer',                  true,  false, false, false, false),
    ('integrations', 'admin',                   true,  true,  true,  true,  true),
    ('integrations', 'sdr',                     false, false, false, false, false),
    ('integrations', 'viewer',                  false, false, false, false, false),
    ('members',      'admin',                   true,  true,  true,  true,  true),
    ('members',      'sdr',                     true,  false, false, false, false),
    ('members',      'viewer',                  true,  false, false, false, false),
    ('invites',      'admin',                   true,  true,  true,  true,  true),
    ('invites',      'sdr',                     true,  false, false, false, false),
    ('invites',      'viewer',                  true,  false, false, false, false),
    ('audit_logs',   'admin',                   true,  false, false, false, true),
    ('audit_logs',   'sdr',                     false, false, false, false, false),
    ('audit_logs',   'viewer',                  false, false, false, false, false);
$function$;

-- Semeia as organizacoes existentes. Nao sobrescreve linhas ja editadas.
insert into public.role_permissions
  (organization_id, role, resource, can_view, can_create, can_update, can_delete, can_manage)
select o.id, d.role, d.resource, d.can_view, d.can_create, d.can_update, d.can_delete, d.can_manage
from public.organizations o
cross join public.default_role_permissions() d
on conflict (organization_id, role, resource) do nothing;

-- Organizacao nova nasce com a matriz semeada; sem isso o admin de um
-- workspace recem-criado abriria a tela vazia.
create or replace function public.seed_role_permissions()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  insert into public.role_permissions
    (organization_id, role, resource, can_view, can_create, can_update, can_delete, can_manage)
  select new.id, d.role, d.resource, d.can_view, d.can_create, d.can_update, d.can_delete, d.can_manage
  from public.default_role_permissions() d
  on conflict (organization_id, role, resource) do nothing;
  return new;
end;
$function$;

drop trigger if exists trg_seed_role_permissions on public.organizations;
create trigger trg_seed_role_permissions
  after insert on public.organizations
  for each row execute function public.seed_role_permissions();

-- Resolve a permissao efetiva do usuario para um recurso, considerando o papel
-- dele na organizacao. Sem linha explicita, aplica o padrao do papel:
--   admin  -> tudo
--   sdr    -> ver/criar/editar
--   viewer -> so ver
create or replace function public.can_access(
  _org_id uuid,
  _user_id uuid,
  _resource text,
  _action text default 'view'
)
returns boolean
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v_role public.app_role;
  v_perm public.role_permissions;
begin
  if _user_id is null then
    return false;
  end if;

  select om.role into v_role
  from public.organization_members om
  where om.organization_id = _org_id
    and om.user_id = _user_id
    and om.deleted_at is null
  limit 1;

  -- Sem vinculo com a organizacao: nada.
  if v_role is null then
    return false;
  end if;

  select * into v_perm
  from public.role_permissions rp
  where rp.organization_id = _org_id
    and rp.role = v_role
    and rp.resource = _resource
  limit 1;

  if found then
    return case _action
      when 'view'   then v_perm.can_view
      when 'create' then v_perm.can_create
      when 'update' then v_perm.can_update
      when 'delete' then v_perm.can_delete
      when 'manage' then v_perm.can_manage
      else false
    end;
  end if;

  return case v_role
    when 'admin'  then true
    when 'sdr'    then _action in ('view','create','update')
    when 'viewer' then _action = 'view'
    else false
  end;
end;
$function$;

revoke all on function public.can_access(uuid, uuid, text, text) from public, anon;
grant execute on function public.can_access(uuid, uuid, text, text) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 4. Retencao dos runs de relatorio
-- ---------------------------------------------------------------------------
create or replace function public.prune_scheduled_report_runs(_retention_days integer default 180)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_count integer := 0;
begin
  if auth.uid() is not null and not public.has_role(auth.uid(), 'admin') then
    raise exception 'prune_scheduled_report_runs: admin only';
  end if;

  with del as (
    delete from public.scheduled_report_runs
    where created_at < now() - make_interval(days => _retention_days)
    returning 1
  )
  select count(*) into v_count from del;

  return v_count;
end;
$function$;

revoke all on function public.prune_scheduled_report_runs(integer) from public, anon, authenticated;
grant execute on function public.prune_scheduled_report_runs(integer) to service_role;

-- ---------------------------------------------------------------------------
-- 4b. Grants das tabelas novas
-- ---------------------------------------------------------------------------
-- Sem GRANT o PostgREST responde "permission denied" mesmo com RLS e policy
-- corretas (RLS filtra linhas, GRANT libera a tabela). authenticated so precisa
-- de DML; o DDL e o acesso amplo ficam com service_role.
grant select, insert, update, delete on public.scheduled_reports to authenticated;
grant select on public.scheduled_report_runs to authenticated;
grant select, insert, update, delete on public.bulk_imports to authenticated;
grant select on public.role_permissions to authenticated;
grant insert, update, delete on public.role_permissions to authenticated;

grant all on public.scheduled_reports to service_role;
grant all on public.scheduled_report_runs to service_role;
grant all on public.bulk_imports to service_role;
grant all on public.role_permissions to service_role;

select cron.schedule(
  'prune-scheduled-report-runs-monthly',
  '53 3 1 * *',
  $$SELECT public.prune_scheduled_report_runs(180);$$
);

-- ---------------------------------------------------------------------------
-- 5. Disparo horario dos relatorios agendados
-- ---------------------------------------------------------------------------
-- A funcao decide internamente quais agendamentos estao vencidos, entao rodar
-- de hora em hora basta e evita 24 jobs por relatorio. A chave vem do vault
-- (mesmo padrao da migration 20261121190000) em vez de texto plano no cron.
select cron.schedule(
  'send-scheduled-reports-hourly',
  '7 * * * *',
  $$
    SELECT net.http_post(
      url := 'https://pttzwlbidamibjssqiqb.supabase.co/functions/v1/send-scheduled-reports',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'SUPABASE_SERVICE_ROLE_KEY'),
        'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'SUPABASE_SERVICE_ROLE_KEY')
      ),
      body := jsonb_build_object('trigger', 'cron', 'at', now()::text)
    );
  $$
);