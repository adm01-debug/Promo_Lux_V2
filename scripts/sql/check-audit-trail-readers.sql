-- ---------------------------------------------------------------------------
-- check-audit-trail-readers.sql
--
-- Prova de comportamento dos leitores de auditoria depois da correcao
-- (`20261126220000` e `20261126230000`): contagem, facets, trilha mascarada e
-- export. Existe porque a classe de bug que motivou a correcao -- corpo plpgsql
-- referenciando coluna inexistente (`audit_logs.user_id`) -- nasce sem erro:
-- `CREATE FUNCTION` nao valida o corpo, entao a funcao fica no ar e so falha
-- quando alguem a chama.
--
-- Roda contra um banco com o schema aplicado e NAO persiste nada (ROLLBACK no
-- fim). Cada assercao levanta excecao com mensagem propria quando falha.
--
--   docker exec -i <container_db> psql -U postgres -d postgres -f - < scripts/sql/check-audit-trail-readers.sql
-- ---------------------------------------------------------------------------\set ON_ERROR_STOP on
BEGIN;
SELECT set_config('request.jwt.claims', '{"sub":"99999992-9999-4999-8999-999999999992"}', true);

INSERT INTO public.organizations (id, name, slug, owner_id)
VALUES ('99999991-9999-4999-8999-999999999991','Org Teste','org-teste-99999991','99999992-9999-4999-8999-999999999992');
INSERT INTO public.organization_members (organization_id, user_id, role) VALUES
 ('99999991-9999-4999-8999-999999999991','99999992-9999-4999-8999-999999999992','admin'),
 ('99999991-9999-4999-8999-999999999991','99999993-9999-4999-8999-999999999993','viewer')
ON CONFLICT (organization_id, user_id) DO UPDATE SET role = EXCLUDED.role;

INSERT INTO public.pii_redaction_rules (organization_id, category, action, enabled) VALUES
 ('99999991-9999-4999-8999-999999999991','email','mask',true),
 ('99999991-9999-4999-8999-999999999991','phone','mask',true);

-- As insercoes em `organizations` disparam a trilha automatica (role_permissions etc),
-- por isso as assercoes abaixo filtram por _tables = {companies, deals}
INSERT INTO public.audit_logs (id, organization_id, actor_id, action, table_name, record_id, old_data, new_data, metadata, created_at) VALUES
 ('b1111111-1111-4111-8111-111111111111','99999991-9999-4999-8999-999999999991','99999992-9999-4999-8999-999999999992','create','companies','c1111111-1111-4111-8111-111111111111','{}','{"email":"ana@exemplo.com","phone":"+5511999998888"}','{"ip":"1.2.3.4"}', now() - interval '1 hour'),
 ('b2222222-2222-4222-8222-222222222222','99999991-9999-4999-8999-999999999991','99999992-9999-4999-8999-999999999992','update','deals','d1111111-1111-4111-8111-111111111111','{"email":"bruno@exemplo.com"}','{"email":"bruno@exemplo.com"}','{}', now() - interval '2 hours'),
 ('b3333333-3333-4333-8333-333333333333','99999991-9999-4999-8999-999999999991','99999992-9999-4999-8999-999999999992','delete','companies','c2222222-2222-4222-8222-222222222222','{}','{}','{}', now() - interval '40 days');

DO $$
DECLARE
  org uuid := '99999991-9999-4999-8999-999999999991';
  negocio text[] := ARRAY['companies','deals'];
  n bigint;
  linhas int;
  valor text;
  primeiro uuid;
  facets jsonb;
BEGIN
  SELECT public.count_audit_logs(org, null, null, null, 'companies') INTO n;
  IF n <> 2 THEN RAISE EXCEPTION 'count companies: esperado 2, veio %', n; END IF;

  SELECT public.count_audit_logs(org, null, null, 'delete', 'companies') INTO n;
  IF n <> 1 THEN RAISE EXCEPTION 'count delete/companies: esperado 1, veio %', n; END IF;

  SELECT public.count_audit_logs(org, now() - interval '7 days', null, null, 'companies') INTO n;
  IF n <> 1 THEN RAISE EXCEPTION 'count companies 7d: esperado 1, veio %', n; END IF;

  SELECT public.count_audit_logs(org, null, null, null, null, '99999992-9999-4999-8999-999999999992') INTO n;
  IF n < 3 THEN RAISE EXCEPTION 'count por ator: esperado >= 3, veio %', n; END IF;

  SELECT public.audit_log_facets(org) INTO facets;
  IF NOT (facets -> 'actions') @> '["create"]'::jsonb THEN RAISE EXCEPTION 'facets sem create: %', facets; END IF;
  IF NOT (facets -> 'tables') @> '["companies"]'::jsonb THEN RAISE EXCEPTION 'facets sem companies: %', facets; END IF;

  SELECT count(*) INTO linhas FROM public.read_audit_logs_safe(org, 10, 0, null, negocio);
  IF linhas <> 3 THEN RAISE EXCEPTION 'trilha (companies+deals): esperado 3, veio %', linhas; END IF;

  SELECT count(*) INTO linhas FROM public.read_audit_logs_safe(org, 10, 0, null, ARRAY['companies']);
  IF linhas <> 2 THEN RAISE EXCEPTION 'trilha companies: esperado 2, veio %', linhas; END IF;

  SELECT r.new_data ->> 'email' INTO valor FROM public.read_audit_logs_safe(org, 10, 0, null, ARRAY['companies']) r
   WHERE r.id = 'b1111111-1111-4111-8111-111111111111';
  IF valor = 'ana@exemplo.com' THEN RAISE EXCEPTION 'email NAO foi mascarado: %', valor; END IF;
  RAISE NOTICE 'email mascarado = %', valor;

  SELECT r.new_data ->> 'phone' INTO valor FROM public.read_audit_logs_safe(org, 10, 0, null, ARRAY['companies']) r
   WHERE r.id = 'b1111111-1111-4111-8111-111111111111';
  IF valor = '+5511999998888' THEN RAISE EXCEPTION 'telefone NAO foi mascarado: %', valor; END IF;
  RAISE NOTICE 'phone mascarado = %', valor;

  SELECT r.id INTO primeiro FROM public.read_audit_logs_safe(org, 10, 0, null, negocio) r LIMIT 1;
  IF primeiro <> 'b1111111-1111-4111-8111-111111111111' THEN RAISE EXCEPTION 'ordem desc errada, primeiro = %', primeiro; END IF;

  SELECT r.total_count INTO n FROM public.read_audit_logs_safe(org, 1, 2, null, negocio) r;
  IF n <> 3 THEN RAISE EXCEPTION 'total_count na ultima pagina: esperado 3, veio %', n; END IF;

  SELECT count(*) INTO linhas FROM public.read_audit_logs_safe(org, 1, 2, null, negocio);
  IF linhas <> 1 THEN RAISE EXCEPTION 'ultima pagina: esperado 1, veio %', linhas; END IF;

  SELECT count(*) INTO linhas FROM public.read_audit_logs_safe(org, 10, 0, 'delete', ARRAY['companies']);
  IF linhas <> 1 THEN RAISE EXCEPTION 'filtro _action: esperado 1, veio %', linhas; END IF;

  SELECT count(*) INTO linhas FROM public.read_audit_logs_safe(org, 10, 0, null, negocio, now() - interval '7 days', null);
  IF linhas <> 2 THEN RAISE EXCEPTION 'filtro _from: esperado 2, veio %', linhas; END IF;

  SELECT count(*) INTO linhas FROM public.read_audit_logs_safe(org, 10, 0, null, negocio, null, now() - interval '30 days');
  IF linhas <> 1 THEN RAISE EXCEPTION 'filtro _to: esperado 1, veio %', linhas; END IF;

  SELECT count(*) INTO linhas FROM public.export_audit_logs(org, null, null, null, 'companies', null, null, null, 10);
  IF linhas <> 2 THEN RAISE EXCEPTION 'export companies: esperado 2, veio %', linhas; END IF;

  SELECT r.new_data ->> 'email' INTO valor FROM public.export_audit_logs(org, null, null, null, 'companies', null, null, null, 10) r
   WHERE r.id = 'b1111111-1111-4111-8111-111111111111';
  IF valor = 'ana@exemplo.com' THEN RAISE EXCEPTION 'export NAO mascarou email: %', valor; END IF;
  RAISE NOTICE 'export email mascarado = %', valor;

  IF to_regprocedure('public.read_audit_logs_safe(uuid,integer,text,text)') IS NOT NULL THEN
    RAISE EXCEPTION 'a versao antiga de read_audit_logs_safe continua no banco';
  END IF;
  IF NOT has_function_privilege('authenticated','public.read_audit_logs_safe(uuid,integer,integer,text,text[],timestamptz,timestamptz)','EXECUTE') THEN
    RAISE EXCEPTION 'authenticated sem EXECUTE em read_audit_logs_safe';
  END IF;
  IF has_function_privilege('anon','public.read_audit_logs_safe(uuid,integer,integer,text,text[],timestamptz,timestamptz)','EXECUTE') THEN
    RAISE EXCEPTION 'anon COM EXECUTE em read_audit_logs_safe';
  END IF;
  IF has_function_privilege('anon','public.count_audit_logs(uuid,timestamptz,timestamptz,text,text,uuid)','EXECUTE') THEN
    RAISE EXCEPTION 'anon COM EXECUTE em count_audit_logs';
  END IF;

  PERFORM set_config('request.jwt.claims', '{"sub":"99999993-9999-4999-8999-999999999993"}', true);
  BEGIN
    PERFORM public.count_audit_logs(org);
    RAISE EXCEPTION 'viewer conseguiu contar audit log';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'viewer barrado corretamente';
  END;

  -- o handler acima desfaz a subtransacao, devolvendo o claim do admin
  PERFORM set_config('request.jwt.claims', '{"sub":"99999993-9999-4999-8999-999999999993"}', true);
  BEGIN
    PERFORM public.read_audit_logs_safe(org, 10, 0);
    RAISE EXCEPTION 'viewer conseguiu ler a trilha';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'viewer barrado na trilha';
  END;

  PERFORM set_config('request.jwt.claims', '', true);
  BEGIN
    PERFORM public.read_audit_logs_safe(org, 10, 0);
    RAISE EXCEPTION 'anonimo conseguiu ler a trilha';
  EXCEPTION WHEN invalid_authorization_specification THEN
    RAISE NOTICE 'anonimo barrado (nao autenticado, 28000)';
  END;

  PERFORM set_config('request.jwt.claims', '{"sub":"99999992-9999-4999-8999-999999999992"}', true);
  RAISE NOTICE 'TODOS OS TESTES PASSARAM';
END $$;
ROLLBACK;