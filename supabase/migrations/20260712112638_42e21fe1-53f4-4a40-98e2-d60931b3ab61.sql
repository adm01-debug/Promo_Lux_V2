-- 1) Funções acionadas SOMENTE por triggers: nunca chamadas diretamente por clientes.
--    Triggers executam como owner independentemente de GRANT; revogar EXECUTE de
--    anon/authenticated/PUBLIC elimina o warning 0029 sem qualquer impacto.
DO $$
DECLARE
  fn text;
  trigger_fns text[] := ARRAY[
    'update_updated_at_column()',
    'normalize_suppression_email()',
    'cleanup_old_idempotency_keys()',
    'increment_version()',
    'handle_new_organization()',
    'prevent_user_id_change()',
    'notify_on_workflow_complete()',
    'handle_new_user()',
    'validate_ipc_score()',
    'sync_suppression_from_recipient()',
    'log_audit_event()',
    'update_automation_steps_updated_at()',
    'log_deal_stage_change()',
    'handle_updated_at()',
    'process_audit_log()',
    'enqueue_webhook_event()',
    'notify_on_enrichment()'
  ];
BEGIN
  FOREACH fn IN ARRAY trigger_fns LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%s FROM PUBLIC, anon, authenticated;', fn);
  END LOOP;
END $$;

-- 2) Funções de bastidores: chamadas por edge functions (service_role) ou cron,
--    nunca por clientes autenticados. Revoga de anon/authenticated e garante service_role.
DO $$
DECLARE
  fn text;
  service_fns text[] := ARRAY[
    'advance_recipient_step(uuid, integer, timestamp with time zone, boolean, text)',
    'record_campaign_event(uuid, text, text, text, text)',
    'record_campaign_reply(text, text, text, text, text, text, text, text, text, timestamp with time zone, uuid)',
    'prune_auth_rate_limits()',
    'purge_soft_deleted()',
    'evaluate_org_violation_alerts()',
    'count_recent_org_violations(integer)',
    'verify_api_key(text)',
    'touch_api_key(uuid)'
  ];
BEGIN
  FOREACH fn IN ARRAY service_fns LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%s FROM PUBLIC, anon, authenticated;', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO service_role;', fn);
  END LOOP;
END $$;