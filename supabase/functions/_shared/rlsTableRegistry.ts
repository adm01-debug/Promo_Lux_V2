/**
 * Shared whitelist of multi-tenant tables covered by `rls-tests`.
 *
 * ➜ Para cada tabela nova com RLS por organização, ADICIONE uma entrada aqui.
 *    Caso contrário, o teste de cobertura (`rls_coverage_complete`) FALHA.
 *
 * - `table`: nome da tabela em `public`.
 * - `payload(orgId, userId, ctx)`: gera um insert válido para a tabela na org indicada.
 *   `ctx` recebe ids auxiliares (ex.: stage_id, company_id) já criados pelo runner.
 * - `requires`: tabelas auxiliares que devem ser criadas antes (em ordem) e
 *   cujo id é exposto em `ctx[<table>]`.
 * - `excludeFromAnon`: pula o teste de "anon não pode ler/inserir" (ex.: tabelas
 *   somente service_role como webhook_deliveries).
 */
export type AppEnv = "dev" | "staging" | "prod";

export interface RlsTableSpec {
  table: string;
  payload: (orgId: string, userId: string, ctx: Record<string, string>) => Record<string, unknown>;
  requires?: string[];
  excludeFromAnon?: boolean;
  /**
   * Ambientes nos quais esta tabela ainda não existe ou deve ser ignorada no teste de isolamento.
   */
  envExempt?: AppEnv[];
  /**
   * Nome da coluna identificadora usada pelo runner para selecionar/limpar a
   * linha de teste (`.select(idColumn).single()` / `.eq(idColumn, ...)`).
   * Default "id". Tabelas de configuração singleton por org (PK =
   * organization_id, sem coluna `id` própria) precisam sobrescrever.
   */
  idColumn?: string;
}

export const RLS_TABLES: RlsTableSpec[] = [
  { table: "companies",      payload: (org, uid) => ({ name: "X", organization_id: org, user_id: uid }) },
  { table: "workflows",      payload: (org, uid) => ({ name: "wf", steps: [], organization_id: org, user_id: uid }) },
  { table: "campaigns",      payload: (org, uid) => ({ name: "c", organization_id: org, user_id: uid }) },
  { table: "stakeholders",   payload: (org, uid) => ({ full_name: "P", organization_id: org, user_id: uid }) },
  { table: "notifications",  payload: (org, uid) => ({ title: "n", message: "m", organization_id: org, user_id: uid }) },
  { table: "intent_signals", payload: (org, uid) => ({ company_name: "X", signal: "visit", organization_id: org, user_id: uid }) },
  { table: "scrape_jobs",    payload: (org, uid) => ({ name: "j", organization_id: org, user_id: uid }) },
  { table: "ipc_config",     payload: (org, uid) => ({ name: `ipc-${Date.now()}`, criteria: {}, organization_id: org, user_id: uid }) },
  { table: "deal_stages",    payload: (org, uid) => ({ name: "RLS-stage", organization_id: org, user_id: uid }) },
  {
    table: "deals",
    requires: ["deal_stages"],
    payload: (org, uid, ctx) => ({ title: "d", stage_id: ctx.deal_stages, organization_id: org, user_id: uid }),
  },
  {
    table: "deal_tasks",
    payload: (org, uid) => ({ title: "t", organization_id: org, user_id: uid }),
  },
  {
    table: "deal_activities",
    requires: ["deal_stages", "deals"],
    payload: (org, uid, ctx) => ({ deal_id: ctx.deals, type: "note", title: "a", organization_id: org, user_id: uid }),
  },
  { table: "api_keys",          payload: (org, uid) => ({ name: "k", prefix: `pfx_${Date.now()}`, key_hash: `h_${Date.now()}`, organization_id: org, user_id: uid }) },
  { table: "webhooks",          payload: (org, uid) => ({ name: "w", url: "https://example.com", events: ["companies.insert"], organization_id: org, user_id: uid }) },
  { table: "webhook_deliveries", excludeFromAnon: true,
    requires: ["webhooks"],
    payload: (org, uid, ctx) => ({ webhook_id: ctx.webhooks, event: "companies.insert", payload: {}, organization_id: org, user_id: uid }) },
  { table: "agent_chat_messages", payload: (org, uid) => ({ role: "user", content: "hi", organization_id: org, user_id: uid }) },

  // Adicionadas ao auditar todas as tabelas com RLS ativo nas migrations
  // contra este registry — tinham RLS ligado há tempo mas nunca haviam sido
  // registradas aqui nem em RLS_TABLES_EXEMPT, então o teste de cobertura
  // (`rls_coverage_complete`) nunca as sinalizava e o isolamento cross-org
  // delas nunca era exercitado automaticamente.
  { table: "api_latency_alert_history", payload: (org) => ({ organization_id: org, path: "/e2e", p95_ms: 100, p95_critical_ms: 1500, consecutive: 1 }) },
  { table: "api_latency_alert_settings", idColumn: "organization_id", payload: (org) => ({ organization_id: org }) },
  { table: "api_latency_snapshots", payload: (org) => ({ organization_id: org, path: "/e2e" }) },
  { table: "automation_alerts", payload: (org, uid) => ({ user_id: uid, organization_id: org, event_type: "job_completed", delivery_method: "in_app" }) },
  { table: "automation_execution_logs", payload: (org, uid) => ({ organization_id: org, user_id: uid }) },
  { table: "automation_steps", payload: (org) => ({ organization_id: org, name: "RLS-step" }) },
  { table: "dlq_alert_history", payload: (org) => ({ organization_id: org, pending_items: 0, pending_critical: 0, consecutive: 0 }) },
  { table: "dlq_alert_settings", idColumn: "organization_id", payload: (org) => ({ organization_id: org }) },
  { table: "dlq_health_snapshots", payload: (org) => ({ organization_id: org }) },
  { table: "email_suppressions", payload: (org) => ({ organization_id: org, email: `rls-test-${Date.now()}@example.com`, reason: "manual" }) },
  {
    table: "job_exports",
    requires: ["scrape_jobs"],
    payload: (org, uid, ctx) => ({ job_id: ctx.scrape_jobs, user_id: uid, organization_id: org, format: "csv" }),
  },
  { table: "lusha_contacts", payload: (org, uid) => ({ organization_id: org, user_id: uid, lusha_company_name: "RLS Co", full_name: "RLS Contact" }) },
  { table: "lusha_dm_search_history", payload: (org, uid) => ({ organization_id: org, user_id: uid, domain: "rls-test.example.com", status: "queued" }) },
  {
    table: "oauth_sandbox_snapshots",
    payload: (org, uid) => ({
      organization_id: org, user_id: uid, label: "RLS snapshot", provider: "gmail", scope_type: "organization",
      redirect_uri: "https://example.com/oauth/callback", redirect_uri_normalized: "https://example.com/oauth/callback",
      client_id_configured: true, client_secret_configured: true,
    }),
  },
  { table: "oracle_rate_limits", payload: (org) => ({ organization_id: org }) },
  { table: "org_violation_alert_settings", idColumn: "organization_id", payload: (org) => ({ organization_id: org }) },
  { table: "org_violation_alerts", payload: (org) => ({ organization_id: org, window_minutes: 5, threshold: 100, violation_count: 1 }) },
  { table: "scrape_dead_letter", payload: (org, uid) => ({ organization_id: org, user_id: uid }) },
  { table: "scrape_queue", payload: (org, uid) => ({ organization_id: org, user_id: uid }) },
  // email_sync_log NÃO entra aqui: exige email_account_id NOT NULL apontando
  // para email_accounts, que é isenta (RLS por user_id, não por org) e não
  // roda neste loop — não há como este harness (baseado em `requires` entre
  // specs do próprio RLS_TABLES) satisfazer essa FK. Continua coberta pela
  // whitelist do frontend (src/lib/rlsRegistry.ts), que é só informativa.
];

/**
 * Tabelas RLS-enabled que sabidamente NÃO seguem o modelo multi-tenant
 * por organização (ex.: profiles é por user_id; audit_logs é gerido por triggers).
 * Listadas explicitamente para o teste de cobertura ignorá-las sem alarmar.
 */
export const RLS_TABLES_EXEMPT: string[] = [
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
  "idempotency_keys",
  "user_roles",
  // Mesma auditoria acima: tabelas globais/operacionais sem organization_id
  // (dashboards internos de saúde/circuit-breaker/vault, rate limiting por
  // identificador, flags globais).
  "auth_rate_limits",
  "circuit_breaker_alert_history",
  "circuit_breaker_alert_settings",
  "circuit_breaker_snapshots",
  "circuit_breakers",
  "db_health_snapshots",
  "feature_flags",
  "health_checks",
  "partition_advisories",
  "partition_policies",
  "vault_cookie_alert_history",
  "vault_cookie_snapshots",
  // email_sync_log É multi-tenant (organization_id), mas fica isenta AQUI
  // (só nesta whitelist do runner) porque exige email_account_id NOT NULL —
  // ver o comentário logo após "scrape_queue" em RLS_TABLES acima. Continua
  // marcada como tabela real em src/lib/rlsRegistry.ts (frontend).
  "email_sync_log",
];

/**
 * Exceções globais por ambiente.
 * Útil para tabelas que ainda não foram migradas para staging/prod.
 */
export const ENV_EXEMPT_TABLES: Record<AppEnv, string[]> = {
  dev: [],
  staging: [], // Exemplo: ["tabela_nova_em_dev"]
  prod: [],
};