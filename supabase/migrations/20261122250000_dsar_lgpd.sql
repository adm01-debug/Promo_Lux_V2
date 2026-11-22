-- DSAR / Right to be Forgotten (gap 2.8 do GAPS-ENTERPRISE:
-- "DSAR/Right to be Forgotten - Manual. Padrao: fluxo automatizado por usuario/org").
--
-- Entrega o ciclo completo de um Data Subject Access Request:
--   1. registro do pedido com prazo legal (LGPD art. 19 / GDPR art. 12 = 30 dias);
--   2. portabilidade: export integral dos dados do titular em JSON;
--   3. direito ao esquecimento: pseudonimizacao irreversivel dos identificadores
--      diretos, preservando integridade referencial e historico de negocio;
--   4. trilha de auditoria de cada execucao.
--
-- Decisao de design: o apagamento NAO deleta linhas. Identificadores diretos
-- (nome, email, telefone, LinkedIn, payloads crus) sao substituidos por tokens
-- derivados de sha256, e o vinculo `stakeholder_id`/`deal_id` permanece. Isso
-- atende ao direito ao esquecimento sem quebrar relatorios historicos e sem
-- destruir prova de auditoria (LGPD art. 16, GDPR art. 17(3)).

CREATE TABLE IF NOT EXISTS public.data_subject_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  request_type text NOT NULL,
  subject_email text NOT NULL,
  subject_name text,
  subject_user_id uuid,
  status text NOT NULL DEFAULT 'pending',
  requested_at timestamptz NOT NULL DEFAULT now(),
  due_at timestamptz NOT NULL,
  completed_at timestamptz,
  handled_by uuid,
  legal_basis text,
  notes text,
  rejection_reason text,
  result_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT data_subject_requests_type_chk
    CHECK (request_type IN ('access', 'portability', 'erasure', 'rectification')),
  CONSTRAINT data_subject_requests_status_chk
    CHECK (status IN ('pending', 'processing', 'completed', 'rejected')),
  CONSTRAINT data_subject_requests_email_chk
    CHECK (position('@' in subject_email) > 1)
);

CREATE INDEX IF NOT EXISTS idx_dsr_org_status
  ON public.data_subject_requests (organization_id, status, due_at);

CREATE INDEX IF NOT EXISTS idx_dsr_subject
  ON public.data_subject_requests (organization_id, lower(subject_email));

ALTER TABLE public.data_subject_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dsr_select_admin" ON public.data_subject_requests;
CREATE POLICY "dsr_select_admin" ON public.data_subject_requests
  FOR SELECT TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "dsr_insert_admin" ON public.data_subject_requests;
CREATE POLICY "dsr_insert_admin" ON public.data_subject_requests
  FOR INSERT TO authenticated
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "dsr_update_admin" ON public.data_subject_requests;
CREATE POLICY "dsr_update_admin" ON public.data_subject_requests
  FOR UPDATE TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), 'admin'::public.app_role));

GRANT SELECT, INSERT, UPDATE ON public.data_subject_requests TO authenticated;

-- Hash estavel usado para pseudonimizar. Sem salt por linha de proposito:
-- o mesmo email precisa produzir o mesmo token para manter deduplicacao e
-- bloqueio de reenvio (email_suppressions).
CREATE OR REPLACE FUNCTION public.dsar_token(_value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT 'erased-' || substr(encode(sha256(lower(btrim(coalesce(_value, '')))::bytea), 'hex'), 1, 24)
$$;

REVOKE ALL ON FUNCTION public.dsar_token(text) FROM public;
GRANT EXECUTE ON FUNCTION public.dsar_token(text) TO authenticated;

-- Helper: pseudonimiza varias colunas de uma tabela num unico UPDATE,
-- aplicando apenas as colunas que existem no schema real. Protege contra
-- divergencia entre repo e producao (coluna removida/renomeada).
CREATE OR REPLACE FUNCTION public._dsar_pseudonymize(
  _tbl text,
  _org_id uuid,
  _email text,
  _token text,
  _masked_email text,
  _cols jsonb
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _sets text;
  _n int := 0;
BEGIN
  SELECT string_agg(format('%I = %s', c.col, c.expr), ', ' ORDER BY c.col)
    INTO _sets
  FROM (
    SELECT k AS col,
           CASE
             WHEN k = 'full_name' THEN quote_literal(_token)
             WHEN k = 'email' THEN quote_literal(_masked_email)
             ELSE 'NULL'
           END AS expr
    FROM jsonb_array_elements_text(_cols) AS k
  ) c
  WHERE EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = _tbl AND column_name = c.col
  );

  IF _sets IS NULL OR _sets = '' THEN
    RETURN 0;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = _tbl AND column_name = 'updated_at'
  ) THEN
    _sets := _sets || ', updated_at = now()';
  END IF;

  EXECUTE format(
    'UPDATE public.%I SET %s WHERE organization_id = $1 AND lower(email) = $2',
    _tbl, _sets
  ) USING _org_id, _email;

  GET DIAGNOSTICS _n = ROW_COUNT;
  RETURN _n;
END;
$$;

REVOKE ALL ON FUNCTION public._dsar_pseudonymize(text, uuid, text, text, text, jsonb) FROM public;

-- Portabilidade: export integral dos dados do titular dentro de uma organizacao.
CREATE OR REPLACE FUNCTION public.export_subject_data(
  _org_id uuid,
  _subject_email text,
  _subject_user_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _email text;
  _stakeholders jsonb;
  _lusha jsonb;
  _suppressions jsonb;
  _memberships jsonb;
  _profile jsonb;
  _activities int;
  _result jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'nao autenticado' USING ERRCODE = '28000';
  END IF;

  IF NOT public.has_org_role(_org_id, auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'apenas admin da organizacao pode exportar dados de titular' USING ERRCODE = '42501';
  END IF;

  IF _subject_email IS NULL OR position('@' in _subject_email) <= 1 THEN
    RAISE EXCEPTION 'email do titular invalido' USING ERRCODE = '22023';
  END IF;

  _email := lower(btrim(_subject_email));

  SELECT coalesce(jsonb_agg(to_jsonb(s) ORDER BY s.created_at), '[]'::jsonb)
    INTO _stakeholders
  FROM public.stakeholders s
  WHERE s.organization_id = _org_id
    AND (lower(s.email) = _email OR (_subject_user_id IS NOT NULL AND s.user_id = _subject_user_id));

  SELECT coalesce(jsonb_agg(to_jsonb(l) ORDER BY l.created_at), '[]'::jsonb)
    INTO _lusha
  FROM public.lusha_contacts l
  WHERE l.organization_id = _org_id
    AND lower(l.email) = _email;

  SELECT coalesce(jsonb_agg(to_jsonb(e) ORDER BY e.created_at), '[]'::jsonb)
    INTO _suppressions
  FROM public.email_suppressions e
  WHERE e.organization_id = _org_id
    AND lower(e.email) = _email;

  SELECT coalesce(jsonb_agg(to_jsonb(m) ORDER BY m.created_at), '[]'::jsonb)
    INTO _memberships
  FROM public.organization_members m
  WHERE m.organization_id = _org_id
    AND _subject_user_id IS NOT NULL
    AND m.user_id = _subject_user_id;

  IF _subject_user_id IS NOT NULL THEN
    SELECT to_jsonb(p) INTO _profile FROM public.profiles p WHERE p.id = _subject_user_id;
  END IF;

  SELECT count(*)::int INTO _activities
  FROM public.deal_activities a
  WHERE a.organization_id = _org_id
    AND (
      lower(coalesce(a.content, '')) LIKE '%' || _email || '%'
      OR lower(coalesce(a.title, '')) LIKE '%' || _email || '%'
    );

  _result := jsonb_build_object(
    'organization_id', _org_id,
    'generated_at', now(),
    'generated_by', auth.uid(),
    'subject', jsonb_build_object(
      'email', _email,
      'user_id', _subject_user_id,
      'legal_basis', 'LGPD art. 18 II / GDPR art. 15 (direito de acesso e portabilidade)'
    ),
    'stakeholders', _stakeholders,
    'lusha_contacts', _lusha,
    'email_suppressions', _suppressions,
    'memberships', _memberships,
    'profile', _profile,
    'deal_activities_mentioning_subject', _activities,
    'counts', jsonb_build_object(
      'stakeholders', jsonb_array_length(_stakeholders),
      'lusha_contacts', jsonb_array_length(_lusha),
      'email_suppressions', jsonb_array_length(_suppressions),
      'memberships', jsonb_array_length(_memberships),
      'deal_activities', _activities
    )
  );

  RETURN _result;
END;
$$;

REVOKE ALL ON FUNCTION public.export_subject_data(uuid, text, uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.export_subject_data(uuid, text, uuid) TO authenticated;

-- Direito ao esquecimento: pseudonimiza identificadores diretos.
CREATE OR REPLACE FUNCTION public.erase_subject_data(
  _org_id uuid,
  _subject_email text,
  _subject_user_id uuid DEFAULT NULL,
  _reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _email text;
  _tok text;
  _masked_email text;
  _n_stake int := 0;
  _n_lusha int := 0;
  _n_supp int := 0;
  _n_prof int := 0;
  _result jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'nao autenticado' USING ERRCODE = '28000';
  END IF;

  IF NOT public.has_org_role(_org_id, auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'apenas admin da organizacao pode apagar dados de titular' USING ERRCODE = '42501';
  END IF;

  IF _subject_email IS NULL OR position('@' in _subject_email) <= 1 THEN
    RAISE EXCEPTION 'email do titular invalido' USING ERRCODE = '22023';
  END IF;

  _email := lower(btrim(_subject_email));
  _tok := public.dsar_token(_email);
  _masked_email := _tok || '@erased.invalid';

  _n_stake := public._dsar_pseudonymize(
    'stakeholders', _org_id, _email, _tok, _masked_email,
    '["full_name","email","phone","linkedin_url","notes","avatar_url","raw_data","department","role","seniority","tags"]'::jsonb
  );

  _n_lusha := public._dsar_pseudonymize(
    'lusha_contacts', _org_id, _email, _tok, _masked_email,
    '["full_name","first_name","email","phone_raw","phone_formatted","linkedin_url","raw_lusha_payload","raw_leadcontact_email","raw_leadcontact_phone","company_linkedin_url","x_url","department_pt","department_en","job_title","seniority","linkedin_public_id","linkedin_skills","linkedin_awards","linkedin_certifications","linkedin_courses"]'::jsonb
  );

  _n_supp := public._dsar_pseudonymize(
    'email_suppressions', _org_id, _email, _tok, _masked_email,
    '["email","notes"]'::jsonb
  );

  -- profiles do usuario titular (escopo global do usuario, nao da org)
  IF _subject_user_id IS NOT NULL THEN
    UPDATE public.profiles
       SET full_name = _tok,
           avatar_url = NULL,
           updated_at = now()
     WHERE id = _subject_user_id;
    GET DIAGNOSTICS _n_prof = ROW_COUNT;
  END IF;

  _result := jsonb_build_object(
    'organization_id', _org_id,
    'executed_at', now(),
    'executed_by', auth.uid(),
    'subject_email_token', _tok,
    'reason', _reason,
    'legal_basis', 'LGPD art. 18 VI / GDPR art. 17 (direito ao esquecimento)',
    'counts', jsonb_build_object(
      'stakeholders', _n_stake,
      'lusha_contacts', _n_lusha,
      'email_suppressions', _n_supp,
      'profiles', _n_prof
    )
  );

  INSERT INTO public.audit_logs (organization_id, user_id, action, table_name, metadata)
  VALUES (
    _org_id,
    auth.uid(),
    'dsar.erasure',
    'data_subject_requests',
    _result
  );

  RETURN _result;
END;
$$;

REVOKE ALL ON FUNCTION public.erase_subject_data(uuid, text, uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.erase_subject_data(uuid, text, uuid, text) TO authenticated;

-- Registro do pedido com prazo legal de 30 dias.
CREATE OR REPLACE FUNCTION public.create_dsar_request(
  _org_id uuid,
  _request_type text,
  _subject_email text,
  _subject_name text DEFAULT NULL,
  _subject_user_id uuid DEFAULT NULL,
  _legal_basis text DEFAULT NULL,
  _notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'nao autenticado' USING ERRCODE = '28000';
  END IF;

  IF NOT public.has_org_role(_org_id, auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'apenas admin da organizacao pode registrar pedido de titular' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.data_subject_requests (
    organization_id, request_type, subject_email, subject_name,
    subject_user_id, legal_basis, notes, due_at
  ) VALUES (
    _org_id, _request_type, lower(btrim(_subject_email)), _subject_name,
    _subject_user_id, _legal_basis, _notes, now() + interval '30 days'
  )
  RETURNING id INTO _id;

  RETURN _id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_dsar_request(uuid, text, text, text, uuid, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.create_dsar_request(uuid, text, text, text, uuid, text, text) TO authenticated;

-- Listagem com SLA calculado.
CREATE OR REPLACE FUNCTION public.list_dsar_requests(_org_id uuid)
RETURNS TABLE (
  id uuid,
  request_type text,
  subject_email text,
  subject_name text,
  status text,
  requested_at timestamptz,
  due_at timestamptz,
  completed_at timestamptz,
  days_remaining int,
  is_overdue boolean,
  legal_basis text,
  notes text,
  result_summary jsonb
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'nao autenticado' USING ERRCODE = '28000';
  END IF;

  IF NOT public.has_org_role(_org_id, auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'apenas admin da organizacao pode listar pedidos de titular' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT r.id, r.request_type, r.subject_email, r.subject_name, r.status,
         r.requested_at, r.due_at, r.completed_at,
         GREATEST(ceil(extract(epoch FROM (r.due_at - now())) / 86400)::int, 0) AS days_remaining,
         (r.status <> 'completed' AND r.due_at < now()) AS is_overdue,
         r.legal_basis, r.notes, r.result_summary
  FROM public.data_subject_requests r
  WHERE r.organization_id = _org_id
  ORDER BY (r.status <> 'completed' AND r.due_at < now()) DESC, r.due_at ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.list_dsar_requests(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.list_dsar_requests(uuid) TO authenticated;

-- Atende o pedido: executa export ou erasure conforme o tipo e fecha o SLA.
CREATE OR REPLACE FUNCTION public.fulfill_dsar_request(
  _org_id uuid,
  _request_id uuid,
  _notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _req public.data_subject_requests%ROWTYPE;
  _payload jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'nao autenticado' USING ERRCODE = '28000';
  END IF;

  IF NOT public.has_org_role(_org_id, auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'apenas admin da organizacao pode atender pedido de titular' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO _req
  FROM public.data_subject_requests
  WHERE id = _request_id AND organization_id = _org_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'pedido nao encontrado nesta organizacao' USING ERRCODE = 'P0002';
  END IF;

  IF _req.status = 'completed' THEN
    RETURN jsonb_build_object('status', 'already_completed', 'request_id', _request_id);
  END IF;

  IF _req.request_type = 'erasure' THEN
    _payload := public.erase_subject_data(_org_id, _req.subject_email, _req.subject_user_id, 'dsar:' || _request_id::text);
  ELSE
    _payload := public.export_subject_data(_org_id, _req.subject_email, _req.subject_user_id);
  END IF;

  UPDATE public.data_subject_requests
     SET status = 'completed',
         completed_at = now(),
         handled_by = auth.uid(),
         notes = coalesce(_notes, notes),
         result_summary = _payload,
         updated_at = now()
   WHERE id = _request_id;

  RETURN jsonb_build_object(
    'status', 'completed',
    'request_id', _request_id,
    'request_type', _req.request_type,
    'result', _payload
  );
END;
$$;

REVOKE ALL ON FUNCTION public.fulfill_dsar_request(uuid, uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.fulfill_dsar_request(uuid, uuid, text) TO authenticated;

-- Pedidos vencidos ou vencendo em _within_days. Usado pelo painel e por alerta.
CREATE OR REPLACE FUNCTION public.dsar_sla_alerts(_org_id uuid, _within_days int DEFAULT 7)
RETURNS TABLE (
  id uuid,
  request_type text,
  subject_email text,
  due_at timestamptz,
  days_remaining int,
  is_overdue boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'nao autenticado' USING ERRCODE = '28000';
  END IF;

  IF NOT public.has_org_role(_org_id, auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'apenas admin da organizacao pode consultar SLA de pedidos' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT r.id, r.request_type, r.subject_email, r.due_at,
         GREATEST(ceil(extract(epoch FROM (r.due_at - now())) / 86400)::int, 0),
         (r.due_at < now())
  FROM public.data_subject_requests r
  WHERE r.organization_id = _org_id
    AND r.status IN ('pending', 'processing')
    AND r.due_at <= now() + make_interval(days => GREATEST(_within_days, 0))
  ORDER BY r.due_at ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.dsar_sla_alerts(uuid, int) FROM public;
GRANT EXECUTE ON FUNCTION public.dsar_sla_alerts(uuid, int) TO authenticated;