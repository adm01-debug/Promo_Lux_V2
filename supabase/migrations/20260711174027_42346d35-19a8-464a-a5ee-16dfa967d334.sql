-- A/B Testing de campanhas: variante atribuída por destinatário + métricas agregadas por variante.
-- Coluna variant guarda o índice/rótulo da variante da etapa 0 (primeiro e-mail).
ALTER TABLE public.campaign_recipients
  ADD COLUMN IF NOT EXISTS variant TEXT;

-- Índice para agregação eficiente de métricas por variante dentro de uma campanha.
CREATE INDEX IF NOT EXISTS idx_campaign_recipients_variant
  ON public.campaign_recipients (campaign_id, variant);

-- Função de estatísticas A/B por variante (respeita isolamento multi-tenant via membership).
CREATE OR REPLACE FUNCTION public.campaign_ab_stats(_campaign_id uuid)
RETURNS TABLE(
  variant text,
  recipients bigint,
  sent bigint,
  opened bigint,
  clicked bigint,
  replied bigint,
  bounced bigint,
  open_rate numeric,
  click_rate numeric,
  reply_rate numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH allowed AS (
    SELECT c.id
    FROM public.campaigns c
    WHERE c.id = _campaign_id
      AND public.is_org_member(c.organization_id, auth.uid())
  ),
  base AS (
    SELECT
      COALESCE(r.variant, 'A') AS variant,
      r.status,
      r.open_count,
      r.click_count,
      r.replied_at,
      r.bounced_at,
      r.sent_at
    FROM public.campaign_recipients r
    JOIN allowed a ON a.id = r.campaign_id
  )
  SELECT
    variant,
    count(*)::bigint AS recipients,
    count(*) FILTER (WHERE sent_at IS NOT NULL)::bigint AS sent,
    count(*) FILTER (WHERE open_count > 0)::bigint AS opened,
    count(*) FILTER (WHERE click_count > 0)::bigint AS clicked,
    count(*) FILTER (WHERE replied_at IS NOT NULL)::bigint AS replied,
    count(*) FILTER (WHERE bounced_at IS NOT NULL)::bigint AS bounced,
    ROUND(
      100.0 * count(*) FILTER (WHERE open_count > 0)
      / NULLIF(count(*) FILTER (WHERE sent_at IS NOT NULL), 0), 1
    ) AS open_rate,
    ROUND(
      100.0 * count(*) FILTER (WHERE click_count > 0)
      / NULLIF(count(*) FILTER (WHERE sent_at IS NOT NULL), 0), 1
    ) AS click_rate,
    ROUND(
      100.0 * count(*) FILTER (WHERE replied_at IS NOT NULL)
      / NULLIF(count(*) FILTER (WHERE sent_at IS NOT NULL), 0), 1
    ) AS reply_rate
  FROM base
  GROUP BY variant
  ORDER BY variant;
$$;

GRANT EXECUTE ON FUNCTION public.campaign_ab_stats(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.campaign_ab_stats(uuid) TO service_role;