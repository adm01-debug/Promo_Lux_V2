/**
 * Frontend mirror of `supabase/functions/_shared/rlsTableRegistry.ts`.
 *
 * Mantém a lista de tabelas multi-tenant cobertas pelos testes RLS
 * (`RLS_REGISTRY_TABLES`) e as tabelas isentas por desenho
 * (`RLS_REGISTRY_EXEMPT`). Quando uma tabela RLS-enabled aparece no banco
 * mas NÃO está em nenhuma das duas listas, o painel de verificação a
 * destaca como "faltando no registry".
 *
 * ⚠️  Mantenha em sincronia com o arquivo do edge function.
 */
export const RLS_REGISTRY_TABLES: string[] = [
  "companies",
  "workflows",
  "campaigns",
  "stakeholders",
  "notifications",
  "intent_signals",
  "scrape_jobs",
  "ipc_config",
  "deal_stages",
  "deals",
  "deal_tasks",
  "deal_activities",
  "api_keys",
  "webhooks",
  "webhook_deliveries",
  "agent_chat_messages",
  // Adicionadas ao auditar o registry contra `ALTER TABLE ... ENABLE ROW
  // LEVEL SECURITY` em todas as migrations — estavam com RLS ativo há tempo
  // mas nunca tinham sido incluídas aqui (o painel de cobertura nunca as
  // sinalizava como faltantes nem como isentas).
  "api_latency_alert_history",
  "api_latency_alert_settings",
  "api_latency_snapshots",
  "automation_alerts",
  "automation_execution_logs",
  "automation_steps",
  "dlq_alert_history",
  "dlq_alert_settings",
  "dlq_health_snapshots",
  "email_suppressions",
  "email_sync_log",
  "job_exports",
  "lusha_contacts",
  "lusha_dm_search_history",
  "oauth_sandbox_snapshots",
  "oracle_rate_limits",
  "org_violation_alert_settings",
  "org_violation_alerts",
  "scrape_dead_letter",
  "scrape_queue",
  // Rodada #27 — tabelas org-scoped que estavam ausentes do mirror
  // frontend do registry (gap silencioso: painel de cobertura não as
  // sinalizava). Todas com RLS ativa; incluídas para auditoria completa.
  "company_reviews",
  "lusha_credit_usage_log",
  "lusha_search_sessions",
  "org_proxies",
  "org_retry_policies",
  "org_scrape_rate_limits",
];

export const RLS_REGISTRY_EXEMPT: string[] = [
  "profiles",
  "audit_logs",
  "api_request_logs",
  "organizations",
  "organization_members",
  "organization_invites",
  "campaign_events",
  "campaign_messages",
  "campaign_recipients",
  "campaign_replies",
  "scrape_results",
  "email_accounts",
  "workflow_runs",
  // Mesma auditoria acima: tabelas globais/operacionais sem organization_id
  // (dashboards internos de saúde/circuit-breaker/vault, rate limiting por
  // identificador, flags globais) — isentas do modelo multi-tenant por
  // desenho (ver task #9 do audit: confirmado que não são multi-tenant, não
  // que estejam mal protegidas).
  "auth_rate_limits",
  "circuit_breaker_alert_history",
  "circuit_breaker_alert_settings",
  "circuit_breaker_snapshots",
  "circuit_breakers",
  "db_health_snapshots",
  "feature_flags",
  "health_checks",
  "idempotency_keys",
  "partition_advisories",
  "partition_policies",
  "user_roles",
  "vault_cookie_alert_history",
  "vault_cookie_snapshots",
];