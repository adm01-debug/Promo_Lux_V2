GRANT EXECUTE ON FUNCTION public.evaluate_partition_policies() TO authenticated;
GRANT EXECUTE ON FUNCTION public.pg_catalog_rls_tables() TO authenticated;
GRANT EXECUTE ON FUNCTION public.pg_columns_for_insert(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.purge_dead_letter(integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reset_circuit_breaker(text) TO authenticated;

GRANT EXECUTE ON FUNCTION public.evaluate_partition_policies() TO service_role;
GRANT EXECUTE ON FUNCTION public.pg_catalog_rls_tables() TO service_role;
GRANT EXECUTE ON FUNCTION public.pg_columns_for_insert(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.purge_dead_letter(integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.reset_circuit_breaker(text) TO service_role;