-- Ranking de performance por membro da organizacao.
-- Gap do docs/GAPS-ENTERPRISE.md "Leaderboards | Inexistente".

CREATE OR REPLACE VIEW public.org_leaderboard
WITH (security_invoker = true) AS
WITH months AS (
  SELECT DISTINCT date_trunc('month', d.closed_at)::date AS month_start, d.organization_id
  FROM public.deals d
  WHERE d.closed_at IS NOT NULL AND d.deleted_at IS NULL
  UNION
  SELECT DISTINCT date_trunc('month', ac.created_at)::date, ac.organization_id
  FROM public.deal_activities ac
),
base AS (
  SELECT
    m.organization_id,
    m.month_start,
    om.user_id,
    pr.full_name
  FROM months m
  JOIN public.organization_members om ON om.organization_id = m.organization_id
  LEFT JOIN public.profiles pr ON pr.id = om.user_id
)
SELECT
  b.organization_id,
  b.user_id,
  b.full_name,
  b.month_start,
  COALESCE(w.won_deals, 0)   AS won_deals,
  COALESCE(w.won_value, 0)   AS won_value,
  COALESCE(ac.activities, 0) AS activities,
  COALESCE(co.new_companies, 0) AS new_companies,
  -- ROW_NUMBER/count inline: a UI ordena por metrica escolhida, o rank e calculado
  -- no cliente para nao exigir uma view por metrica.
  (COALESCE(w.won_value, 0) * 1.0) AS score_value
FROM base b
LEFT JOIN LATERAL (
  SELECT COUNT(*)::numeric AS won_deals, COALESCE(SUM(d.value), 0)::numeric AS won_value
  FROM public.deals d
  JOIN public.deal_stages s ON s.id = d.stage_id AND s.type = 'won'
  WHERE d.organization_id = b.organization_id
    AND d.user_id = b.user_id
    AND d.deleted_at IS NULL
    AND d.closed_at >= b.month_start
    AND d.closed_at < (b.month_start + INTERVAL '1 month')
) w ON TRUE
LEFT JOIN LATERAL (
  SELECT COUNT(*)::numeric AS activities
  FROM public.deal_activities a
  WHERE a.organization_id = b.organization_id
    AND a.user_id = b.user_id
    AND a.created_at >= b.month_start
    AND a.created_at < (b.month_start + INTERVAL '1 month')
) ac ON TRUE
LEFT JOIN LATERAL (
  SELECT COUNT(*)::numeric AS new_companies
  FROM public.companies c
  WHERE c.organization_id = b.organization_id
    AND c.user_id = b.user_id
    AND c.created_at >= b.month_start
    AND c.created_at < (b.month_start + INTERVAL '1 month')
) co ON TRUE;

GRANT SELECT ON public.org_leaderboard TO authenticated;
GRANT SELECT ON public.org_leaderboard TO service_role;

COMMENT ON VIEW public.org_leaderboard IS 'Ranking mensal por membro: negocios ganhos, receita, atividades e novas empresas.';