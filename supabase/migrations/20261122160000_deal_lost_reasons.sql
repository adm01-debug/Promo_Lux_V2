-- Motivos de perda (lost reasons) + automação de closed_at
-- Gap do docs/GAPS-ENTERPRISE.md:83 "Lost reasons | Inexistente"

CREATE TABLE IF NOT EXISTS public.deal_lost_reasons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  label text NOT NULL,
  category text NOT NULL DEFAULT 'other'
    CHECK (category IN ('price','competitor','timing','no_budget','no_fit','no_response','internal','other')),
  active boolean NOT NULL DEFAULT true,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT deal_lost_reasons_label_org_uniq UNIQUE (organization_id, label)
);

CREATE INDEX IF NOT EXISTS idx_deal_lost_reasons_org ON public.deal_lost_reasons(organization_id, position);

ALTER TABLE public.deal_lost_reasons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members view lost reasons" ON public.deal_lost_reasons;
CREATE POLICY "Members view lost reasons" ON public.deal_lost_reasons
  FOR SELECT TO authenticated
  USING (organization_id IS NOT NULL AND public.is_org_member(organization_id, auth.uid()));

DROP POLICY IF EXISTS "SDR+ insert lost reasons" ON public.deal_lost_reasons;
CREATE POLICY "SDR+ insert lost reasons" ON public.deal_lost_reasons
  FOR INSERT TO authenticated
  WITH CHECK (organization_id IS NOT NULL AND public.has_org_role(organization_id, auth.uid(), 'sdr'));

DROP POLICY IF EXISTS "SDR+ update lost reasons" ON public.deal_lost_reasons;
CREATE POLICY "SDR+ update lost reasons" ON public.deal_lost_reasons
  FOR UPDATE TO authenticated
  USING (organization_id IS NOT NULL AND public.has_org_role(organization_id, auth.uid(), 'sdr'))
  WITH CHECK (organization_id IS NOT NULL AND public.has_org_role(organization_id, auth.uid(), 'sdr'));

DROP POLICY IF EXISTS "Admins delete lost reasons" ON public.deal_lost_reasons;
CREATE POLICY "Admins delete lost reasons" ON public.deal_lost_reasons
  FOR DELETE TO authenticated
  USING (organization_id IS NOT NULL AND public.has_org_role(organization_id, auth.uid(), 'admin'));

-- Ligação com o negócio
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS lost_reason_id uuid
  REFERENCES public.deal_lost_reasons(id) ON DELETE SET NULL;
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS lost_notes text;

CREATE INDEX IF NOT EXISTS idx_deals_lost_reason ON public.deals(lost_reason_id)
  WHERE lost_reason_id IS NOT NULL;

DROP TRIGGER IF EXISTS trg_deal_lost_reasons_updated ON public.deal_lost_reasons;
CREATE TRIGGER trg_deal_lost_reasons_updated
  BEFORE UPDATE ON public.deal_lost_reasons
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed dos motivos canônicos por organização existente
INSERT INTO public.deal_lost_reasons (organization_id, user_id, label, category, position)
SELECT o.id, o.owner_id, v.label, v.category, v.pos
FROM public.organizations o
CROSS JOIN (VALUES
  ('Preço acima do orçamento', 'price', 0),
  ('Concorrente escolhido', 'competitor', 1),
  ('Timing inadequado', 'timing', 2),
  ('Sem orçamento no momento', 'no_budget', 3),
  ('Fora do perfil ideal (ICP)', 'no_fit', 4),
  ('Sem resposta do contato', 'no_response', 5),
  ('Decisão interna contrária', 'internal', 6),
  ('Outro', 'other', 7)
) AS v(label, category, pos)
WHERE o.owner_id IS NOT NULL
ON CONFLICT (organization_id, label) DO NOTHING;

-- Análise de perdas por motivo
CREATE OR REPLACE VIEW public.deal_lost_reason_stats
WITH (security_invoker = true) AS
SELECT
  d.organization_id,
  r.id            AS lost_reason_id,
  r.label,
  r.category,
  COUNT(*)::int              AS deal_count,
  COALESCE(SUM(d.value), 0)  AS total_value
FROM public.deals d
JOIN public.deal_lost_reasons r ON r.id = d.lost_reason_id
JOIN public.deal_stages s ON s.id = d.stage_id AND s.type = 'lost'
GROUP BY d.organization_id, r.id, r.label, r.category;

COMMENT ON TABLE public.deal_lost_reasons IS 'Catálogo de motivos de perda por organização (GAPS-ENTERPRISE:83).';
COMMENT ON VIEW public.deal_lost_reason_stats IS 'Contagem e valor perdido por motivo; base do painel de análise de perdas.';
-- Seed idempotente chamável pela UI quando a org não tem catálogo
-- (orgs criadas depois desta migration).
CREATE OR REPLACE FUNCTION public.seed_default_lost_reasons(_org_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inserted integer := 0;
BEGIN
  IF _org_id IS NULL THEN
    RAISE EXCEPTION 'org_id obrigatorio';
  END IF;
  IF NOT public.is_org_member(_org_id, auth.uid()) THEN
    RAISE EXCEPTION 'sem permissao na organizacao';
  END IF;

  INSERT INTO public.deal_lost_reasons (organization_id, user_id, label, category, position)
  SELECT _org_id, auth.uid(), v.label, v.category, v.pos
  FROM (VALUES
    ('Preço acima do orçamento', 'price', 0),
    ('Concorrente escolhido', 'competitor', 1),
    ('Timing inadequado', 'timing', 2),
    ('Sem orçamento no momento', 'no_budget', 3),
    ('Fora do perfil ideal (ICP)', 'no_fit', 4),
    ('Sem resposta do contato', 'no_response', 5),
    ('Decisão interna contrária', 'internal', 6),
    ('Outro', 'other', 7)
  ) AS v(label, category, pos)
  ON CONFLICT (organization_id, label) DO NOTHING;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  RETURN v_inserted;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.seed_default_lost_reasons(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.seed_default_lost_reasons(uuid) TO authenticated;