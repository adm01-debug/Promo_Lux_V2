-- Apagamento de titular (LGPD art. 18 VI) estava impossivel: qualquer pedido de
-- exclusao estourava e era desfeito pelo rollback. Tres defeitos:
--
-- 1. _dsar_pseudonymize montava "coluna = NULL" para toda coluna da lista. Em
--    lusha_contacts isso atinge colunas NOT NULL (raw_lusha_payload,
--    raw_leadcontact_email, raw_leadcontact_phone, todas jsonb NOT NULL DEFAULT
--    '{}'::jsonb) e a coluna GENERATED ALWAYS linkedin_public_id. O UPDATE morria
--    com "column linkedin_public_id can only be updated to DEFAULT" antes de tocar
--    em qualquer dado.
-- 2. A trilha era gravada em audit_logs.user_id, coluna que nao existe (o schema usa
--    actor_id, ver 20261124220000) e com action 'dsar.erasure', valor fora do enum
--    audit_action: mesmo corrigindo (1), o pedido falhava no fim.
-- 3. Consequencia visivel: o botao "Apagar" do painel de privacidade
--    (fulfill_dsar_request -> erase_subject_data) devolvia erro ao admin e nenhum
--    dado era pseudonimizado.
--
-- Assinaturas inalteradas (_dsar_pseudonymize e erase_subject_data): CREATE OR
-- REPLACE basta, sem DROP.

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
    SELECT ic.column_name AS col,
           CASE
             WHEN ic.column_name = 'full_name' THEN quote_literal(_token)
             WHEN ic.column_name = 'email' THEN quote_literal(_masked_email)
             WHEN ic.is_nullable = 'YES' THEN 'NULL'
             -- Coluna NOT NULL nao aceita NULL: volta ao proprio default. Ex.:
             -- raw_lusha_payload, raw_leadcontact_email e raw_leadcontact_phone
             -- sao jsonb NOT NULL DEFAULT '{}'::jsonb.
             ELSE 'DEFAULT'
           END AS expr
    FROM jsonb_array_elements_text(_cols) AS k
    JOIN information_schema.columns ic
      ON ic.table_schema = 'public' AND ic.table_name = _tbl AND ic.column_name = k
    -- Coluna GENERATED ALWAYS (ex.: lusha_contacts.linkedin_public_id) nao pode ser escrita.
    WHERE ic.is_generated = 'NEVER'
  ) c;

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
  _request_id uuid;
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
    '["full_name","first_name","email","phone_raw","phone_formatted","linkedin_url","raw_lusha_payload","raw_leadcontact_email","raw_leadcontact_phone","company_linkedin_url","x_url","department_pt","department_en","job_title","seniority","linkedin_skills","linkedin_awards","linkedin_certifications","linkedin_courses"]'::jsonb
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

  -- audit_logs.record_id e NOT NULL e a trilha aponta para o pedido de titular que
  -- originou o apagamento (quando a chamada veio do painel, via fulfill_dsar_request).
  SELECT r.id INTO _request_id
    FROM public.data_subject_requests r
   WHERE r.organization_id = _org_id
     AND r.request_type = 'erasure'
     AND lower(r.subject_email) = _email
   ORDER BY r.requested_at DESC
   LIMIT 1;

  _request_id := coalesce(_request_id, _subject_user_id, _org_id);

  -- audit_logs nao tem user_id (usa actor_id) e action e o enum audit_action:
  -- 'dsar.erasure' nao existe. Sem isso a funcao estourava no fim e o apagamento
  -- inteiro era desfeito pelo rollback da transacao.
  INSERT INTO public.audit_logs (organization_id, actor_id, action, table_name, record_id, metadata)
  VALUES (
    _org_id,
    auth.uid(),
    'execute'::public.audit_action,
    'data_subject_requests',
    _request_id,
    _result || jsonb_build_object('audit_kind', 'dsar.erasure')
  );

  RETURN _result;
END;
$$;

REVOKE ALL ON FUNCTION public.erase_subject_data(uuid, text, uuid, text) FROM public;

GRANT EXECUTE ON FUNCTION public.erase_subject_data(uuid, text, uuid, text) TO authenticated;
