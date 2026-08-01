
-- Melhoria #1: Revoga EXECUTE de anon em todas as SECURITY DEFINER do schema public.
-- Essas funções são chamadas por cron (service_role) ou por usuários autenticados.
-- Nenhuma exige acesso anônimo.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT n.nspname AS s, p.proname AS f, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef = true
      AND has_function_privilege('anon', p.oid, 'EXECUTE')
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %I.%I(%s) FROM anon, PUBLIC', r.s, r.f, r.args);
  END LOOP;
END $$;
