-- ===========================================================================
-- Fecha os 4 itens restantes da secao "O que realmente falta" de
-- docs/AUDITORIA-FUNCIONALIDADES.md:
--   6. lead_scores          -> score por stakeholder (hoje so companies.ipc_score)
--   7. dashboard_layouts    -> layout por usuario no banco (hoje localStorage)
--   8. deal_predictions     -> previsao de fechamento por deal
--   9. changelog_entries    -> in-app changelog (zero referencias no src)
--
-- Padrao seguido: GRANT na mesma migration (sem ele o PostgREST responde
-- permission denied antes de avaliar policy), RLS habilitada, policy de
-- select por membro da org e de escrita por admin, e service_role full.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. lead_scores — score por stakeholder
-- ---------------------------------------------------------------------------
-- companies.ipc_score ja existe e e preenchido, mas era so por empresa. O
-- stakeholder e quem decide a compra, entao precisa de score proprio.
create table if not exists public.lead_scores (
  id uuid primary key default gen_random_uuid(),
  stakeholder_id uuid not null references public.stakeholders(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete cascade,
  user_id uuid not null default auth.uid(),
  score integer not null default 0 check (score between 0 and 100),
  -- faixa derivada do score, mantida em coluna para indexar/filtrar no PostgREST
  tier text not null default 'cold' check (tier in ('hot','warm','cold')),
  -- memoria do calculo: quais sinais entraram e quanto cada um pesou
  signals jsonb not null default '{}'::jsonb,
  model_version text not null default 'v1',
  computed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- um score vigente por stakeholder (historico fica em signals/updated_at)
  unique (stakeholder_id)
);

create index if not exists idx_lead_scores_org_tier
  on public.lead_scores(organization_id, tier, score desc);
create index if not exists idx_lead_scores_score
  on public.lead_scores(organization_id, score desc);

alter table public.lead_scores enable row level security;

create policy "Members view lead_scores" on public.lead_scores
  for select to authenticated
  using (organization_id is null and user_id = auth.uid()
         or public.is_org_member(organization_id, auth.uid()));
create policy "Members upsert own lead_scores" on public.lead_scores
  for insert to authenticated
  with check (public.is_org_member(organization_id, auth.uid()));
create policy "Members update lead_scores" on public.lead_scores
  for update to authenticated
  using (public.is_org_member(organization_id, auth.uid()))
  with check (public.is_org_member(organization_id, auth.uid()));
create policy "Admins delete lead_scores" on public.lead_scores
  for delete to authenticated
  using (organization_id is null and user_id = auth.uid()
         or public.has_org_role(organization_id, auth.uid(), 'admin'));
create policy "Service manage lead_scores" on public.lead_scores
  for all to service_role using (true) with check (true);

create trigger trg_lead_scores_updated before update on public.lead_scores
  for each row execute function public.update_updated_at_column();

grant select, insert, update, delete on public.lead_scores to authenticated;
grant all on public.lead_scores to service_role;

-- ---------------------------------------------------------------------------
-- 2. dashboard_layouts — layout por usuario persistido no banco
-- ---------------------------------------------------------------------------
-- Hoje DashboardView guarda a ordem dos widgets em localStorage (por
-- navegador, nao por usuario). Esta tabela passa a ser a fonte de verdade,
-- com localStorage apenas como cache/fallback.
create table if not exists public.dashboard_layouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  -- 'default' para o dashboard principal; permite layouts por tela depois
  dashboard_key text not null default 'default',
  -- ordem dos widgets, ex.: [{"id":"chart","visible":true},...]
  widgets jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, organization_id, dashboard_key)
);

create index if not exists idx_dashboard_layouts_user
  on public.dashboard_layouts(user_id, dashboard_key);

alter table public.dashboard_layouts enable row level security;

create policy "Users view own dashboard_layouts" on public.dashboard_layouts
  for select to authenticated using (user_id = auth.uid());
create policy "Users insert own dashboard_layouts" on public.dashboard_layouts
  for insert to authenticated with check (user_id = auth.uid());
create policy "Users update own dashboard_layouts" on public.dashboard_layouts
  for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Users delete own dashboard_layouts" on public.dashboard_layouts
  for delete to authenticated using (user_id = auth.uid());
create policy "Service manage dashboard_layouts" on public.dashboard_layouts
  for all to service_role using (true) with check (true);

create trigger trg_dashboard_layouts_updated before update on public.dashboard_layouts
  for each row execute function public.update_updated_at_column();

grant select, insert, update, delete on public.dashboard_layouts to authenticated;
grant all on public.dashboard_layouts to service_role;

-- ---------------------------------------------------------------------------
-- 3. deal_predictions — previsao de fechamento por deal
-- ---------------------------------------------------------------------------
create table if not exists public.deal_predictions (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.deals(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete cascade,
  user_id uuid not null default auth.uid(),
  -- probabilidade 0..100 de ganhar o deal
  win_probability integer not null default 0 check (win_probability between 0 and 100),
  -- data esperada de fechamento (pode diferir da expected_close_date manual)
  predicted_close_date date,
  -- receita esperada ponderada = value * win_probability / 100
  weighted_value numeric not null default 0,
  -- drivers do calculo: stage, tempo parado, atividades, valor
  drivers jsonb not null default '{}'::jsonb,
  model_version text not null default 'v1',
  computed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (deal_id)
);

create index if not exists idx_deal_predictions_org
  on public.deal_predictions(organization_id, win_probability desc);
create index if not exists idx_deal_predictions_close
  on public.deal_predictions(predicted_close_date);

alter table public.deal_predictions enable row level security;

create policy "Members view deal_predictions" on public.deal_predictions
  for select to authenticated
  using (public.is_org_member(organization_id, auth.uid()));
create policy "Members upsert deal_predictions" on public.deal_predictions
  for insert to authenticated
  with check (public.is_org_member(organization_id, auth.uid()));
create policy "Members update deal_predictions" on public.deal_predictions
  for update to authenticated
  using (public.is_org_member(organization_id, auth.uid()))
  with check (public.is_org_member(organization_id, auth.uid()));
create policy "Admins delete deal_predictions" on public.deal_predictions
  for delete to authenticated
  using (public.has_org_role(organization_id, auth.uid(), 'admin'));
create policy "Service manage deal_predictions" on public.deal_predictions
  for all to service_role using (true) with check (true);

create trigger trg_deal_predictions_updated before update on public.deal_predictions
  for each row execute function public.update_updated_at_column();

grant select, insert, update, delete on public.deal_predictions to authenticated;
grant all on public.deal_predictions to service_role;

-- ---------------------------------------------------------------------------
-- 4. changelog_entries — in-app changelog
-- ---------------------------------------------------------------------------
-- Conteudo do produto (nao e dado de cliente): leitura por qualquer usuario
-- autenticado, escrita so por admin de plataforma via service_role/migration.
create table if not exists public.changelog_entries (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  body text not null default '',
  category text not null default 'feature'
    check (category in ('feature','fix','improvement','security','breaking')),
  version text,
  published_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_changelog_published
  on public.changelog_entries(published_at desc);

alter table public.changelog_entries enable row level security;

create policy "Authenticated view changelog" on public.changelog_entries
  for select to authenticated using (true);
create policy "Service manage changelog" on public.changelog_entries
  for all to service_role using (true) with check (true);

grant select on public.changelog_entries to authenticated;
grant all on public.changelog_entries to service_role;

-- ---------------------------------------------------------------------------
-- 5. Calculo dos scores
-- ---------------------------------------------------------------------------
-- Ambos sao funcoes puras de leitura (stable), entao podem ser chamadas pelo
-- front via RPC ou por cron sem efeito colateral.
create or replace function public.compute_lead_score(_stakeholder_id uuid)
returns table (score integer, tier text, signals jsonb)
language plpgsql stable security definer
set search_path to 'public'
as $function$
declare
  v_sh public.stakeholders;
  v_signals jsonb := '{}'::jsonb;
  v_score int := 0;
  v_seniority text;
  v_has_email boolean;
  v_has_phone boolean;
  v_has_linkedin boolean;
  v_recent_contact boolean;
  v_confidence int;
begin
  select * into v_sh from public.stakeholders where id = _stakeholder_id;
  if not found then
    return query select 0, 'cold'::text, '{}'::jsonb;
    return;
  end if;

  v_seniority := lower(coalesce(v_sh.seniority, '') || ' ' || coalesce(v_sh.role, ''));
  v_has_email := coalesce(v_sh.email, '') <> '';
  v_has_phone := coalesce(v_sh.phone, '') <> '';
  v_has_linkedin := coalesce(v_sh.linkedin_url, '') <> '';
  v_recent_contact := v_sh.last_contacted_at is not null
                      and v_sh.last_contacted_at > now() - interval '30 days';
  v_confidence := coalesce(v_sh.confidence_score, 0);

  -- cargo: decisor vale mais que influenciador, que vale mais que usuario
  if v_seniority ~ '(ceo|cto|cfo|coo|cmo|founder|socio|sócio|diretor|director|vp|head|chief)' then
    v_score := v_score + 40; v_signals := v_signals || '{"cargo_decisor":40}';
  elsif v_seniority ~ '(gerente|manager|coordenador|coordinator|lead|lider|líder)' then
    v_score := v_score + 25; v_signals := v_signals || '{"cargo_gestor":25}';
  elsif v_seniority ~ '(analista|analyst|assistente|assistant|estagiario|estagiário|intern)' then
    v_score := v_score + 8; v_signals := v_signals || '{"cargo_operacional":8}';
  end if;

  -- canais de contato existentes
  if v_has_email then v_score := v_score + 15; v_signals := v_signals || '{"tem_email":15}'; end if;
  if v_has_phone then v_score := v_score + 10; v_signals := v_signals || '{"tem_telefone":10}'; end if;
  if v_has_linkedin then v_score := v_score + 10; v_signals := v_signals || '{"tem_linkedin":10}'; end if;

  -- engajamento recente e o sinal mais forte de intencao
  if v_recent_contact then
    v_score := v_score + 20; v_signals := v_signals || '{"contato_30d":20}';
  end if;

  -- confianca do dado de origem, escalada para no maximo 10 pontos
  if v_confidence > 0 then
    v_score := v_score + least(10, greatest(0, v_confidence / 10));
    v_signals := v_signals || jsonb_build_object('confianca_origem', least(10, greatest(0, v_confidence / 10)));
  end if;

  v_score := least(100, greatest(0, v_score));

  return query select
    v_score,
    case when v_score >= 70 then 'hot' when v_score >= 40 then 'warm' else 'cold' end,
    v_signals;
end;
$function$;

create or replace function public.compute_deal_prediction(_deal_id uuid)
returns table (win_probability integer, predicted_close_date date, weighted_value numeric, drivers jsonb)
language plpgsql stable security definer
set search_path to 'public'
as $function$
declare
  v_deal public.deals;
  v_stage public.deal_stages;
  v_drivers jsonb := '{}'::jsonb;
  v_prob int := 0;
  v_idle_days int := 0;
  v_acts int := 0;
  v_date date;
begin
  select * into v_deal from public.deals where id = _deal_id;
  if not found then
    return query select 0, null::date, 0::numeric, '{}'::jsonb;
    return;
  end if;

  select * into v_stage from public.deal_stages where id = v_deal.stage_id;

  -- base: a probabilidade que o proprio funil declara para o estagio
  v_prob := coalesce(v_stage.probability, 0);
  v_drivers := v_drivers || jsonb_build_object('probabilidade_estagio', v_prob,
    'estagio', coalesce(v_stage.name, 'sem_estagio'));

  -- deals fechados usam closed_at, nao a previsao
  select count(*) into v_acts
  from public.deal_activities where deal_id = _deal_id;

  -- tempo parado penaliza: quanto mais dias sem atividade, menor a chance
  v_idle_days := greatest(0, extract(day from now() - coalesce(
    (select max(created_at) from public.deal_activities where deal_id = _deal_id),
    v_deal.updated_at, v_deal.created_at))::int);

  -- Penalidade PROPORCIONAL, nao absoluta: subtrair pontos fixos zerava deals
  -- de estagio inicial (20% - 25 = 0). Multiplicar preserva a ordem relativa
  -- do funil e nunca zera a previsao de um deal apenas por estar parado.
  if v_idle_days > 30 then
    v_prob := round(v_prob * 0.6)::int;
    v_drivers := v_drivers || '{"fator_inatividade_30d":0.6}';
  elsif v_idle_days > 14 then
    v_prob := round(v_prob * 0.8)::int;
    v_drivers := v_drivers || '{"fator_inatividade_14d":0.8}';
  elsif v_idle_days <= 3 then
    v_prob := v_prob + 8; v_drivers := v_drivers || '{"bonus_atividade_recente":8}';
  end if;

  -- engajamento registrado (atividades) soma ate 12 pontos
  if v_acts >= 5 then
    v_prob := v_prob + 12; v_drivers := v_drivers || jsonb_build_object('bonus_atividades', 12);
  elsif v_acts >= 2 then
    v_prob := v_prob + 6; v_drivers := v_drivers || jsonb_build_object('bonus_atividades', 6);
  elsif v_acts = 0 then
    v_prob := v_prob - 5; v_drivers := v_drivers || jsonb_build_object('sem_atividades', -5);
  end if;

  v_prob := least(100, greatest(0, v_prob));

  -- data prevista: a manual quando existe, senao estimativa por estagio
  v_date := coalesce(v_deal.expected_close_date,
    (now() + make_interval(days => greatest(7, (100 - v_prob) / 2)))::date);

  return query select
    v_prob,
    v_date,
    round(coalesce(v_deal.value, 0) * v_prob / 100.0, 2),
    v_drivers || jsonb_build_object('dias_sem_atividade', v_idle_days, 'atividades', v_acts);
end;
$function$;

-- Recalcula e grava o score de um stakeholder (upsert).
create or replace function public.refresh_lead_score(_stakeholder_id uuid)
returns public.lead_scores
language plpgsql security definer
set search_path to 'public'
as $function$
declare
  v_calc record;
  v_sh public.stakeholders;
  v_row public.lead_scores;
begin
  select * into v_sh from public.stakeholders where id = _stakeholder_id;
  if not found then
    raise exception 'stakeholder % nao encontrado', _stakeholder_id;
  end if;

  select * into v_calc from public.compute_lead_score(_stakeholder_id);

  insert into public.lead_scores (stakeholder_id, organization_id, user_id, score, tier, signals)
  values (_stakeholder_id, v_sh.organization_id, coalesce(v_sh.user_id, auth.uid()), v_calc.score, v_calc.tier, v_calc.signals)
  on conflict (stakeholder_id) do update
    set score = excluded.score,
        tier = excluded.tier,
        signals = excluded.signals,
        computed_at = now(),
        updated_at = now()
  returning * into v_row;

  return v_row;
end;
$function$;

-- Recalcula e grava a previsao de um deal.
create or replace function public.refresh_deal_prediction(_deal_id uuid)
returns public.deal_predictions
language plpgsql security definer
set search_path to 'public'
as $function$
declare
  v_calc record;
  v_deal public.deals;
  v_row public.deal_predictions;
begin
  select * into v_deal from public.deals where id = _deal_id;
  if not found then
    raise exception 'deal % nao encontrado', _deal_id;
  end if;

  select * into v_calc from public.compute_deal_prediction(_deal_id);

  insert into public.deal_predictions
    (deal_id, organization_id, user_id, win_probability, predicted_close_date, weighted_value, drivers)
  values (_deal_id, v_deal.organization_id, coalesce(v_deal.user_id, auth.uid()),
          v_calc.win_probability, v_calc.predicted_close_date, v_calc.weighted_value, v_calc.drivers)
  on conflict (deal_id) do update
    set win_probability = excluded.win_probability,
        predicted_close_date = excluded.predicted_close_date,
        weighted_value = excluded.weighted_value,
        drivers = excluded.drivers,
        computed_at = now(),
        updated_at = now()
  returning * into v_row;

  return v_row;
end;
$function$;

-- Recalcula todos os scores de uma organizacao (usado pelo cron e pela UI).
create or replace function public.refresh_org_scores(_org_id uuid)
returns table (leads_atualizados integer, deals_atualizados integer)
language plpgsql security definer
set search_path to 'public'
as $function$
declare
  v_leads int := 0;
  v_deals int := 0;
  r record;
begin
  -- gate: cron entra sem uid; usuario comum so mexe na propria org e se for admin
  if auth.uid() is not null and not public.has_org_role(_org_id, auth.uid(), 'admin') then
    raise exception 'apenas admin da organizacao pode recalcular scores';
  end if;

  for r in select id from public.stakeholders
           where organization_id = _org_id loop
    perform public.refresh_lead_score(r.id);
    v_leads := v_leads + 1;
  end loop;

  for r in select id from public.deals
           where organization_id = _org_id and deleted_at is null loop
    perform public.refresh_deal_prediction(r.id);
    v_deals := v_deals + 1;
  end loop;

  return query select v_leads, v_deals;
end;
$function$;

revoke all on function public.compute_lead_score(uuid) from public, anon;
revoke all on function public.compute_deal_prediction(uuid) from public, anon;
revoke all on function public.refresh_lead_score(uuid) from public, anon;
revoke all on function public.refresh_deal_prediction(uuid) from public, anon;
revoke all on function public.refresh_org_scores(uuid) from public, anon;

grant execute on function public.compute_lead_score(uuid) to authenticated, service_role;
grant execute on function public.compute_deal_prediction(uuid) to authenticated, service_role;
grant execute on function public.refresh_lead_score(uuid) to authenticated, service_role;
grant execute on function public.refresh_deal_prediction(uuid) to authenticated, service_role;
grant execute on function public.refresh_org_scores(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- 6. Recalculo periodico dos scores
-- ---------------------------------------------------------------------------
-- Score parado envelhece: um deal sem atividade ha 40 dias continua "hot" se
-- ninguem recalcular. O cron reprocessa todas as organizacoes diariamente.
select cron.schedule(
  'refresh-scores-daily',
  '23 5 * * *',
  $cron$
  do $body$
  declare r record;
  begin
    for r in select id from public.organizations loop
      begin
        perform public.refresh_org_scores(r.id);
      exception when others then
        -- uma org com dado ruim nao pode parar o recalculo das demais
        raise warning 'refresh_org_scores falhou para %: %', r.id, sqlerrm;
      end;
    end loop;
  end;
  $body$;
  $cron$
);

