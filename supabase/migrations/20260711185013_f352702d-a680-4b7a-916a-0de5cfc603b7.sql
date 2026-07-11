-- Least-privilege: revoke EXECUTE from anon/authenticated/public on internal-only
-- SECURITY DEFINER functions. Trigger functions run as the trigger owner and
-- never need direct EXECUTE grants; cron/service-role functions are invoked with
-- the service role, which bypasses these grants.

-- Trigger functions (invoked by the trigger mechanism, never called directly)
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_updated_at() FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_automation_steps_updated_at() FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.increment_version() FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.validate_ipc_score() FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.normalize_suppression_email() FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.cleanup_old_idempotency_keys() FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_organization() FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.enqueue_webhook_event() FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.log_audit_event() FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.process_audit_log() FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_on_workflow_complete() FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_on_enrichment() FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.prevent_user_id_change() FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.log_deal_stage_change() FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_suppression_from_recipient() FROM public, anon, authenticated;

-- Cron / service-role-only functions (invoked from edge functions with service role)
REVOKE ALL ON FUNCTION public.purge_soft_deleted() FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.prune_auth_rate_limits() FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.advance_recipient_step(uuid, integer, timestamptz, boolean, text) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_campaign_event(uuid, text, text, text, text) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_campaign_reply(text, text, text, text, text, text, text, text, text, timestamptz, uuid) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.evaluate_org_violation_alerts() FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.count_recent_org_violations(integer) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.verify_api_key(text) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.touch_api_key(uuid) FROM public, anon, authenticated;
