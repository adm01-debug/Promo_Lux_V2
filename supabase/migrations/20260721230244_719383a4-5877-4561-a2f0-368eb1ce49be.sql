
-- Rodada #15 — ADR-009: revogar EXECUTE de authenticated/anon em funções internas
-- (workers, triggers, snapshots, purges, admin). service_role mantém acesso.

DO $$
DECLARE
  fn text;
  fns text[] := ARRAY[
    -- Workers de fila (guarda interno exige auth.uid() NULL = service_role)
    'public.claim_scrape_tasks(int, text)',
    'public.complete_scrape_task(uuid)',
    'public.claim_web_scrape_tasks(int, text)',
    'public.complete_web_scrape_task(uuid, uuid)',
    'public.fail_web_scrape_task(uuid, text, bool, text)',
    'public.defer_web_scrape_task(uuid, int, text)',
    -- Snapshots/cron/admin
    'public.capture_db_health_snapshot()',
    'public.capture_dlq_health_snapshots()',
    'public.evaluate_partition_policies()',
    'public.purge_dead_letter(int, int)',
    'public.purge_soft_deleted()',
    'public.prune_auth_rate_limits()',
    'public.pg_columns_for_insert(text)',
    'public.pg_catalog_rls_tables()',
    -- Edge/trigger internas
    'public.record_campaign_event(uuid, text, text, text, text)',
    'public.record_campaign_reply(text, text, text, text, text, text, text, text, text, timestamptz, uuid)',
    'public.advance_recipient_step(uuid, int, timestamptz, bool, text)',
    'public.log_automation_event(uuid, text, text, text, text, text, text, text, uuid, uuid, uuid, uuid, text, int, int, bool, int, int, int, uuid, text, jsonb)',
    'public.count_recent_org_violations(int)',
    'public.evaluate_org_violation_alerts()',
    'public.decide_ab_winner(uuid)',
    -- Trigger functions (só invocadas internamente)
    'public.handle_new_user()',
    'public.handle_new_organization()',
    'public.log_audit_event()',
    'public.enqueue_webhook_event()',
    'public.notify_on_workflow_complete()',
    'public.log_deal_stage_change()',
    'public.prevent_user_id_change()',
    'public.cleanup_old_idempotency_keys()',
    'public.normalize_suppression_email()',
    'public.validate_ipc_score()',
    'public.increment_version()',
    'public.update_updated_at_column()',
    'public.handle_updated_at()',
    'public.update_automation_steps_updated_at()',
    'public.validate_dlq_alert_settings()',
    'public.circuit_breaker_settings_touch()'
  ];
BEGIN
  FOREACH fn IN ARRAY fns LOOP
    BEGIN
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', fn);
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', fn);
    EXCEPTION WHEN undefined_function THEN
      RAISE NOTICE 'Função % não encontrada — ignorada', fn;
    END;
  END LOOP;
END $$;
