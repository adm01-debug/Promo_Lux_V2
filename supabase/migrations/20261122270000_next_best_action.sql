-- Next Best Action (gap 2.9 do GAPS-ENTERPRISE:
-- "Next best action - Inexistente. Padrao: sugestao por contato (call vs email vs LinkedIn)").
--
-- Entrega um motor deterministico (sem custo de LLM, roda em SQL) que, para
-- cada deal/contato da organizacao, calcula a proxima melhor acao e a
-- justificativa. A recomendacao e funcao de:
--   * dias desde o ultimo toque (deal_activities);
--   * temperatura do deal (win_probability de deal_predictions);
--   * canal disponivel do contato (email, telefone, linkedin);
--   * estagio do deal (negociacao pede call, prospeccao pede email).
--
-- Reaproveita o que ja existe: nada de tabela nova de eventos. A tabela
-- `next_best_actions` so guarda o resultado materializado por deal, para a UI
-- ler rapido e para permitir "dispensar" uma sugestao.

CREATE TABLE IF NOT EXISTS public.next_best_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  deal_id uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  stakeholder_id uuid REFERENCES public.stakeholders(id) ON DELETE SET NULL,
  action_type text NOT NULL,
  channel text NOT NULL,
  priority integer NOT NULL DEFAULT 50,
  reason text NOT NULL,
  days_since_contact integer,
  win_probability integer,
  suggested_at timestamptz NOT NULL DEFAULT now(),
  dismissed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT next_best_actions_deal_unique UNIQUE (deal_id),
  CONSTRAINT next_best_actions_type_check CHECK (action_type IN ('follow_up', 'call', 'email', 'linkedin', 'meeting', 'proposal', 'reengage', 'close')),
  CONSTRAINT next_best_actions_channel_check CHECK (channel IN ('email', 'phone', 'linkedin', 'in_person')),
  CONSTRAINT next_best_actions_priority_check CHECK (priority BETWEEN 0 AND 100)
);

CREATE INDEX IF NOT EXISTS idx_next_best_actions_org_priority
  ON public.next_best_actions (organization_id, priority DESC, suggested_at DESC);
CREATE INDEX IF NOT EXISTS idx_next_best_actions_pending
  ON public.next_best_actions (organization_id) WHERE dismissed_at IS NULL;

ALTER TABLE public.next_best_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view next_best_actions" ON public.next_best_actions
  FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "Members upsert next_best_actions" ON public.next_best_actions
  FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "Members update next_best_actions" ON public.next_best_actions
  FOR UPDATE TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()))
  WITH CHECK (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "Admins delete next_best_actions" ON public.next_best_actions
  FOR DELETE TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), 'admin'));
CREATE POLICY "Service manage next_best_actions" ON public.next_best_actions
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TRIGGER trg_next_best_actions_updated BEFORE UPDATE ON public.next_best_actions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.next_best_actions TO authenticated;
GRANT ALL ON public.next_best_actions TO service_role;
-- ---------------------------------------------------------------------------
-- Motor de recomendacao
-- ---------------------------------------------------------------------------
-- Para um deal, escolhe canal e acao segundo tres eixos: dias sem toque,
-- probabilidade de ganho e canal disponivel do contato. Deterministico:
-- mesmos dados => mesma recomendacao, sem dependencia de LLM.
CREATE OR REPLACE FUNCTION public.nba_recommend(
  _days_since integer,
  _win_prob integer,
  _has_email boolean,
  _has_phone boolean,
  _has_linkedin boolean
)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_action text;
  v_channel text;
  v_priority integer;
  v_reason text;
BEGIN
  IF _has_email IS NULL AND _has_phone IS NULL AND _has_linkedin IS NULL THEN
    _has_email := false; _has_phone := false; _has_linkedin := false;
  END IF;

  -- Canal: quanto mais quente o deal, mais direto o canal.
  IF coalesce(_win_prob, 0) >= 60 AND coalesce(_has_phone, false) THEN
    v_channel := 'phone';
  ELSIF coalesce(_has_email, false) THEN
    v_channel := 'email';
  ELSIF coalesce(_has_linkedin, false) THEN
    v_channel := 'linkedin';
  ELSIF coalesce(_has_phone, false) THEN
    v_channel := 'phone';
  ELSE
    v_channel := 'email';
  END IF;

  -- Acao: ordenada por urgencia (tempo parado) e depois por temperatura.
  IF _days_since IS NULL THEN
    v_action := 'reengage';
    v_reason := 'Deal sem nenhuma atividade registrada - iniciar contato';
  ELSIF _days_since >= 21 THEN
    v_action := 'reengage';
    v_reason := format('Sem contato ha %s dias - risco alto de esfriar', _days_since);
  ELSIF coalesce(_win_prob, 0) >= 75 AND _days_since <= 7 THEN
    v_action := 'close';
    v_reason := format('Probabilidade de ganho em %s%% e contato recente - pedir fechamento', coalesce(_win_prob, 0));
  ELSIF coalesce(_win_prob, 0) >= 60 THEN
    v_action := 'proposal';
    v_reason := format('Probabilidade de ganho em %s%% - enviar/retomar proposta', coalesce(_win_prob, 0));
  ELSIF _days_since >= 10 THEN
    v_action := 'follow_up';
    v_reason := format('Sem contato ha %s dias - retomar conversa', _days_since);
  ELSIF v_channel = 'phone' THEN
    v_action := 'call';
    v_reason := 'Contato engajado com telefone disponivel - ligar';
  ELSE
    v_action := 'email';
    v_reason := 'Manter cadencia com mensagem personalizada';
  END IF;

  -- Prioridade: tempo parado domina, temperatura pondera.
  v_priority := least(100, greatest(0,
      coalesce(_days_since, 30) * 2 + coalesce(_win_prob, 0) / 2
  ));

  RETURN jsonb_build_object(
    'action_type', v_action,
    'channel', v_channel,
    'priority', v_priority,
    'reason', v_reason
  );
END;
$$;

REVOKE ALL ON FUNCTION public.nba_recommend(integer, integer, boolean, boolean, boolean) FROM public;
GRANT EXECUTE ON FUNCTION public.nba_recommend(integer, integer, boolean, boolean, boolean) TO authenticated;
-- ---------------------------------------------------------------------------
-- Recalculo por organizacao
-- ---------------------------------------------------------------------------
-- Materializa uma sugestao por deal ativo. Idempotente: reexecutar atualiza o
-- mesmo deal em vez de duplicar (constraint next_best_actions_deal_unique).
-- Sugestoes dispensadas ficam registradas (dismissed_at) e nao sao recriadas
-- ate o deal mudar de estado.
CREATE OR REPLACE FUNCTION public.refresh_next_best_actions(_org_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_count integer := 0;
  r record;
  v_rec jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'nao autenticado' USING ERRCODE = '28000';
  END IF;

  IF NOT public.is_org_member(_org_id, v_uid) THEN
    RAISE EXCEPTION 'usuario nao pertence a organizacao' USING ERRCODE = '42501';
  END IF;

  FOR r IN
    SELECT
      d.id AS deal_id,
      d.organization_id,
      d.stakeholder_id,
      s.email IS NOT NULL AND length(trim(s.email)) > 0 AS has_email,
      s.phone IS NOT NULL AND length(trim(s.phone)) > 0 AS has_phone,
      s.linkedin_url IS NOT NULL AND length(trim(s.linkedin_url)) > 0 AS has_linkedin,
      (SELECT max(a.created_at) FROM public.deal_activities a WHERE a.deal_id = d.id) AS last_touch,
      p.win_probability
    FROM public.deals d
    LEFT JOIN public.stakeholders s ON s.id = d.stakeholder_id
    LEFT JOIN public.deal_predictions p ON p.deal_id = d.id
    WHERE d.organization_id = _org_id
      AND d.deleted_at IS NULL
      AND d.closed_at IS NULL
  LOOP
    v_rec := public.nba_recommend(
      CASE WHEN r.last_touch IS NULL THEN NULL
           ELSE floor(extract(epoch FROM (now() - r.last_touch)) / 86400)::integer
      END,
      r.win_probability,
      r.has_email, r.has_phone, r.has_linkedin
    );

    INSERT INTO public.next_best_actions (
      organization_id, deal_id, stakeholder_id,
      action_type, channel, priority, reason,
      days_since_contact, win_probability, suggested_at
    ) VALUES (
      r.organization_id, r.deal_id, r.stakeholder_id,
      v_rec->>'action_type', v_rec->>'channel', (v_rec->>'priority')::integer, v_rec->>'reason',
      CASE WHEN r.last_touch IS NULL THEN NULL
           ELSE floor(extract(epoch FROM (now() - r.last_touch)) / 86400)::integer
      END,
      r.win_probability,
      now()
    )
    ON CONFLICT ON CONSTRAINT next_best_actions_deal_unique
    DO UPDATE SET
      stakeholder_id = EXCLUDED.stakeholder_id,
      action_type = EXCLUDED.action_type,
      channel = EXCLUDED.channel,
      priority = EXCLUDED.priority,
      reason = EXCLUDED.reason,
      days_since_contact = EXCLUDED.days_since_contact,
      win_probability = EXCLUDED.win_probability,
      suggested_at = now(),
      updated_at = now()
    WHERE public.next_best_actions.dismissed_at IS NULL;

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_next_best_actions(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.refresh_next_best_actions(uuid) TO authenticated;
-- ---------------------------------------------------------------------------
-- Leitura para a UI: fila priorizada com dados do deal/contato
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.list_next_best_actions(
  _org_id uuid,
  _limit integer DEFAULT 50,
  _include_dismissed boolean DEFAULT false
)
RETURNS TABLE (
  id uuid,
  deal_id uuid,
  deal_title text,
  deal_value numeric,
  stage_name text,
  stakeholder_id uuid,
  stakeholder_name text,
  stakeholder_email text,
  stakeholder_phone text,
  stakeholder_linkedin text,
  action_type text,
  channel text,
  priority integer,
  reason text,
  days_since_contact integer,
  win_probability integer,
  suggested_at timestamptz,
  dismissed_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'nao autenticado' USING ERRCODE = '28000';
  END IF;

  IF NOT public.is_org_member(_org_id, v_uid) THEN
    RAISE EXCEPTION 'usuario nao pertence a organizacao' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    n.id, n.deal_id, d.title, d.value, ds.name,
    n.stakeholder_id, s.full_name, s.email, s.phone, s.linkedin_url,
    n.action_type, n.channel, n.priority, n.reason,
    n.days_since_contact, n.win_probability, n.suggested_at, n.dismissed_at
  FROM public.next_best_actions n
  JOIN public.deals d ON d.id = n.deal_id
  LEFT JOIN public.deal_stages ds ON ds.id = d.stage_id
  LEFT JOIN public.stakeholders s ON s.id = n.stakeholder_id
  WHERE n.organization_id = _org_id
    AND (_include_dismissed OR n.dismissed_at IS NULL)
  ORDER BY n.dismissed_at NULLS FIRST, n.priority DESC, n.suggested_at DESC
  LIMIT greatest(1, least(coalesce(_limit, 50), 500));
END;
$$;

REVOKE ALL ON FUNCTION public.list_next_best_actions(uuid, integer, boolean) FROM public;
GRANT EXECUTE ON FUNCTION public.list_next_best_actions(uuid, integer, boolean) TO authenticated;

-- Dispensar uma sugestao (o usuario decidiu nao seguir agora).
CREATE OR REPLACE FUNCTION public.dismiss_next_best_action(_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_org uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'nao autenticado' USING ERRCODE = '28000';
  END IF;

  SELECT organization_id INTO v_org FROM public.next_best_actions WHERE id = _id;
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'sugestao nao encontrada' USING ERRCODE = 'P0002';
  END IF;

  IF NOT public.is_org_member(v_org, v_uid) THEN
    RAISE EXCEPTION 'usuario nao pertence a organizacao' USING ERRCODE = '42501';
  END IF;

  UPDATE public.next_best_actions
     SET dismissed_at = now(), updated_at = now()
   WHERE id = _id AND dismissed_at IS NULL;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.dismiss_next_best_action(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.dismiss_next_best_action(uuid) TO authenticated;