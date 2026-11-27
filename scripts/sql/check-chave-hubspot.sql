-- Prova executavel: a chave da API do HubSpot nao sai sem login.
-- Roda tudo dentro de uma transacao e desfaz no fim (ROLLBACK): nao persiste dado.
-- Uso: psql -v ON_ERROR_STOP=1 -f scripts/sql/check-chave-hubspot.sql
\set ON_ERROR_STOP 1

BEGIN;

INSERT INTO auth.users (id, email) VALUES
  ('c0000000-0000-4000-8000-000000000001', 'qa-admin-hubspot@exemplo.com'),
  ('c0000000-0000-4000-8000-000000000002', 'qa-fora-hubspot@exemplo.com');

INSERT INTO public.organizations (id, name, slug, owner_id)
VALUES ('d0000000-0000-4000-8000-000000000001', 'QA HubSpot', 'qa-hubspot-check',
        'c0000000-0000-4000-8000-000000000001');

INSERT INTO public.organization_members (organization_id, user_id, role)
VALUES ('d0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001', 'admin')
ON CONFLICT DO NOTHING;

INSERT INTO public.org_integrations (organization_id, provider, config, enabled)
VALUES ('d0000000-0000-4000-8000-000000000001', 'hubspot',
        '{"api_key":"qa-hubspot-key-nao-vaza"}'::jsonb, true);

DO $$
DECLARE
  _org      uuid := 'd0000000-0000-4000-8000-000000000001';
  _admin    uuid := 'c0000000-0000-4000-8000-000000000001';
  _fora     uuid := 'c0000000-0000-4000-8000-000000000002';
  _esperado text := 'qa-hubspot-key-nao-vaza';
  _key      text;
  _code     text;
BEGIN
  -- 1) Grants: anon nao executa; authenticated e service_role executam.
  IF has_function_privilege('anon', 'public.get_hubspot_api_key(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'anon ainda pode executar get_hubspot_api_key';
  END IF;
  IF NOT has_function_privilege('authenticated', 'public.get_hubspot_api_key(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'authenticated perdeu o EXECUTE (a leitura admin pela UI depende dele)';
  END IF;
  IF NOT has_function_privilege('service_role', 'public.get_hubspot_api_key(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'service_role perdeu o EXECUTE (as edge functions dependem dele)';
  END IF;

  -- 2) Sem login: bloqueia com 28000 e nunca devolve a chave.
  PERFORM set_config('request.jwt.claims', '{}', true);
  _code := NULL;
  BEGIN
    _key := public.get_hubspot_api_key(_org);
  EXCEPTION
    WHEN invalid_authorization_specification THEN _code := '28000';
    WHEN insufficient_privilege THEN _code := '42501';
  END;
  IF _code IS NULL THEN
    RAISE EXCEPTION 'chamada sem login devolveu % em vez de bloquear', coalesce(_key, '<null>');
  END IF;

  -- 3) Usuario logado que nao e admin da organizacao: bloqueia com 42501.
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', _fora, 'role', 'authenticated')::text, true);
  _code := NULL;
  BEGIN
    _key := public.get_hubspot_api_key(_org);
  EXCEPTION
    WHEN insufficient_privilege THEN _code := '42501';
  END;
  IF _code IS NULL THEN
    RAISE EXCEPTION 'nao-admin leu a chave: %', coalesce(_key, '<null>');
  END IF;

  -- 4) Admin da organizacao le a propria chave.
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', _admin, 'role', 'authenticated')::text, true);
  _key := public.get_hubspot_api_key(_org);
  IF _key IS DISTINCT FROM _esperado THEN
    RAISE EXCEPTION 'admin nao leu a chave (recebeu %)', coalesce(_key, '<null>');
  END IF;

  -- 5) service_role continua lendo (edge functions com a chave de servico).
  PERFORM set_config('request.jwt.claims', '{"role":"service_role"}', true);
  _key := public.get_hubspot_api_key(_org);
  IF _key IS DISTINCT FROM _esperado THEN
    RAISE EXCEPTION 'service_role nao leu a chave (recebeu %)', coalesce(_key, '<null>');
  END IF;

  -- 6) Chamada real com o papel anon: barrada pelo grant, antes de qualquer logica.
  PERFORM set_config('request.jwt.claims', '{"role":"anon"}', true);
  PERFORM set_config('role', 'anon', true);
  _code := NULL;
  BEGIN
    _key := public.get_hubspot_api_key(_org);
  EXCEPTION
    WHEN insufficient_privilege THEN _code := '42501';
  END;
  IF _code IS NULL THEN
    RAISE EXCEPTION 'o papel anon executou a funcao e recebeu %', coalesce(_key, '<null>');
  END IF;

  RAISE NOTICE 'TODOS OS TESTES PASSARAM';
END $$;

ROLLBACK;