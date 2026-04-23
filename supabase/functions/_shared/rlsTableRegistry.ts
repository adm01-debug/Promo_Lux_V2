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
export interface RlsTableSpec {
  table: string;
  payload: (orgId: string, userId: string, ctx: Record<string, string>) => Record<string, unknown>;
  requires?: string[];
  excludeFromAnon?: boolean;
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
];