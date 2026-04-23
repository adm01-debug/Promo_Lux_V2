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
];