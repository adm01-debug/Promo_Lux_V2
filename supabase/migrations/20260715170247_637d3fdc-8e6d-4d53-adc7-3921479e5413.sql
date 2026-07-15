
DO $$
DECLARE
  fn text;
  sig text;
BEGIN
  FOR fn, sig IN
    SELECT p.proname, pg_get_function_identity_arguments(p.oid)
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'evaluate_partition_policies',
        'pg_catalog_rls_tables',
        'pg_columns_for_insert',
        'purge_dead_letter',
        'reset_circuit_breaker'
      )
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM PUBLIC, authenticated, anon', fn, sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%I(%s) TO service_role', fn, sig);
  END LOOP;
END$$;

GRANT SELECT ON public.lusha_credit_usage_log TO authenticated;
GRANT ALL ON public.lusha_credit_usage_log TO service_role;

CREATE POLICY "org_members_view_credit_usage"
ON public.lusha_credit_usage_log
FOR SELECT
TO authenticated
USING (
  organization_id IS NOT NULL
  AND public.is_org_member(organization_id, auth.uid())
);

CREATE POLICY "service_role_full_credit_usage"
ON public.lusha_credit_usage_log
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);
