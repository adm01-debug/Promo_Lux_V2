-- ============================================================
-- Hardening: revogar EXECUTE de funções SECURITY DEFINER internas
-- de anon/authenticated. Elas rodam via triggers, RLS ou service_role.
-- Funções de API legítimas do frontend permanecem acessíveis.
-- ============================================================

-- Trigger functions (executadas pelo owner da tabela, nunca via API)
REVOKE EXECUTE ON FUNCTION public.enqueue_webhook_event() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.evaluate_org_violation_alerts() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_organization() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_audit_event() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_deal_stage_change() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_on_enrichment() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_on_workflow_complete() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.prevent_user_id_change() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.process_audit_log() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_suppression_from_recipient() FROM anon, authenticated;

-- Rotinas internas / service_role (edge functions, manutenção)
REVOKE EXECUTE ON FUNCTION public.advance_recipient_step(uuid, integer, timestamp with time zone, boolean, text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.count_recent_org_violations(integer) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.create_default_deal_stages(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.pg_catalog_rls_tables() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.pg_columns_for_insert(text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.prune_auth_rate_limits() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.purge_soft_deleted() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.record_campaign_event(uuid, text, text, text, text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.record_campaign_reply(text, text, text, text, text, text, text, text, text, timestamp with time zone, uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.touch_api_key(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.verify_api_key(text) FROM anon, authenticated;

-- Garantir que service_role mantém acesso a todas elas
GRANT EXECUTE ON FUNCTION public.enqueue_webhook_event() TO service_role;
GRANT EXECUTE ON FUNCTION public.evaluate_org_violation_alerts() TO service_role;
GRANT EXECUTE ON FUNCTION public.advance_recipient_step(uuid, integer, timestamp with time zone, boolean, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.count_recent_org_violations(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.create_default_deal_stages(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.pg_catalog_rls_tables() TO service_role;
GRANT EXECUTE ON FUNCTION public.pg_columns_for_insert(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.prune_auth_rate_limits() TO service_role;
GRANT EXECUTE ON FUNCTION public.purge_soft_deleted() TO service_role;
GRANT EXECUTE ON FUNCTION public.record_campaign_event(uuid, text, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_campaign_reply(text, text, text, text, text, text, text, text, text, timestamp with time zone, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.touch_api_key(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.verify_api_key(text) TO service_role;