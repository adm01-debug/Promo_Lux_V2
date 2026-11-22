-- NPS / CSAT: pesquisa de satisfacao com resposta publica por token.
-- Gap do docs/GAPS-ENTERPRISE.md "NPS/CSAT | Inexistente".
--
-- Fluxo: o SDR cria a pesquisa, gera um convite (linha com responded_at NULL)
-- e envia o link /survey/<token> ao cliente. O cliente responde sem login, via
-- RPC SECURITY DEFINER que valida o token — nenhuma tabela fica aberta a anon.

CREATE TABLE IF NOT EXISTS public.satisfaction_surveys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('nps','csat')),
  question text NOT NULL,
  -- CSAT usa escala 1..5; NPS usa 0..10. Guardado para a UI nao chutar.
  scale_max integer NOT NULL DEFAULT 10 CHECK (scale_max BETWEEN 2 AND 10),
  active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_satisfaction_surveys_org
  ON public.satisfaction_surveys(organization_id, created_at DESC);

ALTER TABLE public.satisfaction_surveys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members view surveys" ON public.satisfaction_surveys;
CREATE POLICY "Members view surveys" ON public.satisfaction_surveys
  FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));

DROP POLICY IF EXISTS "SDR+ insert surveys" ON public.satisfaction_surveys;
CREATE POLICY "SDR+ insert surveys" ON public.satisfaction_surveys
  FOR INSERT TO authenticated
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), 'sdr'));

DROP POLICY IF EXISTS "SDR+ update surveys" ON public.satisfaction_surveys;
CREATE POLICY "SDR+ update surveys" ON public.satisfaction_surveys
  FOR UPDATE TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), 'sdr'))
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), 'sdr'));

DROP POLICY IF EXISTS "Admins delete surveys" ON public.satisfaction_surveys;
CREATE POLICY "Admins delete surveys" ON public.satisfaction_surveys
  FOR DELETE TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), 'admin'));

DROP TRIGGER IF EXISTS trg_satisfaction_surveys_updated ON public.satisfaction_surveys;
CREATE TRIGGER trg_satisfaction_surveys_updated
  BEFORE UPDATE ON public.satisfaction_surveys
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.satisfaction_surveys TO authenticated;
GRANT ALL ON public.satisfaction_surveys TO service_role;

-- Respostas. responded_at NULL = convite pendente (nao conta em nenhuma media).
CREATE TABLE IF NOT EXISTS public.satisfaction_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id uuid NOT NULL REFERENCES public.satisfaction_surveys(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  contact_email text,
  score integer CHECK (score BETWEEN 0 AND 10),
  comment text,
  responded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_satisfaction_responses_survey
  ON public.satisfaction_responses(survey_id, responded_at DESC);
CREATE INDEX IF NOT EXISTS idx_satisfaction_responses_org
  ON public.satisfaction_responses(organization_id, responded_at DESC);
CREATE INDEX IF NOT EXISTS idx_satisfaction_responses_token
  ON public.satisfaction_responses(token);

ALTER TABLE public.satisfaction_responses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members view responses" ON public.satisfaction_responses;
CREATE POLICY "Members view responses" ON public.satisfaction_responses
  FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));

DROP POLICY IF EXISTS "SDR+ insert responses" ON public.satisfaction_responses;
CREATE POLICY "SDR+ insert responses" ON public.satisfaction_responses
  FOR INSERT TO authenticated
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), 'sdr'));

DROP POLICY IF EXISTS "Admins delete responses" ON public.satisfaction_responses;
CREATE POLICY "Admins delete responses" ON public.satisfaction_responses
  FOR DELETE TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), 'admin'));

GRANT SELECT, INSERT, DELETE ON public.satisfaction_responses TO authenticated;
GRANT ALL ON public.satisfaction_responses TO service_role;

-- Agregacao. NPS segue a regra oficial: promotores (9-10) menos detratores (0-6).
CREATE OR REPLACE VIEW public.satisfaction_stats
WITH (security_invoker = true) AS
SELECT
  s.id                AS survey_id,
  s.organization_id,
  s.name,
  s.kind,
  s.scale_max,
  s.active,
  COUNT(r.id) FILTER (WHERE r.responded_at IS NOT NULL) AS responses,
  ROUND(AVG(r.score) FILTER (WHERE r.responded_at IS NOT NULL)::numeric, 2) AS avg_score,
  COUNT(r.id) FILTER (WHERE r.responded_at IS NOT NULL AND r.score >= 9) AS promoters,
  COUNT(r.id) FILTER (WHERE r.responded_at IS NOT NULL AND r.score BETWEEN 7 AND 8) AS passives,
  COUNT(r.id) FILTER (WHERE r.responded_at IS NOT NULL AND r.score <= 6) AS detractors,
  COUNT(r.id) FILTER (WHERE r.responded_at IS NULL) AS pending,
  CASE
    WHEN COUNT(r.id) FILTER (WHERE r.responded_at IS NOT NULL) = 0 THEN NULL
    WHEN s.kind = 'nps' THEN
      ROUND(
        ((COUNT(r.id) FILTER (WHERE r.responded_at IS NOT NULL AND r.score >= 9)
          - COUNT(r.id) FILTER (WHERE r.responded_at IS NOT NULL AND r.score <= 6))::numeric
         / COUNT(r.id) FILTER (WHERE r.responded_at IS NOT NULL)) * 100
      , 1)
    ELSE ROUND(
      (AVG(r.score) FILTER (WHERE r.responded_at IS NOT NULL) / NULLIF(s.scale_max, 0)) * 100
    , 1)
  END AS score_index
FROM public.satisfaction_surveys s
LEFT JOIN public.satisfaction_responses r ON r.survey_id = s.id
GROUP BY s.id, s.organization_id, s.name, s.kind, s.scale_max, s.active;

GRANT SELECT ON public.satisfaction_stats TO authenticated;
GRANT SELECT ON public.satisfaction_stats TO service_role;

-- Leitura publica da pesquisa pelo token. Nao expoe organization_id nem outras
-- respostas: devolve so o necessario para renderizar o formulario.
CREATE OR REPLACE FUNCTION public.get_survey_by_token(_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'name', s.name,
    'kind', s.kind,
    'question', s.question,
    'scale_max', s.scale_max,
    'answered', r.responded_at IS NOT NULL,
    'score', r.score,
    'comment', r.comment
  )
  INTO v_result
  FROM public.satisfaction_responses r
  JOIN public.satisfaction_surveys s ON s.id = r.survey_id
  WHERE r.token = _token AND s.active;

  RETURN v_result;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_survey_by_token(text) FROM public;
GRANT EXECUTE ON FUNCTION public.get_survey_by_token(text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_survey_by_token(text) TO authenticated;

-- Resposta publica. Idempotente: uma resposta por token, sobrescreve se repetir.
CREATE OR REPLACE FUNCTION public.submit_survey_response(
  _token text,
  _score integer,
  _comment text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_survey public.satisfaction_surveys%ROWTYPE;
  v_response public.satisfaction_responses%ROWTYPE;
BEGIN
  SELECT * INTO v_response
  FROM public.satisfaction_responses
  WHERE token = _token;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'token_invalido' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_survey
  FROM public.satisfaction_surveys
  WHERE id = v_response.survey_id AND active;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'pesquisa_inativa' USING ERRCODE = '22023';
  END IF;

  IF _score IS NULL OR _score < 0 OR _score > v_survey.scale_max THEN
    RAISE EXCEPTION 'nota_fora_da_escala' USING ERRCODE = '22023';
  END IF;

  UPDATE public.satisfaction_responses
  SET score = _score,
      comment = NULLIF(btrim(COALESCE(_comment, '')), ''),
      responded_at = now()
  WHERE id = v_response.id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.submit_survey_response(text, integer, text) FROM public;
GRANT EXECUTE ON FUNCTION public.submit_survey_response(text, integer, text) TO anon;
GRANT EXECUTE ON FUNCTION public.submit_survey_response(text, integer, text) TO authenticated;

COMMENT ON TABLE public.satisfaction_surveys IS 'Pesquisas de NPS/CSAT por organizacao (GAPS-ENTERPRISE).';
COMMENT ON VIEW public.satisfaction_stats IS 'NPS oficial (promotores - detratores) e CSAT normalizado, somente respostas concluidas.';
COMMENT ON FUNCTION public.get_survey_by_token(text) IS 'Leitura publica de uma pesquisa pelo token do convite.';
COMMENT ON FUNCTION public.submit_survey_response(text, integer, text) IS 'Resposta publica idempotente por token.';