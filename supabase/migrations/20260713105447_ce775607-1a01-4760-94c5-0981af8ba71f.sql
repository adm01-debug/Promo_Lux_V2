-- Defesa em profundidade: reduzir a superfície de ataque das funções
-- SECURITY DEFINER no schema public (linter 0028/0029).
--
-- Estratégia (principle of least privilege):
--   1. Revoga EXECUTE de anon, authenticated e PUBLIC em TODAS as funções.
--   2. Concede EXECUTE ao service_role (backend confiável / edge functions).
--   3. Reconcede EXECUTE a authenticated APENAS nas funções realmente
--      invocadas pelo cliente (RPCs) ou usadas dentro de policies RLS.

REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- RPCs chamadas diretamente pelo frontend (contexto authenticated).
GRANT EXECUTE ON FUNCTION public.accept_org_invite(_token text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.api_latency_stats(_hours integer, _limit integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.api_latency_trend(_hours integer, _bucket_minutes integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.campaign_ab_stats(_campaign_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_default_deal_stages(_user_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.dlq_health_metrics() TO authenticated;
GRANT EXECUTE ON FUNCTION public.dlq_health_trend(_hours integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.evaluate_partition_policies() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_dashboard_stats(p_org_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pg_catalog_rls_tables() TO authenticated;
GRANT EXECUTE ON FUNCTION public.pg_columns_for_insert(_table_name text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.purge_dead_letter(_replayed_retention_days integer, _stale_retention_days integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.replay_dead_letter(_dlq_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.replay_dead_letter_batch(_organization_id uuid, _limit integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reset_circuit_breaker(_service_name text) TO authenticated;

-- Funções usadas DENTRO de policies RLS (avaliadas como o usuário autenticado).
GRANT EXECUTE ON FUNCTION public.has_role(_user_id uuid, _role app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_org_role(_org_id uuid, _user_id uuid, _min_role app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_org_member(_org_id uuid, _user_id uuid) TO authenticated;