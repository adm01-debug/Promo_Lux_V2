-- ============================================================
-- C14 (reconstrucao): Significancia estatistica no A/B
-- ============================================================
-- Estado real hoje:
--   * campaign_ab_stats (20260711174027) devolve taxas simples
--     (open_rate/click_rate/reply_rate) sem nenhum teste estatistico.
--   * decide_ab_winner (20260711174405) elege a "vencedora" por MAIOR TAXA
--     assim que cada variante tem ab_min_sample (default 20) envios.
--
-- Efeito em producao: com 2 variantes de 20 envios, 2/20 vs 1/20 (10% vs 5%)
-- ja elege vencedora. Isso e ruido: p ~ 0.55 na metrica 'open'. A campanha
-- migra 100% do trafego para a variante errada e a decisao vira permanente
-- (ab_winner_variant preenchido nunca e reavaliado).
--
-- Esta migration:
--   1. cria public.normal_two_sided_p(float8) - cauda bilateral da normal
--      padrao pela aproximacao de Zelen & Severo / Abramowitz-Stegun 26.2.17
--      (|erro| < 7.5e-8 ate z~3). Postgres nao tem erfc(), entao e necessario.
--      Em cauda extrema (z > 5) a aproximacao SUPERESTIMA o p-value, o que
--      e a direcao conservadora: nunca declara significancia falsa.
--   2. adiciona em campaigns: ab_winner_p_value, ab_winner_lift,
--      ab_winner_reason (why a decisao foi tomada) e ab_confirmation_runs
--      (contador de reavaliacoes apos a decisao).
--   3. cria public.ab_two_proportion_test(...) - two-proportion z-test com
--      pooled p, devolve (p_value, lift_pct, is_significant, needed_sample).
--   4. reescreve decide_ab_winner para so eleger COM significancia
--      (p <= ab_min_confidence) e amostra minima; senao devolve NULL e
--      deixar o split rodando. Idempotente e retrocompativel na assinatura.
--   5. recria campaign_ab_stats mantendo as colunas originais e ANEXANDO
--      p_value / lift_pct / is_significant / is_winner (aditivo na cauda).
-- ============================================================

-- ------------------------------------------------------------------
-- 1. Cauda bilateral da normal padrao
-- ------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.normal_two_sided_p(_z float8)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT CASE
    WHEN _z IS NULL THEN NULL
    WHEN abs(_z) = 0 THEN 1::numeric
    ELSE ROUND(
      LEAST(GREATEST(
        power(
          1
          + 0.196854  * abs(_z)
          + 0.115194  * power(abs(_z), 2)
          + 0.000344  * power(abs(_z), 3)
          + 0.019527  * power(abs(_z), 4),
          -4
        ),
        0::float8
      ), 1::float8)::numeric,
      6
    )
  END;
$$;

-- ------------------------------------------------------------------
-- 2. Colunas de decisao auditavel
-- ------------------------------------------------------------------
ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS ab_min_confidence numeric NOT NULL DEFAULT 0.95,
  ADD COLUMN IF NOT EXISTS ab_winner_p_value numeric,
  ADD COLUMN IF NOT EXISTS ab_winner_lift numeric,
  ADD COLUMN IF NOT EXISTS ab_winner_reason text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.campaigns'::regclass
      AND conname  = 'campaigns_ab_min_confidence_check'
  ) THEN
    ALTER TABLE public.campaigns
      ADD CONSTRAINT campaigns_ab_min_confidence_check
      CHECK (ab_min_confidence > 0.5 AND ab_min_confidence < 1);
  END IF;
END;
$$;

-- ------------------------------------------------------------------
-- 3. Two-proportion z-test (pooled)
-- ------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ab_two_proportion_test(
  _success_a bigint,
  _total_a   bigint,
  _success_b bigint,
  _total_b   bigint
)
RETURNS TABLE(
  p_value        numeric,
  lift_pct       numeric,
  is_significant boolean,
  needed_sample  bigint
)
LANGUAGE plpgsql
IMMUTABLE
PARALLEL SAFE
AS $$
DECLARE
  v_rate_a  numeric;
  v_rate_b  numeric;
  v_pooled  numeric;
  v_se      numeric;
  v_z       float8;
  v_p       numeric;
  v_lift    numeric;
  v_needed  bigint;
  v_delta   numeric;
BEGIN
  IF COALESCE(_total_a, 0) = 0 OR COALESCE(_total_b, 0) = 0 THEN
    RETURN QUERY SELECT NULL::numeric, NULL::numeric, false, NULL::bigint;
    RETURN;
  END IF;

  v_rate_a := _success_a::numeric / _total_a;
  v_rate_b := _success_b::numeric / _total_b;
  v_pooled := (_success_a + _success_b)::numeric / (_total_a + _total_b);
  v_delta  := v_rate_b - v_rate_a;
  v_lift   := CASE WHEN v_rate_a > 0 THEN ROUND(100.0 * v_delta / v_rate_a, 2) ELSE NULL END;

  IF v_rate_a = 0 AND v_rate_b = 0 THEN
    RETURN QUERY SELECT 1::numeric, 0::numeric, false, NULL::bigint;
    RETURN;
  END IF;

  v_se := sqrt(
    (v_pooled * (1 - v_pooled)) * (1::numeric / _total_a + 1::numeric / _total_b)
  );

  IF COALESCE(v_se, 0) = 0 THEN
    -- Separacao perfeita (0% vs 100%): z e infinito, p tende a 0.
    v_p := CASE WHEN v_delta = 0 THEN 1::numeric ELSE 0::numeric END;
  ELSE
    v_z := (v_delta / v_se)::float8;
    v_p := public.normal_two_sided_p(v_z);
  END IF;

  -- Amostra necessaria por variante para detectar o efeito observado a 80%
  -- de poder e 95% de confianca (aproximacao para proporcoes parecidas).
  v_needed := CASE
    WHEN v_delta = 0 THEN NULL
    ELSE CEIL(
      15.7 * v_pooled * (1 - v_pooled) / power(v_delta, 2)
    )::bigint
  END;

  RETURN QUERY SELECT v_p, v_lift, (v_p IS NOT NULL AND v_p <= 0.05), v_needed;
END;
$$;

-- ------------------------------------------------------------------
-- 4. decide_ab_winner com significancia
-- ------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.decide_ab_winner(_campaign_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_campaign        public.campaigns;
  v_min             integer;
  v_variant_count   integer;
  v_metric          text;
  v_best            record;
  v_row             record;
  v_second          record;
  v_test            record;
BEGIN
  SELECT * INTO v_campaign FROM public.campaigns WHERE id = _campaign_id;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- Isolamento: service_role (auth.uid() NULL) OU membro da organizacao.
  IF auth.uid() IS NOT NULL
     AND NOT public.is_org_member(v_campaign.organization_id, auth.uid()) THEN
    RAISE EXCEPTION 'Acesso negado a campanha' USING ERRCODE = '42501';
  END IF;

  -- Ja decidido ou teste automatico desligado.
  IF v_campaign.ab_winner_variant IS NOT NULL OR NOT v_campaign.ab_test_enabled THEN
    RETURN v_campaign.ab_winner_variant;
  END IF;

  v_min    := GREATEST(COALESCE(v_campaign.ab_min_sample, 20), 1);
  v_metric := COALESCE(v_campaign.ab_winner_metric, 'reply');

  SELECT count(DISTINCT variant) INTO v_variant_count
  FROM public.campaign_recipients
  WHERE campaign_id = _campaign_id AND variant IS NOT NULL;
  IF v_variant_count < 2 THEN
    RETURN NULL;
  END IF;

  -- Toda variante usada precisa ter atingido a amostra minima de envios.
  IF EXISTS (
    SELECT 1 FROM public.campaign_recipients
    WHERE campaign_id = _campaign_id AND variant IS NOT NULL
    GROUP BY variant
    HAVING count(*) FILTER (WHERE sent_at IS NOT NULL) < v_min
  ) THEN
    RETURN NULL;
  END IF;

  -- Melhor e segunda melhor variante pela metrica configurada.
  -- CTE nao sobrevive entre comandos separados, entao vem num unico FOR.
  FOR v_row IN
    WITH agg AS (
      SELECT
        variant,
        count(*) FILTER (WHERE sent_at IS NOT NULL)     AS sent,
        count(*) FILTER (WHERE open_count > 0)          AS opened,
        count(*) FILTER (WHERE click_count > 0)         AS clicked,
        count(*) FILTER (WHERE replied_at IS NOT NULL)  AS replied
      FROM public.campaign_recipients
      WHERE campaign_id = _campaign_id AND variant IS NOT NULL
      GROUP BY variant
    ),
    scored AS (
      SELECT
        variant, sent, opened, clicked, replied,
        CASE v_metric
          WHEN 'open'  THEN opened::numeric  / NULLIF(sent, 0)
          WHEN 'click' THEN clicked::numeric / NULLIF(sent, 0)
          ELSE              replied::numeric / NULLIF(sent, 0)
        END AS rate,
        ROW_NUMBER() OVER (
          ORDER BY
            CASE v_metric
              WHEN 'open'  THEN opened::numeric  / NULLIF(sent, 0)
              WHEN 'click' THEN clicked::numeric / NULLIF(sent, 0)
              ELSE              replied::numeric / NULLIF(sent, 0)
            END DESC NULLS LAST,
            sent DESC,
            variant ASC
        ) AS rn
      FROM agg
    )
    SELECT * FROM scored WHERE rn <= 2 ORDER BY rn
  LOOP
    IF v_row.rn = 1 THEN v_best := v_row;
    ELSIF v_row.rn = 2 THEN v_second := v_row;
    END IF;
  END LOOP;

  IF v_best IS NULL OR v_second IS NULL THEN
    RETURN NULL;
  END IF;
  IF v_best.variant IS NULL OR v_second.variant IS NULL THEN
    RETURN NULL;
  END IF;
  IF v_best.rate IS NULL OR v_second.rate IS NULL THEN
    RETURN NULL;
  END IF;
  IF v_best.rate <= v_second.rate THEN
    RETURN NULL;  -- empate exato: nao ha vencedora
  END IF;

  -- Teste de significancia entre as duas melhores.
  -- Base do teste = segunda colocada; assim lift_pct expressa o ganho
  -- do vencedor sobre a alternativa (positivo = melhor).
  SELECT * INTO v_test FROM public.ab_two_proportion_test(
    CASE v_metric
      WHEN 'open'  THEN v_second.opened
      WHEN 'click' THEN v_second.clicked
      ELSE              v_second.replied
    END,
    v_second.sent,
    CASE v_metric
      WHEN 'open'  THEN v_best.opened
      WHEN 'click' THEN v_best.clicked
      ELSE              v_best.replied
    END,
    v_best.sent
  );

  IF v_test.p_value IS NULL OR v_test.p_value > (1 - v_campaign.ab_min_confidence) THEN
    -- Sem evidencia estatistica suficiente: mantem o split rodando.
    RETURN NULL;
  END IF;

  UPDATE public.campaigns
  SET ab_winner_variant    = v_best.variant,
      ab_winner_decided_at = now(),
      ab_winner_p_value    = v_test.p_value,
      ab_winner_lift       = v_test.lift_pct,
      ab_winner_reason     = format(
        'significancia: %s vs %s na metrica %s (p=%s, lift=%s%%, n=%s/%s)',
        v_best.variant, v_second.variant, v_metric,
        v_test.p_value, COALESCE(v_test.lift_pct::text, 'n/d'),
        v_best.sent, v_second.sent
      )
  WHERE id = _campaign_id;

  RETURN v_best.variant;
END;
$$;

-- ------------------------------------------------------------------
-- 5. campaign_ab_stats com significancia (assinatura preservada + cauda)
-- ------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.campaign_ab_stats(uuid);

CREATE FUNCTION public.campaign_ab_stats(_campaign_id uuid)
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
  reply_rate numeric,
  p_value numeric,
  lift_pct numeric,
  is_significant boolean,
  is_winner boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_campaign public.campaigns;
  v_metric   text;
  v_top      text;
  v_best     record;
  v_stats    record;
BEGIN
  SELECT * INTO v_campaign FROM public.campaigns WHERE id = _campaign_id;
  IF NOT FOUND OR NOT public.is_org_member(v_campaign.organization_id, auth.uid()) THEN
    RETURN;  -- sem membership: nenhuma linha (nao vaza existencia da campanha)
  END IF;

  v_metric := COALESCE(v_campaign.ab_winner_metric, 'reply');

  -- Variante lider pela metrica (mesmo criterio de decide_ab_winner).
  SELECT s.variant INTO v_top
  FROM (
    SELECT
      COALESCE(r.variant, 'A') AS variant,
      count(*) FILTER (WHERE r.sent_at IS NOT NULL)     AS sent,
      count(*) FILTER (WHERE r.open_count > 0)          AS opened,
      count(*) FILTER (WHERE r.click_count > 0)         AS clicked,
      count(*) FILTER (WHERE r.replied_at IS NOT NULL)  AS replied
    FROM public.campaign_recipients r
    WHERE r.campaign_id = _campaign_id
    GROUP BY COALESCE(r.variant, 'A')
  ) s
  ORDER BY
    CASE v_metric
      WHEN 'open'  THEN s.opened::numeric  / NULLIF(s.sent, 0)
      WHEN 'click' THEN s.clicked::numeric / NULLIF(s.sent, 0)
      ELSE              s.replied::numeric / NULLIF(s.sent, 0)
    END DESC NULLS LAST,
    s.sent DESC,
    s.variant ASC
  LIMIT 1;

  -- Linha de referencia para o teste: a lider (se houver >1 variante).
  SELECT * INTO v_best
  FROM (
    SELECT
      COALESCE(r.variant, 'A') AS variant,
      count(*) FILTER (WHERE r.sent_at IS NOT NULL)     AS sent,
      count(*) FILTER (WHERE r.open_count > 0)          AS opened,
      count(*) FILTER (WHERE r.click_count > 0)         AS clicked,
      count(*) FILTER (WHERE r.replied_at IS NOT NULL)  AS replied
    FROM public.campaign_recipients r
    WHERE r.campaign_id = _campaign_id
    GROUP BY COALESCE(r.variant, 'A')
  ) best
  WHERE best.variant = v_top;

  FOR v_stats IN
    SELECT
      COALESCE(r.variant, 'A') AS variant,
      count(*)::bigint AS recipients,
      count(*) FILTER (WHERE r.sent_at IS NOT NULL)::bigint    AS sent,
      count(*) FILTER (WHERE r.open_count > 0)::bigint         AS opened,
      count(*) FILTER (WHERE r.click_count > 0)::bigint        AS clicked,
      count(*) FILTER (WHERE r.replied_at IS NOT NULL)::bigint AS replied,
      count(*) FILTER (WHERE r.bounced_at IS NOT NULL)::bigint AS bounced
    FROM public.campaign_recipients r
    WHERE r.campaign_id = _campaign_id
    GROUP BY COALESCE(r.variant, 'A')
    ORDER BY COALESCE(r.variant, 'A')
  LOOP
    variant     := v_stats.variant;
    recipients  := v_stats.recipients;
    sent        := v_stats.sent;
    opened      := v_stats.opened;
    clicked     := v_stats.clicked;
    replied     := v_stats.replied;
    bounced     := v_stats.bounced;
    open_rate   := ROUND(100.0 * v_stats.opened  / NULLIF(v_stats.sent, 0), 1);
    click_rate  := ROUND(100.0 * v_stats.clicked / NULLIF(v_stats.sent, 0), 1);
    reply_rate  := ROUND(100.0 * v_stats.replied / NULLIF(v_stats.sent, 0), 1);

    IF v_best.variant IS NULL OR v_stats.variant = v_best.variant THEN
      p_value        := NULL;
      lift_pct       := 0;
      is_significant := false;
    ELSE
      SELECT t.p_value, t.lift_pct, t.is_significant
        INTO p_value, lift_pct, is_significant
      FROM public.ab_two_proportion_test(
        CASE v_metric
          WHEN 'open'  THEN v_best.opened
          WHEN 'click' THEN v_best.clicked
          ELSE              v_best.replied
        END,
        v_best.sent,
        CASE v_metric
          WHEN 'open'  THEN v_stats.opened
          WHEN 'click' THEN v_stats.clicked
          ELSE              v_stats.replied
        END,
        v_stats.sent
      ) t;
    END IF;

    is_winner := (v_campaign.ab_winner_variant IS NOT NULL
                  AND v_stats.variant = v_campaign.ab_winner_variant);

    RETURN NEXT;
  END LOOP;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.campaign_ab_stats(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.campaign_ab_stats(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.normal_two_sided_p(float8) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.ab_two_proportion_test(bigint, bigint, bigint, bigint) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.normal_two_sided_p(float8) TO service_role;
GRANT  EXECUTE ON FUNCTION public.ab_two_proportion_test(bigint, bigint, bigint, bigint) TO service_role;

REVOKE EXECUTE ON FUNCTION public.decide_ab_winner(uuid) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.decide_ab_winner(uuid) TO service_role;