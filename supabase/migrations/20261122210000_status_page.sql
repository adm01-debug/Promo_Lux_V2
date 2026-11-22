-- Pagina de status publica (gap 2.10 do GAPS-ENTERPRISE).
-- "Status page - Inexistente - status.luxai.com publico".
--
-- Duas partes:
--   1. `incidents`     registro manual de incidente (quem abriu, severidade,
--                      janela, componentes afetados, postmortem)
--   2. RPC anonima     `get_public_status()` devolve o snapshot que a pagina
--                      publica renderiza. SECURITY DEFINER porque o visitante
--                      nao tem conta: nao existe auth.uid() para a policy.
--
-- O status dos componentes nao e digitado a mao: e derivado de
-- `automation_execution_logs` (fonte real de execucao das automacoes), para que
-- a pagina nao minta quando o operador esquece de atualizar.

create table if not exists public.incidents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null default auth.uid(),
  title text not null,
  impact text not null default 'minor' check (impact in ('none','minor','major','critical')),
  status text not null default 'investigating'
    check (status in ('investigating','identified','monitoring','resolved')),
  components text[] not null default '{}',
  body text,
  postmortem text,
  started_at timestamptz not null default now(),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists idx_incidents_org
  on public.incidents(organization_id, started_at desc) where deleted_at is null;
create index if not exists idx_incidents_open
  on public.incidents(started_at desc) where resolved_at is null and deleted_at is null;

alter table public.incidents enable row level security;

create policy "Members view incidents" on public.incidents
  for select to authenticated
  using (public.is_org_member(organization_id, auth.uid()) and deleted_at is null);
create policy "Members insert incidents" on public.incidents
  for insert to authenticated
  with check (public.is_org_member(organization_id, auth.uid()));
create policy "Members update incidents" on public.incidents
  for update to authenticated
  using (public.is_org_member(organization_id, auth.uid()))
  with check (public.is_org_member(organization_id, auth.uid()));
create policy "Admins delete incidents" on public.incidents
  for delete to authenticated
  using (public.has_org_role(organization_id, auth.uid(), 'admin'));
create policy "Service manage incidents" on public.incidents
  for all to service_role using (true) with check (true);

create trigger trg_incidents_updated before update on public.incidents
  for each row execute function public.update_updated_at_column();

-- Snapshot publico. Nao expoe organizacao, valores de negocio nem logs brutos:
-- so o estado agregado e o texto dos incidentes.
create or replace function public.get_public_status()
returns jsonb
language sql
security definer
set search_path = public
stable
as $function$
  with comps as (
    select
      source as component,
      count(*) filter (where created_at >= now() - interval '24 hours') as events_24h,
      count(*) filter (
        where status in ('failed','dead') and created_at >= now() - interval '24 hours'
      ) as failures_24h,
      max(created_at) as last_event_at
    from public.automation_execution_logs
    where created_at >= now() - interval '7 days'
    group by source
  ),
  ranked as (
    select
      component,
      events_24h,
      failures_24h,
      last_event_at,
      case
        when events_24h = 0 then 'unknown'
        when failures_24h = 0 then 'operational'
        when failures_24h::numeric / nullif(events_24h, 0) < 0.1 then 'degraded'
        else 'outage'
      end as state
    from comps
  )
  select jsonb_build_object(
    'generated_at', now(),
    'overall', coalesce((
      select case
        when count(*) filter (where state = 'outage') > 0 then 'outage'
        when count(*) filter (where state = 'degraded') > 0 then 'degraded'
        when count(*) = 0 then 'unknown'
        else 'operational'
      end
      from ranked
    ), 'unknown'),
    'components', coalesce((
      select jsonb_agg(jsonb_build_object(
        'component', component,
        'state', state,
        'events_24h', events_24h,
        'failures_24h', failures_24h,
        'last_event_at', last_event_at
      ) order by component)
      from ranked
    ), '[]'::jsonb),
    'incidents', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', i.id,
        'title', i.title,
        'impact', i.impact,
        'status', i.status,
        'components', i.components,
        'body', i.body,
        'started_at', i.started_at,
        'resolved_at', i.resolved_at
      ) order by i.started_at desc)
      from (
        select *
        from public.incidents
        where deleted_at is null
          and started_at >= now() - interval '30 days'
        order by started_at desc
        limit 20
      ) i
    ), '[]'::jsonb)
  );
$function$;

-- Uptime por dia (ultimos 30 dias) para o grafico de barras da pagina.
create or replace function public.get_public_uptime(_days integer default 30)
returns table (day date, events integer, failures integer, uptime_pct numeric)
language sql
security definer
set search_path = public
stable
as $function$
  select
    date_trunc('day', created_at)::date as day,
    count(*)::integer as events,
    count(*) filter (where status in ('failed','dead'))::integer as failures,
    round(
      100.0 * count(*) filter (where status not in ('failed','dead'))
      / nullif(count(*), 0),
      2
    ) as uptime_pct
  from public.automation_execution_logs
  where created_at >= now() - make_interval(days => greatest(1, least(coalesce(_days, 30), 90)))
  group by 1
  order by 1;
$function$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.incidents TO authenticated;
GRANT ALL ON public.incidents TO service_role;

-- Leitura publica: so pelas RPCs, nunca direto na tabela.
REVOKE ALL ON public.incidents FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_public_status() FROM public;
REVOKE EXECUTE ON FUNCTION public.get_public_uptime(integer) FROM public;
GRANT EXECUTE ON FUNCTION public.get_public_status() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_uptime(integer) TO anon, authenticated;