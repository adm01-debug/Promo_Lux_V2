-- ============================================================
-- Remover EXECUTE de PUBLIC (raiz do problema) em todas as
-- funções SECURITY DEFINER e regrantar por perfil.
-- ============================================================

-- 1) Trigger functions: rodam como owner, nenhum grant de API necessário.
REVOKE EXECUTE ON FUNCTION public.enqueue_webhook_event() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_organization() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.log_audit_event() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.log_deal_stage_change() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notify_on_enrichment() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notify_on_workflow_complete() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.prevent_user_id_change() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.process_audit_log() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.sync_suppression_from_recipient() FROM PUBLIC;

-- 2) Rotinas internas / service_role apenas.
REVOKE EXECUTE ON FUNCTION public.advance_recipient_step(uuid, integer, timestamp with time zone, boolean, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.count_recent_org_violations(integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_default_deal_stages(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.evaluate_org_violation_alerts() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.pg_catalog_rls_tables() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.pg_columns_for_insert(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.prune_auth_rate_limits() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.purge_soft_deleted() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.record_campaign_event(uuid, text, text, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.record_campaign_reply(text, text, text, text, text, text, text, text, text, timestamp with time zone, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.touch_api_key(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.verify_api_key(text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.advance_recipient_step(uuid, integer, timestamp with time zone, boolean, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.count_recent_org_violations(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.create_default_deal_stages(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.evaluate_org_violation_alerts() TO service_role;
GRANT EXECUTE ON FUNCTION public.pg_catalog_rls_tables() TO service_role;
GRANT EXECUTE ON FUNCTION public.pg_columns_for_insert(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.prune_auth_rate_limits() TO service_role;
GRANT EXECUTE ON FUNCTION public.purge_soft_deleted() TO service_role;
GRANT EXECUTE ON FUNCTION public.record_campaign_event(uuid, text, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_campaign_reply(text, text, text, text, text, text, text, text, text, timestamp with time zone, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.touch_api_key(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.verify_api_key(text) TO service_role;

-- 3) Funções de API do frontend + helpers de RLS: authenticated (+ service_role).
REVOKE EXECUTE ON FUNCTION public.accept_org_invite(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_dashboard_stats(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_sector_summary(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.campaign_ab_stats(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.decide_ab_winner(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_org_role(uuid, uuid, app_role) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_org_member(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.default_org_for_current_user() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.accept_org_invite(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_dashboard_stats(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_sector_summary(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.campaign_ab_stats(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.decide_ab_winner(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_org_role(uuid, uuid, app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_org_member(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.default_org_for_current_user() TO authenticated, service_role;