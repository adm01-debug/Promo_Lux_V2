-- ============================================================
-- C13 (reconstrucao): Campaign Warmup / Email Sending Throttling
-- ============================================================
-- A migration original (20260721235001) foi commitada como blob base64
-- corrompido e neutralizada como no-op, deixando o campaign-dispatch sem
-- limite diario por organizacao. Hoje o unico freio e BATCH_PER_CAMPAIGN=25
-- por ciclo (campaign-dispatch/index.ts:26), sem teto diario: um dominio novo
-- queimando reputacao derruba a entregabilidade de todas as campanhas.
--
-- Esta migration reconstroi a intencao original com o schema que o runtime
-- consome de fato: warmup_profiles (ramp-up por organizacao) e
-- campaign_warmup_state (consumo diario por campanha) + RPC get_warmup_slot.
-- ============================================================

create table if not exists public.warmup_profiles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  -- Ramp-up: dia 1 envia start_per_day, incrementa daily_increment por dia
  -- ate estabilizar em max_per_day. ramp_days = quantos dias dura o ramp-up.
  start_per_day integer not null default 20 check (start_per_day > 0),
  daily_increment integer not null default 10 check (daily_increment >= 0),
  max_per_day integer not null default 200 check (max_per_day > 0),
  ramp_days integer not null default 14 check (ramp_days > 0),
  -- Dias da semana permitidos (0=domingo .. 6=sabado). Default seg-sex.
  allowed_weekdays smallint[] not null default '{1,2,3,4,5}',
  -- Janela de envio em UTC. Fora dela o dispatcher nao envia.
  send_window_start smallint not null default 9 check (send_window_start between 0 and 23),
  send_window_end smallint not null default 18 check (send_window_end between 0 and 23),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id)
);

create table if not exists public.campaign_warmup_state (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  -- Dia corrente do ramp-up (1-based) e contador do dia.
  current_day integer not null default 1 check (current_day > 0),
  emails_sent_today integer not null default 0 check (emails_sent_today >= 0),
  last_reset_date date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id)
);

create index if not exists idx_campaign_warmup_state_org
  on public.campaign_warmup_state(organization_id, last_reset_date desc);

alter table public.warmup_profiles enable row level security;
alter table public.campaign_warmup_state enable row level security;

create policy "Members view warmup_profiles" on public.warmup_profiles
  for select to authenticated
  using (public.is_org_member(organization_id, auth.uid()));
create policy "Admins insert warmup_profiles" on public.warmup_profiles
  for insert to authenticated
  with check (public.has_org_role(organization_id, auth.uid(), 'admin'));
create policy "Admins update warmup_profiles" on public.warmup_profiles
  for update to authenticated
  using (public.has_org_role(organization_id, auth.uid(), 'admin'))
  with check (public.has_org_role(organization_id, auth.uid(), 'admin'));
create policy "Admins delete warmup_profiles" on public.warmup_profiles
  for delete to authenticated
  using (public.has_org_role(organization_id, auth.uid(), 'admin'));
create policy "Service manage warmup_profiles" on public.warmup_profiles
  for all to service_role using (true) with check (true);

create policy "Members view campaign_warmup_state" on public.campaign_warmup_state
  for select to authenticated
  using (public.is_org_member(organization_id, auth.uid()));create policy "Service manage campaign_warmup_state" on public.campaign_warmup_state
  for all to service_role using (true) with check (true);

  -- A RPC SECURITY DEFINER acima e a unica via de escrita do contador. Revogar
  -- tambem o GRANT garante que nem um admin zere `emails_sent_today` direto pela
  -- tabela — o que furaria o teto diario.
  revoke insert, update, delete on public.campaign_warmup_state from authenticated;

create trigger trg_warmup_profiles_updated before update on public.warmup_profiles
  for each row execute function public.update_updated_at_column();
create trigger trg_campaign_warmup_state_updated before update on public.campaign_warmup_state
  for each row execute function public.update_updated_at_column();

-- ------------------------------------------------------------
-- get_warmup_slot(_org_id, _campaign_id)
-- Responde ao dispatcher: quantos e-mails esta campanha ainda pode enviar
-- agora. SECURITY DEFINER porque o dispatcher roda como service_role, mas a
-- funcao tambem e chamada pelo front (preview do limite) como authenticated.
--
-- Regras:
--   1. Sem perfil de warmup ou perfil desabilitado -> sem teto (allowed=true,
--      remaining=NULL). Preserva o comportamento atual de quem nao configurou.
--   2. Fora da janela de envio ou dia da semana nao permitido -> allowed=false.
--   3. Limite do dia = start_per_day + daily_increment * (current_day - 1),
--      truncado em max_per_day. current_day nunca passa de ramp_days.
--   4. remaining = limite - emails_sent_today, nunca negativo.
-- ------------------------------------------------------------
create or replace function public.get_warmup_slot(
  _org_id uuid,
  _campaign_id uuid
)
returns table (
  allowed boolean,
  daily_limit integer,
  emails_sent_today integer,
  remaining integer,
  current_day integer,
  reason text
)
language plpgsql
volatile
security definer
set search_path to 'public'
as $$
declare
  v_profile public.warmup_profiles%rowtype;
  v_state public.campaign_warmup_state%rowtype;
  v_today date := current_date;
  v_limit integer;
  v_sent integer;
  v_day integer;
begin
  select * into v_profile
  from public.warmup_profiles
  where organization_id = _org_id and enabled;

  -- Sem perfil: comportamento legado, sem teto.
  if not found then
    return query select true, null::integer, 0, null::integer, null::integer, 'no_profile'::text;
    return;
  end if;

  -- Campanha precisa ser da org informada: o estado e criado com (_org_id,
  -- _campaign_id), entao combinar org e campanha de donos diferentes vazaria
  -- contador entre tenants.
  if not exists (
    select 1 from public.campaigns
    where id = _campaign_id and organization_id = _org_id
  ) then
    raise exception 'campaign % nao pertence a organizacao %', _campaign_id, _org_id
      using errcode = '42501';
  end if;

  -- Dia da semana. isodow: 1=segunda..7=domingo; allowed_weekdays usa
  -- 0=domingo..6=sabado, por isso o domingo (7) vira 0.
  if not (
    (case when extract(isodow from now() at time zone 'UTC') = 7 then 0
          else extract(isodow from now() at time zone 'UTC')::smallint end)
    = any (v_profile.allowed_weekdays)
  ) then
    return query select false, null::integer, 0, 0, null::integer, 'weekday_blocked'::text;
    return;
  end if;

  if extract(hour from now() at time zone 'UTC')::smallint
       not between v_profile.send_window_start and v_profile.send_window_end then
    return query select false, null::integer, 0, 0, null::integer, 'outside_window'::text;
    return;
  end if;

  -- Estado do dia: cria se nao existe, reseta se virou o dia.
  select * into v_state
  from public.campaign_warmup_state
  where campaign_id = _campaign_id;

  if not found then
    insert into public.campaign_warmup_state
      (organization_id, campaign_id, current_day, emails_sent_today, last_reset_date)
    values (_org_id, _campaign_id, 1, 0, v_today)
    returning * into v_state;
  elsif v_state.last_reset_date < v_today then
    -- Avanca o dia do ramp-up uma vez por dia decorrido.
    update public.campaign_warmup_state as s
       set emails_sent_today = 0,
           last_reset_date = v_today,
           current_day = least(
             s.current_day + (v_today - v_state.last_reset_date),
             v_profile.ramp_days
           )
     where s.id = v_state.id
    returning * into v_state;
  end if;

  v_day := v_state.current_day;
  v_limit := least(
    v_profile.start_per_day + v_profile.daily_increment * (v_day - 1),
    v_profile.max_per_day
  );
  v_sent := v_state.emails_sent_today;

  return query select
    (v_sent < v_limit),
    v_limit,
    v_sent,
    greatest(v_limit - v_sent, 0),
    v_day,
    case when v_sent >= v_limit then 'daily_limit_reached' else 'ok' end::text;
end;
$$;

-- Consome N envios do slot do dia. Chamada pelo dispatcher logo apos enviar.
create or replace function public.consume_warmup_slot(
  _campaign_id uuid,
  _count integer
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if _count is null or _count <= 0 then
    return;
  end if;
  update public.campaign_warmup_state
     set emails_sent_today = emails_sent_today + _count
   where campaign_id = _campaign_id;
end;
$$;

revoke execute on function public.get_warmup_slot(uuid, uuid) from anon;
revoke execute on function public.consume_warmup_slot(uuid, integer) from anon, authenticated;

grant execute on function public.get_warmup_slot(uuid, uuid) to authenticated, service_role;grant execute on function public.consume_warmup_slot(uuid, integer) to service_role;

grant select on public.warmup_profiles to authenticated;
grant insert, update, delete on public.warmup_profiles to authenticated;
grant select on public.campaign_warmup_state to authenticated;
grant all on public.warmup_profiles to service_role;
grant all on public.campaign_warmup_state to service_role;
