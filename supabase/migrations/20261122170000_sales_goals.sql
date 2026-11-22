-- Metas e cotas por membro da organizacao.
-- Gap do docs/GAPS-ENTERPRISE.md:147 "Goals & quotas | Inexistente"

CREATE TABLE IF NOT EXISTS public.sales_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  -- user_id do SDR/AE dono da meta; NULL = meta da organizacao inteira
  owner_id uuid,
  period text NOT NULL CHECK (period IN ('month','quarter','year')),
  period_start date NOT NULL,
  metric text NOT NULL CHECK (metric IN ('won_value','won_deals','activities','new_companies')),
  target numeric NOT NULL CHECK (target >= 0),
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sales_goals_unique_scope UNIQUE (organization_id, owner_id, period, period_start, metric)
);

CREATE INDEX IF NOT EXISTS idx_sales_goals_org_period
  ON public.sales_goals(organization_id, period_start DESC);
CREATE INDEX IF NOT EXISTS idx_sales_goals_owner
  ON public.sales_goals(organization_id, owner_id, period_start DESC);

ALTER TABLE public.sales_goals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members view goals" ON public.sales_goals;
CREATE POLICY "Members view goals" ON public.sales_goals
  FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));

DROP POLICY IF EXISTS "SDR+ insert goals" ON public.sales_goals;
CREATE POLICY "SDR+ insert goals" ON public.sales_goals
  FOR INSERT TO authenticated
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), 'sdr'));

DROP POLICY IF EXISTS "SDR+ update goals" ON public.sales_goals;
CREATE POLICY "SDR+ update goals" ON public.sales_goals
  FOR UPDATE TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), 'sdr'))
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), 'sdr'));

DROP POLICY IF EXISTS "Admins delete goals" ON public.sales_goals;
CREATE POLICY "Admins delete goals" ON public.sales_goals
  FOR DELETE TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), 'admin'));

DROP TRIGGER IF EXISTS trg_sales_goals_updated ON public.sales_goals;
CREATE TRIGGER trg_sales_goals_updated
  BEFORE UPDATE ON public.sales_goals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Progresso real por meta, calculado a partir dos dados existentes.
-- won_value/won_deals: deals em estagio type='won' fechados no periodo.
-- activities: deal_activities criadas no periodo.
-- new_companies: companies criadas no periodo.
CREATE OR REPLACE VIEW public.sales_goal_progress
WITH (security_invoker = true) AS
SELECT
  g.id                AS goal_id,
  g.organization_id,
  g.owner_id,
  g.period,
  g.period_start,
  g.metric,
  g.target,
  CASE g.metric
    WHEN 'won_value' THEN COALESCE(w.total_value, 0)
    WHEN 'won_deals' THEN COALESCE(w.deal_count, 0)
    WHEN 'activities' THEN COALESCE(a.activity_count, 0)
    WHEN 'new_companies' THEN COALESCE(c.company_count, 0)
    ELSE 0
  END AS achieved,
  CASE
    WHEN g.target > 0 THEN
      ROUND(
        (CASE g.metric
          WHEN 'won_value' THEN COALESCE(w.total_value, 0)
          WHEN 'won_deals' THEN COALESCE(w.deal_count, 0)
          WHEN 'activities' THEN COALESCE(a.activity_count, 0)
          WHEN 'new_companies' THEN COALESCE(c.company_count, 0)
          ELSE 0
        END / g.target) * 100
      , 1)
    ELSE 0
  END AS pct
FROM public.sales_goals g
LEFT JOIN LATERAL (
  SELECT COUNT(*)::numeric AS deal_count, COALESCE(SUM(d.value), 0)::numeric AS total_value
  FROM public.deals d
  JOIN public.deal_stages s ON s.id = d.stage_id AND s.type = 'won'
  WHERE d.organization_id = g.organization_id
    AND d.deleted_at IS NULL
    AND (g.owner_id IS NULL OR d.user_id = g.owner_id)
    AND d.closed_at >= g.period_start
    AND d.closed_at < (g.period_start + CASE g.period
        WHEN 'month' THEN INTERVAL '1 month'
        WHEN 'quarter' THEN INTERVAL '3 months'
        ELSE INTERVAL '1 year' END)
) w ON g.metric IN ('won_value','won_deals')
LEFT JOIN LATERAL (
  SELECT COUNT(*)::numeric AS activity_count
  FROM public.deal_activities ac
  WHERE ac.organization_id = g.organization_id
    AND (g.owner_id IS NULL OR ac.user_id = g.owner_id)
    AND ac.created_at >= g.period_start
    AND ac.created_at < (g.period_start + CASE g.period
        WHEN 'month' THEN INTERVAL '1 month'
        WHEN 'quarter' THEN INTERVAL '3 months'
        ELSE INTERVAL '1 year' END)
) a ON g.metric = 'activities'
LEFT JOIN LATERAL (
  SELECT COUNT(*)::numeric AS company_count
  FROM public.companies co
  WHERE co.organization_id = g.organization_id
    AND (g.owner_id IS NULL OR co.user_id = g.owner_id)
    AND co.created_at >= g.period_start
    AND co.created_at < (g.period_start + CASE g.period
        WHEN 'month' THEN INTERVAL '1 month'
        WHEN 'quarter' THEN INTERVAL '3 months'
        ELSE INTERVAL '1 year' END)
) c ON g.metric = 'new_companies';

-- Nome do dono da meta, para a UI nao precisar de join extra.
CREATE OR REPLACE VIEW public.sales_goals_detailed
WITH (security_invoker = true) AS
SELECT
  p.*,
  pr.full_name AS owner_name,
  g.created_at,
  g.updated_at
FROM public.sales_goal_progress p
JOIN public.sales_goals g ON g.id = p.goal_id
LEFT JOIN public.profiles pr ON pr.id = p.owner_id;

COMMENT ON TABLE public.sales_goals IS 'Metas e cotas por membro (GAPS-ENTERPRISE:147).';
COMMENT ON VIEW public.sales_goal_progress IS 'Progresso de cada meta medido contra deals/atividades/empresas reais.';