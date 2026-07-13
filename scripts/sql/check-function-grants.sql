-- =============================================================================
-- CI Guard: Grants de EXECUTE em funções do schema public
-- =============================================================================
-- Este script FALHA (RAISE EXCEPTION → psql exit code != 0) quando a postura de
-- privilégios de execução das funções `public` diverge do esperado. É a rede de
-- segurança que impede regressões silenciosas de endurecimento de segurança.
--
-- Postura esperada (fonte da verdade — manter em sincronia com as migrações de
-- hardening `harden_security_definer_function_grants` e a security-memory):
--
--   • anon           → NÃO pode executar NENHUMA função public.
--   • authenticated  → pode executar EXATAMENTE as 19 funções abaixo
--                      (RPCs do frontend + helpers de RLS + default de coluna).
--   • service_role   → pode executar TODAS as funções (backend/edge functions).
--
-- Qualquer desvio (função que deixou de ser executável para um papel esperado,
-- OU função que passou a ser executável por um papel indevido) aborta o build.
-- =============================================================================

DO $$
DECLARE
  -- Conjunto exato de funções que DEVEM ser executáveis por `authenticated`.
  expected_authenticated text[] := ARRAY[
    'accept_org_invite',
    'api_latency_stats',
    'api_latency_trend',
    'campaign_ab_stats',
    'create_default_deal_stages',
    'default_org_for_current_user',
    'dlq_health_metrics',
    'dlq_health_trend',
    'evaluate_partition_policies',
    'get_dashboard_stats',
    'has_org_role',
    'has_role',
    'is_org_member',
    'pg_catalog_rls_tables',
    'pg_columns_for_insert',
    'purge_dead_letter',
    'replay_dead_letter',
    'replay_dead_letter_batch',
    'reset_circuit_breaker'
  ];
  rec record;
  violations text := '';
  is_expected boolean;
  missing_authenticated text := '';
  fn text;
  found boolean;
BEGIN
  -- 1) Varre todas as funções do schema public e valida a matriz de privilégios.
  FOR rec IN
    SELECT p.proname AS name,
           p.oid     AS oid,
           has_function_privilege('anon',          p.oid, 'EXECUTE') AS anon,
           has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authd,
           has_function_privilege('service_role',  p.oid, 'EXECUTE') AS svc
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prokind = 'f'
    ORDER BY p.proname
  LOOP
    is_expected := rec.name = ANY(expected_authenticated);

    -- anon jamais pode executar funções public.
    IF rec.anon THEN
      violations := violations || format(E'\n  [anon] "%s" NÃO deveria ser executável por anon', rec.name);
    END IF;

    -- authenticated: deve executar exatamente o conjunto esperado.
    IF is_expected AND NOT rec.authd THEN
      violations := violations || format(E'\n  [authenticated] "%s" DEIXOU de ser executável (esperado: executável)', rec.name);
    ELSIF NOT is_expected AND rec.authd THEN
      violations := violations || format(E'\n  [authenticated] "%s" tornou-se executável (não esperado — revise o hardening)', rec.name);
    END IF;

    -- service_role deve executar todas as funções.
    IF NOT rec.svc THEN
      violations := violations || format(E'\n  [service_role] "%s" NÃO é executável (esperado: executável)', rec.name);
    END IF;
  END LOOP;

  -- 2) Garante que nenhuma função esperada foi removida/renomeada do schema.
  FOREACH fn IN ARRAY expected_authenticated LOOP
    SELECT EXISTS (
      SELECT 1 FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.prokind = 'f' AND p.proname = fn
    ) INTO found;
    IF NOT found THEN
      missing_authenticated := missing_authenticated || format(E'\n  [missing] função esperada "%s" não existe mais em public', fn);
    END IF;
  END LOOP;

  IF violations <> '' OR missing_authenticated <> '' THEN
    RAISE EXCEPTION E'Verificação de grants de função FALHOU:%s%s',
      violations, missing_authenticated;
  END IF;

  RAISE NOTICE 'OK: postura de EXECUTE das funções public está conforme o esperado (anon=0, authenticated=% funções, service_role=todas).',
    array_length(expected_authenticated, 1);
END $$;
