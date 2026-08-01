-- Configuração de teste A/B com seleção automática de vencedor.
ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS ab_test_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ab_min_sample integer NOT NULL DEFAULT 20,
  ADD COLUMN IF NOT EXISTS ab_winner_metric text NOT NULL DEFAULT 'reply'
    CHECK (ab_winner_metric IN ('open','click','reply')),
  ADD COLUMN IF NOT EXISTS ab_winner_variant text,
  ADD COLUMN IF NOT EXISTS ab_winner_decided_at timestamp with time zone;

-- Elege automaticamente a variante vencedora quando cada variante usada
-- atingiu a amostra mínima de envios. Idempotente: se já houver vencedora
-- ou o teste automático estiver desativado, retorna o estado atual.
CREATE OR REPLACE FUNCTION public.decide_ab_winner(_campaign_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_campaign public.campaigns;
  v_winner text;
  v_min integer;
  v_variant_count integer;
BEGIN
  SELECT * INTO v_campaign FROM public.campaigns WHERE id = _campaign_id;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- Isolamento: service_role (auth.uid() NULL) OU membro da organização.
  IF auth.uid() IS NOT NULL
     AND NOT public.is_org_member(v_campaign.organization_id, auth.uid()) THEN
    RAISE EXCEPTION 'Acesso negado à campanha';
  END IF;

  -- Já decidido ou teste automático desligado.
  IF v_campaign.ab_winner_variant IS NOT NULL OR NOT v_campaign.ab_test_enabled THEN
    RETURN v_campaign.ab_winner_variant;
  END IF;

  v_min := GREATEST(COALESCE(v_campaign.ab_min_sample, 20), 1);

  -- Precisa de pelo menos 2 variantes atribuídas.
  SELECT count(DISTINCT variant) INTO v_variant_count
  FROM public.campaign_recipients
  WHERE campaign_id = _campaign_id AND variant IS NOT NULL;
  IF v_variant_count < 2 THEN
    RETURN NULL;
  END IF;

  -- Toda variante usada precisa ter atingido a amostra mínima de envios.
  IF EXISTS (
    SELECT 1 FROM public.campaign_recipients
    WHERE campaign_id = _campaign_id AND variant IS NOT NULL
    GROUP BY variant
    HAVING count(*) FILTER (WHERE sent_at IS NOT NULL) < v_min
  ) THEN
    RETURN NULL;
  END IF;

  -- Elege vencedora pela métrica configurada (desempate por volume de envio).
  SELECT s.variant INTO v_winner
  FROM (
    SELECT
      variant,
      count(*) FILTER (WHERE sent_at IS NOT NULL) AS sent,
      count(*) FILTER (WHERE open_count > 0) AS opened,
      count(*) FILTER (WHERE click_count > 0) AS clicked,
      count(*) FILTER (WHERE replied_at IS NOT NULL) AS replied
    FROM public.campaign_recipients
    WHERE campaign_id = _campaign_id AND variant IS NOT NULL
    GROUP BY variant
  ) s
  ORDER BY
    CASE v_campaign.ab_winner_metric
      WHEN 'open'  THEN s.opened::numeric  / NULLIF(s.sent, 0)
      WHEN 'click' THEN s.clicked::numeric / NULLIF(s.sent, 0)
      ELSE               s.replied::numeric / NULLIF(s.sent, 0)
    END DESC NULLS LAST,
    s.sent DESC
  LIMIT 1;

  IF v_winner IS NOT NULL THEN
    UPDATE public.campaigns
    SET ab_winner_variant = v_winner, ab_winner_decided_at = now()
    WHERE id = _campaign_id;
  END IF;

  RETURN v_winner;
END;
$$;

GRANT EXECUTE ON FUNCTION public.decide_ab_winner(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.decide_ab_winner(uuid) TO service_role;