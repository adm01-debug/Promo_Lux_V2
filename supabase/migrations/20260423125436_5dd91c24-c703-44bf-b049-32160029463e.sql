-- Helper SQL function to enumerate public tables with RLS enabled.
-- Used by the rls-tests edge function to detect tables missing from the
-- shared whitelist (`RLS_TABLES`) so new tables aren't accidentally left
-- without cross-org isolation tests.
CREATE OR REPLACE FUNCTION public.pg_catalog_rls_tables()
RETURNS TABLE(table_name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT c.relname::text AS table_name
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relkind = 'r'
    AND c.relrowsecurity = true
  ORDER BY c.relname;
$$;

-- Only callable by service_role (used internamente pela edge function rls-tests).
REVOKE ALL ON FUNCTION public.pg_catalog_rls_tables() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pg_catalog_rls_tables() TO service_role;