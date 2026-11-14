# 10 · ACESSO E SEGURANÇA — quem pode o quê

> Gerado automaticamente por AI Context Sync v1.3.2 · commit `f1a6552703` · branch `main` · 2026-11-14 12:39 UTC
> Não edite à mão — regras humanas vão em `manual/`.

## Perfis / roles identificados

`admin`, `agent`, `granted`, `sdr`, `user`, `viewer`

- Tabelas de perfil/permissão: `organization_members`, `user_roles`
- Colunas de perfil: `stakeholders.role` (text), `agent_chat_messages.role` (TEXT NOT NULL CHECK (role IN ('user', 'agent'))), `organization_members.role` (public.app_role NOT NULL DEFAULT 'viewer'), `organization_invites.role` (public.app_role NOT NULL DEFAULT 'viewer'), `user_roles.role` (public.app_role NOT NULL)
- Claims do JWT usados em políticas/funções: nenhum
- Funções usadas dentro de políticas RLS (a regra real está no corpo delas — veja `06`): `default_org_for_current_user`, `has_org_role`, `has_role`, `is_org_member`

## Matriz tabela × operação → quem pode (derivada das políticas RLS)

| Tabela | RLS | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|---|
| `agent_chat_messages` | enabled | authenticated: user_id = auth.uid() | authenticated: user_id = auth.uid() | — | authenticated: user_id = auth.uid() |
| `api_keys` | enabled | service_role: true<br>authenticated: public.has_org_role(organization_id, auth.uid(), 'admin') | service_role: true<br>authenticated: public.has_org_role(organization_id, auth.uid(), 'admin') | service_role: true<br>authenticated: public.has_org_role(organization_id, auth.uid(), 'admin') | service_role: true<br>authenticated: public.has_org_role(organization_id, auth.uid(), 'admin') |
| `api_latency_alert_history` | enabled | authenticated: public.is_org_member(organization_id, auth.uid()) | — | — | — |
| `api_latency_alert_settings` | enabled | authenticated: public.is_org_member(organization_id, auth.uid()) | authenticated: public.has_org_role(organization_id, auth.uid(), 'admin') | authenticated: public.has_org_role(organization_id, auth.uid(), 'admin') | authenticated: public.has_org_role(organization_id, auth.uid(), 'admin') |
| `api_latency_snapshots` | enabled | authenticated: public.is_org_member(organization_id, auth.uid()) | — | — | — |
| `api_request_logs` | enabled | authenticated: organization_id IS NOT NULL AND public.has_org_role(organization_id, auth.uid(), 'admin'::app_role)<br>service_role: true | service_role: true | service_role: true | service_role: true |
| `apollo_rate_state` | enabled | authenticated: true<br>service_role: true | service_role: true | service_role: true | service_role: true |
| `apollo_search_cache` | enabled | authenticated: true<br>service_role: true | service_role: true | service_role: true | service_role: true |
| `audit_logs` | enabled | service_role: true<br>authenticated: organization_id IS NOT NULL AND public.has_org_role(organization_id, auth.uid(), 'admin')<br>authenticated: public.has_role(auth.uid(), 'admin'::public.app_role) | service_role: true | service_role: true | service_role: true |
| `auth_rate_limits` | enabled | service_role: true | service_role: true | service_role: true | service_role: true |
| `automation_alerts` | enabled | public: auth.uid() = user_id | public: auth.uid() = user_id | public: auth.uid() = user_id | public: auth.uid() = user_id |
| `automation_execution_logs` | enabled | authenticated: public.is_org_member(organization_id, auth.uid()) | authenticated: public.is_org_member(organization_id, auth.uid()) | — | authenticated: public.has_role(auth.uid(), 'admin') |
| `automation_steps` | enabled | public: organization_id IN ( SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid() ) | public: organization_id IN ( SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid() ) | public: organization_id IN ( SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid() ) | — |
| `campaign_events` | enabled | authenticated: public.is_org_member(organization_id, auth.uid()) | — | — | — |
| `campaign_messages` | enabled | authenticated: public.is_org_member(organization_id, auth.uid()) | authenticated: public.has_org_role(organization_id, auth.uid(), 'sdr') | — | authenticated: public.has_org_role(organization_id, auth.uid(), 'admin') |
| `campaign_recipients` | enabled | authenticated: public.is_org_member(organization_id, auth.uid()) | authenticated: public.has_org_role(organization_id, auth.uid(), 'sdr') | authenticated: public.has_org_role(organization_id, auth.uid(), 'sdr') | authenticated: public.has_org_role(organization_id, auth.uid(), 'admin') |
| `campaign_replies` | enabled | authenticated: public.is_org_member(organization_id, auth.uid()) | — | — | — |
| `campaigns` | enabled | service_role: true<br>authenticated: public.is_org_member(organization_id, auth.uid()) | service_role: true<br>authenticated: public.has_org_role(organization_id, auth.uid(), 'sdr') | service_role: true<br>authenticated: public.has_org_role(organization_id, auth.uid(), 'sdr') | service_role: true<br>authenticated: public.has_org_role(organization_id, auth.uid(), 'admin') |
| `circuit_breaker_alert_history` | enabled | authenticated: public.has_role(auth.uid(), 'admin')<br>service_role: true | service_role: true | service_role: true | service_role: true |
| `circuit_breaker_alert_settings` | enabled | authenticated: public.has_role(auth.uid(), 'admin')<br>authenticated: public.has_role(auth.uid(), 'admin')<br>service_role: true | authenticated: public.has_role(auth.uid(), 'admin')<br>service_role: true | authenticated: public.has_role(auth.uid(), 'admin')<br>service_role: true | authenticated: public.has_role(auth.uid(), 'admin')<br>service_role: true |
| `circuit_breaker_snapshots` | enabled | authenticated: true<br>service_role: true | service_role: true | service_role: true | service_role: true |
| `circuit_breakers` | enabled | public: auth.role() = 'authenticated' | — | — | — |
| `cnpj_enrich_cache` | enabled | authenticated: true | — | — | — |
| `cnpj_enrich_queue` | enabled | authenticated: requested_by = auth.uid() | authenticated: requested_by = auth.uid() | — | — |
| `cnpj_enrich_rate_state` | enabled | authenticated: true | — | — | — |
| `companies` | enabled | service_role: true<br>authenticated: public.is_org_member(organization_id, auth.uid()) | service_role: true<br>authenticated: public.has_org_role(organization_id, auth.uid(), 'sdr') | service_role: true<br>authenticated: public.has_org_role(organization_id, auth.uid(), 'sdr') | service_role: true<br>authenticated: public.has_org_role(organization_id, auth.uid(), 'admin') |
| `company_reviews` | enabled | authenticated: public.is_org_member(organization_id, auth.uid()) | authenticated: public.is_org_member(organization_id, auth.uid()) | authenticated: public.is_org_member(organization_id, auth.uid()) | authenticated: public.is_org_member(organization_id, auth.uid()) |
| `db_health_snapshots` | enabled | authenticated: public.has_role(auth.uid(), 'admin') | — | — | — |
| `deal_activities` | enabled | authenticated: public.is_org_member(organization_id, auth.uid()) | authenticated: public.has_org_role(organization_id, auth.uid(), 'sdr') | authenticated: public.has_org_role(organization_id, auth.uid(), 'sdr') | authenticated: public.has_org_role(organization_id, auth.uid(), 'admin') |
| `deal_stages` | enabled | authenticated: public.is_org_member(organization_id, auth.uid()) | authenticated: public.has_org_role(organization_id, auth.uid(), 'admin') | authenticated: public.has_org_role(organization_id, auth.uid(), 'admin') | authenticated: public.has_org_role(organization_id, auth.uid(), 'admin') |
| `deal_tasks` | enabled | authenticated: public.is_org_member(organization_id, auth.uid()) | authenticated: public.has_org_role(organization_id, auth.uid(), 'sdr') | authenticated: public.has_org_role(organization_id, auth.uid(), 'sdr') | authenticated: public.has_org_role(organization_id, auth.uid(), 'admin') |
| `deals` | enabled | service_role: true<br>authenticated: public.is_org_member(organization_id, auth.uid()) | service_role: true<br>authenticated: public.has_org_role(organization_id, auth.uid(), 'sdr') | service_role: true<br>authenticated: public.has_org_role(organization_id, auth.uid(), 'sdr') | service_role: true<br>authenticated: public.has_org_role(organization_id, auth.uid(), 'admin') |
| `dlq_alert_history` | enabled | authenticated: public.is_org_member(organization_id, auth.uid()) | — | — | — |
| `dlq_alert_settings` | enabled | authenticated: public.is_org_member(organization_id, auth.uid()) | authenticated: public.has_org_role(organization_id, auth.uid(), 'admin') | authenticated: public.has_org_role(organization_id, auth.uid(), 'admin') | authenticated: public.has_org_role(organization_id, auth.uid(), 'admin') |
| `dlq_health_snapshots` | enabled | authenticated: public.is_org_member(organization_id, auth.uid()) | — | — | — |
| `email_accounts` | enabled | authenticated: (scope_type = 'user' AND user_id = auth.uid()) OR (scope_type = 'organization' AND public.is_org_member(organization_id, auth<br>service_role: true | authenticated: (scope_type = 'user' AND user_id = auth.uid()) OR (scope_type = 'organization' AND public.has_org_role(organization_id, auth.<br>service_role: true | authenticated: (scope_type = 'user' AND user_id = auth.uid()) OR (scope_type = 'organization' AND public.has_org_role(organization_id, auth.<br>service_role: true | authenticated: (scope_type = 'user' AND user_id = auth.uid()) OR (scope_type = 'organization' AND public.has_org_role(organization_id, auth.<br>service_role: true |
| `email_suppressions` | enabled | authenticated: public.is_org_member(organization_id, auth.uid()) | authenticated: public.is_org_member(organization_id, auth.uid()) | authenticated: public.is_org_member(organization_id, auth.uid()) | authenticated: public.is_org_member(organization_id, auth.uid()) |
| `email_sync_log` | enabled | authenticated: EXISTS ( SELECT 1 FROM public.email_accounts ea WHERE ea.id = email_sync_log.email_account_id AND ( (ea.scope_type = 'user' A<br>service_role: true | service_role: true | service_role: true | service_role: true |
| `feature_flags` | enabled | public: organization_id IS NULL OR organization_id = public.default_org_for_current_user()<br>service_role: true | service_role: true | service_role: true | service_role: true |
| `health_checks` | enabled | public: auth.role() = 'authenticated' | — | — | — |
| `idempotency_keys` | enabled | public: auth.uid() = user_id | public: auth.uid() = user_id<br>public: auth.uid() = user_id | — | — |
| `instagram_scrape_dead_letter` | enabled | authenticated: organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()) | — | — | — |
| `instagram_scrape_queue` | enabled | authenticated: organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()) | authenticated: organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()) | authenticated: organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()) | authenticated: organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()) |
| `instagram_scrape_results` | enabled | authenticated: organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()) | — | — | — |
| `intent_signals` | enabled | service_role: true<br>authenticated: public.is_org_member(organization_id, auth.uid()) | service_role: true<br>authenticated: public.has_org_role(organization_id, auth.uid(), 'sdr') | service_role: true<br>authenticated: public.has_org_role(organization_id, auth.uid(), 'sdr') | service_role: true<br>authenticated: public.has_org_role(organization_id, auth.uid(), 'admin') |
| `ipc_config` | enabled | service_role: true<br>authenticated: public.is_org_member(organization_id, auth.uid())<br>public: organization_id IN ( SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid() )<br>public: organization_id IN ( SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid() AND role IN ('admin', 'sdr') | service_role: true<br>authenticated: public.has_org_role(organization_id, auth.uid(), 'admin')<br>public: organization_id IN ( SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid() AND role IN ('admin', 'sdr') | service_role: true<br>authenticated: public.has_org_role(organization_id, auth.uid(), 'admin')<br>public: organization_id IN ( SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid() AND role IN ('admin', 'sdr') | service_role: true<br>authenticated: public.has_org_role(organization_id, auth.uid(), 'admin')<br>public: organization_id IN ( SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid() AND role IN ('admin', 'sdr') |
| `job_exports` | enabled | public: auth.uid() = user_id | public: auth.uid() = user_id | public: auth.uid() = user_id | public: auth.uid() = user_id |
| `lusha_contacts` | enabled | public: organization_id = public.default_org_for_current_user()<br>service_role: true | service_role: true<br>authenticated: user_id = auth.uid() AND has_org_role(organization_id, auth.uid(), 'viewer'::app_role) | public: organization_id = public.default_org_for_current_user()<br>service_role: true | public: organization_id = public.default_org_for_current_user()<br>service_role: true |
| `lusha_credit_usage_log` | enabled | authenticated: organization_id IS NOT NULL AND public.is_org_member(organization_id, auth.uid())<br>service_role: true | service_role: true | service_role: true | service_role: true |
| `lusha_dm_search_history` | enabled | public: auth.uid() = user_id | public: auth.uid() = user_id | public: auth.uid() = user_id | public: auth.uid() = user_id |
| `lusha_search_sessions` | enabled | public: organization_id = public.default_org_for_current_user()<br>service_role: true | public: user_id = auth.uid() AND organization_id = public.default_org_for_current_user()<br>service_role: true | public: organization_id = public.default_org_for_current_user()<br>service_role: true | public: organization_id = public.default_org_for_current_user()<br>service_role: true |
| `notifications` | enabled | authenticated: user_id = auth.uid()<br>service_role: true | authenticated: user_id = auth.uid()<br>service_role: true | authenticated: user_id = auth.uid()<br>service_role: true | authenticated: user_id = auth.uid()<br>service_role: true |
| `oauth_sandbox_snapshots` | enabled | authenticated: public.is_org_member(organization_id, auth.uid())<br>public: organization_id IN ( SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid() )<br>public: organization_id IN ( SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid() AND role = 'admin' ) | authenticated: public.has_org_role(organization_id, auth.uid(), 'admin'::public.app_role) AND user_id = auth.uid()<br>public: organization_id IN ( SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid() AND role = 'admin' ) | authenticated: public.has_org_role(organization_id, auth.uid(), 'admin'::public.app_role)<br>public: organization_id IN ( SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid() AND role = 'admin' ) | authenticated: public.has_org_role(organization_id, auth.uid(), 'admin'::public.app_role)<br>public: organization_id IN ( SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid() AND role = 'admin' ) |
| `oracle_rate_limits` | enabled | authenticated: public.is_org_member(organization_id, auth.uid())<br>service_role: true | service_role: true | service_role: true | service_role: true |
| `oracle_v2_health` | não encontrado | sem RLS | sem RLS | sem RLS | sem RLS |
| `org_proxies` | enabled | authenticated: public.has_org_role(organization_id, auth.uid(), 'admin') | authenticated: public.has_org_role(organization_id, auth.uid(), 'admin') | authenticated: public.has_org_role(organization_id, auth.uid(), 'admin') | authenticated: public.has_org_role(organization_id, auth.uid(), 'admin') |
| `org_retry_policies` | enabled | authenticated: public.is_org_member(auth.uid(), organization_id) | — | — | — |
| `org_scrape_rate_limits` | enabled | authenticated: public.has_org_role(auth.uid(), organization_id, 'admin')<br>authenticated: public.is_org_member(organization_id, auth.uid()) | authenticated: public.has_org_role(auth.uid(), organization_id, 'admin') | authenticated: public.has_org_role(auth.uid(), organization_id, 'admin') | authenticated: public.has_org_role(auth.uid(), organization_id, 'admin') |
| `org_violation_alert_settings` | enabled | authenticated: public.has_org_role(organization_id, auth.uid(), 'admin') | authenticated: public.has_org_role(organization_id, auth.uid(), 'admin') | authenticated: public.has_org_role(organization_id, auth.uid(), 'admin') | — |
| `org_violation_alerts` | enabled | authenticated: public.has_org_role(organization_id, auth.uid(), 'admin') | — | — | — |
| `organization_invites` | enabled | authenticated: public.is_org_member(organization_id, auth.uid()) | authenticated: public.has_org_role(organization_id, auth.uid(), 'admin') AND created_by = auth.uid() | authenticated: public.has_org_role(organization_id, auth.uid(), 'admin') | authenticated: public.has_org_role(organization_id, auth.uid(), 'admin') |
| `organization_members` | enabled | authenticated: public.is_org_member(organization_id, auth.uid()) | authenticated: public.has_org_role(organization_id, auth.uid(), 'admin') | authenticated: public.has_org_role(organization_id, auth.uid(), 'admin') | authenticated: public.has_org_role(organization_id, auth.uid(), 'admin') OR user_id = auth.uid() |
| `organizations` | enabled | authenticated: public.is_org_member(id, auth.uid()) | authenticated: owner_id = auth.uid() | authenticated: public.has_org_role(id, auth.uid(), 'admin') | authenticated: owner_id = auth.uid() |
| `partition_advisories` | enabled | authenticated: public.has_role(auth.uid(), 'admin') | — | authenticated: public.has_role(auth.uid(), 'admin') | — |
| `partition_policies` | enabled | authenticated: public.has_role(auth.uid(), 'admin') | authenticated: public.has_role(auth.uid(), 'admin') | authenticated: public.has_role(auth.uid(), 'admin') | authenticated: public.has_role(auth.uid(), 'admin') |
| `pg_net_health_snapshots` | enabled | authenticated: public.has_role(auth.uid(), 'admin') | — | — | — |
| `places_api_usage` | enabled | authenticated: public.is_org_member(organization_id, auth.uid()) | — | — | — |
| `profiles` | enabled | authenticated: auth.uid() = id | authenticated: auth.uid() = id | authenticated: auth.uid() = id | authenticated: id = auth.uid() |
| `qa_reaper_runs` | enabled | authenticated: true<br>service_role: true | service_role: true | service_role: true | service_role: true |
| `qa_test_runs` | enabled | authenticated: true<br>service_role: true | service_role: true | service_role: true | service_role: true |
| `queue_sla_defaults` | enabled | authenticated: true | authenticated: public.has_role(auth.uid(), 'admin'::app_role) | authenticated: public.has_role(auth.uid(), 'admin'::app_role) | — |
| `queue_sla_history` | enabled | authenticated: public.has_role(auth.uid(), 'admin'::app_role) | — | — | — |
| `reaper_alert_history` | enabled | authenticated: true<br>service_role: true | service_role: true | service_role: true | service_role: true |
| `reaper_alert_settings` | enabled | authenticated: public.has_role(auth.uid(), 'admin')<br>service_role: true | service_role: true | authenticated: public.has_role(auth.uid(), 'admin')<br>service_role: true | service_role: true |
| `retry_policy_advisories` | enabled | authenticated: (organization_id IS NULL AND public.has_role(auth.uid(), 'admin'::app_role)) OR (organization_id IS NOT NULL AND public.has_o | — | — | — |
| `robots_cache` | enabled | authenticated: true | — | — | — |
| `scrape_dead_letter` | enabled | authenticated: public.is_org_member(organization_id, auth.uid()) | — | — | — |
| `scrape_jobs` | enabled | service_role: true<br>authenticated: public.is_org_member(organization_id, auth.uid()) | service_role: true<br>authenticated: public.has_org_role(organization_id, auth.uid(), 'sdr') | service_role: true<br>authenticated: public.has_org_role(organization_id, auth.uid(), 'sdr') | service_role: true<br>authenticated: public.has_org_role(organization_id, auth.uid(), 'admin') |
| `scrape_queue` | enabled | authenticated: public.is_org_member(organization_id, auth.uid()) | — | — | — |
| `scrape_results` | enabled | service_role: true<br>authenticated: public.is_org_member(organization_id, auth.uid()) | service_role: true<br>authenticated: public.is_org_member(organization_id, auth.uid()) | service_role: true<br>authenticated: public.has_org_role(organization_id, auth.uid(), 'sdr') | service_role: true<br>authenticated: public.has_org_role(organization_id, auth.uid(), 'admin') |
| `scrape_worker_state` | enabled | authenticated: true | — | — | — |
| `sla_alert_history` | enabled | authenticated: public.has_role(auth.uid(), 'admin'::app_role) | — | — | — |
| `sla_alert_settings` | enabled | authenticated: public.has_role(auth.uid(), 'admin'::app_role) | authenticated: public.has_role(auth.uid(), 'admin'::app_role) | authenticated: public.has_role(auth.uid(), 'admin'::app_role) | — |
| `sla_autotune_runs` | enabled | authenticated: public.has_role(auth.uid(), 'admin'::app_role) | — | — | — |
| `sla_snapshots` | enabled | authenticated: true | — | — | — |
| `stakeholders` | enabled | service_role: true<br>authenticated: public.is_org_member(organization_id, auth.uid()) | service_role: true<br>authenticated: public.has_org_role(organization_id, auth.uid(), 'sdr') | service_role: true<br>authenticated: public.has_org_role(organization_id, auth.uid(), 'sdr') | service_role: true<br>authenticated: public.has_org_role(organization_id, auth.uid(), 'admin') |
| `user_roles` | enabled | authenticated: auth.uid() = user_id<br>service_role: true | service_role: true | service_role: true | service_role: true |
| `v_lusha_cache_stats` | não encontrado | sem RLS | sem RLS | sem RLS | sem RLS |
| `v_lux_enrichment_health` | não encontrado | sem RLS | sem RLS | sem RLS | sem RLS |
| `vault_cookie_alert_history` | enabled | authenticated: true | — | — | — |
| `vault_cookie_snapshots` | enabled | authenticated: true | — | — | — |
| `web_scrape_dead_letter` | enabled | authenticated: public.is_org_member(organization_id, auth.uid()) | — | — | — |
| `web_scrape_queue` | enabled | authenticated: public.is_org_member(organization_id, auth.uid()) | — | — | — |
| `web_scrape_results` | enabled | authenticated: public.is_org_member(organization_id, auth.uid()) | — | — | — |
| `webhook_deliveries` | enabled | service_role: true<br>authenticated: public.has_org_role(organization_id, auth.uid(), 'admin') | service_role: true | service_role: true<br>authenticated: public.has_org_role(organization_id, auth.uid(), 'admin') | service_role: true |
| `webhooks` | enabled | service_role: true<br>authenticated: public.has_org_role(organization_id, auth.uid(), 'admin') | service_role: true<br>authenticated: public.has_org_role(organization_id, auth.uid(), 'admin') | service_role: true<br>authenticated: public.has_org_role(organization_id, auth.uid(), 'admin') | service_role: true<br>authenticated: public.has_org_role(organization_id, auth.uid(), 'admin') |
| `workflow_runs` | enabled | service_role: true<br>authenticated: public.is_org_member(organization_id, auth.uid()) | service_role: true<br>authenticated: public.has_org_role(organization_id, auth.uid(), 'sdr') | service_role: true<br>authenticated: public.has_org_role(organization_id, auth.uid(), 'sdr') | service_role: true<br>authenticated: public.has_org_role(organization_id, auth.uid(), 'admin') |
| `workflows` | enabled | service_role: true<br>authenticated: public.is_org_member(organization_id, auth.uid()) | service_role: true<br>authenticated: public.has_org_role(organization_id, auth.uid(), 'sdr') | service_role: true<br>authenticated: public.has_org_role(organization_id, auth.uid(), 'sdr') | service_role: true<br>authenticated: public.has_org_role(organization_id, auth.uid(), 'admin') |

> `—` com RLS ligado = ninguém além de service_role. `sem RLS` = qualquer chave anon lê/escreve tudo.

## Onde o RLS é IGNORADO (service_role) — 170 arquivo(s)

- `e2e/dlq-web-smoke.spec.ts`
- `e2e/instagram-dlq-replay.spec.ts`
- `e2e/instagram-worker-smoke.spec.ts`
- `scripts/ai-context/cenarios.mjs`
- `scripts/ai-context/gerar.unit.mjs`
- `scripts/gen-round24-preflight.ts`
- `scripts/regras_negocio/generate.py`
- `scripts/sql/check-function-grants.sql`
- `scripts/supabase_snapshot/snapshot.py`
- `src/integrations/supabase/withOrg.ts`
- `src/lib/mcp/supabase.ts`
- `supabase/functions/_shared/apollo-cache.ts`
- `supabase/functions/_shared/org-membership.ts`
- `supabase/functions/_shared/rlsTableRegistry.ts`
- `supabase/functions/admin-list-companies/index.ts`
- `supabase/functions/ai-agent/index.ts`
- `supabase/functions/api-latency-alerts/index.ts`
- `supabase/functions/audit-logs-prune/index.ts`
- `supabase/functions/auth-rate-limit/index.ts`
- `supabase/functions/campaign-dispatch/index.ts`
- `supabase/functions/circuit-breaker-alerts/index.ts`
- `supabase/functions/cnpj-enrich-worker/index.ts`
- `supabase/functions/cnpj-enrich/index.ts`
- `supabase/functions/cnpj-settings-status/index.ts`
- `supabase/functions/dlq-alerts/index.ts`
- `supabase/functions/email-oauth-callback/index.ts`
- `supabase/functions/email-oauth-disconnect/index.ts`
- `supabase/functions/email-poll-replies/index.ts`
- `supabase/functions/gmaps-places-search/index.ts`
- `supabase/functions/gmaps-proxy/index.ts`
- `supabase/functions/health/index.ts`
- `supabase/functions/instagram-dlq-replay/index.ts`
- `supabase/functions/instagram-enqueue/index.ts`
- `supabase/functions/instagram-worker-health/index.ts`
- `supabase/functions/instagram-worker/index.ts`
- `supabase/functions/latency-alerts/index.ts`
- `supabase/functions/lusha-reveal/index.ts`
- `supabase/functions/lusha-search/index.ts`
- `supabase/functions/migrate-helper/index.ts`
- `supabase/functions/oracle-cookies-preflight/index.ts`
- `supabase/functions/oracle-enrich-contact/index.ts`
- `supabase/functions/oracle-push-bitrix/index.ts`
- `supabase/functions/oracle-search-decisors/index.ts`
- `supabase/functions/org-violation-alerts/index.ts`
- `supabase/functions/pg-net-watchdog/index.ts`
- `supabase/functions/public-api/index.ts`
- `supabase/functions/purge-soft-deleted/index.ts`
- `supabase/functions/qa-ingest-run/index.ts`
- `supabase/functions/reaper-alerts/index.ts`
- `supabase/functions/retry-policy-tuner/index.ts`
- `supabase/functions/rls-tests/index.test.ts`
- `supabase/functions/rls-tests/index.ts`
- `supabase/functions/scrape-queue-worker/index.ts`
- `supabase/functions/sla-alerts/index.ts`
- `supabase/functions/sla-auto-tune/index.ts`
- `supabase/functions/system-recovery-status/index.ts`
- `supabase/functions/track-click/index.ts`
- `supabase/functions/track-open/index.ts`
- `supabase/functions/vault-cookie-health/index.ts`
- `supabase/functions/web-dlq-replay/index.ts`
- `supabase/functions/web-scrape-enqueue/index.ts`
- `supabase/functions/web-scrape-extract/index.ts`
- `supabase/functions/web-scrape-worker/index.ts`
- `supabase/functions/webhook-dispatcher/index.ts`
- `supabase/functions/workflow-engine/index.ts`
- `supabase/migrations/20260403110010_c9ab9a50-e66a-4a26-8d13-3e3ab3902f23.sql`
- `supabase/migrations/20260403110751_e7e083e1-46e4-440e-a46f-840d9e368c64.sql`
- `supabase/migrations/20260403184426_736fd65b-d84a-4f85-ac2e-ecaf018ba617.sql`
- `supabase/migrations/20260422202021_d5f5a68d-778f-4f72-9c1e-9bdf9366b87f.sql`
- `supabase/migrations/20260422202642_9410556c-61fb-4602-976b-7856c033c13d.sql`
- `supabase/migrations/20260422203255_3b2aeb56-1914-4579-8d43-456aecec6dc6.sql`
- `supabase/migrations/20260423120419_d02ef035-594f-4c5b-91c8-a1d7606f1e38.sql`
- `supabase/migrations/20260423122818_177d2fb9-ab92-4aab-95c5-d80311308880.sql`
- `supabase/migrations/20260423125436_5dd91c24-c703-44bf-b049-32160029463e.sql`
- `supabase/migrations/20260423133137_5b637dfd-6a96-4239-a9a4-3a3711f01978.sql`
- `supabase/migrations/20260423150157_f57a14b6-3393-4672-abab-d38ffa1decb5.sql`
- `supabase/migrations/20260513143000_feature_flags_reconcile_para_flag_key.sql`
- `supabase/migrations/20260513164237_24ec468e-ca67-40db-a840-89690b09ca42.sql`
- `supabase/migrations/20260514211421_9d99a881-4a49-4c7b-94d9-11ff8b66f4c9.sql`
- `supabase/migrations/20260514211452_c31dffa4-ed7a-43fb-9896-a20421da8146.sql`
- `supabase/migrations/20260514211542_982362c3-0081-4604-a462-df6dc5649999.sql`
- `supabase/migrations/20260514211919_096ed609-61bf-4adc-a549-2931a1b631a7.sql`
- `supabase/migrations/20260521103730_7cf08e42-fb4b-4834-b09a-870cbbb23c6b.sql`
- `supabase/migrations/20260711153051_650d9a36-dbaf-4eb1-bef0-39d6d56d94d1.sql`
- `supabase/migrations/20260711164350_a039d6a7-9068-401a-b17e-eed3d3f33a10.sql`
- `supabase/migrations/20260711164411_5d966de7-799d-42df-932e-2d578b861a7e.sql`
- `supabase/migrations/20260711174027_42346d35-19a8-464a-a5ee-16dfa967d334.sql`
- `supabase/migrations/20260711174405_36f70b09-66dc-4d24-9239-c257fe089ffa.sql`
- `supabase/migrations/20260711175945_67e29e04-fe5c-4289-b936-b748b112dae5.sql`
- `supabase/migrations/20260711182448_78ef4fa7-e466-45a0-a375-8906c868d031.sql`
- `supabase/migrations/20260711182609_359679b5-9ff3-4263-abe3-752986dea8b8.sql`
- `supabase/migrations/20260712112638_42e21fe1-53f4-4a40-98e2-d60931b3ab61.sql`
- `supabase/migrations/20260712112725_a7208c18-129a-485e-850f-04d94000de8b.sql`
- `supabase/migrations/20260712112941_b8b623ce-a575-4757-98d5-1422d1ac9c66.sql`
- `supabase/migrations/20260712183806_e5a47f1b-5acb-4925-8862-6b201a553e15.sql`
- `supabase/migrations/20260712184225_7a9e67f2-f6a7-4329-8476-0981fdab6bfb.sql`
- `supabase/migrations/20260712184705_499e82f4-33c4-443a-82b6-21735caafc4b.sql`
- `supabase/migrations/20260712185444_c1c9c166-656a-49ca-8a1d-67dee4fddea0.sql`
- `supabase/migrations/20260712192158_582dac30-4c90-451a-88ff-99ea40438c03.sql`
- `supabase/migrations/20260712192505_fabf24d3-3e91-43d9-8eb4-da7c7ba504e0.sql`
- `supabase/migrations/20260712193650_6a6d3b0a-39c4-4681-8273-82b2c2880329.sql`
- `supabase/migrations/20260712194532_9abe125d-6680-4fc4-a970-6b38016ca698.sql`
- `supabase/migrations/20260712195044_12db549b-7825-4961-a631-6d62b64c4e79.sql`
- `supabase/migrations/20260712195304_af0be010-9de3-4b89-a80b-ca8cd03fb754.sql`
- `supabase/migrations/20260712195509_f5608513-95f0-4f4d-8157-5e5da2e7326e.sql`
- `supabase/migrations/20260712195625_958a9a6c-29bf-4cb9-9188-cb2258d8656c.sql`
- `supabase/migrations/20260712200213_b4344f28-90cf-4c1a-bdb9-2b6fdf0bc489.sql`
- `supabase/migrations/20260712215946_4665e0be-701c-41fa-b424-ee36ac565a53.sql`
- `supabase/migrations/20260712220335_611599d7-cb37-4d2a-b6b3-cf3e8d92954f.sql`
- `supabase/migrations/20260712220610_e12037cd-584f-4f4f-9904-cc6ee392c473.sql`
- `supabase/migrations/20260712220855_4ed03020-3c5a-4753-b895-59fc25ee7447.sql`
- `supabase/migrations/20260712221625_13d2f127-8db7-43a0-81e5-c877ce412a30.sql`
- `supabase/migrations/20260713105447_ce775607-1a01-4760-94c5-0981af8ba71f.sql`
- `supabase/migrations/20260715110637_3b3c9da2-985e-4da4-82bf-37c8c8fc1b1d.sql`
- `supabase/migrations/20260715135053_8bd5f8d2-3d61-4cc7-9fb0-b59a874192f5.sql`
- `supabase/migrations/20260715150000_lusha_credit_usage_log_redeclara.sql`
- `supabase/migrations/20260715164000_search_sessions_redeclara.sql`
- `supabase/migrations/20260715170247_637d3fdc-8e6d-4d53-adc7-3921479e5413.sql`
- `supabase/migrations/20260715170326_8df3cb34-aee7-4980-903a-e98875f35c75.sql`
- `supabase/migrations/20260715170411_d78dbcae-7de5-419d-8e89-a88f64ad3211.sql`
- `supabase/migrations/20260715170429_60ef5195-eadf-4adc-843a-f23012c9aa3a.sql`
- `supabase/migrations/20260715182138_2a0b5d35-f32a-4c13-9ab6-a39dc35c42bc.sql`
- `supabase/migrations/20260715190111_34d421ca-d6a1-4754-ad88-4566225925c9.sql`
- `supabase/migrations/20260715203137_54228599-d263-451d-953e-efa5710f18d7.sql`
- `supabase/migrations/20260718140500_b2e1d3c4-9f6a-4b7c-8d2e-1a3f5c7b9e0f.sql`
- `supabase/migrations/20260721083823_A1-assert-service-or-admin-guard.sql`
- `supabase/migrations/20260721084800_A3A4-extensions-audit-partial-indexes.sql`
- `supabase/migrations/20260721153915_e8a116a4-b2cd-4487-8ec1-a4c063177193.sql`
- `supabase/migrations/20260721154002_b5764fd0-5b2a-4bc4-97d1-7cf2a35dd170.sql`
- `supabase/migrations/20260721160013_fa8d923f-e212-499f-b404-5c6679ef0510.sql`
- `supabase/migrations/20260721160317_0ec1e345-b66a-44eb-aca3-e7a8fc7a931e.sql`
- `supabase/migrations/20260721165045_6f6a09bf-e24c-45b7-934e-ea11eccdbb0a.sql`
- `supabase/migrations/20260721173318_793c82ac-697e-441f-8ec6-774c564bcad5.sql`
- `supabase/migrations/20260721202447_89e985ca-54bf-4b99-820b-fd8f8622ee5c.sql`
- `supabase/migrations/20260721204338_c3449eb5-c14f-4f87-a0ef-49debf3d12bf.sql`
- `supabase/migrations/20260721223228_9f320c24-b3f3-4067-9e70-b9924824f7c9.sql`
- `supabase/migrations/20260721224926_272e3afc-5f57-4804-89b2-f246c4a8f56b.sql`
- `supabase/migrations/20260721225534_28c2ba63-b892-4c2a-bcbb-a4b31f0423de.sql`
- `supabase/migrations/20260721225851_96d1133c-350c-4bd1-be9c-96de97456af1.sql`
- `supabase/migrations/20260721225949_e0ca6ffa-efa2-4bd0-a116-c6425eb821cd.sql`
- `supabase/migrations/20260721230244_719383a4-5877-4561-a2f0-368eb1ce49be.sql`
- `supabase/migrations/20260721230311_59215542-a0b3-4468-b60a-b80b411a334f.sql`
- `supabase/migrations/20260722104240_34cd0552-a1fd-43e1-98fd-6aa0eb140c35.sql`
- `supabase/migrations/20260722111704_d767ae92-d4c9-4722-b181-a07f63a8954d.sql`
- `supabase/migrations/20260722113909_9c22ae79-0880-44a3-b424-02e5fb532d96.sql`
- `supabase/migrations/20260722114256_52e41091-6d26-4aac-b35a-9a38958ee119.sql`
- `supabase/migrations/20260722115903_e036397e-e483-46f6-8d8d-00fc632767e0.sql`
- `supabase/migrations/20260722123959_e7c39e43-b1a2-4861-a445-6343f477981a.sql`
- `supabase/migrations/20260722124907_fd724c3f-8336-49ef-94e6-e6169bfdff71.sql`
- `supabase/migrations/20260723105701_8063c052-209d-42e5-a34b-bd3c0f8427a5.sql`
- … +20 (lista completa em `context.json`)

## Funções SQL `SECURITY DEFINER` (rodam com privilégio do dono, ignoram RLS)

- `accept_org_invite`
- `advance_recipient_step`
- `api_latency_percentiles`
- `api_latency_stats`
- `api_latency_trend`
- `apollo_cache_get`
- `apollo_cache_put`
- `apollo_rate_consume`
- `apollo_rate_disable`
- `apply_retry_advisory`
- `apply_sla_recommendation`
- `assert_service_or_admin`
- `auto_tune_queue_slas`
- `campaign_ab_stats`
- `capture_api_latency_snapshots`
- `capture_circuit_breaker_snapshots`
- `capture_db_health_snapshot`
- `capture_dlq_health_snapshots`
- `capture_sla_snapshot`
- `capture_web_dlq_health_snapshots`
- `check_oracle_rate_limit`
- `claim_instagram_job`
- `claim_instagram_tasks`
- `claim_scrape_tasks`
- `claim_web_scrape_tasks`
- `cnpj_claim_enrich_jobs`
- `cnpj_reserve_rate_slot`
- `complete_scrape_task`
- `complete_web_scrape_task`
- `count_recent_org_violations`
- `create_default_deal_stages`
- `decide_ab_winner`
- `default_org_for_current_user`
- `default_sla_seconds`
- `defer_scrape_task`
- `defer_web_scrape_task`
- `dlq_health_metrics`
- `dlq_health_trend`
- `dlq_purge_stale_network_errors`
- `dlq_top_reasons`
- `enqueue_scrape_task`
- `enqueue_webhook_event`
- `evaluate_api_latency_alerts`
- `evaluate_circuit_breaker_alerts`
- `evaluate_dlq_alerts`
- `evaluate_org_violation_alerts`
- `evaluate_partition_policies`
- `evaluate_vault_cookie_alerts`
- `fail_scrape_task`
- `fail_web_scrape_task`
- `fn_web_scrape_regression_check`
- `get_dashboard_stats`
- `get_sector_summary`
- `handle_new_organization`
- `handle_new_user`
- `has_org_role`
- `has_role`
- `is_org_member`
- `is_service_role`
- `log_audit_event`
- `log_automation_event`
- `log_deal_stage_change`
- `log_queue_sla_change`
- `notify_on_enrichment`
- `notify_on_workflow_complete`
- `pg_catalog_rls_tables`
- `pg_columns_for_insert`
- `pg_net_health`
- `pg_net_watchdog_should_notify`
- `pg_net_watchdog_try_lock`
- `prevent_user_id_change`
- `prune_api_latency_snapshots`
- `prune_api_request_logs`
- `prune_audit_logs`
- `prune_auth_rate_limits`
- `prune_automation_execution_logs`
- `prune_campaign_events`
- `prune_dlq_health_snapshots`
- `prune_email_sync_log`
- `prune_pg_net_health_snapshots`
- `purge_dead_letter`
- `purge_soft_deleted`
- `reap_stuck_queue_tasks`
- `record_campaign_event`
- `record_campaign_reply`
- `record_places_api_call`
- `record_vault_cookie_snapshots`
- `replay_dead_letter`
- `replay_dead_letter_batch`
- `replay_instagram_dead_letter_batch`
- `replay_web_dead_letter_batch`
- `reset_circuit_breaker`
- `rollback_retry_advisory`
- `sla_autotune_blocked_streaks`
- `sla_compliance_stats`
- `sla_recommendations`
- `sync_suppression_from_recipient`
- `system_recovery_health`
- `touch_api_key`
- `verify_api_key`
- `web_dlq_health_metrics`
- `worker_report_batch`
- `worker_should_run`

## Edge functions públicas (sem JWT — qualquer um chama)

- `qa-ingest-run`
- `admin-list-companies`
- `migrate-helper`

## Rotas protegidas no front

| Rota | Guard | Roles | Arquivo |
|---|---|---|---|
| / | ProtectedRoute |  | `src/App.tsx` |
| /admin/companies | ProtectedRoute |  | `src/App.tsx` |
| /app | ProtectedRoute |  | `scripts/ai-context/gerar.unit.mjs` |
| /login | PublicRoute |  | `src/App.tsx` |
| /monitoring | ProtectedRoute |  | `src/App.tsx` |
| /settings/cnpj | ProtectedRoute |  | `src/App.tsx` |

Guards usados: Protected, ProtectedRoute, PublicRoute

Middleware matcher (Next.js): nenhum

## Grants / Revokes (agrupados por role e privilégio)

| Ação | Para/De | Privilégios | Objetos |
|---|---|---|---|
| grant | authenticated | execute | `get_sector_summary`, `get_dashboard_stats`, `campaign_ab_stats`, `decide_ab_winner`, `accept_org_invite`, `get_dashboard_stats`, `get_sector_summary`, `campaign_ab_stats`, `create_default_deal_stages`, `pg_catalog_rls_tables`, `pg_columns_for_insert`, `evaluate_partition_policies`, `log_automation_event`, `replay_dead_letter_batch`, `reset_circuit_breaker` … +31 |
| grant | authenticated | select | `db_health_snapshots`, `scrape_queue`, `scrape_dead_letter`, `dlq_health_snapshots`, `dlq_alert_history`, `api_latency_snapshots`, `api_latency_alert_history`, `lusha_credit_usage_log`, `lusha_credit_usage_log`, `oracle_rate_limits`, `oracle_v2_health`, `circuit_breaker_snapshots`, `circuit_breaker_alert_settings`, `circuit_breaker_alert_history`, `vault_cookie_snapshots` … +22 |
| grant | authenticated | select, insert | `automation_execution_logs`, `instagram_scrape_results`, `cnpj_enrich_queue` |
| grant | authenticated | select, insert, update, delete | `email_suppressions`, `partition_policies`, `partition_advisories`, `dlq_alert_settings`, `api_latency_alert_settings`, `lusha_dm_search_history`, `lusha_contacts`, `lusha_search_sessions`, `org_scrape_rate_limits`, `company_reviews`, `org_proxies`, `instagram_scrape_queue`, `sla_alert_settings` |
| grant | authenticated | select, update | `retry_policy_advisories`, `reaper_alert_settings` |
| grant | authenticated, service_role | execute | `pg_columns_for_insert`, `decide_ab_winner`, `has_role`, `has_org_role`, `is_org_member`, `default_org_for_current_user`, `capture_db_health_snapshot`, `enqueue_scrape_task`, `replay_dead_letter`, `purge_dead_letter`, `dlq_health_metrics`, `api_latency_stats`, `api_latency_trend`, `capture_circuit_breaker_snapshots`, `evaluate_circuit_breaker_alerts` … +8 |
| grant | authenticated, service_role | select | `oracle_v2_health`, `v_sec_definer_anon_grants`, `v_extensions_audit` |
| grant | authenticated, service_role, anon | execute | `default_sla_seconds` |
| grant | service_role | all | `email_suppressions`, `db_health_snapshots`, `scrape_queue`, `scrape_dead_letter`, `partition_policies`, `partition_advisories`, `automation_execution_logs`, `dlq_health_snapshots`, `dlq_alert_settings`, `dlq_alert_history`, `api_latency_snapshots`, `api_latency_alert_settings`, `api_latency_alert_history`, `lusha_dm_search_history`, `lusha_contacts` … +39 |
| grant | service_role | execute | `pg_catalog_rls_tables`, `get_sector_summary`, `purge_soft_deleted`, `advance_recipient_step`, `advance_recipient_step`, `campaign_ab_stats`, `decide_ab_winner`, `enqueue_webhook_event`, `evaluate_org_violation_alerts`, `advance_recipient_step`, `count_recent_org_violations`, `create_default_deal_stages`, `pg_catalog_rls_tables`, `pg_columns_for_insert`, `prune_auth_rate_limits` … +82 |
| grant | service_role | select | `oracle_v2_health` |
| revoke | PUBLIC | all | `capture_db_health_snapshot`, `enqueue_scrape_task`, `claim_scrape_tasks`, `complete_scrape_task`, `fail_scrape_task`, `replay_dead_letter`, `evaluate_partition_policies`, `log_automation_event`, `reset_circuit_breaker`, `capture_circuit_breaker_snapshots`, `evaluate_circuit_breaker_alerts`, `record_vault_cookie_snapshots`, `evaluate_vault_cookie_alerts`, `claim_instagram_tasks`, `replay_instagram_dead_letter_batch` … +8 |
| revoke | PUBLIC | execute | `get_sector_summary`, `get_dashboard_stats`, `enqueue_webhook_event`, `handle_new_organization`, `handle_new_user`, `log_audit_event`, `log_deal_stage_change`, `notify_on_enrichment`, `notify_on_workflow_complete`, `prevent_user_id_change`, `process_audit_log`, `sync_suppression_from_recipient`, `advance_recipient_step`, `count_recent_org_violations`, `create_default_deal_stages` … +20 |
| revoke | PUBLIC, anon | all | `replay_dead_letter_batch`, `purge_dead_letter`, `dlq_health_metrics`, `api_latency_trend`, `capture_api_latency_snapshots`, `evaluate_api_latency_alerts`, `prune_api_latency_snapshots`, `worker_should_run`, `worker_report_batch`, `dlq_top_reasons`, `api_latency_percentiles`, `apply_retry_advisory`, `rollback_retry_advisory`, `enrichment_funnel_counts`, `sla_deadline` … +1 |
| revoke | PUBLIC, anon | execute | `get_sector_summary` |
| revoke | PUBLIC, anon, authenticated | all | `pg_catalog_rls_tables`, `defer_scrape_task`, `dlq_purge_stale_network_errors`, `record_places_api_call`, `claim_web_scrape_tasks`, `complete_web_scrape_task`, `fail_web_scrape_task`, `defer_web_scrape_task`, `prune_api_request_logs`, `prune_audit_logs`, `prune_automation_execution_logs`, `prune_campaign_events`, `prune_email_sync_log`, `worker_report_batch`, `worker_should_run` … +7 |
| revoke | PUBLIC, anon, authenticated | execute | `purge_soft_deleted`, `advance_recipient_step`, `decide_ab_winner`, `replay_web_dead_letter_batch`, `web_dlq_health_metrics`, `api_latency_percentiles`, `dlq_top_reasons`, `prune_pg_net_health_snapshots`, `pg_net_watchdog_should_notify`, `pg_net_watchdog_try_lock`, `system_recovery_health` |
| revoke | PUBLIC, authenticated, anon | execute | `check_oracle_rate_limit` |
| revoke | anon | all | `v_sec_definer_anon_grants`, `v_extensions_audit`, `replay_instagram_dead_letter_batch` |
| revoke | anon | execute | `get_dashboard_stats`, `accept_org_invite`, `get_dashboard_stats`, `get_sector_summary`, `campaign_ab_stats`, `decide_ab_winner`, `has_role`, `has_org_role`, `is_org_member`, `default_org_for_current_user`, `api_latency_stats`, `reset_circuit_breaker`, `evaluate_partition_policies`, `enqueue_scrape_task`, `replay_dead_letter` … +5 |
| revoke | anon, authenticated | execute | `enqueue_webhook_event`, `evaluate_org_violation_alerts`, `handle_new_organization`, `handle_new_user`, `log_audit_event`, `log_deal_stage_change`, `notify_on_enrichment`, `notify_on_workflow_complete`, `prevent_user_id_change`, `process_audit_log`, `sync_suppression_from_recipient`, `advance_recipient_step`, `count_recent_org_violations`, `create_default_deal_stages`, `pg_catalog_rls_tables` … +14 |
| revoke | anon, authenticated, PUBLIC | execute | `public` |
| revoke | authenticated | all | `replay_instagram_dead_letter_batch` |
| revoke | authenticated | execute | `pg_columns_for_insert`, `pg_catalog_rls_tables`, `evaluate_org_violation_alerts`, `assert_service_or_admin` |
| revoke | public | all | `cnpj_reserve_rate_slot`, `cnpj_claim_enrich_jobs`, `apply_sla_recommendation`, `auto_tune_queue_slas`, `log_queue_sla_change`, `auto_tune_queue_slas` |
| revoke | public, anon, authenticated | all | `update_updated_at_column`, `handle_updated_at`, `update_automation_steps_updated_at`, `increment_version`, `validate_ipc_score`, `normalize_suppression_email`, `cleanup_old_idempotency_keys`, `handle_new_organization`, `handle_new_user`, `enqueue_webhook_event`, `log_audit_event`, `process_audit_log`, `notify_on_workflow_complete`, `notify_on_enrichment`, `prevent_user_id_change` … +11 |

## Riscos de acesso detectados

| Tabela | Problema | Arquivos |
|---|---|---|
| `retry_policy_advisories` | front faz UPDATE mas nenhuma política RLS permite UPDATE → vai falhar/retornar vazio para usuários | `src/components/lux/monitoring/RetryPolicyAdvisoriesPanel.tsx` |

## Multi-tenancy

- Chave de tenant: **`organization_id`** presente em 66 tabela(s): `companies`, `scrape_jobs`, `scrape_results`, `ipc_config`, `workflows`, `workflow_runs`, `stakeholders`, `notifications`, `intent_signals`, `campaigns`, `agent_chat_messages`, `organization_members`, `organization_invites`, `audit_logs`, `deal_stages`, `deals`, `deal_activities`, `deal_tasks`, `api_keys`, `webhooks`, `webhook_deliveries`, `campaign_recipients`, `campaign_events`, `email_accounts`, `campaign_messages`, `campaign_replies`, `api_request_logs`, `email_sync_log`, `oauth_sandbox_snapshots`, `org_violation_alert_settings`, `org_violation_alerts`, `idempotency_keys`, `feature_flags`, `automation_alerts`, `job_exports`, `automation_steps`, `email_suppressions`, `scrape_queue`, `scrape_dead_letter`, `automation_execution_logs`, `dlq_health_snapshots`, `dlq_alert_settings`, `dlq_alert_history`, `api_latency_snapshots`, `api_latency_alert_settings`, `api_latency_alert_history`, `lusha_dm_search_history`, `lusha_contacts`, `lusha_credit_usage_log`, `lusha_search_sessions`, `oracle_rate_limits`, `org_scrape_rate_limits`, `company_reviews`, `org_proxies`, `places_api_usage`, `retry_policy_advisories`, `org_retry_policies`, `web_scrape_queue`, `web_scrape_results`, `web_scrape_dead_letter`, `instagram_scrape_queue`, `instagram_scrape_results`, `instagram_scrape_dead_letter`, `oracle_v2_health`, `v_lusha_cache_stats`, `v_lux_enrichment_health`
- Cobertura: 67% das tabelas. Tabelas SEM a chave (verificar isolamento): `health_checks`, `circuit_breakers`, `auth_rate_limits`, `db_health_snapshots`, `partition_policies`, `partition_advisories`, `circuit_breaker_snapshots`, `circuit_breaker_alert_history`, `vault_cookie_snapshots`, `vault_cookie_alert_history`, `scrape_worker_state`, `robots_cache`, `pg_net_health_snapshots`, `qa_test_runs`, `qa_reaper_runs`, `reaper_alert_history`, `sla_alert_history`, `sla_snapshots`, `cnpj_enrich_cache`, `cnpj_enrich_rate_state`, `cnpj_enrich_queue`, `queue_sla_defaults`, `queue_sla_history`, `sla_autotune_runs`, `apollo_search_cache`, `apollo_rate_state`

## Soft delete (registros 'apagados' continuam na tabela — filtre!)

| Tabela | Coluna |
|---|---|
| `companies` | `deleted_at` |
| `ipc_config` | `is_active` |
| `workflows` | `deleted_at` |
| `campaigns` | `deleted_at` |
| `deals` | `deleted_at` |
| `api_keys` | `active` |
| `webhooks` | `active` |
| `email_accounts` | `active` |
| `automation_alerts` | `is_active` |
| `org_proxies` | `is_active` |

## Auditoria (colunas de rastreio)

| Tabela | Colunas |
|---|---|
| `companies` | `created_at`, `updated_at` |
| `scrape_jobs` | `created_at`, `updated_at` |
| `scrape_results` | `created_at` |
| `ipc_config` | `created_at`, `updated_at` |
| `workflows` | `created_at`, `updated_at` |
| `workflow_runs` | `created_at` |
| `stakeholders` | `created_at`, `updated_at` |
| `profiles` | `created_at`, `updated_at` |
| `notifications` | `created_at` |
| `intent_signals` | `created_at` |
| `campaigns` | `created_at`, `updated_at` |
| `agent_chat_messages` | `created_at` |
| `organizations` | `created_at`, `updated_at` |
| `organization_members` | `created_at` |
| `organization_invites` | `created_at`, `created_by` |
| `audit_logs` | `created_at` |
| `deal_stages` | `created_at`, `updated_at` |
| `deals` | `created_at`, `updated_at` |
| `deal_activities` | `created_at` |
| `deal_tasks` | `created_at`, `updated_at` |
| `api_keys` | `created_at` |
| `webhooks` | `created_at`, `updated_at` |
| `webhook_deliveries` | `created_at` |
| `campaign_recipients` | `created_at`, `updated_at` |
| `email_accounts` | `created_at`, `updated_at` |
| `campaign_messages` | `created_at` |
| `campaign_replies` | `created_at` |
| `api_request_logs` | `created_at` |
| `email_sync_log` | `created_at` |
| `oauth_sandbox_snapshots` | `created_at` |
| `org_violation_alert_settings` | `updated_at`, `updated_by` |
| `idempotency_keys` | `created_at` |
| `feature_flags` | `created_at`, `updated_at` |
| `auth_rate_limits` | `created_at`, `updated_at` |
| `automation_alerts` | `created_at`, `updated_at` |
| `job_exports` | `created_at` |
| `automation_steps` | `created_at`, `updated_at` |
| `email_suppressions` | `created_at`, `updated_at` |
| `scrape_queue` | `created_at`, `updated_at` |
| `scrape_dead_letter` | `created_at` |
| `partition_policies` | `created_at`, `updated_at` |
| `partition_advisories` | `created_at` |
| `automation_execution_logs` | `created_at` |
| `dlq_alert_settings` | `created_at`, `updated_at` |
| `api_latency_alert_settings` | `updated_at` |
| `api_latency_alert_history` | `created_at` |
| `lusha_dm_search_history` | `created_at`, `updated_at` |
| `lusha_contacts` | `created_at`, `updated_at` |
| `lusha_credit_usage_log` | `created_at` |
| `lusha_search_sessions` | `created_at`, `updated_at` |
| `oracle_rate_limits` | `created_at`, `updated_at` |
| `circuit_breaker_alert_settings` | `created_at`, `updated_at` |
| `scrape_worker_state` | `updated_at` |
| `org_scrape_rate_limits` | `created_at`, `updated_at` |
| `company_reviews` | `created_at` |
| `org_proxies` | `created_at`, `updated_at` |
| `places_api_usage` | `created_at`, `updated_at` |
| `retry_policy_advisories` | `created_at` |
| `org_retry_policies` | `updated_at`, `updated_by` |
| `web_scrape_queue` | `created_at`, `updated_at` |
| `web_scrape_results` | `created_at` |
| `web_scrape_dead_letter` | `created_at` |
| `pg_net_health_snapshots` | `created_at` |
| `instagram_scrape_queue` | `created_at`, `created_by`, `updated_at` |
| `instagram_scrape_results` | `created_at` |
| `instagram_scrape_dead_letter` | `created_at` |
| `qa_test_runs` | `created_at` |
| `reaper_alert_settings` | `created_at`, `updated_at` |
| `sla_alert_settings` | `created_at`, `updated_at` |
| `cnpj_enrich_rate_state` | `updated_at` |
| `cnpj_enrich_queue` | `created_at`, `updated_at` |
| `queue_sla_defaults` | `created_at`, `updated_at` |
| `queue_sla_history` | `created_at` |
| `sla_autotune_runs` | `created_at` |
| `apollo_rate_state` | `updated_at` |

## Dados pessoais / sensíveis (LGPD — cuidado em logs, exports, prompts de IA)

| Tabela | Coluna |
|---|---|
| `companies` | `phone` |
| `companies` | `email` |
| `companies` | `cnpj` |
| `companies` | `latitude` |
| `companies` | `longitude` |
| `stakeholders` | `email` |
| `stakeholders` | `phone` |
| `campaign_recipients` | `email` |
| `campaign_events` | `ip_address` |
| `email_accounts` | `email` |
| `api_request_logs` | `ip_address` |
| `email_suppressions` | `email` |
| `lusha_contacts` | `email` |
| `cnpj_enrich_cache` | `cnpj` |
| `cnpj_enrich_queue` | `cnpj` |

## Colunas de dinheiro (tipo importa: numeric ✅ / float ❌)

| Tabela | Coluna | Tipo |
|---|---|---|
| `companies` | `price_range` | `string` |
| `webhooks` | `total_sent` | `integer` |
| `webhooks` | `total_failed` | `integer` |
| `partition_advisories` | `total_bytes` | `bigint` |
| `dlq_health_snapshots` | `total_items` | `BIGINT` |
| `lusha_search_sessions` | `total_found` | `INTEGER` |
| `lusha_search_sessions` | `total_empty` | `INTEGER` |
| `lusha_search_sessions` | `total_errors` | `INTEGER` |
| `lusha_search_sessions` | `total_duplicates` | `INTEGER` |
| `lusha_search_sessions` | `total_enriched` | `INTEGER` |
| `lusha_search_sessions` | `total_inserted_bitrix` | `INTEGER` |
| `pg_net_health_snapshots` | `total_requests` | `BIGINT` |
| `v_lusha_cache_stats` | `total_contacts` | `number` |
| `v_lux_enrichment_health` | `total_api_calls` | `number` |
| `v_lux_enrichment_health` | `total_contacts` | `number` |
