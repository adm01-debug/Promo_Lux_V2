CREATE OR REPLACE FUNCTION public.enrichment_funnel_counts()
RETURNS TABLE(total BIGINT, enriched BIGINT, high_score BIGINT, qualified BIGINT)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    COUNT(*)::BIGINT AS total,
    COUNT(*) FILTER (WHERE enriched = true)::BIGINT AS enriched,
    COUNT(*) FILTER (WHERE ipc_score >= 60)::BIGINT AS high_score,
    COUNT(*) FILTER (WHERE ipc_score >= 75)::BIGINT AS qualified
  FROM public.companies
  WHERE deleted_at IS NULL;
$$;

REVOKE ALL ON FUNCTION public.enrichment_funnel_counts() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.enrichment_funnel_counts() TO authenticated, service_role;

COMMENT ON FUNCTION public.enrichment_funnel_counts() IS
  'Retorna 4 métricas do funil de enriquecimento em 1 scan atômico. SECURITY INVOKER: respeita RLS do chamador.';