-- Prova executavel do apagamento de titular (LGPD art. 18 VI).
-- Roda tudo dentro de uma transacao e desfaz no fim (ROLLBACK): nao persiste dado.
-- Uso: psql -v ON_ERROR_STOP=1 -f scripts/sql/check-dsar-erasure.sql
\set ON_ERROR_STOP 1

BEGIN;

INSERT INTO auth.users (id, email) VALUES
  ('a0000000-0000-4000-8000-000000000001', 'qa-admin-dsar@exemplo.com'),
  ('a0000000-0000-4000-8000-000000000002', 'qa-viewer-dsar@exemplo.com');

INSERT INTO public.organizations (id, name, slug, owner_id)
VALUES ('b0000000-0000-4000-8000-000000000001', 'QA DSAR', 'qa-dsar-check', 'a0000000-0000-4000-8000-000000000001');

INSERT INTO public.organization_members (organization_id, user_id, role)
VALUES ('b0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000002', 'viewer')
ON CONFLICT DO NOTHING;

-- Titular com PII em duas tabelas, incluindo uma coluna GENERATED (linkedin_public_id).
INSERT INTO public.stakeholders (organization_id, user_id, full_name, email, phone)
VALUES (
  'b0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001',
  'Titular QA', 'qa-dsar-titular@exemplo.com', '+5511999990000'
);

INSERT INTO public.lusha_contacts (organization_id, user_id, full_name, lusha_company_name, email, phone_raw, linkedin_url, raw_lusha_payload)
VALUES (
  'b0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'Titular QA', 'QA Ltda',
  'qa-dsar-titular@exemplo.com', '+5511999990000', 'https://www.linkedin.com/in/titular-qa/',
  '{"email":"qa-dsar-titular@exemplo.com"}'::jsonb
);

SELECT set_config('request.jwt.claims', '{"sub":"a0000000-0000-4000-8000-000000000001"}', true);

DO $$
DECLARE
  _r jsonb;
  _n int;
  _req uuid;
BEGIN
  _req := public.create_dsar_request(
    'b0000000-0000-4000-8000-000000000001', 'erasure', 'qa-dsar-titular@exemplo.com', 'Titular QA'
  );
  _r := public.fulfill_dsar_request(
    'b0000000-0000-4000-8000-000000000001', _req, 'check automatizado'
  );

  IF _r->>'status' <> 'completed' THEN
    RAISE EXCEPTION 'pedido nao concluido: %', _r;
  END IF;

  IF (_r->'result'->'counts'->>'stakeholders')::int < 1 THEN
    RAISE EXCEPTION 'stakeholder nao pseudonimizado: %', _r->'result';
  END IF;
  IF (_r->'result'->'counts'->>'lusha_contacts')::int < 1 THEN
    RAISE EXCEPTION 'lusha_contact nao pseudonimizado: %', _r->'result';
  END IF;

  SELECT count(*) INTO _n FROM public.data_subject_requests
   WHERE id = _req AND status = 'completed' AND completed_at IS NOT NULL;
  IF _n <> 1 THEN RAISE EXCEPTION 'pedido nao marcado como completed'; END IF;

  SELECT count(*) INTO _n FROM public.stakeholders
   WHERE organization_id = 'b0000000-0000-4000-8000-000000000001'
     AND email LIKE '%@erased.invalid' AND full_name LIKE 'erased-%' AND phone IS NULL;
  IF _n <> 1 THEN RAISE EXCEPTION 'PII do stakeholder continua visivel'; END IF;

  SELECT count(*) INTO _n FROM public.lusha_contacts
   WHERE organization_id = 'b0000000-0000-4000-8000-000000000001'
     AND email LIKE '%@erased.invalid'
     AND coalesce(phone_raw, '') = ''
     AND coalesce(linkedin_url, '') = ''
     AND linkedin_public_id IS NULL
     AND raw_lusha_payload = '{}'::jsonb
     AND raw_leadcontact_email = '{}'::jsonb
     AND raw_leadcontact_phone = '{}'::jsonb;
  IF _n <> 1 THEN RAISE EXCEPTION 'PII do contato Lusha continua visivel (ou coluna gerada nao acompanhou)'; END IF;

  SELECT count(*) INTO _n FROM public.audit_logs
   WHERE organization_id = 'b0000000-0000-4000-8000-000000000001'
     AND actor_id = 'a0000000-0000-4000-8000-000000000001'
     AND table_name = 'data_subject_requests'
     AND action = 'execute'::public.audit_action
     AND metadata->>'audit_kind' = 'dsar.erasure';
  IF _n <> 1 THEN RAISE EXCEPTION 'trilha do apagamento ausente (audit_kind=dsar.erasure)'; END IF;

  RAISE NOTICE 'apagamento concluido e auditado';
END;
$$;

-- Viewer nao pode apagar dado de titular.
SELECT set_config('request.jwt.claims', '{"sub":"a0000000-0000-4000-8000-000000000002"}', true);

DO $$
BEGIN
  PERFORM public.erase_subject_data(
    'b0000000-0000-4000-8000-000000000001', 'qa-dsar-titular@exemplo.com', NULL, 'viewer tentando'
  );
  RAISE EXCEPTION 'viewer conseguiu apagar dados de titular';
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'viewer barrado corretamente';
END;
$$;

-- Anonimo nao pode apagar dado de titular.
SELECT set_config('request.jwt.claims', '', true);

DO $$
BEGIN
  PERFORM public.erase_subject_data(
    'b0000000-0000-4000-8000-000000000001', 'qa-dsar-titular@exemplo.com', NULL, 'anonimo tentando'
  );
  RAISE EXCEPTION 'anonimo conseguiu apagar dados de titular';
EXCEPTION WHEN invalid_authorization_specification THEN
  RAISE NOTICE 'anonimo barrado corretamente (nao autenticado)';
END;
$$;

SELECT 'TODOS OS TESTES PASSARAM' AS resultado;

ROLLBACK;