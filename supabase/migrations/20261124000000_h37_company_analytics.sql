-- =============================================================================
-- H37: Company Analytics — RPCs de agregacao por organizacao
-- =============================================================================
-- CONTEXTO: a migration 20260722000500_H37-company-analytics-rpcs.sql esta
-- neutralizada (no-op) porque o blob original foi commitado corrompido. Nenhum
-- objeto dela existia no banco.
--
-- CAUSA RAIZ do defeito que isto resolve: sem agregacao no servidor,
-- src/components/lux/analytics/useAnalyticsData.ts baixava a tabela companies
-- inteira e somava no cliente. O PostgREST corta a resposta em max_rows (1000),
-- entao em qualquer org com mais de 1000 empresas os totais de AnalyticsView
-- saiam subestimados sem nenhum erro visivel.
--
-- ESCOPO: 5 RPCs org-scoped, SECURITY DEFINER (agregam sobre linhas que a RLS
-- filtraria), com guard de membership identico ao resto do schema.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Resumo do dashboard: contagens, percentual enriquecido, IPC medio,
--    cobertura de contato e setor dominante — numa unica varredura.
-- ---------------------------------------------------------------------------
create or replace function public.company_analytics_summary(_org_id uuid)
returns table (
  total_companies bigint,
  enriched_companies bigint,
  enriched_pct numeric,
  avg_ipc numeric,
  with_email bigint,
  with_phone bigint,
  with_website bigint,
  top_sector text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if _org_id is null then
    raise exception 'org_id obrigatorio' using errcode = '22023';
  end if;
  if not public.is_org_member(_org_id, auth.uid()) then
    raise exception 'sem permissao na organizacao' using errcode = '42501';
  end if;

  return query
  with base as (
    select c.enriched, c.ipc_score, c.email, c.phone, c.website, c.sector
    from public.companies c
    where c.organization_id = _org_id
      and c.deleted_at is null
  ),
  agg as (
    select
      count(*) as total,
      count(*) filter (where b.enriched) as enriched,
      avg(b.ipc_score) as avg_ipc,
      count(*) filter (where b.email is not null and btrim(b.email) <> '') as with_email,
      count(*) filter (where b.phone is not null and btrim(b.phone) <> '') as with_phone,
      count(*) filter (where b.website is not null and btrim(b.website) <> '') as with_website
    from base b
  ),
  top as (
    select coalesce(b.sector, 'Outros') as sector
    from base b
    group by 1
    order by count(*) desc, 1 asc
    limit 1
  )
  select
    a.total,
    a.enriched,
    round(100.0 * a.enriched / nullif(a.total, 0), 1),
    round(a.avg_ipc, 1),
    a.with_email,
    a.with_phone,
    a.with_website,
    (select t.sector from top t)
  from agg a;
end;
$$;

comment on function public.company_analytics_summary(uuid) is
  'Totais org-scoped de empresas para o dashboard de analytics (evita agregar 1000+ linhas no cliente).';


-- ---------------------------------------------------------------------------
-- 2. Tendencia de crescimento: novas empresas e quantas enriquecidas, por mes.
--    Meses sem cadastro retornam 0 (generate_series), para o grafico nao pular
--    buracos.
-- ---------------------------------------------------------------------------
create or replace function public.company_growth_trend(_org_id uuid, _months integer default 6)
returns table (
  month_start date,
  new_companies bigint,
  enriched_companies bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_months integer;
begin
  if _org_id is null then
    raise exception 'org_id obrigatorio' using errcode = '22023';
  end if;
  if not public.is_org_member(_org_id, auth.uid()) then
    raise exception 'sem permissao na organizacao' using errcode = '42501';
  end if;

  v_months := least(greatest(coalesce(_months, 6), 1), 24);

  return query
  with bounds as (
    select (date_trunc('month', now()) - make_interval(months => v_months - 1))::date as first_month
  ),
  series as (
    select (generate_series(b.first_month::timestamp,
                            date_trunc('month', now()),
                            interval '1 month'))::date as month_start
    from bounds b
  ),
  base as (
    select date_trunc('month', c.created_at)::date as month_start, c.enriched
    from public.companies c, bounds b
    where c.organization_id = _org_id
      and c.deleted_at is null
      and c.created_at >= b.first_month
  )
  select
    s.month_start,
    count(b.month_start),
    count(b.month_start) filter (where b.enriched)
  from series s
  left join base b on b.month_start = s.month_start
  group by s.month_start
  order by s.month_start;
end;
$$;

comment on function public.company_growth_trend(uuid, integer) is
  'Serie mensal de empresas novas e enriquecidas por organizacao; meses vazios retornam 0.';


-- ---------------------------------------------------------------------------
-- 3. Distribuicao de score IPC em 4 faixas fixas. As 4 faixas sempre aparecem
--    (mesmo com 0 empresas) porque a UI desenha o eixo fixo.
--    ipc_score NULL conta em '<60', igual ao calculo anterior no cliente (`?? 0`).
-- ---------------------------------------------------------------------------
create or replace function public.company_ipc_distribution(_org_id uuid)
returns table (
  bucket text,
  bucket_pos integer,
  total bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if _org_id is null then
    raise exception 'org_id obrigatorio' using errcode = '22023';
  end if;
  if not public.is_org_member(_org_id, auth.uid()) then
    raise exception 'sem permissao na organizacao' using errcode = '42501';
  end if;

  return query
  with buckets(bucket, bucket_pos, low, high) as (
    values
      ('90-100', 1, 90, 100),
      ('75-89',  2, 75, 89),
      ('60-74',  3, 60, 74),
      ('< 60',   4, 0, 59)
  ),
  base as (
    select coalesce(c.ipc_score, 0) as score
    from public.companies c
    where c.organization_id = _org_id
      and c.deleted_at is null
  )
  select
    b.bucket,
    b.bucket_pos,
    count(x.score)
  from buckets b
  left join base x on x.score >= b.low and x.score <= b.high
  group by b.bucket, b.bucket_pos
  order by b.bucket_pos;
end;
$$;

comment on function public.company_ipc_distribution(uuid) is
  'Contagem de empresas por faixa de IPC (4 faixas fixas) para o grafico de analytics.';


-- ---------------------------------------------------------------------------
-- 4. Distribuicao por fonte de captacao: total e quantas foram enriquecidas.
--    Ordenada por volume desc (a UI mostra as 7 maiores).
-- ---------------------------------------------------------------------------
create or replace function public.company_source_distribution(_org_id uuid, _limit integer default 7)
returns table (
  source text,
  total bigint,
  enriched bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_limit integer;
begin
  if _org_id is null then
    raise exception 'org_id obrigatorio' using errcode = '22023';
  end if;
  if not public.is_org_member(_org_id, auth.uid()) then
    raise exception 'sem permissao na organizacao' using errcode = '42501';
  end if;

  v_limit := least(greatest(coalesce(_limit, 7), 1), 50);

  return query
  select
    coalesce(c.source, 'manual') as source,
    count(*),
    count(*) filter (where c.enriched)
  from public.companies c
  where c.organization_id = _org_id
    and c.deleted_at is null
  group by 1
  order by count(*) desc, 1 asc
  limit v_limit;
end;
$$;

comment on function public.company_source_distribution(uuid, integer) is
  'Empresas por fonte de captacao com contagem de enriquecidas, para o grafico de enriquecimento.';


-- ---------------------------------------------------------------------------
-- 5. Distribuicao por setor: percentual (0-100) de cada setor sobre o total.
-- ---------------------------------------------------------------------------
create or replace function public.company_sector_distribution(_org_id uuid, _limit integer default 6)
returns table (
  sector text,
  total bigint,
  pct numeric
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_limit integer;
begin
  if _org_id is null then
    raise exception 'org_id obrigatorio' using errcode = '22023';
  end if;
  if not public.is_org_member(_org_id, auth.uid()) then
    raise exception 'sem permissao na organizacao' using errcode = '42501';
  end if;

  v_limit := least(greatest(coalesce(_limit, 6), 1), 50);

  return query
  with base as (
    select coalesce(c.sector, 'Outros') as sector
    from public.companies c
    where c.organization_id = _org_id
      and c.deleted_at is null
  ),
  totals as (
    select count(*) as grand_total from base
  )
  select
    b.sector,
    count(*),
    round(100.0 * count(*) / nullif(t.grand_total, 0), 0)
  from base b, totals t
  group by b.sector, t.grand_total
  order by count(*) desc, b.sector asc
  limit v_limit;
end;
$$;

comment on function public.company_sector_distribution(uuid, integer) is
  'Percentual de empresas por setor (0-100), para o grafico de setores do analytics.';


-- ---------------------------------------------------------------------------
-- Grants: as 5 RPCs sao chamadas pelo frontend autenticado. anon nao tem uso.
-- O guard de membership roda dentro da funcao (SECURITY DEFINER), logo o GRANT
-- a authenticated nao expoe dados de outra org.
-- ---------------------------------------------------------------------------
revoke all on function public.company_analytics_summary(uuid) from public, anon;
revoke all on function public.company_growth_trend(uuid, integer) from public, anon;
revoke all on function public.company_ipc_distribution(uuid) from public, anon;
revoke all on function public.company_source_distribution(uuid, integer) from public, anon;
revoke all on function public.company_sector_distribution(uuid, integer) from public, anon;

grant execute on function public.company_analytics_summary(uuid) to authenticated, service_role;
grant execute on function public.company_growth_trend(uuid, integer) to authenticated, service_role;
grant execute on function public.company_ipc_distribution(uuid) to authenticated, service_role;
grant execute on function public.company_source_distribution(uuid, integer) to authenticated, service_role;
grant execute on function public.company_sector_distribution(uuid, integer) to authenticated, service_role;