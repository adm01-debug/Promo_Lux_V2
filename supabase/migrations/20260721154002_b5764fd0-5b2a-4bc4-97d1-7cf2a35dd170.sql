
-- Melhoria #2: Revoga EXECUTE de authenticated em SECURITY DEFINER que só são
-- usadas por triggers, cron ou edge functions com service_role (que bypassa grants).
-- Allowlist = RPCs chamadas pelo frontend + helpers usados nas RLS policies.
DO $$
DECLARE
  r record;
  allow text[] := ARRAY[
    -- RLS helpers (usados em USING/WITH CHECK)
    'has_role','has_org_role','is_org_member','default_org_for_current_user',
    -- Frontend RPCs
    'accept_org_invite','api_latency_stats','api_latency_trend','campaign_ab_stats',
    'create_default_deal_stages','dlq_health_metrics','dlq_health_trend',
    'evaluate_partition_policies','get_dashboard_stats','pg_catalog_rls_tables',
    'pg_columns_for_insert','purge_dead_letter','replay_dead_letter',
    'replay_dead_letter_batch','reset_circuit_breaker'
  ];
BEGIN
  FOR r IN
    SELECT n.nspname AS s, p.proname AS f, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef = true
      AND has_function_privilege('authenticated', p.oid, 'EXECUTE')
      AND NOT (p.proname = ANY(allow))
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %I.%I(%s) FROM authenticated, PUBLIC', r.s, r.f, r.args);
  END LOOP;
END $$;
