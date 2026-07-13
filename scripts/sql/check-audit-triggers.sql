-- =============================================================================
-- CI Guard: Integridade dos gatilhos de auditoria
-- =============================================================================
-- Este script FALHA (RAISE EXCEPTION → psql exit code != 0) quando a topologia
-- de gatilhos de auditoria diverge do esperado. É a rede de segurança que
-- impede a regressão corrigida em `drop_broken_duplicate_audit_triggers`:
-- gatilhos duplicados/quebrados que gravavam em colunas inexistentes e usavam
-- valores fora do enum `audit_action`, o que faria QUALQUER insert/update/delete
-- das tabelas afetadas falhar em produção.
--
-- Postura esperada (fonte da verdade — manter em sincronia com as migrações):
--
--   • A função obsoleta `process_audit_log` NÃO deve existir.
--   • Toda tabela auditável deve ter EXATAMENTE 1 gatilho de auditoria, e ele
--     deve usar a função canônica `public.log_audit_event`.
--   • Nenhuma tabela pode ter mais de um gatilho de auditoria (duplicidade).
--
-- Qualquer desvio aborta o build.
-- =============================================================================

DO $$
DECLARE
  -- Tabelas que DEVEM ter exatamente um gatilho de auditoria canônico.
  expected_tables text[] := ARRAY[
    'campaigns',
    'companies',
    'deals',
    'email_accounts',
    'organization_members',
    'scrape_jobs',
    'workflow_runs',
    'workflows'
  ];
  v_tbl        text;
  v_count      integer;
  v_bad        text;
  v_errors     text := '';
BEGIN
  -- 1) A função obsoleta não pode ressurgir.
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'process_audit_log'
  ) THEN
    v_errors := v_errors || E'\n  • A função obsoleta public.process_audit_log() voltou a existir — remova-a.';
  END IF;

  -- 2) Cada tabela esperada precisa de exatamente 1 gatilho log_audit_event.
  FOREACH v_tbl IN ARRAY expected_tables LOOP
    SELECT count(*) INTO v_count
    FROM pg_trigger t
    JOIN pg_class c   ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_proc p    ON p.oid = t.tgfoid
    WHERE NOT t.tgisinternal
      AND n.nspname = 'public'
      AND c.relname = v_tbl
      AND p.proname = 'log_audit_event';

    IF v_count <> 1 THEN
      v_errors := v_errors || format(
        E'\n  • Tabela "%s": esperado 1 gatilho log_audit_event, encontrado %s.',
        v_tbl, v_count
      );
    END IF;
  END LOOP;

  -- 3) Nenhuma tabela pode ter mais de um gatilho de auditoria (qualquer função
  --    cujo nome contenha "audit"), o que indicaria duplicidade reintroduzida.
  FOR v_bad, v_count IN
    SELECT c.relname, count(*)
    FROM pg_trigger t
    JOIN pg_class c   ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_proc p    ON p.oid = t.tgfoid
    WHERE NOT t.tgisinternal
      AND n.nspname = 'public'
      AND p.proname ILIKE '%audit%'
    GROUP BY c.relname
    HAVING count(*) > 1
  LOOP
    v_errors := v_errors || format(
      E'\n  • Tabela "%s" tem %s gatilhos de auditoria (duplicidade).',
      v_bad, v_count
    );
  END LOOP;

  IF length(v_errors) > 0 THEN
    RAISE EXCEPTION E'Integridade dos gatilhos de auditoria violada:%', v_errors;
  END IF;

  RAISE NOTICE 'OK: gatilhos de auditoria íntegros (1 log_audit_event por tabela, sem process_audit_log).';
END $$;
