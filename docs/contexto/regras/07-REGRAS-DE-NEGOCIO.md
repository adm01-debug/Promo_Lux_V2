# 07 · REGRAS DE NEGÓCIO

> Gerado automaticamente por AI Context Sync v1.3.2 · commit `5e3af794b5` · branch `main` · 2026-11-11 22:38 UTC
> Não edite à mão — regras humanas vão em `manual/`.

## A. Regras escritas por humanos (`manual/` — prioridade máxima, nunca sobrescrito)

_Nenhum arquivo em `manual/`. Copie `manual/TEMPLATE-regras-de-negocio.md` para `manual/regras.md` e preencha._

## B. Quem pode ver/alterar o quê (RLS — conforme migrations do repo; schema real em `06`)

| Tabela | Política | Comando | Roles | Modo | USING | WITH CHECK |
|---|---|---|---|---|---|---|
| `profiles` | Users can view own profile | SELECT | authenticated | permissive | `auth.uid() = id` |  |
| `profiles` | Users can update own profile | UPDATE | authenticated | permissive | `auth.uid() = id` |  |
| `profiles` | Users can insert own profile | INSERT | authenticated | permissive |  | `auth.uid() = id` |
| `companies` | Service can manage companies | ALL | service_role | permissive | `true` | `true` |
| `scrape_jobs` | Service can manage scrape_jobs | ALL | service_role | permissive | `true` | `true` |
| `workflows` | Service can manage workflows | ALL | service_role | permissive | `true` | `true` |
| `workflow_runs` | Service can manage workflow_runs | ALL | service_role | permissive | `true` | `true` |
| `campaigns` | Service can manage campaigns | ALL | service_role | permissive | `true` | `true` |
| `notifications` | Users can view own notifications | SELECT | authenticated | permissive | `user_id = auth.uid()` |  |
| `notifications` | Users can insert own notifications | INSERT | authenticated | permissive |  | `user_id = auth.uid()` |
| `notifications` | Users can update own notifications | UPDATE | authenticated | permissive | `user_id = auth.uid()` |  |
| `notifications` | Users can delete own notifications | DELETE | authenticated | permissive | `user_id = auth.uid()` |  |
| `notifications` | Service can manage notifications | ALL | service_role | permissive | `true` | `true` |
| `stakeholders` | Service can manage stakeholders | ALL | service_role | permissive | `true` | `true` |
| `scrape_results` | Service can manage scrape_results | ALL | service_role | permissive | `true` | `true` |
| `intent_signals` | Service can manage intent_signals | ALL | service_role | permissive | `true` | `true` |
| `ipc_config` | Service can manage ipc_config | ALL | service_role | permissive | `true` | `true` |
| `agent_chat_messages` | Users can read own messages | SELECT | authenticated | permissive | `user_id = auth.uid()` |  |
| `agent_chat_messages` | Users can insert own messages | INSERT | authenticated | permissive |  | `user_id = auth.uid()` |
| `agent_chat_messages` | Users can delete own messages | DELETE | authenticated | permissive | `user_id = auth.uid()` |  |
| `profiles` | Users can delete own profile | DELETE | authenticated | permissive | `id = auth.uid()` |  |
| `realtime.messages` | Users can only listen to own channels | SELECT | authenticated | permissive | `realtime.topic() = ('private:' \|\| auth.uid()::text)` |  |
| `organizations` | Members can view their organizations | SELECT | authenticated | permissive | `public.is_org_member(id, auth.uid())` |  |
| `organizations` | Authenticated users can create organizations | INSERT | authenticated | permissive |  | `owner_id = auth.uid()` |
| `organizations` | Admins can update organizations | UPDATE | authenticated | permissive | `public.has_org_role(id, auth.uid(), 'admin')` | `public.has_org_role(id, auth.uid(), 'admin')` |
| `organizations` | Owner can delete organization | DELETE | authenticated | permissive | `owner_id = auth.uid()` |  |
| `organization_members` | Members can view co-members | SELECT | authenticated | permissive | `public.is_org_member(organization_id, auth.uid())` |  |
| `organization_members` | Admins can add members | INSERT | authenticated | permissive |  | `public.has_org_role(organization_id, auth.uid(), 'admin')` |
| `organization_members` | Admins can update members | UPDATE | authenticated | permissive | `public.has_org_role(organization_id, auth.uid(), 'admin')` | `public.has_org_role(organization_id, auth.uid(), 'admin')` |
| `organization_members` | Admins can remove members or self leave | DELETE | authenticated | permissive | `public.has_org_role(organization_id, auth.uid(), 'admin') OR user_id = auth.uid()` |  |
| `organization_invites` | Members can view invites | SELECT | authenticated | permissive | `public.is_org_member(organization_id, auth.uid())` |  |
| `organization_invites` | Admins can create invites | INSERT | authenticated | permissive |  | `public.has_org_role(organization_id, auth.uid(), 'admin') AND created_by = auth.uid()` |
| `organization_invites` | Admins can revoke invites | UPDATE | authenticated | permissive | `public.has_org_role(organization_id, auth.uid(), 'admin')` | `public.has_org_role(organization_id, auth.uid(), 'admin')` |
| `organization_invites` | Admins can delete invites | DELETE | authenticated | permissive | `public.has_org_role(organization_id, auth.uid(), 'admin')` |  |
| `deals` | Service manage deals | ALL | service_role | permissive | `true` | `true` |
| `api_keys` | Service manage api_keys | ALL | service_role | permissive | `true` | `true` |
| `webhooks` | Service manage webhooks | ALL | service_role | permissive | `true` | `true` |
| `webhook_deliveries` | Service manage deliveries | ALL | service_role | permissive | `true` | `true` |
| `companies` | Members view companies | SELECT | authenticated | permissive | `public.is_org_member(organization_id, auth.uid())` |  |
| `companies` | SDR+ insert companies | INSERT | authenticated | permissive |  | `public.has_org_role(organization_id, auth.uid(), 'sdr')` |
| `companies` | SDR+ update companies | UPDATE | authenticated | permissive | `public.has_org_role(organization_id, auth.uid(), 'sdr')` | `public.has_org_role(organization_id, auth.uid(), 'sdr')` |
| `companies` | Admins delete companies | DELETE | authenticated | permissive | `public.has_org_role(organization_id, auth.uid(), 'admin')` |  |
| `stakeholders` | Members view stakeholders | SELECT | authenticated | permissive | `public.is_org_member(organization_id, auth.uid())` |  |
| `stakeholders` | SDR+ insert stakeholders | INSERT | authenticated | permissive |  | `public.has_org_role(organization_id, auth.uid(), 'sdr')` |
| `stakeholders` | SDR+ update stakeholders | UPDATE | authenticated | permissive | `public.has_org_role(organization_id, auth.uid(), 'sdr')` | `public.has_org_role(organization_id, auth.uid(), 'sdr')` |
| `stakeholders` | Admins delete stakeholders | DELETE | authenticated | permissive | `public.has_org_role(organization_id, auth.uid(), 'admin')` |  |
| `deals` | Members view deals | SELECT | authenticated | permissive | `public.is_org_member(organization_id, auth.uid())` |  |
| `deals` | SDR+ insert deals | INSERT | authenticated | permissive |  | `public.has_org_role(organization_id, auth.uid(), 'sdr')` |
| `deals` | SDR+ update deals | UPDATE | authenticated | permissive | `public.has_org_role(organization_id, auth.uid(), 'sdr')` | `public.has_org_role(organization_id, auth.uid(), 'sdr')` |
| `deals` | Admins delete deals | DELETE | authenticated | permissive | `public.has_org_role(organization_id, auth.uid(), 'admin')` |  |
| `deal_stages` | Members view deal_stages | SELECT | authenticated | permissive | `public.is_org_member(organization_id, auth.uid())` |  |
| `deal_stages` | Admins manage deal_stages insert | INSERT | authenticated | permissive |  | `public.has_org_role(organization_id, auth.uid(), 'admin')` |
| `deal_stages` | Admins manage deal_stages update | UPDATE | authenticated | permissive | `public.has_org_role(organization_id, auth.uid(), 'admin')` | `public.has_org_role(organization_id, auth.uid(), 'admin')` |
| `deal_stages` | Admins delete deal_stages | DELETE | authenticated | permissive | `public.has_org_role(organization_id, auth.uid(), 'admin')` |  |
| `deal_activities` | Members view deal_activities | SELECT | authenticated | permissive | `public.is_org_member(organization_id, auth.uid())` |  |
| `deal_activities` | SDR+ insert deal_activities | INSERT | authenticated | permissive |  | `public.has_org_role(organization_id, auth.uid(), 'sdr')` |
| `deal_activities` | SDR+ update deal_activities | UPDATE | authenticated | permissive | `public.has_org_role(organization_id, auth.uid(), 'sdr')` | `public.has_org_role(organization_id, auth.uid(), 'sdr')` |
| `deal_activities` | Admins delete deal_activities | DELETE | authenticated | permissive | `public.has_org_role(organization_id, auth.uid(), 'admin')` |  |
| `deal_tasks` | Members view deal_tasks | SELECT | authenticated | permissive | `public.is_org_member(organization_id, auth.uid())` |  |
| `deal_tasks` | SDR+ insert deal_tasks | INSERT | authenticated | permissive |  | `public.has_org_role(organization_id, auth.uid(), 'sdr')` |
| `deal_tasks` | SDR+ update deal_tasks | UPDATE | authenticated | permissive | `public.has_org_role(organization_id, auth.uid(), 'sdr')` | `public.has_org_role(organization_id, auth.uid(), 'sdr')` |
| `deal_tasks` | Admins delete deal_tasks | DELETE | authenticated | permissive | `public.has_org_role(organization_id, auth.uid(), 'admin')` |  |
| `campaigns` | Members view campaigns | SELECT | authenticated | permissive | `public.is_org_member(organization_id, auth.uid())` |  |
| `campaigns` | SDR+ insert campaigns | INSERT | authenticated | permissive |  | `public.has_org_role(organization_id, auth.uid(), 'sdr')` |
| `campaigns` | SDR+ update campaigns | UPDATE | authenticated | permissive | `public.has_org_role(organization_id, auth.uid(), 'sdr')` | `public.has_org_role(organization_id, auth.uid(), 'sdr')` |
| `campaigns` | Admins delete campaigns | DELETE | authenticated | permissive | `public.has_org_role(organization_id, auth.uid(), 'admin')` |  |
| `workflows` | Members view workflows | SELECT | authenticated | permissive | `public.is_org_member(organization_id, auth.uid())` |  |
| `workflows` | SDR+ insert workflows | INSERT | authenticated | permissive |  | `public.has_org_role(organization_id, auth.uid(), 'sdr')` |
| `workflows` | SDR+ update workflows | UPDATE | authenticated | permissive | `public.has_org_role(organization_id, auth.uid(), 'sdr')` | `public.has_org_role(organization_id, auth.uid(), 'sdr')` |
| `workflows` | Admins delete workflows | DELETE | authenticated | permissive | `public.has_org_role(organization_id, auth.uid(), 'admin')` |  |
| `workflow_runs` | Members view workflow_runs | SELECT | authenticated | permissive | `public.is_org_member(organization_id, auth.uid())` |  |
| `workflow_runs` | SDR+ insert workflow_runs | INSERT | authenticated | permissive |  | `public.has_org_role(organization_id, auth.uid(), 'sdr')` |
| `workflow_runs` | SDR+ update workflow_runs | UPDATE | authenticated | permissive | `public.has_org_role(organization_id, auth.uid(), 'sdr')` | `public.has_org_role(organization_id, auth.uid(), 'sdr')` |
| `workflow_runs` | Admins delete workflow_runs | DELETE | authenticated | permissive | `public.has_org_role(organization_id, auth.uid(), 'admin')` |  |
| `scrape_jobs` | Members view scrape_jobs | SELECT | authenticated | permissive | `public.is_org_member(organization_id, auth.uid())` |  |
| `scrape_jobs` | SDR+ insert scrape_jobs | INSERT | authenticated | permissive |  | `public.has_org_role(organization_id, auth.uid(), 'sdr')` |
| `scrape_jobs` | SDR+ update scrape_jobs | UPDATE | authenticated | permissive | `public.has_org_role(organization_id, auth.uid(), 'sdr')` | `public.has_org_role(organization_id, auth.uid(), 'sdr')` |
| `scrape_jobs` | Admins delete scrape_jobs | DELETE | authenticated | permissive | `public.has_org_role(organization_id, auth.uid(), 'admin')` |  |
| `scrape_results` | Members view scrape_results | SELECT | authenticated | permissive | `public.is_org_member(organization_id, auth.uid())` |  |
| `scrape_results` | Members insert scrape_results | INSERT | authenticated | permissive |  | `public.is_org_member(organization_id, auth.uid())` |
| `scrape_results` | SDR+ update scrape_results | UPDATE | authenticated | permissive | `public.has_org_role(organization_id, auth.uid(), 'sdr')` | `public.has_org_role(organization_id, auth.uid(), 'sdr')` |
| `scrape_results` | Admins delete scrape_results | DELETE | authenticated | permissive | `public.has_org_role(organization_id, auth.uid(), 'admin')` |  |
| `intent_signals` | Members view intent_signals | SELECT | authenticated | permissive | `public.is_org_member(organization_id, auth.uid())` |  |
| `intent_signals` | SDR+ insert intent_signals | INSERT | authenticated | permissive |  | `public.has_org_role(organization_id, auth.uid(), 'sdr')` |
| `intent_signals` | SDR+ update intent_signals | UPDATE | authenticated | permissive | `public.has_org_role(organization_id, auth.uid(), 'sdr')` | `public.has_org_role(organization_id, auth.uid(), 'sdr')` |
| `intent_signals` | Admins delete intent_signals | DELETE | authenticated | permissive | `public.has_org_role(organization_id, auth.uid(), 'admin')` |  |
| `ipc_config` | Members view ipc_config | SELECT | authenticated | permissive | `public.is_org_member(organization_id, auth.uid())` |  |
| `ipc_config` | Admins manage ipc_config insert | INSERT | authenticated | permissive |  | `public.has_org_role(organization_id, auth.uid(), 'admin')` |
| `ipc_config` | Admins manage ipc_config update | UPDATE | authenticated | permissive | `public.has_org_role(organization_id, auth.uid(), 'admin')` | `public.has_org_role(organization_id, auth.uid(), 'admin')` |
| `ipc_config` | Admins delete ipc_config | DELETE | authenticated | permissive | `public.has_org_role(organization_id, auth.uid(), 'admin')` |  |
| `api_keys` | Admins view api_keys | SELECT | authenticated | permissive | `public.has_org_role(organization_id, auth.uid(), 'admin')` |  |
| `api_keys` | Admins insert api_keys | INSERT | authenticated | permissive |  | `public.has_org_role(organization_id, auth.uid(), 'admin')` |
| `api_keys` | Admins update api_keys | UPDATE | authenticated | permissive | `public.has_org_role(organization_id, auth.uid(), 'admin')` | `public.has_org_role(organization_id, auth.uid(), 'admin')` |
| `api_keys` | Admins delete api_keys | DELETE | authenticated | permissive | `public.has_org_role(organization_id, auth.uid(), 'admin')` |  |
| `webhooks` | Admins view webhooks | SELECT | authenticated | permissive | `public.has_org_role(organization_id, auth.uid(), 'admin')` |  |
| `webhooks` | Admins insert webhooks | INSERT | authenticated | permissive |  | `public.has_org_role(organization_id, auth.uid(), 'admin')` |
| `webhooks` | Admins update webhooks | UPDATE | authenticated | permissive | `public.has_org_role(organization_id, auth.uid(), 'admin')` | `public.has_org_role(organization_id, auth.uid(), 'admin')` |
| `webhooks` | Admins delete webhooks | DELETE | authenticated | permissive | `public.has_org_role(organization_id, auth.uid(), 'admin')` |  |
| `webhook_deliveries` | Admins view deliveries | SELECT | authenticated | permissive | `public.has_org_role(organization_id, auth.uid(), 'admin')` |  |
| `audit_logs` | Admins view org audit logs | SELECT | authenticated | permissive | `organization_id IS NOT NULL AND public.has_org_role(organization_id, auth.uid(), 'admin')` |  |
| `campaign_recipients` | Org members view recipients | SELECT | authenticated | permissive | `public.is_org_member(organization_id, auth.uid())` |  |
| `campaign_recipients` | SDR+ insert recipients | INSERT | authenticated | permissive |  | `public.has_org_role(organization_id, auth.uid(), 'sdr')` |
| `campaign_recipients` | SDR+ update recipients | UPDATE | authenticated | permissive | `public.has_org_role(organization_id, auth.uid(), 'sdr')` | `public.has_org_role(organization_id, auth.uid(), 'sdr')` |
| `campaign_recipients` | Admin delete recipients | DELETE | authenticated | permissive | `public.has_org_role(organization_id, auth.uid(), 'admin')` |  |
| `campaign_events` | Org members view events | SELECT | authenticated | permissive | `public.is_org_member(organization_id, auth.uid())` |  |
| `campaign_messages` | Org members view messages | SELECT | authenticated | permissive | `public.is_org_member(organization_id, auth.uid())` |  |
| `campaign_messages` | SDR+ insert messages | INSERT | authenticated | permissive |  | `public.has_org_role(organization_id, auth.uid(), 'sdr')` |
| `campaign_messages` | Admin delete messages | DELETE | authenticated | permissive | `public.has_org_role(organization_id, auth.uid(), 'admin')` |  |
| `campaign_replies` | Org members view replies | SELECT | authenticated | permissive | `public.is_org_member(organization_id, auth.uid())` |  |
| `api_request_logs` | Admins view org api_request_logs | SELECT | authenticated | permissive | `organization_id IS NOT NULL AND public.has_org_role(organization_id, auth.uid(), 'admin'::app_role)` |  |
| `api_request_logs` | Service manage api_request_logs | ALL | service_role | permissive | `true` | `true` |
| `email_accounts` | View own or shared email accounts | SELECT | authenticated | permissive | `(scope_type = 'user' AND user_id = auth.uid()) OR (scope_type = 'organization' AND public.is_org_member(organization_id, auth.uid()))` |  |
| `email_accounts` | Insert email accounts by scope | INSERT | authenticated | permissive |  | `(scope_type = 'user' AND user_id = auth.uid()) OR (scope_type = 'organization' AND public.has_org_role(organization_id, auth.uid(), 'admin'::public.app_role))` |
| `email_accounts` | Update email accounts by scope | UPDATE | authenticated | permissive | `(scope_type = 'user' AND user_id = auth.uid()) OR (scope_type = 'organization' AND public.has_org_role(organization_id, auth.uid(), 'admin'::public.app_role))` | `(scope_type = 'user' AND user_id = auth.uid()) OR (scope_type = 'organization' AND public.has_org_role(organization_id, auth.uid(), 'admin'::public.app_role))` |
| `email_accounts` | Delete email accounts by scope | DELETE | authenticated | permissive | `(scope_type = 'user' AND user_id = auth.uid()) OR (scope_type = 'organization' AND public.has_org_role(organization_id, auth.uid(), 'admin'::public.app_role))` |  |
| `email_accounts` | Service manage email_accounts | ALL | service_role | permissive | `true` | `true` |
| `email_sync_log` | View sync log by account scope | SELECT | authenticated | permissive | `EXISTS ( SELECT 1 FROM public.email_accounts ea WHERE ea.id = email_sync_log.email_account_id AND ( (ea.scope_type = 'user' AND ea.user_id = auth.uid()) OR (ea.scope_type = 'organization' AND public.is_org_member(ea.organization_id, auth.uid())) ) )` |  |
| `email_sync_log` | Service manage email_sync_log | ALL | service_role | permissive | `true` | `true` |
| `oauth_sandbox_snapshots` | Members view oauth snapshots | SELECT | authenticated | permissive | `public.is_org_member(organization_id, auth.uid())` |  |
| `oauth_sandbox_snapshots` | Admins insert oauth snapshots | INSERT | authenticated | permissive |  | `public.has_org_role(organization_id, auth.uid(), 'admin'::public.app_role) AND user_id = auth.uid()` |
| `oauth_sandbox_snapshots` | Admins update oauth snapshots | UPDATE | authenticated | permissive | `public.has_org_role(organization_id, auth.uid(), 'admin'::public.app_role)` | `public.has_org_role(organization_id, auth.uid(), 'admin'::public.app_role)` |
| `oauth_sandbox_snapshots` | Admins delete oauth snapshots | DELETE | authenticated | permissive | `public.has_org_role(organization_id, auth.uid(), 'admin'::public.app_role)` |  |
| `org_violation_alert_settings` | Admins can read settings | SELECT | authenticated | permissive | `public.has_org_role(organization_id, auth.uid(), 'admin')` |  |
| `org_violation_alert_settings` | Admins can upsert settings | INSERT | authenticated | permissive |  | `public.has_org_role(organization_id, auth.uid(), 'admin')` |
| `org_violation_alert_settings` | Admins can update settings | UPDATE | authenticated | permissive | `public.has_org_role(organization_id, auth.uid(), 'admin')` | `public.has_org_role(organization_id, auth.uid(), 'admin')` |
| `org_violation_alerts` | Admins can view alerts | SELECT | authenticated | permissive | `public.has_org_role(organization_id, auth.uid(), 'admin')` |  |
| `ponto_registros` | Users can view their own registros | SELECT | public | permissive | `auth.uid() = user_id` |  |
| `ponto_registros` | Users can insert their own registros | INSERT | public | permissive |  | `auth.uid() = user_id` |
| `ponto_registros` | Admins can view all registros in their org | SELECT | public | permissive | `EXISTS ( SELECT 1 FROM public.organization_members WHERE organization_id = public.ponto_registros.organization_id AND user_id = auth.uid() AND role = 'admin' )` |  |
| `ponto_ajustes` | Users can view their own ajustes | SELECT | public | permissive | `auth.uid() = user_id` |  |
| `ponto_ajustes` | Users can request adjustments | INSERT | public | permissive |  | `auth.uid() = user_id` |
| `ponto_ajustes` | Admins can manage adjustments | ALL | public | permissive | `EXISTS ( SELECT 1 FROM public.organization_members WHERE organization_id = public.ponto_ajustes.organization_id AND user_id = auth.uid() AND role = 'admin' )` |  |
| `ponto_configuracoes` | Everyone in org can view configs | SELECT | public | permissive | `EXISTS ( SELECT 1 FROM public.organization_members WHERE organization_id = public.ponto_configuracoes.organization_id AND user_id = auth.uid() )` |  |
| `ponto_configuracoes` | Admins can update configs | UPDATE | public | permissive | `EXISTS ( SELECT 1 FROM public.organization_members WHERE organization_id = public.ponto_configuracoes.organization_id AND user_id = auth.uid() AND role = 'admin' )` |  |
| `ponto_banco_horas` | Users can view their own balance | SELECT | public | permissive | `auth.uid() = user_id` |  |
| `ponto_banco_horas` | Admins can view and update balance | ALL | public | permissive | `EXISTS ( SELECT 1 FROM public.organization_members WHERE organization_id = public.ponto_banco_horas.organization_id AND user_id = auth.uid() AND role = 'admin' )` |  |
| `idempotency_keys` | Users can insert their own idempotency keys | INSERT | public | permissive |  | `auth.uid() = user_id` |
| `audit_logs` | Admins view audit logs | SELECT | authenticated | permissive | `public.has_role(auth.uid(), 'admin'::public.app_role)` |  |
| `feature_flags` | Feature flags are viewable by authenticated users | SELECT | public | permissive | `auth.role() = 'authenticated'` |  |
| `health_checks` | Health checks are viewable by authenticated users | SELECT | public | permissive | `auth.role() = 'authenticated'` |  |
| `circuit_breakers` | Circuit breakers are viewable by authenticated users | SELECT | public | permissive | `auth.role() = 'authenticated'` |  |
| `idempotency_keys` | Users can view their own idempotency keys | SELECT | public | permissive | `auth.uid() = user_id` |  |
| `idempotency_keys` | Users can create their own idempotency keys | INSERT | public | permissive |  | `auth.uid() = user_id` |
| `auth_rate_limits` | System can manage auth rate limits | ALL | service_role | permissive | `true` | `true` |
| `user_roles` | Users can view their own roles | SELECT | authenticated | permissive | `auth.uid() = user_id` |  |
| `user_roles` | Service role can manage user roles | ALL | service_role | permissive | `true` | `true` |
| `ipc_config` | Users can view org ipc_config | SELECT | public | permissive | `organization_id IN ( SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid() )` |  |
| `ipc_config` | Users can manage org ipc_config | ALL | public | permissive | `organization_id IN ( SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid() AND role IN ('admin', 'sdr') )` | `organization_id IN ( SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid() AND role IN ('admin', 'sdr') )` |
| `oauth_sandbox_snapshots` | Users can view org oauth_snapshots | SELECT | public | permissive | `organization_id IN ( SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid() )` |  |
| `oauth_sandbox_snapshots` | Users can manage org oauth_snapshots | ALL | public | permissive | `organization_id IN ( SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid() AND role = 'admin' )` | `organization_id IN ( SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid() AND role = 'admin' )` |
| `automation_alerts` | Users can manage their own alerts | ALL | public | permissive | `auth.uid() = user_id` |  |
| `job_exports` | Users can manage their own exports | ALL | public | permissive | `auth.uid() = user_id` |  |
| `automation_steps` | Users can insert automation steps for their organization | INSERT | public | permissive |  | `organization_id IN ( SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid() )` |
| `automation_steps` | Users can update automation steps for their organization | UPDATE | public | permissive | `organization_id IN ( SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid() )` |  |
| `automation_steps` | Users can view their organization's automation steps | SELECT | public | permissive | `organization_id IN ( SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid() )` | `organization_id IN ( SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid() )` |
| `email_suppressions` | Membros veem supressões da sua organização | SELECT | authenticated | permissive | `public.is_org_member(organization_id, auth.uid())` |  |
| `email_suppressions` | Membros podem adicionar supressões manualmente | INSERT | authenticated | permissive |  | `public.is_org_member(organization_id, auth.uid())` |
| `email_suppressions` | Membros podem atualizar supressões da sua organização | UPDATE | authenticated | permissive | `public.is_org_member(organization_id, auth.uid())` | `public.is_org_member(organization_id, auth.uid())` |
| `email_suppressions` | Membros podem remover supressões da sua organização | DELETE | authenticated | permissive | `public.is_org_member(organization_id, auth.uid())` |  |
| `db_health_snapshots` | Admins can view db health snapshots | SELECT | authenticated | permissive | `public.has_role(auth.uid(), 'admin')` |  |
| `scrape_queue` | Org members view scrape queue | SELECT | authenticated | permissive | `public.is_org_member(organization_id, auth.uid())` |  |
| `scrape_dead_letter` | Org members view dead letter | SELECT | authenticated | permissive | `public.is_org_member(organization_id, auth.uid())` |  |
| `partition_policies` | Admins gerenciam políticas de partição | ALL | authenticated | permissive | `public.has_role(auth.uid(), 'admin')` | `public.has_role(auth.uid(), 'admin')` |
| `partition_advisories` | Admins veem recomendações de partição | SELECT | authenticated | permissive | `public.has_role(auth.uid(), 'admin')` |  |
| `partition_advisories` | Admins reconhecem recomendações de partição | UPDATE | authenticated | permissive | `public.has_role(auth.uid(), 'admin')` | `public.has_role(auth.uid(), 'admin')` |
| `automation_execution_logs` | Membros veem logs de automação da sua organização | SELECT | authenticated | permissive | `public.is_org_member(organization_id, auth.uid())` |  |
| `automation_execution_logs` | Membros registram logs na sua organização | INSERT | authenticated | permissive |  | `public.is_org_member(organization_id, auth.uid())` |
| `automation_execution_logs` | Admins removem logs de automação | DELETE | authenticated | permissive | `public.has_role(auth.uid(), 'admin')` |  |
| `dlq_health_snapshots` | Org members can read DLQ snapshots | SELECT | authenticated | permissive | `public.is_org_member(organization_id, auth.uid())` |  |
| `dlq_alert_settings` | Org members can read DLQ alert settings | SELECT | authenticated | permissive | `public.is_org_member(organization_id, auth.uid())` |  |
| `dlq_alert_settings` | Org admins can insert DLQ alert settings | INSERT | authenticated | permissive |  | `public.has_org_role(organization_id, auth.uid(), 'admin')` |
| `dlq_alert_settings` | Org admins can update DLQ alert settings | UPDATE | authenticated | permissive | `public.has_org_role(organization_id, auth.uid(), 'admin')` | `public.has_org_role(organization_id, auth.uid(), 'admin')` |
| `dlq_alert_settings` | Org admins can delete DLQ alert settings | DELETE | authenticated | permissive | `public.has_org_role(organization_id, auth.uid(), 'admin')` |  |
| `dlq_alert_history` | Org members can read DLQ alert history | SELECT | authenticated | permissive | `public.is_org_member(organization_id, auth.uid())` |  |
| `api_latency_snapshots` | Membros veem snapshots de latência da sua organização | SELECT | authenticated | permissive | `public.is_org_member(organization_id, auth.uid())` |  |
| `api_latency_alert_settings` | Membros veem config de alerta de latência | SELECT | authenticated | permissive | `public.is_org_member(organization_id, auth.uid())` |  |
| `api_latency_alert_settings` | Admins inserem config de alerta de latência | INSERT | authenticated | permissive |  | `public.has_org_role(organization_id, auth.uid(), 'admin')` |
| `api_latency_alert_settings` | Admins atualizam config de alerta de latência | UPDATE | authenticated | permissive | `public.has_org_role(organization_id, auth.uid(), 'admin')` | `public.has_org_role(organization_id, auth.uid(), 'admin')` |
| `api_latency_alert_settings` | Admins removem config de alerta de latência | DELETE | authenticated | permissive | `public.has_org_role(organization_id, auth.uid(), 'admin')` |  |
| `api_latency_alert_history` | Membros veem histórico de alerta de latência | SELECT | authenticated | permissive | `public.is_org_member(organization_id, auth.uid())` |  |
| `lusha_dm_search_history` | Users manage own dm history | ALL | public | permissive | `auth.uid() = user_id` | `auth.uid() = user_id` |
| `lusha_contacts` | lc_select | SELECT | public | permissive | `organization_id = public.default_org_for_current_user()` |  |
| `lusha_contacts` | lc_update | UPDATE | public | permissive | `organization_id = public.default_org_for_current_user()` |  |
| `lusha_contacts` | lc_delete | DELETE | public | permissive | `organization_id = public.default_org_for_current_user()` |  |
| `lusha_contacts` | lc_service_role | ALL | service_role | permissive | `true` | `true` |
| `lusha_credit_usage_log` | org_members_view_credit_usage | SELECT | authenticated | permissive | `organization_id IS NOT NULL AND public.is_org_member(organization_id, auth.uid())` |  |
| `lusha_credit_usage_log` | service_role_full_credit_usage | ALL | service_role | permissive | `true` | `true` |
| `oracle_rate_limits` | org_members_view_rate_limits | SELECT | authenticated | permissive | `public.is_org_member(organization_id, auth.uid())` |  |
| `oracle_rate_limits` | service_role_full_rate_limits | ALL | service_role | permissive | `true` | `true` |
| `circuit_breaker_snapshots` | Snapshots visíveis a autenticados | SELECT | authenticated | permissive | `true` |  |
| `circuit_breaker_snapshots` | Service role gerencia snapshots | ALL | service_role | permissive | `true` | `true` |
| `circuit_breaker_alert_settings` | Admins leem settings | SELECT | authenticated | permissive | `public.has_role(auth.uid(), 'admin')` |  |
| `circuit_breaker_alert_settings` | Admins alteram settings | ALL | authenticated | permissive | `public.has_role(auth.uid(), 'admin')` | `public.has_role(auth.uid(), 'admin')` |
| `circuit_breaker_alert_settings` | Service role gerencia settings | ALL | service_role | permissive | `true` | `true` |
| `circuit_breaker_alert_history` | Admins leem histórico | SELECT | authenticated | permissive | `public.has_role(auth.uid(), 'admin')` |  |
| `circuit_breaker_alert_history` | Service role gerencia histórico | ALL | service_role | permissive | `true` | `true` |
| `vault_cookie_snapshots` | Authenticated can read vault snapshots | SELECT | authenticated | permissive | `true` |  |
| `vault_cookie_alert_history` | Authenticated can read vault alerts | SELECT | authenticated | permissive | `true` |  |
| `lusha_contacts` | lc_insert | INSERT | authenticated | permissive |  | `user_id = auth.uid() AND has_org_role(organization_id, auth.uid(), 'viewer'::app_role)` |
| `webhook_deliveries` | Admins replay deliveries | UPDATE | authenticated | permissive | `public.has_org_role(organization_id, auth.uid(), 'admin')` | `public.has_org_role(organization_id, auth.uid(), 'admin') AND status = 'pending' AND attempts = 0` |
| `scrape_worker_state` | worker state readable by authenticated | SELECT | authenticated | permissive | `true` |  |
| `org_scrape_rate_limits` | Org admins manage rate limits | ALL | authenticated | permissive | `public.has_org_role(auth.uid(), organization_id, 'admin')` | `public.has_org_role(auth.uid(), organization_id, 'admin')` |
| `org_scrape_rate_limits` | Org members view rate limits | SELECT | authenticated | permissive | `public.is_org_member(organization_id, auth.uid())` |  |
| `company_reviews` | org members read company_reviews | SELECT | authenticated | permissive | `public.is_org_member(organization_id, auth.uid())` |  |
| `company_reviews` | org members write company_reviews | INSERT | authenticated | permissive |  | `public.is_org_member(organization_id, auth.uid())` |
| `company_reviews` | org members update company_reviews | UPDATE | authenticated | permissive | `public.is_org_member(organization_id, auth.uid())` | `public.is_org_member(organization_id, auth.uid())` |
| `company_reviews` | org members delete company_reviews | DELETE | authenticated | permissive | `public.is_org_member(organization_id, auth.uid())` |  |
| `org_proxies` | org admins read org_proxies | SELECT | authenticated | permissive | `public.has_org_role(organization_id, auth.uid(), 'admin')` |  |
| `org_proxies` | org admins insert org_proxies | INSERT | authenticated | permissive |  | `public.has_org_role(organization_id, auth.uid(), 'admin')` |
| `org_proxies` | org admins update org_proxies | UPDATE | authenticated | permissive | `public.has_org_role(organization_id, auth.uid(), 'admin')` | `public.has_org_role(organization_id, auth.uid(), 'admin')` |
| `org_proxies` | org admins delete org_proxies | DELETE | authenticated | permissive | `public.has_org_role(organization_id, auth.uid(), 'admin')` |  |
| `places_api_usage` | Members can read org places usage | SELECT | authenticated | permissive | `public.is_org_member(organization_id, auth.uid())` |  |
| `org_retry_policies` | Org members view active policy | SELECT | authenticated | permissive | `public.is_org_member(auth.uid(), organization_id)` |  |
| `retry_policy_advisories` | Advisories select scoped | SELECT | authenticated | permissive | `(organization_id IS NULL AND public.has_role(auth.uid(), 'admin'::app_role)) OR (organization_id IS NOT NULL AND public.has_org_role(auth.uid(), organization_id, 'admin'))` |  |
| `web_scrape_queue` | web_scrape_queue_org_select | SELECT | authenticated | permissive | `public.is_org_member(organization_id, auth.uid())` |  |
| `web_scrape_results` | web_scrape_results_org_select | SELECT | authenticated | permissive | `public.is_org_member(organization_id, auth.uid())` |  |
| `web_scrape_dead_letter` | web_scrape_dl_org_select | SELECT | authenticated | permissive | `public.is_org_member(organization_id, auth.uid())` |  |
| `robots_cache` | robots_cache_read_all | SELECT | authenticated | permissive | `true` |  |
| `pg_net_health_snapshots` | admins read pg_net snapshots | SELECT | authenticated | permissive | `public.has_role(auth.uid(), 'admin')` |  |
| `instagram_scrape_queue` | org members read ig queue | SELECT | authenticated | permissive | `organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid())` |  |
| `instagram_scrape_queue` | org members write ig queue | INSERT | authenticated | permissive |  | `organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid())` |
| `instagram_scrape_queue` | org members update ig queue | UPDATE | authenticated | permissive | `organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid())` |  |
| `instagram_scrape_queue` | org members delete ig queue | DELETE | authenticated | permissive | `organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid())` |  |
| `instagram_scrape_results` | org members read ig results | SELECT | authenticated | permissive | `organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid())` |  |
| `instagram_scrape_dead_letter` | org members read ig dlq | SELECT | authenticated | permissive | `organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid())` |  |
| `qa_test_runs` | qa_runs_read_authenticated | SELECT | authenticated | permissive | `true` |  |
| `qa_test_runs` | qa_runs_service_role_all | ALL | service_role | permissive | `true` | `true` |
| `qa_reaper_runs` | authenticated can read reaper runs | SELECT | authenticated | permissive | `true` |  |
| `qa_reaper_runs` | service_role manages reaper runs | ALL | service_role | permissive | `true` | `true` |
| `reaper_alert_settings` | admins read reaper settings | SELECT | authenticated | permissive | `public.has_role(auth.uid(), 'admin')` |  |
| `reaper_alert_settings` | admins update reaper settings | UPDATE | authenticated | permissive | `public.has_role(auth.uid(), 'admin')` | `public.has_role(auth.uid(), 'admin')` |
| `reaper_alert_settings` | service_role manages reaper settings | ALL | service_role | permissive | `true` | `true` |
| `reaper_alert_history` | authenticated read reaper history | SELECT | authenticated | permissive | `true` |  |
| `reaper_alert_history` | service_role manages reaper history | ALL | service_role | permissive | `true` | `true` |
| `sla_alert_settings` | sla_alert_settings_admin_select | SELECT | authenticated | permissive | `public.has_role(auth.uid(), 'admin'::app_role)` |  |
| `sla_alert_settings` | sla_alert_settings_admin_insert | INSERT | authenticated | permissive |  | `public.has_role(auth.uid(), 'admin'::app_role)` |
| `sla_alert_settings` | sla_alert_settings_admin_update | UPDATE | authenticated | permissive | `public.has_role(auth.uid(), 'admin'::app_role)` |  |
| `sla_alert_history` | sla_alert_history_admin_select | SELECT | authenticated | permissive | `public.has_role(auth.uid(), 'admin'::app_role)` |  |
| `sla_snapshots` | sla_snapshots_auth_select | SELECT | authenticated | permissive | `true` |  |
| `cnpj_enrich_cache` | cnpj_cache_read_authenticated | SELECT | authenticated | permissive | `true` |  |
| `cnpj_enrich_rate_state` | cnpj_rate_read_authenticated | SELECT | authenticated | permissive | `true` |  |
| `cnpj_enrich_queue` | cnpj_queue_read_own | SELECT | authenticated | permissive | `requested_by = auth.uid()` |  |
| `cnpj_enrich_queue` | cnpj_queue_insert_own | INSERT | authenticated | permissive |  | `requested_by = auth.uid()` |
| `queue_sla_defaults` | queue_sla_defaults_select | SELECT | authenticated | permissive | `true` |  |
| `queue_sla_defaults` | queue_sla_defaults_admin_insert | INSERT | authenticated | permissive |  | `public.has_role(auth.uid(), 'admin'::app_role)` |
| `queue_sla_defaults` | queue_sla_defaults_admin_update | UPDATE | authenticated | permissive | `public.has_role(auth.uid(), 'admin'::app_role)` | `public.has_role(auth.uid(), 'admin'::app_role)` |
| `queue_sla_history` | queue_sla_history_admin_select | SELECT | authenticated | permissive | `public.has_role(auth.uid(), 'admin'::app_role)` |  |
| `sla_autotune_runs` | sla_autotune_runs_admin_select | SELECT | authenticated | permissive | `public.has_role(auth.uid(), 'admin'::app_role)` |  |
| `apollo_search_cache` | apollo_cache_read_authenticated | SELECT | authenticated | permissive | `true` |  |
| `apollo_search_cache` | apollo_cache_service_all | ALL | service_role | permissive | `true` | `true` |
| `apollo_rate_state` | apollo_rate_read_authenticated | SELECT | authenticated | permissive | `true` |  |
| `apollo_rate_state` | apollo_rate_service_all | ALL | service_role | permissive | `true` | `true` |

## C. Restrições de dados (obrigatório / único / default / CHECK / FK / calculada)

| Tabela | Coluna | Regra |
|---|---|---|
| `companies` | `id` | PK; default gen_random_uuid() |
| `companies` | `name` | obrigatório |
| `companies` | `source` | default 'manual' |
| `companies` | `ipc_score` | default 0 |
| `companies` | `enriched` | default false |
| `companies` | `starred` | default false |
| `companies` | `raw_data` | default '{}' |
| `companies` | `created_at` | default now() |
| `companies` | `updated_at` | default now() |
| `companies` | `user_id` | default auth.uid(); FK → users.id ON DELETE CASCADE |
| `companies` | `organization_id` | default public.default_org_for_current_user() |
| `companies` | `version` | default 1 |
| `scrape_jobs` | `id` | PK; default gen_random_uuid() |
| `scrape_jobs` | `name` | obrigatório |
| `scrape_jobs` | `status` | default 'pending' |
| `scrape_jobs` | `source` | default 'gmaps' |
| `scrape_jobs` | `config` | default '{}' |
| `scrape_jobs` | `results_count` | default 0 |
| `scrape_jobs` | `created_at` | default now() |
| `scrape_jobs` | `updated_at` | default now() |
| `scrape_jobs` | `user_id` | default auth.uid(); FK → users.id ON DELETE CASCADE |
| `scrape_jobs` | `organization_id` | default public.default_org_for_current_user() |
| `scrape_jobs` | `auto_sync` | default false |
| `scrape_jobs` | `extra_reviews` | default false |
| `scrape_results` | `id` | PK; default gen_random_uuid() |
| `scrape_results` | `job_id` | obrigatório; FK → scrape_jobs.id ON DELETE CASCADE |
| `scrape_results` | `company_id` | FK → companies.id ON DELETE SET NULL |
| `scrape_results` | `raw_data` | default '{}' |
| `scrape_results` | `processed` | default false |
| `scrape_results` | `created_at` | default now() |
| `scrape_results` | `user_id` | default auth.uid(); FK → users.id ON DELETE CASCADE |
| `scrape_results` | `organization_id` | default public.default_org_for_current_user() |
| `ipc_config` | `id` | PK; default gen_random_uuid() |
| `ipc_config` | `name` | default 'default' |
| `ipc_config` | `criteria` | default '{}' |
| `ipc_config` | `is_active` | default true |
| `ipc_config` | `created_at` | default now() |
| `ipc_config` | `updated_at` | default now() |
| `ipc_config` | `user_id` | default auth.uid(); FK → users.id ON DELETE CASCADE |
| `ipc_config` | `organization_id` | default public.default_org_for_current_user() |
| `workflows` | `id` | PK; default gen_random_uuid() |
| `workflows` | `name` | obrigatório |
| `workflows` | `status` | default 'draft' |
| `workflows` | `steps` | default '[]' |
| `workflows` | `config` | default '{}' |
| `workflows` | `leads_processed` | default 0 |
| `workflows` | `leads_qualified` | default 0 |
| `workflows` | `success_rate` | default 0 |
| `workflows` | `created_at` | default now() |
| `workflows` | `updated_at` | default now() |
| `workflows` | `user_id` | default auth.uid(); FK → users.id ON DELETE CASCADE |
| `workflows` | `organization_id` | default public.default_org_for_current_user() |
| `workflow_runs` | `id` | PK; default gen_random_uuid() |
| `workflow_runs` | `workflow_id` | obrigatório; FK → workflows.id ON DELETE CASCADE |
| `workflow_runs` | `status` | default 'pending' |
| `workflow_runs` | `results` | default '{}' |
| `workflow_runs` | `started_at` | default now() |
| `workflow_runs` | `created_at` | default now() |
| `workflow_runs` | `user_id` | default auth.uid(); FK → users.id ON DELETE CASCADE |
| `workflow_runs` | `organization_id` | default public.default_org_for_current_user() |
| `workflow_runs` | `(tabela)` | constraint workflow_runs_status_check CHECK (status IN ('pending','queued','running','completed','failed','cancelled')) |
| `stakeholders` | `id` | PK; default gen_random_uuid() |
| `stakeholders` | `company_id` | FK → companies.id ON DELETE CASCADE |
| `stakeholders` | `full_name` | obrigatório |
| `stakeholders` | `seniority` | default 'unknown' |
| `stakeholders` | `confidence_score` | default 50 |
| `stakeholders` | `source` | default 'manual' |
| `stakeholders` | `tags` | default '{}' |
| `stakeholders` | `raw_data` | default '{}'::jsonb |
| `stakeholders` | `created_at` | default now() |
| `stakeholders` | `updated_at` | default now() |
| `stakeholders` | `user_id` | default auth.uid(); FK → users.id ON DELETE CASCADE |
| `stakeholders` | `organization_id` | default public.default_org_for_current_user() |
| `profiles` | `id` | PK; FK → users.id ON DELETE CASCADE |
| `profiles` | `skin` | default 'gold' |
| `profiles` | `created_at` | default now() |
| `profiles` | `updated_at` | default now() |
| `profiles` | `notification_prefs` | default '{"email_notifs": |
| `profiles` | `onboarding_completed` | default false |
| `notifications` | `id` | PK; default gen_random_uuid() |
| `notifications` | `type` | default 'system' |
| `notifications` | `title` | obrigatório |
| `notifications` | `message` | obrigatório |
| `notifications` | `read` | default false |
| `notifications` | `metadata` | default '{}'::jsonb |
| `notifications` | `created_at` | default now() |
| `notifications` | `user_id` | default auth.uid(); FK → users.id ON DELETE CASCADE |
| `notifications` | `organization_id` | default public.default_org_for_current_user() |
| `notifications` | `(tabela)` | constraint notifications_type_check CHECK (type IN ('system','signal','scrape','enrichment','discovery')) |
| `intent_signals` | `id` | PK; default gen_random_uuid() |
| `intent_signals` | `company_id` | FK → companies.id ON DELETE CASCADE |
| `intent_signals` | `company_name` | obrigatório |
| `intent_signals` | `type` | default 'website_visit' |
| `intent_signals` | `signal` | obrigatório |
| `intent_signals` | `strength` | default 'medium' |
| `intent_signals` | `metadata` | default '{}'::jsonb |
| `intent_signals` | `created_at` | default now() |
| `intent_signals` | `user_id` | default auth.uid(); FK → users.id ON DELETE CASCADE |
| `intent_signals` | `organization_id` | default public.default_org_for_current_user() |
| `intent_signals` | `(tabela)` | constraint intent_signals_type_check CHECK (type IN ('website_visit','hiring','funding','tech_adoption','content_engagement')) |
| `campaigns` | `id` | PK; default gen_random_uuid() |
| `campaigns` | `name` | obrigatório |
| `campaigns` | `status` | default 'draft' |
| `campaigns` | `prospects` | default 0 |
| `campaigns` | `sent` | default 0 |
| `campaigns` | `opened` | default 0 |
| `campaigns` | `replied` | default 0 |
| `campaigns` | `meetings` | default 0 |
| `campaigns` | `sequence` | default '[]'::jsonb |
| `campaigns` | `created_at` | default now() |
| `campaigns` | `updated_at` | default now() |
| `campaigns` | `user_id` | default auth.uid(); FK → users.id ON DELETE CASCADE |
| `campaigns` | `organization_id` | default public.default_org_for_current_user() |
| `campaigns` | `failed` | default 0 |
| `campaigns` | `ab_test_enabled` | default false |
| `campaigns` | `ab_min_sample` | obrigatório |
| `campaigns` | `ab_winner_metric` | obrigatório |
| `campaigns` | `bounced` | obrigatório |
| `agent_chat_messages` | `id` | PK; default gen_random_uuid() |
| `agent_chat_messages` | `user_id` | default auth.uid() |
| `agent_chat_messages` | `role` | obrigatório; CHECK role IN ('user', 'agent') |
| `agent_chat_messages` | `content` | obrigatório |
| `agent_chat_messages` | `created_at` | default now() |
| `agent_chat_messages` | `organization_id` | default public.default_org_for_current_user() |
| `organizations` | `id` | PK; default gen_random_uuid() |
| `organizations` | `name` | obrigatório |
| `organizations` | `slug` | obrigatório; único |
| `organizations` | `owner_id` | obrigatório |
| `organizations` | `created_at` | default now() |
| `organizations` | `updated_at` | default now() |
| `organization_members` | `id` | PK; default gen_random_uuid() |
| `organization_members` | `organization_id` | obrigatório; FK → organizations.id ON DELETE CASCADE |
| `organization_members` | `user_id` | obrigatório |
| `organization_members` | `role` | default 'viewer' |
| `organization_members` | `created_at` | default now() |
| `organization_members` | `(tabela)` | UNIQUE (organization_id, user_id) |
| `organization_invites` | `id` | PK; default gen_random_uuid() |
| `organization_invites` | `organization_id` | obrigatório; FK → organizations.id ON DELETE CASCADE |
| `organization_invites` | `token` | único; default encode(gen_random_bytes(24) |
| `organization_invites` | `role` | default 'viewer' |
| `organization_invites` | `created_by` | obrigatório |
| `organization_invites` | `expires_at` | default (now() |
| `organization_invites` | `revoked` | default false |
| `organization_invites` | `created_at` | default now() |
| `deal_stages` | `id` | PK; default gen_random_uuid() |
| `deal_stages` | `user_id` | default auth.uid() |
| `deal_stages` | `name` | obrigatório |
| `deal_stages` | `color` | default '#D4A520' |
| `deal_stages` | `position` | default 0 |
| `deal_stages` | `probability` | default 0; CHECK probability >= 0 AND probability <= 100 |
| `deal_stages` | `type` | default 'open'; CHECK type IN ('open','won','lost') |
| `deal_stages` | `created_at` | default now() |
| `deal_stages` | `updated_at` | default now() |
| `deal_stages` | `organization_id` | default public.default_org_for_current_user() |
| `deals` | `id` | PK; default gen_random_uuid() |
| `deals` | `user_id` | default auth.uid() |
| `deals` | `stage_id` | obrigatório; FK → deal_stages.id ON DELETE RESTRICT |
| `deals` | `title` | obrigatório |
| `deals` | `value` | default 0 |
| `deals` | `currency` | default 'BRL' |
| `deals` | `company_id` | FK → companies.id ON DELETE SET NULL |
| `deals` | `stakeholder_id` | FK → stakeholders.id ON DELETE SET NULL |
| `deals` | `priority` | default 'medium'; CHECK priority IN ('low','medium','high') |
| `deals` | `tags` | default '{}' |
| `deals` | `position` | default 0 |
| `deals` | `created_at` | default now() |
| `deals` | `updated_at` | default now() |
| `deals` | `organization_id` | default public.default_org_for_current_user() |
| `deals` | `version` | default 1 |
| `deal_activities` | `id` | PK; default gen_random_uuid() |
| `deal_activities` | `user_id` | default auth.uid() |
| `deal_activities` | `deal_id` | obrigatório; FK → deals.id ON DELETE CASCADE |
| `deal_activities` | `type` | default 'note'; CHECK type IN ('note','call','email','meeting','stage_change','system') |
| `deal_activities` | `title` | obrigatório |
| `deal_activities` | `metadata` | default '{}'::jsonb |
| `deal_activities` | `created_at` | default now() |
| `deal_activities` | `organization_id` | default public.default_org_for_current_user() |
| `deal_tasks` | `id` | PK; default gen_random_uuid() |
| `deal_tasks` | `user_id` | default auth.uid() |
| `deal_tasks` | `deal_id` | FK → deals.id ON DELETE CASCADE |
| `deal_tasks` | `title` | obrigatório |
| `deal_tasks` | `reminded` | default false |
| `deal_tasks` | `completed` | default false |
| `deal_tasks` | `priority` | default 'medium'; CHECK priority IN ('low','medium','high') |
| `deal_tasks` | `created_at` | default now() |
| `deal_tasks` | `updated_at` | default now() |
| `deal_tasks` | `organization_id` | default public.default_org_for_current_user() |
| `api_keys` | `id` | PK; default gen_random_uuid() |
| `api_keys` | `user_id` | default auth.uid() |
| `api_keys` | `name` | obrigatório |
| `api_keys` | `prefix` | obrigatório |
| `api_keys` | `key_hash` | obrigatório; único |
| `api_keys` | `scopes` | default ARRAY['read'] |
| `api_keys` | `active` | default true |
| `api_keys` | `created_at` | default now() |
| `api_keys` | `organization_id` | default public.default_org_for_current_user() |
| `webhooks` | `id` | PK; default gen_random_uuid() |
| `webhooks` | `user_id` | default auth.uid() |
| `webhooks` | `name` | obrigatório |
| `webhooks` | `url` | obrigatório |
| `webhooks` | `secret` | default encode(gen_random_bytes(24) |
| `webhooks` | `events` | default '{}' |
| `webhooks` | `active` | default true |
| `webhooks` | `total_sent` | default 0 |
| `webhooks` | `total_failed` | default 0 |
| `webhooks` | `created_at` | default now() |
| `webhooks` | `updated_at` | default now() |
| `webhooks` | `organization_id` | default public.default_org_for_current_user() |
| `webhook_deliveries` | `id` | PK; default gen_random_uuid() |
| `webhook_deliveries` | `user_id` | obrigatório |
| `webhook_deliveries` | `webhook_id` | obrigatório; FK → webhooks.id ON DELETE CASCADE |
| `webhook_deliveries` | `event` | obrigatório |
| `webhook_deliveries` | `payload` | obrigatório |
| `webhook_deliveries` | `status` | default 'pending'; CHECK status IN ('pending','success','failed','retrying') |
| `webhook_deliveries` | `attempts` | default 0 |
| `webhook_deliveries` | `created_at` | default now() |
| `webhook_deliveries` | `organization_id` | default public.default_org_for_current_user() |
| `webhook_deliveries` | `(tabela)` | constraint webhook_deliveries_status_check CHECK (status IN ('pending', 'sending', 'success', 'failed', 'retrying')) |
| `audit_logs` | `id` | PK; default gen_random_uuid() |
| `audit_logs` | `organization_id` | FK → organizations.id |
| `audit_logs` | `user_id` | FK → users.id |
| `audit_logs` | `action` | obrigatório |
| `audit_logs` | `table_name` | obrigatório |
| `audit_logs` | `record_id` | obrigatório |
| `audit_logs` | `created_at` | default now() |
| `campaign_recipients` | `id` | PK; default gen_random_uuid() |
| `campaign_recipients` | `organization_id` | default public.default_org_for_current_user() |
| `campaign_recipients` | `user_id` | default auth.uid() |
| `campaign_recipients` | `campaign_id` | obrigatório; FK → campaigns.id ON DELETE CASCADE |
| `campaign_recipients` | `stakeholder_id` | FK → stakeholders.id ON DELETE SET NULL |
| `campaign_recipients` | `company_id` | FK → companies.id ON DELETE SET NULL |
| `campaign_recipients` | `email` | obrigatório |
| `campaign_recipients` | `status` | default 'pending' |
| `campaign_recipients` | `open_count` | default 0 |
| `campaign_recipients` | `click_count` | default 0 |
| `campaign_recipients` | `created_at` | default now() |
| `campaign_recipients` | `updated_at` | default now() |
| `campaign_recipients` | `current_step` | default 0 |
| `campaign_recipients` | `next_action_at` | obrigatório |
| `campaign_recipients` | `(tabela)` | constraint campaign_recipients_status_check CHECK (status IN ('pending','queued','sent','failed','bounced','unsubscribed','replied')) |
| `campaign_events` | `id` | PK; default gen_random_uuid() |
| `campaign_events` | `organization_id` | obrigatório |
| `campaign_events` | `campaign_id` | obrigatório; FK → campaigns.id ON DELETE CASCADE |
| `campaign_events` | `recipient_id` | obrigatório; FK → campaign_recipients.id ON DELETE CASCADE |
| `campaign_events` | `event_type` | obrigatório; CHECK event_type IN ('open','click','bounce','unsubscribe','reply','sent') |
| `campaign_events` | `metadata` | default '{}'::jsonb |
| `campaign_events` | `occurred_at` | default now() |
| `email_accounts` | `id` | PK; default gen_random_uuid() |
| `email_accounts` | `organization_id` | default public.default_org_for_current_user() |
| `email_accounts` | `user_id` | default auth.uid() |
| `email_accounts` | `provider` | obrigatório; CHECK provider IN ('gmail','outlook') |
| `email_accounts` | `email` | obrigatório |
| `email_accounts` | `active` | default true |
| `email_accounts` | `created_at` | default now() |
| `email_accounts` | `updated_at` | default now() |
| `email_accounts` | `scope_type` | default 'user' |
| `email_accounts` | `reconnect_attempts` | default 0 |
| `email_accounts` | `reconnect_base_delay_seconds` | obrigatório |
| `email_accounts` | `reconnect_max_attempts` | obrigatório |
| `email_accounts` | `reconnect_required` | obrigatório |
| `campaign_messages` | `id` | PK; default gen_random_uuid() |
| `campaign_messages` | `organization_id` | default public.default_org_for_current_user() |
| `campaign_messages` | `user_id` | default auth.uid() |
| `campaign_messages` | `campaign_id` | obrigatório; FK → campaigns.id ON DELETE CASCADE |
| `campaign_messages` | `recipient_id` | obrigatório; FK → campaign_recipients.id ON DELETE CASCADE |
| `campaign_messages` | `email_account_id` | FK → email_accounts.id ON DELETE SET NULL |
| `campaign_messages` | `step_index` | default 0 |
| `campaign_messages` | `sent_at` | default now() |
| `campaign_messages` | `created_at` | default now() |
| `campaign_replies` | `id` | PK; default gen_random_uuid() |
| `campaign_replies` | `organization_id` | obrigatório |
| `campaign_replies` | `campaign_id` | obrigatório; FK → campaigns.id ON DELETE CASCADE |
| `campaign_replies` | `recipient_id` | obrigatório; FK → campaign_recipients.id ON DELETE CASCADE |
| `campaign_replies` | `message_id` | FK → campaign_messages.id ON DELETE SET NULL |
| `campaign_replies` | `email_account_id` | FK → email_accounts.id ON DELETE SET NULL |
| `campaign_replies` | `provider` | obrigatório |
| `campaign_replies` | `provider_message_id` | obrigatório |
| `campaign_replies` | `received_at` | obrigatório |
| `campaign_replies` | `created_at` | default now() |
| `api_request_logs` | `id` | PK; default gen_random_uuid() |
| `api_request_logs` | `method` | obrigatório |
| `api_request_logs` | `path` | obrigatório |
| `api_request_logs` | `status_code` | obrigatório |
| `api_request_logs` | `duration_ms` | obrigatório |
| `api_request_logs` | `created_at` | default now() |
| `email_sync_log` | `id` | PK; default gen_random_uuid() |
| `email_sync_log` | `email_account_id` | obrigatório; FK → email_accounts.id ON DELETE CASCADE |
| `email_sync_log` | `organization_id` | obrigatório |
| `email_sync_log` | `scope_type` | obrigatório; CHECK scope_type IN ('user','organization') |
| `email_sync_log` | `provider` | obrigatório |
| `email_sync_log` | `status` | obrigatório; CHECK status IN ('success','error','skipped','refresh_failed') |
| `email_sync_log` | `reconnect_required` | default false |
| `email_sync_log` | `created_at` | default now() |
| `oauth_sandbox_snapshots` | `id` | PK; default gen_random_uuid() |
| `oauth_sandbox_snapshots` | `organization_id` | default public.default_org_for_current_user() |
| `oauth_sandbox_snapshots` | `user_id` | default auth.uid() |
| `oauth_sandbox_snapshots` | `label` | obrigatório |
| `oauth_sandbox_snapshots` | `provider` | obrigatório; CHECK provider IN ('gmail','outlook') |
| `oauth_sandbox_snapshots` | `scope_type` | obrigatório; CHECK scope_type IN ('user','organization') |
| `oauth_sandbox_snapshots` | `redirect_uri` | obrigatório |
| … +545 linhas — lista completa em `context.json` | | |

## D. Automações no banco (triggers e funções — regras que rodam sozinhas)

| Trigger | Quando | Tabela | Executa | Condição |
|---|---|---|---|---|
| update_companies_updated_at | BEFORE UPDATE | `companies` | `update_updated_at_column` |  |
| update_scrape_jobs_updated_at | BEFORE UPDATE | `scrape_jobs` | `update_updated_at_column` |  |
| update_ipc_config_updated_at | BEFORE UPDATE | `ipc_config` | `update_updated_at_column` |  |
| update_workflows_updated_at | BEFORE UPDATE | `workflows` | `update_updated_at_column` |  |
| update_stakeholders_updated_at | BEFORE UPDATE | `stakeholders` | `update_updated_at_column` |  |
| on_auth_user_created | AFTER INSERT | `auth.users` | `handle_new_user` |  |
| update_profiles_updated_at | BEFORE UPDATE | `profiles` | `update_updated_at_column` |  |
| trg_notify_enrichment | AFTER UPDATE | `companies` | `notify_on_enrichment` |  |
| trg_notify_workflow_complete | AFTER UPDATE | `workflow_runs` | `notify_on_workflow_complete` |  |
| trg_validate_ipc_score | BEFORE INSERT OR UPDATE | `companies` | `validate_ipc_score` |  |
| trg_prevent_user_id_change_companies | BEFORE UPDATE | `companies` | `prevent_user_id_change` |  |
| trg_prevent_user_id_change_stakeholders | BEFORE UPDATE | `stakeholders` | `prevent_user_id_change` |  |
| trg_prevent_user_id_change_scrape_results | BEFORE UPDATE | `scrape_results` | `prevent_user_id_change` |  |
| trg_prevent_user_id_change_scrape_jobs | BEFORE UPDATE | `scrape_jobs` | `prevent_user_id_change` |  |
| trg_prevent_user_id_change_campaigns | BEFORE UPDATE | `campaigns` | `prevent_user_id_change` |  |
| trg_prevent_user_id_change_workflows | BEFORE UPDATE | `workflows` | `prevent_user_id_change` |  |
| trg_prevent_user_id_change_workflow_runs | BEFORE UPDATE | `workflow_runs` | `prevent_user_id_change` |  |
| trg_prevent_user_id_change_intent_signals | BEFORE UPDATE | `intent_signals` | `prevent_user_id_change` |  |
| trg_prevent_user_id_change_ipc_config | BEFORE UPDATE | `ipc_config` | `prevent_user_id_change` |  |
| trg_prevent_user_id_change_notifications | BEFORE UPDATE | `notifications` | `prevent_user_id_change` |  |
| trg_prevent_user_id_change_agent_chat | BEFORE UPDATE | `agent_chat_messages` | `prevent_user_id_change` |  |
| prevent_user_id_change_companies | BEFORE UPDATE | `companies` | `prevent_user_id_change` |  |
| prevent_user_id_change_campaigns | BEFORE UPDATE | `campaigns` | `prevent_user_id_change` |  |
| prevent_user_id_change_workflows | BEFORE UPDATE | `workflows` | `prevent_user_id_change` |  |
| prevent_user_id_change_workflow_runs | BEFORE UPDATE | `workflow_runs` | `prevent_user_id_change` |  |
| prevent_user_id_change_scrape_jobs | BEFORE UPDATE | `scrape_jobs` | `prevent_user_id_change` |  |
| prevent_user_id_change_scrape_results | BEFORE UPDATE | `scrape_results` | `prevent_user_id_change` |  |
| prevent_user_id_change_notifications | BEFORE UPDATE | `notifications` | `prevent_user_id_change` |  |
| prevent_user_id_change_ipc_config | BEFORE UPDATE | `ipc_config` | `prevent_user_id_change` |  |
| prevent_user_id_change_intent_signals | BEFORE UPDATE | `intent_signals` | `prevent_user_id_change` |  |
| prevent_user_id_change_stakeholders | BEFORE UPDATE | `stakeholders` | `prevent_user_id_change` |  |
| trg_companies_updated_at | BEFORE UPDATE | `companies` | `update_updated_at_column` |  |
| trg_campaigns_updated_at | BEFORE UPDATE | `campaigns` | `update_updated_at_column` |  |
| trg_workflows_updated_at | BEFORE UPDATE | `workflows` | `update_updated_at_column` |  |
| trg_scrape_jobs_updated_at | BEFORE UPDATE | `scrape_jobs` | `update_updated_at_column` |  |
| trg_ipc_config_updated_at | BEFORE UPDATE | `ipc_config` | `update_updated_at_column` |  |
| trg_profiles_updated_at | BEFORE UPDATE | `profiles` | `update_updated_at_column` |  |
| trg_stakeholders_updated_at | BEFORE UPDATE | `stakeholders` | `update_updated_at_column` |  |
| trg_companies_validate_ipc | BEFORE INSERT OR UPDATE | `companies` | `validate_ipc_score` |  |
| trg_companies_prevent_uid_change | BEFORE UPDATE | `companies` | `prevent_user_id_change` |  |
| trg_campaigns_prevent_uid_change | BEFORE UPDATE | `campaigns` | `prevent_user_id_change` |  |
| trg_workflows_prevent_uid_change | BEFORE UPDATE | `workflows` | `prevent_user_id_change` |  |
| trg_scrape_jobs_prevent_uid_change | BEFORE UPDATE | `scrape_jobs` | `prevent_user_id_change` |  |
| trg_notifications_prevent_uid_change | BEFORE UPDATE | `notifications` | `prevent_user_id_change` |  |
| trg_stakeholders_prevent_uid_change | BEFORE UPDATE | `stakeholders` | `prevent_user_id_change` |  |
| trg_companies_enrichment_notify | AFTER UPDATE | `companies` | `notify_on_enrichment` |  |
| trg_workflow_runs_notify | AFTER UPDATE | `workflow_runs` | `notify_on_workflow_complete` |  |
| on_organization_created | AFTER INSERT | `organizations` | `handle_new_organization` |  |
| update_organizations_updated_at | BEFORE UPDATE | `organizations` | `update_updated_at_column` |  |
| trg_deal_stages_updated | BEFORE UPDATE | `deal_stages` | `update_updated_at_column` |  |
| trg_deals_updated | BEFORE UPDATE | `deals` | `update_updated_at_column` |  |
| trg_deal_tasks_updated | BEFORE UPDATE | `deal_tasks` | `update_updated_at_column` |  |
| trg_audit_deals | AFTER INSERT OR UPDATE OR DELETE | `deals` | `log_audit_event` |  |
| trg_deal_stage_change | AFTER UPDATE | `deals` | `log_deal_stage_change` |  |
| trg_webhooks_updated | BEFORE UPDATE | `webhooks` | `update_updated_at_column` |  |
| trg_wh_companies | AFTER INSERT OR UPDATE OR DELETE | `companies` | `enqueue_webhook_event` |  |
| trg_wh_deals | AFTER INSERT OR UPDATE OR DELETE | `deals` | `enqueue_webhook_event` |  |
| trg_wh_stakeholders | AFTER INSERT OR UPDATE OR DELETE | `stakeholders` | `enqueue_webhook_event` |  |
| trg_campaign_recipients_updated | BEFORE UPDATE | `campaign_recipients` | `update_updated_at_column` |  |
| trg_email_accounts_updated | BEFORE UPDATE | `email_accounts` | `update_updated_at_column` |  |
| trg_audit_organization_members | AFTER INSERT OR UPDATE OR DELETE | `organization_members` | `log_audit_event` |  |
| trg_audit_email_accounts | AFTER INSERT OR UPDATE OR DELETE | `email_accounts` | `log_audit_event` |  |
| trg_org_violation_alert_settings_updated_at | BEFORE UPDATE | `org_violation_alert_settings` | `update_updated_at_column` |  |
| trigger_ponto_registros_updated_at | BEFORE UPDATE | `ponto_registros` | `handle_updated_at` |  |
| trigger_ponto_ajustes_updated_at | BEFORE UPDATE | `ponto_ajustes` | `handle_updated_at` |  |
| trigger_ponto_configuracoes_updated_at | BEFORE UPDATE | `ponto_configuracoes` | `handle_updated_at` |  |
| increment_companies_version | BEFORE UPDATE | `companies` | `increment_version` |  |
| increment_deals_version | BEFORE UPDATE | `deals` | `increment_version` |  |
| update_feature_flags_updated_at | BEFORE UPDATE | `feature_flags` | `update_updated_at_column` |  |
| tr_update_auth_rate_limits_updated_at | BEFORE UPDATE | `auth_rate_limits` | `update_updated_at_column` |  |
| tr_companies_version | BEFORE UPDATE | `companies` | `increment_version` |  |
| tr_deals_version | BEFORE UPDATE | `deals` | `increment_version` |  |
| update_email_suppressions_updated_at | BEFORE UPDATE | `email_suppressions` | `update_updated_at_column` |  |
| normalize_email_suppressions | BEFORE INSERT OR UPDATE | `email_suppressions` | `normalize_suppression_email` |  |
| sync_suppression_on_recipient_status | AFTER UPDATE OF STATUS | `campaign_recipients` | `sync_suppression_from_recipient` |  |
| update_automation_alerts_updated_at | BEFORE UPDATE | `automation_alerts` | `update_updated_at_column` |  |
| trg_scrape_queue_updated_at | BEFORE UPDATE | `scrape_queue` | `update_updated_at_column` |  |
| trg_partition_policies_updated_at | BEFORE UPDATE | `partition_policies` | `update_updated_at_column` |  |
| trg_validate_dlq_alert_settings | BEFORE INSERT OR UPDATE | `dlq_alert_settings` | `validate_dlq_alert_settings` |  |
| trg_validate_api_latency_alert_settings | BEFORE INSERT OR UPDATE | `api_latency_alert_settings` | `validate_api_latency_alert_settings` |  |
| trg_audit_scrape_jobs | AFTER INSERT OR UPDATE OR DELETE | `scrape_jobs` | `log_audit_event` |  |
| trg_audit_workflow_runs | AFTER INSERT OR UPDATE OR DELETE | `workflow_runs` | `log_audit_event` |  |
| trg_lusha_dm_hist_updated | BEFORE UPDATE | `lusha_dm_search_history` | `update_updated_at_column` |  |
| trg_oracle_rate_limits_updated_at | BEFORE UPDATE | `oracle_rate_limits` | `update_updated_at_column` |  |
| trg_cb_settings_touch | BEFORE UPDATE | `circuit_breaker_alert_settings` | `circuit_breaker_settings_touch` |  |
| scrape_jobs_set_config_hash_trg | BEFORE INSERT OR UPDATE OF CONFIG | `scrape_jobs` | `scrape_jobs_set_config_hash` |  |
| org_scrape_rate_limits_updated_at | BEFORE UPDATE | `org_scrape_rate_limits` | `update_updated_at_column` |  |
| validate_company_rating_trg | BEFORE INSERT OR UPDATE | `companies` | `validate_company_rating` |  |
| org_proxies_updated_at | BEFORE UPDATE | `org_proxies` | `update_updated_at_column` |  |
| trg_places_api_usage_updated_at | BEFORE UPDATE | `places_api_usage` | `update_updated_at_column` |  |
| trg_web_scrape_queue_updated_at | BEFORE UPDATE | `web_scrape_queue` | `update_updated_at_column` |  |
| trg_ig_queue_updated_at | BEFORE UPDATE | `instagram_scrape_queue` | `update_updated_at_column` |  |
| trg_reaper_alert_settings_updated_at | BEFORE UPDATE | `reaper_alert_settings` | `update_updated_at_column` |  |
| update_sla_alert_settings_updated_at | BEFORE UPDATE | `sla_alert_settings` | `update_updated_at_column` |  |
| trg_cnpj_enrich_queue_updated | BEFORE UPDATE | `cnpj_enrich_queue` | `update_updated_at_column` |  |
| update_queue_sla_defaults_updated_at | BEFORE UPDATE | `queue_sla_defaults` | `update_updated_at_column` |  |
| trg_log_queue_sla_change | AFTER INSERT OR UPDATE | `queue_sla_defaults` | `log_queue_sla_change` |  |

Erros lançados por funções SQL (`RAISE EXCEPTION` = regra de negócio no banco):

| Função | Mensagem | Origem |
|---|---|---|
| `validate_ipc_score` | ipc_score must be between 0 and 100, got % | `supabase/migrations/20260403184048_3c59e2f7-1cf4-45f9-8c02-cd5b6bddadee.sql` |
| `prevent_user_id_change` | Changing user_id is not allowed | `supabase/migrations/20260404163754_10399fc9-2e6c-48d9-b69a-80a3cab69139.sql` |
| `accept_org_invite` | Não autenticado | `supabase/migrations/20260422201601_940b28cc-0f04-4a93-9866-11fd3d1edba5.sql` |
| `accept_org_invite` | Convite inválido | `supabase/migrations/20260422201601_940b28cc-0f04-4a93-9866-11fd3d1edba5.sql` |
| `accept_org_invite` | Convite revogado | `supabase/migrations/20260422201601_940b28cc-0f04-4a93-9866-11fd3d1edba5.sql` |
| `accept_org_invite` | Convite já utilizado | `supabase/migrations/20260422201601_940b28cc-0f04-4a93-9866-11fd3d1edba5.sql` |
| `accept_org_invite` | Convite expirado | `supabase/migrations/20260422201601_940b28cc-0f04-4a93-9866-11fd3d1edba5.sql` |
| `record_campaign_event` | Recipient not found | `supabase/migrations/20260423120024_1d1aada5-8bc8-4099-b508-8ccbd1154e69.sql` |
| `get_dashboard_stats` | Acesso negado à organização | `supabase/migrations/20260522142002_01f908df-71d7-469f-aa7a-fa389e561b44.sql` |
| `decide_ab_winner` | Acesso negado à campanha | `supabase/migrations/20260711174405_36f70b09-66dc-4d24-9239-c257fe089ffa.sql` |
| `pg_catalog_rls_tables` | Acesso negado: requer papel de administrador | `supabase/migrations/20260712112941_b8b623ce-a575-4757-98d5-1422d1ac9c66.sql` |
| `pg_columns_for_insert` | Acesso negado: requer papel de administrador | `supabase/migrations/20260712112941_b8b623ce-a575-4757-98d5-1422d1ac9c66.sql` |
| `enqueue_scrape_task` | Não autenticado | `supabase/migrations/20260712184225_7a9e67f2-f6a7-4329-8476-0981fdab6bfb.sql` |
| `enqueue_scrape_task` | Acesso negado à organização | `supabase/migrations/20260712184225_7a9e67f2-f6a7-4329-8476-0981fdab6bfb.sql` |
| `complete_scrape_task` | Somente o worker do sistema pode concluir tarefas | `supabase/migrations/20260712184225_7a9e67f2-f6a7-4329-8476-0981fdab6bfb.sql` |
| `replay_dead_letter` | Não autenticado | `supabase/migrations/20260712184225_7a9e67f2-f6a7-4329-8476-0981fdab6bfb.sql` |
| `replay_dead_letter` | Item não encontrado | `supabase/migrations/20260712184225_7a9e67f2-f6a7-4329-8476-0981fdab6bfb.sql` |
| `replay_dead_letter` | Acesso negado à organização | `supabase/migrations/20260712184225_7a9e67f2-f6a7-4329-8476-0981fdab6bfb.sql` |
| `replay_dead_letter` | Item já reprocessado | `supabase/migrations/20260712184225_7a9e67f2-f6a7-4329-8476-0981fdab6bfb.sql` |
| `evaluate_partition_policies` | Acesso negado: requer papel de administrador | `supabase/migrations/20260712184705_499e82f4-33c4-443a-82b6-21735caafc4b.sql` |
| `log_automation_event` | organization_id é obrigatório | `supabase/migrations/20260712185444_c1c9c166-656a-49ca-8a1d-67dee4fddea0.sql` |
| `log_automation_event` | Acesso negado à organização | `supabase/migrations/20260712185444_c1c9c166-656a-49ca-8a1d-67dee4fddea0.sql` |
| `defer_scrape_task` | Somente o worker do sistema pode adiar tarefas | `supabase/migrations/20260712192136_d1537905-fe42-44d1-895b-0575288af134.sql` |
| `defer_scrape_task` | Tarefa não encontrada | `supabase/migrations/20260712192136_d1537905-fe42-44d1-895b-0575288af134.sql` |
| `replay_dead_letter_batch` | Não autenticado | `supabase/migrations/20260712192505_fabf24d3-3e91-43d9-8eb4-da7c7ba504e0.sql` |
| `replay_dead_letter_batch` | Acesso negado à organização | `supabase/migrations/20260712192505_fabf24d3-3e91-43d9-8eb4-da7c7ba504e0.sql` |
| `reset_circuit_breaker` | Acesso negado: requer papel de administrador | `supabase/migrations/20260712193650_6a6d3b0a-39c4-4681-8273-82b2c2880329.sql` |
| `reset_circuit_breaker` | service_name é obrigatório | `supabase/migrations/20260712193650_6a6d3b0a-39c4-4681-8273-82b2c2880329.sql` |
| `reset_circuit_breaker` | Circuit breaker não encontrado: % | `supabase/migrations/20260712193650_6a6d3b0a-39c4-4681-8273-82b2c2880329.sql` |
| `purge_dead_letter` | Acesso negado: requer papel de administrador | `supabase/migrations/20260712194532_9abe125d-6680-4fc4-a970-6b38016ca698.sql` |
| `capture_dlq_health_snapshots` | Acesso negado: requer papel de administrador | `supabase/migrations/20260712195304_af0be010-9de3-4b89-a80b-ca8cd03fb754.sql` |
| `prune_dlq_health_snapshots` | Acesso negado: requer papel de administrador | `supabase/migrations/20260712195304_af0be010-9de3-4b89-a80b-ca8cd03fb754.sql` |
| `validate_dlq_alert_settings` | pending_critical deve ser >= 1 | `supabase/migrations/20260712195625_958a9a6c-29bf-4cb9-9188-cb2258d8656c.sql` |
| `validate_dlq_alert_settings` | consecutive deve estar entre 1 e 24 | `supabase/migrations/20260712195625_958a9a6c-29bf-4cb9-9188-cb2258d8656c.sql` |
| `validate_dlq_alert_settings` | cooldown_hours deve estar entre 1 e 168 | `supabase/migrations/20260712195625_958a9a6c-29bf-4cb9-9188-cb2258d8656c.sql` |
| `evaluate_dlq_alerts` | Acesso negado: requer papel de administrador | `supabase/migrations/20260712200213_b4344f28-90cf-4c1a-bdb9-2b6fdf0bc489.sql` |
| `validate_api_latency_alert_settings` | p95_critical_ms deve ser >= 1 | `supabase/migrations/20260712220855_4ed03020-3c5a-4753-b895-59fc25ee7447.sql` |
| `validate_api_latency_alert_settings` | consecutive deve estar entre 1 e 24 | `supabase/migrations/20260712220855_4ed03020-3c5a-4753-b895-59fc25ee7447.sql` |
| `validate_api_latency_alert_settings` | cooldown_hours deve estar entre 1 e 168 | `supabase/migrations/20260712220855_4ed03020-3c5a-4753-b895-59fc25ee7447.sql` |
| `capture_api_latency_snapshots` | Acesso negado: requer papel de administrador | `supabase/migrations/20260712220855_4ed03020-3c5a-4753-b895-59fc25ee7447.sql` |
| `evaluate_api_latency_alerts` | Acesso negado: requer papel de administrador | `supabase/migrations/20260712220855_4ed03020-3c5a-4753-b895-59fc25ee7447.sql` |
| `prune_api_latency_snapshots` | Acesso negado: requer papel de administrador | `supabase/migrations/20260712220855_4ed03020-3c5a-4753-b895-59fc25ee7447.sql` |
| `check_oracle_rate_limit` | organization_id é obrigatório | `supabase/migrations/20260715170326_8df3cb34-aee7-4980-903a-e98875f35c75.sql` |
| `capture_circuit_breaker_snapshots` | Acesso negado: requer papel de administrador | `supabase/migrations/20260715190111_34d421ca-d6a1-4754-ad88-4566225925c9.sql` |
| `evaluate_circuit_breaker_alerts` | Acesso negado: requer papel de administrador | `supabase/migrations/20260715190111_34d421ca-d6a1-4754-ad88-4566225925c9.sql` |
| `get_sector_summary` | Acesso negado à organização | `supabase/migrations/20260718141000_c3f2e4d5-0a7b-4c8d-9e3f-2b4a6c8d0e1f.sql` |
| `validate_company_rating` | rating must be between 0 and 5, got % | `supabase/migrations/20260721164832_429da0f9-d40e-4b2e-868f-e93baeea477a.sql` |
| `validate_company_rating` | review_count must be >= 0, got % | `supabase/migrations/20260721164832_429da0f9-d40e-4b2e-868f-e93baeea477a.sql` |
| `record_places_api_call` | params inválidos | `supabase/migrations/20260721173318_793c82ac-697e-441f-8ec6-774c564bcad5.sql` |
| `apply_retry_advisory` | not authenticated | `supabase/migrations/20260721204338_c3449eb5-c14f-4f87-a0ef-49debf3d12bf.sql` |
| `apply_retry_advisory` | advisory not found | `supabase/migrations/20260721204338_c3449eb5-c14f-4f87-a0ef-49debf3d12bf.sql` |
| `apply_retry_advisory` | advisory already applied | `supabase/migrations/20260721204338_c3449eb5-c14f-4f87-a0ef-49debf3d12bf.sql` |
| `apply_retry_advisory` | advisory dismissed | `supabase/migrations/20260721204338_c3449eb5-c14f-4f87-a0ef-49debf3d12bf.sql` |
| `apply_retry_advisory` | forbidden | `supabase/migrations/20260721204338_c3449eb5-c14f-4f87-a0ef-49debf3d12bf.sql` |
| `apply_retry_advisory` | forbidden | `supabase/migrations/20260721204338_c3449eb5-c14f-4f87-a0ef-49debf3d12bf.sql` |
| `rollback_retry_advisory` | not authenticated | `supabase/migrations/20260721204338_c3449eb5-c14f-4f87-a0ef-49debf3d12bf.sql` |
| `rollback_retry_advisory` | advisory not found | `supabase/migrations/20260721204338_c3449eb5-c14f-4f87-a0ef-49debf3d12bf.sql` |
| `rollback_retry_advisory` | advisory not applied | `supabase/migrations/20260721204338_c3449eb5-c14f-4f87-a0ef-49debf3d12bf.sql` |
| `rollback_retry_advisory` | advisory already rolled back | `supabase/migrations/20260721204338_c3449eb5-c14f-4f87-a0ef-49debf3d12bf.sql` |
| `rollback_retry_advisory` | only org-scoped advisories can be rolled back | `supabase/migrations/20260721204338_c3449eb5-c14f-4f87-a0ef-49debf3d12bf.sql` |
| `rollback_retry_advisory` | forbidden | `supabase/migrations/20260721204338_c3449eb5-c14f-4f87-a0ef-49debf3d12bf.sql` |
| `rollback_retry_advisory` | no previous policy stored | `supabase/migrations/20260721204338_c3449eb5-c14f-4f87-a0ef-49debf3d12bf.sql` |
| `complete_web_scrape_task` | Somente o worker do sistema pode concluir tarefas | `supabase/migrations/20260721223228_9f320c24-b3f3-4067-9e70-b9924824f7c9.sql` |
| `fail_web_scrape_task` | Somente o worker do sistema pode falhar tarefas | `supabase/migrations/20260721223228_9f320c24-b3f3-4067-9e70-b9924824f7c9.sql` |
| `fail_web_scrape_task` | Tarefa não encontrada | `supabase/migrations/20260721223228_9f320c24-b3f3-4067-9e70-b9924824f7c9.sql` |
| `defer_web_scrape_task` | Somente o worker do sistema pode adiar tarefas | `supabase/migrations/20260721223228_9f320c24-b3f3-4067-9e70-b9924824f7c9.sql` |
| `capture_web_dlq_health_snapshots` | Acesso negado: requer papel de administrador | `supabase/migrations/20260722104240_34cd0552-a1fd-43e1-98fd-6aa0eb140c35.sql` |
| `pg_net_health` | Acesso negado: requer service_role ou admin | `supabase/migrations/20260722115903_e036397e-e483-46f6-8d8d-00fc632767e0.sql` |
| `prune_pg_net_health_snapshots` | Acesso negado: requer papel de administrador | `supabase/migrations/20260722123959_e7c39e43-b1a2-4861-a445-6343f477981a.sql` |
| `replay_web_dead_letter_batch` | Não autenticado | `supabase/migrations/20260723114921_c4f4d58e-b702-490c-bb58-304662fdca7e.sql` |
| `replay_web_dead_letter_batch` | Acesso negado à organização | `supabase/migrations/20260723114921_c4f4d58e-b702-490c-bb58-304662fdca7e.sql` |
| `fail_scrape_task` | Somente o worker do sistema pode falhar tarefas | `supabase/migrations/20260723134607_c87d89db-1d71-4e34-a4a1-e25d9aab0e75.sql` |
| `fail_scrape_task` | Tarefa não encontrada | `supabase/migrations/20260723134607_c87d89db-1d71-4e34-a4a1-e25d9aab0e75.sql` |
| `claim_scrape_tasks` | Somente o worker do sistema pode reservar tarefas | `supabase/migrations/20260726154832_c0dc9709-892f-472b-ad37-30beedd48605.sql` |
| `claim_web_scrape_tasks` | Somente o worker do sistema pode reservar tarefas | `supabase/migrations/20260726154832_c0dc9709-892f-472b-ad37-30beedd48605.sql` |
| `claim_instagram_tasks` | Somente o worker do sistema pode reservar tarefas do Instagram | `supabase/migrations/20260726154832_c0dc9709-892f-472b-ad37-30beedd48605.sql` |
| `apply_sla_recommendation` | forbidden: admin role required | `supabase/migrations/20260726155237_a262859f-a87b-4824-ab59-51e0702db5ee.sql` |
| `apply_sla_recommendation` | invalid queue_kind: % | `supabase/migrations/20260726155237_a262859f-a87b-4824-ab59-51e0702db5ee.sql` |
| `apply_sla_recommendation` | no recommendation available for queue % | `supabase/migrations/20260726155237_a262859f-a87b-4824-ab59-51e0702db5ee.sql` |
| `apply_sla_recommendation` | insufficient sample for queue % | `supabase/migrations/20260726155237_a262859f-a87b-4824-ab59-51e0702db5ee.sql` |
| `sla_autotune_blocked_streaks` | forbidden | `supabase/migrations/20260726160244_761f8ad7-97f4-42a1-a5b2-56668e573d89.sql` |

## E. Estados, máquinas de estado e transições

### E.1 Colunas de status no banco

| Tabela | Coluna | Valores permitidos (enum/CHECK) | Default |
|---|---|---|---|
| `companies` | `business_status` | **livre (sem enum/CHECK)** |  |
| `scrape_jobs` | `status` | **livre (sem enum/CHECK)** | `pending` |
| `workflows` | `status` | **livre (sem enum/CHECK)** | `draft` |
| `workflow_runs` | `status` | `cancelled`, `completed`, `failed`, `pending`, `queued`, `running` | `pending` |
| `workflow_runs` | `current_step` | **livre (sem enum/CHECK)** |  |
| `campaigns` | `status` | **livre (sem enum/CHECK)** | `draft` |
| `webhook_deliveries` | `status` | `failed`, `pending`, `retrying`, `sending`, `success` | `pending` |
| `campaign_recipients` | `status` | `bounced`, `failed`, `pending`, `queued`, `replied`, `sent`, `unsubscribed` | `pending` |
| `campaign_recipients` | `current_step` | **livre (sem enum/CHECK)** | `0` |
| `campaign_recipients` | `last_step_error` | **livre (sem enum/CHECK)** |  |
| `campaign_messages` | `step_index` | **livre (sem enum/CHECK)** | `0` |
| `email_sync_log` | `status` | `error`, `refresh_failed`, `skipped`, `success` |  |
| `health_checks` | `status` | `degraded`, `healthy`, `unhealthy` |  |
| `circuit_breakers` | `state` | `closed`, `half-open`, `open` | `closed` |
| `job_exports` | `status` | `failed`, `pending`, `processing`, `ready` | `pending` |
| `automation_steps` | `status` | `pending`, `running`, `completed`, `failed`, `cancelled` | `pending` |
| `scrape_queue` | `status` | `queued`, `processing`, `succeeded`, `dead` | `queued` |
| `automation_execution_logs` | `step_name` | **livre (sem enum/CHECK)** |  |
| `automation_execution_logs` | `step_index` | **livre (sem enum/CHECK)** |  |
| `automation_execution_logs` | `phase` | `cancel`, `claim`, `complete`, `dead_letter`, `execute`, `fail`, `retry` | `execute` |
| `automation_execution_logs` | `status` | `cancelled`, `dead`, `failed`, `retrying`, `started`, `succeeded` | `started` |
| `automation_execution_logs` | `http_status` | **livre (sem enum/CHECK)** |  |
| `lusha_contacts` | `enrichment_status` | **livre (sem enum/CHECK)** | `pending` |
| `lusha_dm_search_history` | `status` | `cancelled`, `done`, `failed`, `processing`, `queued` |  |
| `lusha_search_sessions` | `status` | **livre (sem enum/CHECK)** |  |
| `circuit_breaker_snapshots` | `state` | `closed`, `half-open`, `open` |  |
| `circuit_breaker_alert_history` | `state` | **livre (sem enum/CHECK)** |  |
| `vault_cookie_snapshots` | `health_status` | **livre (sem enum/CHECK)** |  |
| `web_scrape_queue` | `status` | `queued`, `processing`, `succeeded`, `failed`, `dead` | `queued` |
| `web_scrape_results` | `http_status` | **livre (sem enum/CHECK)** |  |
| `robots_cache` | `http_status` | **livre (sem enum/CHECK)** |  |
| `instagram_scrape_queue` | `status` | `dead`, `failed`, `queued`, `running`, `succeeded` | `queued` |
| `cnpj_enrich_cache` | `status` | `not_found`, `success` |  |
| `cnpj_enrich_queue` | `status` | `completed`, `failed`, `not_found`, `pending`, `processing` | `pending` |
| `apollo_search_cache` | `status` | `empty`, `hit` |  |
| `v_lux_enrichment_health` | `cnt_other_status` | **livre (sem enum/CHECK)** |  |

### E.2 Mapas de transição declarados no código

- **workflowApi** (`src/lib/api/workflows.ts`):
  ```ts
  async list(): Promise<Workflow[]> { return callWorkflowApi("list"); }, async create(data: { name: string; description: string; steps: WorkflowStep[]; config: Record<string, unknown> }): Promise<Workflow> { return callWorkflowApi("create", { method: "POST", body: JSON.stringify(data) }); }, async run(workflowId: string): Promise<{ run_id: string; results: WorkflowRunResults }> { return callWorkflowApi("run", { method: "POST", body: JSON.stringify({ workflow_id: workflowId }) }); }, async toggleStatus(workflowId: string, newStatus: string): Promise<void> { await callWorkflowApi("toggle-status", { method: "POST", body: JSON.stringify({ workflow_id: workflowId, new_status: newStatus }), }); }, a …
  ```

### E.3 Valores de status usados no código (escreve / compara / filtra)

| Campo | Valor | Uso | Onde |
|---|---|---|---|
| `step` | `batch_done` | escreve | `supabase/functions/oracle-enrich-contact/index.ts`<br>`supabase/functions/oracle-push-bitrix/index.ts` |
| `step` | `call` | escreve | `src/lib/demoData.ts` |
| `step` | `cb_check` | escreve | `supabase/functions/oracle-enrich-contact/index.ts`<br>`supabase/functions/oracle-push-bitrix/index.ts`<br>`supabase/functions/oracle-search-decisors/index.ts` |
| `step` | `company_search` | escreve | `supabase/functions/oracle-search-decisors/index.ts` |
| `step` | `config` | escreve | `supabase/functions/oracle-push-bitrix/index.ts` |
| `step` | `contact_created` | escreve | `supabase/functions/oracle-push-bitrix/index.ts` |
| `step` | `cookie_preflight` | escreve | `supabase/functions/oracle-enrich-contact/index.ts`<br>`supabase/functions/oracle-search-decisors/index.ts` |
| `step` | `dedup_leads` | escreve | `supabase/functions/oracle-search-decisors/index.ts` |
| `step` | `dept_fallback_apollo` | escreve | `supabase/functions/oracle-search-decisors/index.ts` |
| `step` | `dept_resolve` | escreve | `supabase/functions/oracle-search-decisors/index.ts` |
| `step` | `dept_search` | escreve | `supabase/functions/oracle-search-decisors/index.ts` |
| `step` | `dup_found` | escreve | `supabase/functions/oracle-push-bitrix/index.ts` |
| `step` | `email_intro` | escreve | `src/lib/demoData.ts` |
| `step` | `email_reengagement` | escreve | `src/lib/demoData.ts` |
| `step` | `enrich_email` | escreve | `supabase/functions/oracle-enrich-contact/index.ts` |
| `step` | `enrich_phone` | escreve | `supabase/functions/oracle-enrich-contact/index.ts` |
| `step` | `follow_up` | escreve | `src/lib/demoData.ts` |
| `step` | `follow_up_1` | escreve | `src/lib/demoData.ts` |
| `step` | `follow_up_2` | escreve | `src/lib/demoData.ts` |
| `step` | `idempotent_hit` | escreve | `supabase/functions/oracle-search-decisors/index.ts` |
| `step` | `insert_contacts` | escreve | `supabase/functions/oracle-search-decisors/index.ts` |
| `step` | `linkedin_connect` | escreve | `src/lib/demoData.ts` |
| `step` | `lock` | escreve | `supabase/functions/oracle-push-bitrix/index.ts` |
| `step` | `lock_contacts` | escreve | `supabase/functions/oracle-enrich-contact/index.ts` |
| `step` | `number` | compara | `supabase/functions/campaign-dispatch/index.ts` |
| `step` | `org_check` | escreve | `supabase/functions/oracle-enrich-contact/index.ts`<br>`supabase/functions/oracle-push-bitrix/index.ts`<br>`supabase/functions/oracle-search-decisors/index.ts` |
| `step` | `push_failed` | escreve | `supabase/functions/oracle-push-bitrix/index.ts` |
| `step` | `rate_limit` | escreve | `supabase/functions/oracle-push-bitrix/index.ts`<br>`supabase/functions/oracle-search-decisors/index.ts` |
| `step` | `scan` | compara | `src/components/auth/MFAEnroll.tsx` |
| `step` | `search_done` | escreve | `supabase/functions/oracle-search-decisors/index.ts` |
| `step` | `session_create` | escreve | `supabase/functions/oracle-search-decisors/index.ts` |
| `step` | `stage_verificando` | escreve | `supabase/functions/oracle-push-bitrix/index.ts` |
| `step` | `start` | compara | `src/components/auth/MFAEnroll.tsx` |
| `step` | `verify` | compara | `src/components/auth/MFAEnroll.tsx` |
| `status` | `CLOSED` | compara | `src/components/lux/LushaIntelligenceView.tsx` |
| `status` | `FAILED` | escreve | `supabase/functions/_shared/apify-gateway.ts` |
| `status` | `SUBSCRIBED` | compara | `src/components/lux/LushaIntelligenceView.tsx` |
| `status` | `SUCCEEDED` | escreve | `supabase/functions/_shared/apify-gateway.ts` |
| `status` | `accepting` | compara | `src/pages/AcceptInvite.tsx` |
| `status` | `active` | compara, escreve, filtra | `src/components/lux/AutomationsList.tsx`<br>`src/components/lux/CampaignsView.tsx`<br>`src/components/lux/WorkflowsView.tsx`<br>`src/components/lux/layout/Sidebar.tsx`<br>`src/components/lux/workflows/WorkflowCard.tsx`<br>… +3 |
| `status` | `all` | compara, escreve | `src/components/lux/LushaIntelligenceView.tsx`<br>`src/components/lux/lusha/SessionsPanel.tsx`<br>`src/components/lux/lusha/historyUtils.ts` |
| `status` | `bitrix_duplicate` | compara, escreve | `supabase/functions/oracle-push-bitrix/index.ts` |
| `status` | `blocked` | escreve | `supabase/functions/webhook-dispatcher/index.ts` |
| `status` | `bounced` | compara | `src/components/lux/campaigns/CampaignTrackingDrawer.tsx` |
| `status` | `cancelled` | compara, escreve | `src/components/lux/LushaIntelligenceView.tsx` |
| `status` | `completed` | compara, escreve, filtra | `src/components/lux/GmapsScraperView.tsx`<br>`src/components/lux/analytics/useAnalyticsData.ts`<br>`src/components/lux/automations/AutomationEventsFeed.tsx`<br>`src/components/lux/monitoring/AutomationStatusPanel.tsx`<br>`src/components/lux/monitoring/JobDetailsSheet.tsx`<br>… +10 |
| `status` | `connected` | escreve | `src/components/lux/SettingsView.tsx` |
| `status` | `crit` | compara | `src/components/lux/monitoring/SlaCompliancePanel.tsx` |
| `status` | `dead` | compara, escreve | `supabase/functions/instagram-worker/index.ts`<br>`supabase/functions/retry-policy-tuner/index.ts` |
| `status` | `degraded` | compara, escreve | `src/components/lux/monitoring/MonitoringView.tsx`<br>`supabase/functions/oracle-push-bitrix/index.ts`<br>`supabase/functions/oracle-search-decisors/index.ts` |
| `status` | `done` | compara, escreve | `src/components/lux/LushaIntelligenceView.tsx`<br>`src/components/lux/automations/AutomationStageBadge.tsx` |
| `status` | `draft` | escreve | `src/components/lux/CampaignsView.tsx`<br>`src/lib/demoData.ts` |
| `status` | `empty` | compara | `supabase/functions/_shared/apollo-cache.ts` |
| `status` | `enriched` | compara, escreve | `src/hooks/useOracleV2.ts`<br>`supabase/functions/oracle-enrich-contact/index.ts` |
| `status` | `enriching` | compara | `src/components/lux/lusha/OracleV2Panel.tsx` |
| `status` | `error` | compara, escreve | `src/components/lux/integrations/EmailSyncHistorySheet.tsx`<br>`src/pages/AcceptInvite.tsx`<br>`supabase/functions/_shared/oracle-logger.ts`<br>`supabase/functions/_shared/safe-update.ts`<br>`supabase/functions/email-poll-replies/index.ts`<br>… +7 |
| `status` | `error_auth` | compara | `supabase/functions/oracle-enrich-contact/index.ts` |
| `status` | `error_bitrix` | compara, escreve | `supabase/functions/oracle-push-bitrix/index.ts` |
| `status` | `error_other` | compara, escreve | `supabase/functions/oracle-enrich-contact/index.ts` |
| `status` | `error_rate_limit` | compara | `supabase/functions/oracle-enrich-contact/index.ts` |
| `status` | `expired` | compara, escreve | `src/components/lux/lusha/LushaCookieHealthBanner.tsx`<br>`supabase/functions/lusha-cookie-health/index.ts` |
| `status` | `expiring_soon` | compara | `src/components/lux/lusha/LushaCookieHealthBanner.tsx` |
| `status` | `failed` | compara, escreve | `src/components/lux/LushaIntelligenceView.tsx`<br>`src/components/lux/automations/AutomationEventsFeed.tsx`<br>`src/components/lux/campaigns/CampaignTrackingDrawer.tsx`<br>`src/components/lux/integrations/WebhooksPanel.tsx`<br>`src/components/lux/lusha/SessionsPanel.tsx`<br>… +10 |
| `status` | `fulfilled` | compara | `supabase/functions/oracle-enrich-contact/index.ts` |
| `status` | `healthy` | compara, escreve | `src/components/lux/lusha/LushaCookieHealthBanner.tsx`<br>`src/components/lux/monitoring/MonitoringView.tsx`<br>`supabase/functions/health/index.ts`<br>`supabase/functions/lusha-cookie-health/index.ts` |
| `status` | `hit` | compara, escreve | `supabase/functions/_shared/apollo-cache.ts` |
| `status` | `masked` | compara, escreve | `supabase/functions/_shared/lusha-client.ts` |
| `status` | `not_found` | compara, escreve | `src/hooks/useCnpjEnrich.ts`<br>`supabase/functions/cnpj-enrich-worker/index.ts`<br>`supabase/functions/cnpj-enrich/index.ts`<br>`supabase/functions/cnpj-settings-status/index.ts`<br>`supabase/functions/oracle-enrich-contact/index.ts` |
| `status` | `ok` | compara, escreve | `src/components/lux/GmapsScraperView.tsx`<br>`src/components/lux/monitoring/SlaCompliancePanel.tsx`<br>`src/pages/AcceptInvite.tsx` |
| `status` | `online` | compara, escreve | `src/components/lux/monitoring/MonitoringView.tsx` |
| `status` | `paused` | compara, escreve | `src/components/lux/workflows/WorkflowCard.tsx`<br>`src/lib/demoData.ts` |
| `status` | `pending` | compara, escreve, filtra | `src/components/lux/GmapsScraperView.tsx`<br>`src/components/lux/analytics/useAnalyticsData.ts`<br>`src/components/lux/campaigns/CampaignTrackingDrawer.tsx`<br>`src/components/lux/monitoring/JobDetailsSheet.tsx`<br>`src/hooks/useWebhooks.ts`<br>… +5 |
| `status` | `processing` | compara, escreve | `src/components/lux/LushaIntelligenceView.tsx`<br>`src/components/lux/lusha/historyUtils.ts`<br>`src/hooks/useAutomationsMonitor.ts` |
| `status` | `queued` | compara, escreve, filtra | `src/components/lux/LushaIntelligenceView.tsx`<br>`src/components/lux/campaigns/CampaignTrackingDrawer.tsx`<br>`src/components/lux/lusha/historyUtils.ts`<br>`src/hooks/useAutomationsMonitor.ts`<br>`src/hooks/useScrapeQueue.ts`<br>… +5 |
| `status` | `refresh_failed` | compara, escreve | `src/components/lux/integrations/EmailSyncHistorySheet.tsx`<br>`supabase/functions/email-poll-replies/index.ts` |
| `status` | `rejected` | compara | `supabase/functions/scrape-queue-worker/index.ts` |
| `status` | `replied` | compara | `src/components/lux/campaigns/CampaignTrackingDrawer.tsx` |
| `status` | `retry` | escreve | `supabase/functions/instagram-worker/index.ts` |
| `status` | `retrying` | compara | `src/components/lux/integrations/WebhooksPanel.tsx` |
| `status` | `running` | compara, escreve | `src/components/lux/AutomationsList.tsx`<br>`src/components/lux/GmapsScraperView.tsx`<br>`src/components/lux/analytics/useAnalyticsData.ts`<br>`src/components/lux/monitoring/AutomationStatusPanel.tsx`<br>`src/components/lux/monitoring/JobDetailsSheet.tsx`<br>… +7 |
| `status` | `sending` | escreve | `supabase/functions/webhook-dispatcher/index.ts` |
| `status` | `sent` | compara | `src/components/lux/campaigns/CampaignTrackingDrawer.tsx` |
| `status` | `sent_to_bitrix` | compara, escreve | `src/hooks/useOracleV2.ts`<br>`supabase/functions/oracle-push-bitrix/index.ts` |
| `status` | `skipped` | compara, escreve | `src/components/lux/integrations/EmailSyncHistorySheet.tsx`<br>`supabase/functions/email-poll-replies/index.ts`<br>`supabase/functions/oracle-enrich-contact/index.ts`<br>`supabase/functions/oracle-push-bitrix/index.ts`<br>`supabase/functions/webhook-dispatcher/index.ts` |
| `status` | `started` | compara | `src/components/lux/monitoring/AutomationStatusPanel.tsx` |
| `status` | `succeeded` | compara, escreve, filtra | `src/components/lux/automations/AutomationEventsFeed.tsx`<br>`src/components/lux/monitoring/AutomationStatusPanel.tsx`<br>`src/components/lux/monitoring/MultiQueueResilienceCard.tsx`<br>`supabase/functions/instagram-worker/index.ts`<br>`supabase/functions/retry-policy-tuner/index.ts` |
| `status` | `success` | compara, escreve | `src/components/lux/integrations/EmailSyncHistorySheet.tsx`<br>`src/components/lux/lusha/SessionsPanel.tsx`<br>`supabase/functions/cnpj-enrich-worker/index.ts`<br>`supabase/functions/cnpj-enrich/index.ts`<br>`supabase/functions/cnpj-settings-status/index.ts`<br>… +4 |
| `status` | `timeout` | escreve | `src/hooks/useCnpjEnrich.ts` |
| `status` | `unhealthy` | escreve | `supabase/functions/health/index.ts` |
| `status` | `unknown` | compara, escreve | `src/components/lux/lusha/LushaCookieHealthBanner.tsx`<br>`supabase/functions/lusha-cookie-health/index.ts` |
| `status` | `verified` | compara, escreve | `src/components/auth/MFAVerify.tsx`<br>`src/components/lux/settings/MFASetup.tsx`<br>`src/hooks/useMFA.ts`<br>`supabase/functions/_shared/leadcontact-client.ts` |
| `status` | `warn` | compara | `src/components/lux/monitoring/SlaCompliancePanel.tsx` |
| `status` | `warning` | escreve | `supabase/functions/oracle-search-decisors/index.ts` |
| `status` | `working` | compara | `src/components/lux/GmapsScraperView.tsx`<br>`src/components/lux/monitoring/JobDetailsSheet.tsx`<br>`src/pages/Monitoring.tsx` |
| `role` | `CEO` | escreve | `src/lib/demoData.ts` |
| `role` | `CFO` | escreve | `src/lib/demoData.ts` |
| `role` | `CTO` | escreve | `src/lib/demoData.ts` |
| `role` | `admin` | compara, escreve, filtra | `src/components/lux/OrganizationsView.tsx`<br>`src/components/lux/monitoring/ApiLatencyAlertSettingsCard.tsx`<br>`src/components/lux/monitoring/DlqAlertSettingsCard.tsx`<br>`src/hooks/usePermissions.ts`<br>`supabase/functions/dlq-alerts/index.ts`<br>… +8 |
| `role` | `agent` | compara, escreve | `src/components/lux/AIAgentView.tsx` |
| `role` | `sdr` | compara | `src/hooks/usePermissions.ts` |
| `role` | `system` | escreve | `supabase/functions/ai-agent/index.ts`<br>`supabase/functions/web-scrape-extract/index.ts` |
| `role` | `user` | compara, escreve | `src/components/lux/AIAgentView.tsx`<br>`supabase/functions/_shared/rlsTableRegistry.ts`<br>`supabase/functions/ai-agent/index.ts`<br>`supabase/functions/web-scrape-extract/index.ts` |
| `role` | `viewer` | compara | `src/hooks/usePermissions.ts` |
| `type` | `ADD_TOAST` | compara, escreve | `src/hooks/use-toast.ts` |
| `type` | `DISMISS_TOAST` | compara, escreve | `src/hooks/use-toast.ts` |
| `type` | `Image` | escreve | `supabase/functions/_shared/apify-fixtures.ts` |
| `type` | `REMOVE_TOAST` | compara, escreve | `src/hooks/use-toast.ts` |
| `type` | `Sidecar` | escreve | `supabase/functions/_shared/apify-fixtures.ts` |
| `type` | `UPDATE_TOAST` | compara, escreve | `src/hooks/use-toast.ts` |
| `type` | `Video` | escreve | `supabase/functions/_shared/apify-fixtures.ts` |
| `type` | `action` | escreve | `src/components/lux/WorkflowsView.tsx`<br>`src/components/lux/workflows/WorkflowCard.tsx`<br>`src/lib/demoData.ts` |
| `type` | `awards` | escreve | `src/components/lux/lusha/DecisionMakersGrid.tsx` |
| `type` | `certifications` | escreve | `src/components/lux/LushaIntelligenceView.tsx`<br>`src/components/lux/lusha/DecisionMakersGrid.test-d.ts`<br>`src/components/lux/lusha/DecisionMakersGrid.tsx` |
| `type` | `column` | escreve | `src/components/lux/deals/DealColumn.tsx` |
| `type` | `content_download` | escreve | `src/lib/demoData.ts` |
| `type` | `courses` | escreve | `src/components/lux/lusha/DecisionMakersGrid.tsx` |
| `type` | `deal` | compara, escreve | `src/components/lux/ActivityFeed.tsx`<br>`src/components/lux/deals/DealCard.tsx` |
| `type` | `discovery` | escreve | `src/hooks/useCompanyDetails.ts` |
| `type` | `email` | compara, escreve | `src/components/lux/CampaignsView.tsx`<br>`src/components/lux/campaigns/CampaignFormFields.tsx`<br>`supabase/functions/campaign-dispatch/index.ts` |
| `type` | `enrich` | escreve | `src/components/lux/WorkflowsView.tsx`<br>`src/components/lux/workflows/WorkflowCard.tsx`<br>`src/lib/demoData.ts` |
| `type` | `enrichment` | compara, escreve | `src/components/lux/ActivityFeed.tsx`<br>`src/hooks/useCompanyDetails.ts`<br>`src/lib/demoData.ts` |
| `type` | `error` | escreve | `src/lib/demoData.ts` |
| `type` | `filter` | escreve | `src/components/lux/WorkflowsView.tsx`<br>`src/components/lux/workflows/WorkflowCard.tsx`<br>`src/lib/demoData.ts` |
| `type` | `funding` | escreve | `src/lib/demoData.ts` |
| `type` | `image` | escreve | `supabase/functions/_shared/apify-fixtures.ts` |
| `type` | `job_completed` | escreve | `src/pages/Monitoring.tsx`<br>`supabase/functions/workflow-engine/index.ts` |
| `type` | `job_failed` | escreve | `src/pages/Monitoring.tsx` |
| `type` | `job_posting` | escreve | `src/lib/demoData.ts` |
| `type` | `json_object` | escreve | `supabase/functions/web-scrape-extract/index.ts` |
| `type` | `note` | escreve | `src/hooks/useDeals.ts`<br>`supabase/functions/_shared/rlsTableRegistry.ts` |
| `type` | `open` | escreve | `src/hooks/useDeals.ts` |
| `type` | `range` | compara, escreve | `src/components/lux/ICPConfigView.tsx`<br>`src/hooks/useICPConfig.ts` |
| `type` | `scrape` | escreve | `src/hooks/useRealtimeScrapeJobs.ts`<br>`src/lib/demoData.ts`<br>`supabase/functions/gmaps-proxy/index.ts` |
| `type` | `select` | compara, escreve | `src/components/lux/ICPConfigView.tsx`<br>`src/hooks/useICPConfig.ts` |
| `type` | `signal` | escreve | `src/hooks/useCompanyDetails.ts`<br>`src/lib/demoData.ts`<br>`supabase/functions/org-violation-alerts/index.ts` |
| `type` | `social_engagement` | escreve | `src/lib/demoData.ts` |
| `type` | `source` | escreve | `src/components/lux/WorkflowsView.tsx`<br>`src/components/lux/workflows/WorkflowCard.tsx`<br>`src/lib/api/workflows.ts`<br>`src/lib/demoData.ts` |
| `type` | `spring` | escreve | `src/components/lux/ActivityFeed.tsx`<br>`src/components/lux/AnalyticsView.tsx`<br>`src/components/lux/AppBreadcrumbs.tsx`<br>`src/components/lux/CompanyTable.tsx`<br>`src/components/lux/ConnectionStatus.tsx`<br>… +10 |
| `type` | `string` | compara | `supabase/functions/_shared/hiker-client.ts`<br>`supabase/functions/_shared/leadcontact-client.ts` |
| `type` | `success` | compara, escreve | `src/components/lux/StepProgress.tsx`<br>`src/lib/demoData.ts` |
| `type` | `system` | escreve | `src/lib/demoData.ts`<br>`supabase/functions/dlq-alerts/index.ts`<br>`supabase/functions/latency-alerts/index.ts`<br>`supabase/functions/lusha-search/index.ts`<br>`supabase/functions/pg-net-watchdog/index.ts`<br>… +3 |
| `type` | `tags` | compara, escreve | `src/components/lux/ICPConfigView.tsx`<br>`src/hooks/useICPConfig.ts` |
| `type` | `technology_change` | escreve | `src/lib/demoData.ts` |
| `type` | `text` | escreve | `src/lib/mcp/supabase.ts`<br>`src/lib/mcp/tools/get-company.ts`<br>`src/lib/mcp/tools/get-dashboard-stats.ts`<br>`src/lib/mcp/tools/list-companies.ts`<br>`src/lib/mcp/tools/list-decision-makers.ts`<br>… +2 |
| `type` | `totp` | escreve | `src/hooks/useMFA.ts` |
| `type` | `wait` | escreve | `src/components/lux/CampaignsView.tsx`<br>`src/components/lux/campaigns/CampaignFormFields.tsx` |
| `type` | `website_visit` | escreve | `src/lib/demoData.ts` |
| `enrichment_status` | `bitrix_duplicate` | compara, escreve | `src/components/lux/lusha/OracleV2Panel.tsx`<br>`supabase/functions/oracle-push-bitrix/index.ts` |
| `enrichment_status` | `enriched` | compara, escreve, filtra | `src/components/lux/LushaIntelligenceView.tsx`<br>`src/components/lux/lusha/OracleV2Panel.tsx`<br>`supabase/functions/oracle-push-bitrix/index.ts` |
| `enrichment_status` | `enriching` | compara, escreve, filtra | `src/components/lux/lusha/OracleV2Panel.tsx`<br>`supabase/functions/oracle-enrich-contact/index.ts` |
| `enrichment_status` | `error_bitrix` | compara, escreve | `src/components/lux/lusha/OracleV2Panel.tsx`<br>`supabase/functions/oracle-push-bitrix/index.ts` |
| `enrichment_status` | `error_other` | escreve | `supabase/functions/oracle-enrich-contact/index.ts` |
| `enrichment_status` | `not_found` | compara, escreve | `src/components/lux/lusha/OracleV2Panel.tsx`<br>`supabase/functions/oracle-enrich-contact/index.ts`<br>`supabase/functions/oracle-push-bitrix/index.ts` |
| `enrichment_status` | `pending` | escreve | `supabase/functions/lusha-search/index.ts` |
| `enrichment_status` | `pending_enrichment` | compara, escreve | `src/components/lux/lusha/OracleV2Panel.tsx`<br>`supabase/functions/lusha-decision-makers/index.ts`<br>`supabase/functions/oracle-search-decisors/index.ts` |
| `enrichment_status` | `pushing_bitrix` | escreve | `supabase/functions/oracle-push-bitrix/index.ts` |
| `enrichment_status` | `sent_to_bitrix` | compara, escreve, filtra | `src/components/lux/lusha/OracleV2Panel.tsx`<br>`supabase/functions/oracle-push-bitrix/index.ts` |
| `stage` | `enrichment` | compara | `src/components/lux/automations/AutomationStageBadge.tsx` |
| `stage` | `getDatasetItems` | escreve | `supabase/functions/_shared/apify-gateway.ts` |
| `stage` | `startActorRun` | escreve | `supabase/functions/_shared/apify-gateway.ts` |
| `phase` | `all` | compara, escreve | `src/components/lux/monitoring/AutomationLogsPanel.tsx`<br>`src/hooks/useAutomationLogs.ts` |
| `phase` | `execute` | filtra | `supabase/functions/retry-policy-tuner/index.ts` |
| `phase` | `fail` | escreve | `supabase/functions/web-scrape-worker/index.ts` |
| `phase` | `preflight` | escreve | `supabase/functions/oracle-cookies-preflight/index.ts` |
| `state` | `closed` | compara, escreve | `src/components/lux/monitoring/CircuitBreakerPanel.tsx`<br>`supabase/functions/_shared/circuit-breaker.ts` |
| `state` | `collapsed` | compara | `src/components/ui/sidebar.tsx` |
| `state` | `expanded` | escreve | `src/components/ui/use-sidebar.ts` |
| `state` | `half-open` | compara, escreve, filtra | `supabase/functions/_shared/circuit-breaker.ts` |
| `state` | `open` | compara, filtra | `src/components/lux/monitoring/CircuitBreakerPanel.tsx`<br>`supabase/functions/_shared/circuit-breaker.ts` |
| `state` | `string` | compara | `supabase/functions/email-oauth-callback/index.ts` |
| `campaign_status` | `draft` | escreve | `src/integrations/supabase/types.ts` |
| `scrape_queue_status` | `queued` | escreve | `src/integrations/supabase/types.ts` |
| `health_status` | `error` | compara | `supabase/functions/lusha-cookie-health/index.ts`<br>`supabase/functions/lusha-search/index.ts`<br>`supabase/functions/oracle-cookies-preflight/index.ts` |
| `health_status` | `expired` | compara, escreve | `supabase/functions/_shared/cookies.ts`<br>`supabase/functions/lusha-cookie-health/index.ts`<br>`supabase/functions/lusha-search/index.ts`<br>`supabase/functions/oracle-cookies-preflight/index.ts` |
| `health_status` | `expiring_soon` | compara | `supabase/functions/lusha-cookie-health/index.ts` |
| `current_step` | `enrich` | escreve | `supabase/functions/workflow-engine/index.ts` |
| `current_step` | `ipc_score` | escreve | `supabase/functions/workflow-engine/index.ts` |
| `current_step` | `save` | escreve | `supabase/functions/workflow-engine/index.ts` |
| `current_step` | `scrape` | escreve | `supabase/functions/workflow-engine/index.ts` |

### E.4 Enums e listas de valores

| Nome | Valores | Onde |
|---|---|---|
| app_role | `admin`, `sdr`, `viewer` | banco |
| audit_action | `execute`, `create`, `update`, `delete` | banco |
| automation_status | `pending`, `running`, `completed`, `failed`, `cancelled` | banco |
| campaign_status | `draft`, `active`, `paused`, `completed`, `archived` | banco |
| scrape_job_status | `pending`, `running`, `working`, `completed`, `failed`, `cancelled` | banco |
| scrape_queue_status | `queued`, `processing`, `succeeded`, `dead` | banco |
| web_scrape_status | `queued`, `processing`, `succeeded`, `failed`, `dead` | banco |
| workflow_status | `draft`, `active`, `paused`, `completed`, `failed`, `running`, `archived` | banco |
| StepType | email \| wait \| condition \| notify \| webhook \| tag | `src/components/automation/WorkflowEditor.tsx` |
| ScoreRange | all \| 90+ \| 75-89 \| 60-74 \| <60 | `src/components/lux/company-filters-utils.ts` |
| DMHistoryStatus | done \| failed \| cancelled \| processing \| queued | `src/components/lux/lusha/historyUtils.ts` |
| InviteFilter | all \| pending \| accepted \| revoked \| expired | `src/components/lux/organizations/InviteSection.tsx` |
| LatencySeverity | critical \| warning \| ok | `src/hooks/useApiLatency.ts` |
| AUTOMATION_TABLES | "scrape_jobs", "workflow_runs", "workflows", "automation_steps", | `src/hooks/useAuditTrail.ts` |
| AutomationStage | scraping \| enrichment \| localization | `src/hooks/useAutomationsMonitor.ts` |
| StageStatus | done \| pending | `src/hooks/useAutomationsMonitor.ts` |
| CircuitBreakerState | closed \| open \| half-open | `src/hooks/useCircuitBreakers.ts` |
| CnpjEnrichStatus | idle \| loading \| queued \| success \| not_found \| invalid \| error | `src/hooks/useCnpjEnrich.ts` |
| AlertSeverity | critical \| warning \| ok | `src/hooks/useDbHealth.ts` |
| DlqQueueKind | scrape \| web | `src/hooks/useDlqAlertSettings.ts` |
| DlqHealthSeverity | critical \| warning \| ok | `src/hooks/useDlqHealth.ts` |
| DlqMotor | instagram \| web | `src/hooks/useDlqReplay.ts` |
| EmailAccountAuditAction | connected \| disconnected \| scope_changed \| tokens_refreshed \| reactivated \| deactivated \| error_recorded \| polled \| updated | `src/hooks/useEmailAccountAuditLog.ts` |
| SuppressionReason | unsubscribe \| bounce \| complaint \| manual | `src/hooks/useEmailSuppressions.ts` |
| EmailSyncStatus | success \| error \| skipped \| refresh_failed | `src/hooks/useEmailSyncLog.ts` |
| MembershipAuditAction | added \| removed \| role_changed \| left \| other | `src/hooks/useMembershipAuditLog.ts` |
| View | dashboard \| icp \| workflows \| companies \| intent \| campaigns \| ai-agent \| analytics \| settings \| gmaps \| map \| stakeholders \| scrape-results \| organizations \| deals \| integrations \| org-violations \| rls-discovery \| monitoring \| automations \| recycle-bin \| suppressions \| lusha | `src/hooks/useNavigationHistory.ts` |
| NavigationDirection | forward \| back | `src/hooks/useNavigationHistory.ts` |
| ReaperAlertReason | dead_detected \| no_recent_run | `src/hooks/useReaperAlerts.ts` |
| Skin | gold \| blue \| green \| red \| purple \| orange | `src/hooks/useSkin.ts` |
| WEBHOOK_EVENTS | "companies.insert", "companies.update", "companies.delete", "deals.insert", "deals.update", "deals.delete", "stakeholders.insert", "stakeholders.update", "stakeholders.delete", "security.org_violation_threshold", "scrape_jobs.completed", "scrape_jobs.failed", "workflows.completed", "workflows.failed … | `src/hooks/useWebhooks.ts` |
| SoftDeleteTable | companies \| deals \| campaigns \| workflows | `src/integrations/supabase/withOrg.ts` |
| EmailErrorKind | auth \| sync | `src/lib/emailErrorMessages.ts` |
| EmailErrorSeverity | warning \| error \| fatal | `src/lib/emailErrorMessages.ts` |
| AppRole | admin \| sdr \| viewer | `src/lib/permissions.ts` |
| Action | view \| create \| edit \| delete \| manage | `src/lib/permissions.ts` |
| Entity | companies \| stakeholders \| deals \| campaigns \| workflows \| scrape_jobs \| integrations \| members \| invites \| audit_logs | `src/lib/permissions.ts` |
| CheckSeverity | ok \| warning \| error | `src/lib/redirectUriChecklist.ts` |
| ContactSource | lusha \| apollo | `src/lib/sourceQualityReport.ts` |
| SortKey | date \| volume | `src/lib/dlq/aggregations.ts` |
| SortDir | asc \| desc | `src/lib/dlq/aggregations.ts` |
| Classification | improved \| regressed \| stable \| new \| removed | `src/lib/resilience/compareReport.ts` |
| GapSeverity | critical \| warning \| info | `src/lib/resilience/report.ts` |
| FaultType | timeout \| rate_limit \| server_5xx \| client_4xx \| unavailable | `src/lib/resilience/simulator.ts` |
| FaultKind | rate_limit_429 \| timeout \| actor_run_failed \| empty_dataset | `supabase/functions/_shared/apify-gateway.ts` |
| ApifyRunStatus | READY \| RUNNING \| SUCCEEDED \| FAILED \| TIMING-OUT \| TIMED-OUT \| ABORTING \| ABORTED | `supabase/functions/_shared/apify-gateway.ts` |
| ApolloRateReason | ok \| cooldown \| minute_limit \| daily_limit \| unavailable | `supabase/functions/_shared/apollo-cache.ts` |
| ServicoCookie | lusha \| leadcontact \| linkedin | `supabase/functions/_shared/cookies.ts` |
| HikerErrorClass | rate_limit \| server \| network \| client \| not_found \| auth \| timeout | `supabase/functions/_shared/hiker-client.ts` |
| InstagramTargetType | profile \| posts \| hashtag \| comments | `supabase/functions/_shared/instagram-config-hash.ts` |
| OmkarReviewsSort | newest \| most_relevant \| highest_rating \| lowest_rating | `supabase/functions/_shared/omkar-gmaps-config.ts` |
| LogLevel | info \| warn \| error | `supabase/functions/_shared/oracle-logger.ts` |
| AppEnv | dev \| staging \| prod | `supabase/functions/_shared/rlsTableRegistry.ts` |
| ScrapeJobStatus | pending \| running \| completed \| failed \| paused | `supabase/functions/_shared/domain/scrape-job-machine.ts` |

## F. Validações de entrada

### F.1 Schemas Zod

- **schema** (`src/components/lux/ProxyFormDialog.tsx`, z.object):
  ```ts
  { label: z.string().trim().min(1, "Informe um rótulo").max(80), proxy_type: z.enum(["http", "https", "socks5"]), url: z .string() .trim() .min(5, "URL inválida") .max(500) .refine((v) => /^(https?|socks5):\/\//i.test(v), "URL deve começar com http://, https:// ou socks5://"), is_active: z.boolean(), }
  ```
  - Regras cruzadas (refine): “URL deve começar com http://, https:// ou socks5://”
- **loginSchema** (`src/lib/schemas/auth.ts`, z.object):
  ```ts
  { email: z .string() .trim() .min(1, "O email é obrigatório.") .email("Formato de email inválido.") .max(255, "Email muito longo."), password: z .string() .min(1, "A senha é obrigatória."), }
  ```
- **signupSchema** (`src/lib/schemas/auth.ts`, z.object):
  ```ts
  { email: z .string() .trim() .min(1, "O email é obrigatório.") .email("Formato de email inválido.") .max(255, "Email muito longo."), password: z .string() .min(8, "A senha deve ter pelo menos 8 caracteres.") .max(72, "A senha deve ter no máximo 72 caracteres.") .regex(/[A-Z]/, "A senha deve conter ao menos uma letra maiúscula.") .regex(/[0-9]/, "A senha deve conter ao menos um número.") .regex(/[^A-Za-z0-9]/, "A senha deve conter ao menos um caractere especial."), }
  ```
- **resetEmailSchema** (`src/lib/schemas/auth.ts`, z.object):
  ```ts
  { email: z .string() .trim() .min(1, "O email é obrigatório.") .email("Formato de email inválido."), }
  ```
- **newPasswordSchema** (`src/lib/schemas/auth.ts`, z.object, encadeia refine):
  ```ts
  { password: z .string() .min(8, "A senha deve ter pelo menos 8 caracteres.") .max(72, "A senha deve ter no máximo 72 caracteres.") .regex(/[A-Z]/, "A senha deve conter ao menos uma letra maiúscula.") .regex(/[0-9]/, "A senha deve conter ao menos um número.") .regex(/[^A-Za-z0-9]/, "A senha deve conter ao menos um caractere especial."), confirmPassword: z.string(), }
  ```
  - Regras cruzadas (refine): “As senhas não coincidem.”
- **campaignSchema** (`src/lib/schemas/campaign.ts`, z.object):
  ```ts
  { name: z.string().min(1, "Nome é obrigatório").max(200, "Máximo 200 caracteres"), prospects: z.number().min(0, "Mínimo 0").max(100000, "Máximo 100.000"), }
  ```
- **companySchema** (`src/lib/schemas/company.ts`, z.object):
  ```ts
  { name: z.string().min(1, "Nome é obrigatório").max(200, "Máximo 200 caracteres"), cnpj: z .string() .max(20, "Máximo 20 caracteres") .optional() .or(z.literal("")) .refine( (val) => !val || isValidCnpj(val), "CNPJ inválido (14 dígitos e verificadores)", ) .transform((val) => (val ? normalizeCnpj(val) : val)), sector: z.string().max(100, "Máximo 100 caracteres").optional().or(z.literal("")), location: z.string().max(200, "Máximo 200 caracteres").optional().or(z.literal("")), email: z.union([ z.string().email("Email inválido"), z.literal(""), ]).optional(), phone: z.string().max(30, "Máximo 30 caracteres").optional().or(z.literal("")), website: z.union([ z.string().url("URL inválida"), z.literal(""), ]).optional(), linkedin_url: z.union([ z.string().url("URL do LinkedIn inválida"), z.litera …
  ```
  - Regras cruzadas (refine): “CNPJ inválido (14 dígitos e verificadores)”
- **scrapeJobSchema** (`src/lib/schemas/scrapeJob.ts`, z.object):
  ```ts
  { name: z.string().min(1, "Nome é obrigatório").max(200, "Máximo 200 caracteres"), keywords: z.string().min(1, "Palavras-chave são obrigatórias").max(500, "Máximo 500 caracteres"), lang: z.enum(["pt", "en", "es"], { message: "Idioma inválido" }), radius: z.number().min(500, "Mínimo 500m").max(50000, "Máximo 50km"), depth: z.number().min(1, "Mínimo 1").max(5, "Máximo 5"), email: z.boolean(), fast_mode: z.boolean(), auto_sync: z.boolean().default(false), // Alinhamento com o contrato do omkarcloud/google-maps-scraper. // Opcionais: ignorados pelo provedor padrão (gosom). country: z.string().length(2, "Use o código ISO de 2 letras").optional(), business_type: z.string().max(120, "Máximo 120 caracteres").optional(), max_cities: z.number().int().positive().max(10000).optional(), max_results: z. …
  ```
- **ScrapeJobConfigSchema** (`supabase/functions/_shared/schemas.ts`, z.object):
  ```ts
  { keywords: z.array(z.string().min(1).max(200)).min(1).max(20), lang: z.string().min(2).max(5).default("pt"), zoom: z.number().int().min(1).max(21).default(15), lat: z.string().max(30).default("0"), lon: z.string().max(30).default("0"), fast_mode: z.boolean().default(false), radius: z.number().int().min(100).max(100000).default(10000), depth: z.number().int().min(1).max(10).default(1), email: z.boolean().default(true), max_time: z.number().int().positive().default(480000000000), proxies: z.array(z.string().max(500)).max(10).default([]), extra_reviews: z.boolean().default(false), // Campos do contrato omkarcloud/google-maps-scraper. Opcionais: o provedor // padrão (gosom) simplesmente os ignora. country: z.string().min(2).max(2).optional(), business_type: z.string().max(120).optional(), max …
  ```
- **CreateScrapeJobSchema** (`supabase/functions/_shared/schemas.ts`, z.object):
  ```ts
  { name: z.string().min(1).max(255), auto_sync: z.boolean().default(false), config: ScrapeJobConfigSchema, }
  ```
- **ScoringCriteriaSchema** (`supabase/functions/_shared/schemas.ts`, z.object):
  ```ts
  { sectors: z.array(z.string()).optional(), locations: z.array(z.string()).optional(), }
  ```
- **IPCConfigSchema** (`supabase/functions/_shared/schemas.ts`, z.object):
  ```ts
  { name: z.string().min(1), criteria: ScoringCriteriaSchema, is_active: z.boolean().default(false), }
  ```
- **MessageSchema** (`supabase/functions/ai-agent/index.ts`, z.object):
  ```ts
  { message: z.string().min(1, "Message is required").max(2000, "Message too long"), }
  ```
- **BodySchema** (`supabase/functions/cnpj-enrich/index.ts`, z.object):
  ```ts
  { cnpj: z.string().min(11).max(20) }
  ```
- **BodySchema** (`supabase/functions/gmaps-places-search/index.ts`, z.object):
  ```ts
  { query: z.string().min(2).max(500), max_results: z.number().int().min(1).max(20).optional(), language: z.string().min(2).max(5).default("pt-BR"), }
  ```
- **CreateJobSchema** (`supabase/functions/gmaps-proxy/index.ts`, z.object):
  ```ts
  { name: z.string().min(1).max(255), keywords: z.array(z.string().min(1).max(200)).min(1).max(20), lang: z.string().min(2).max(5).optional(), zoom: z.number().optional(), lat: z.string().optional(), lon: z.string().optional(), fast_mode: z.boolean().optional(), radius: z.number().optional(), depth: z.number().optional(), email: z.boolean().optional(), max_time: z.number().optional(), proxies: z.array(z.string()).optional(), }
  ```
- **SyncResultsSchema** (`supabase/functions/gmaps-proxy/index.ts`, z.object):
  ```ts
  { job_id: z.string().uuid("Invalid job_id"), }
  ```
- **ActionSchema** (`supabase/functions/gmaps-proxy/index.ts`, z.enum):
  ```ts
  ["list", "create", "delete", "sync-results", "export"]
  ```
- **BodySchema** (`supabase/functions/instagram-dlq-replay/index.ts`, z.object):
  ```ts
  { organization_id: z.string().uuid(), dlq_ids: z.array(z.string().uuid()).max(500).optional(), limit: z.number().int().min(1).max(500).optional(), reason: z.string().min(1).max(200).optional(), }
  ```
- **SearchSchema** (`supabase/functions/lusha-search/index.ts`, z.object):
  ```ts
  { company_name: z.string().min(1).max(255), departments: z.array(z.string().min(1).max(100)).min(1).max(10), company_id: z.string().uuid().optional(), bitrix_card_id: z.string().optional(), bitrix_user_id: z.string().optional(), session_size: z.number().int().min(1).max(25).default(20), }
  ```
- **InputSchema** (`supabase/functions/oracle-enrich-contact/index.ts`, z.object):
  ```ts
  { contact_ids: z.array(z.string().uuid()).min(1).max(50), }
  ```
- **InputSchema** (`supabase/functions/oracle-push-bitrix/index.ts`, z.object):
  ```ts
  { contact_ids: z.array(z.string().uuid()).min(1).max(50), bitrix_company_id: z.string().min(1).max(32).optional(), bitrix_assigned_by_id: z.coerce.number().int().positive().optional(), }
  ```
- **InputSchema** (`supabase/functions/oracle-search-decisors/index.ts`, z.object):
  ```ts
  { company_name: z.string().min(2).max(200), departments: z.array(z.string().min(1).max(80)).min(1).max(20), organization_id: z.string().uuid(), company_id: z.string().uuid().optional(), session_id: z.string().uuid().optional(), max_per_department: z.number().int().min(1).max(50).default(25), bitrix_company_id: z.string().min(1).max(32).optional(), bitrix_user_id: z.string().min(1).max(32).optional(), }
  ```
- **BodySchema** (`supabase/functions/web-dlq-replay/index.ts`, z.object):
  ```ts
  { organization_id: z.string().uuid(), dlq_ids: z.array(z.string().uuid()).max(500).optional(), limit: z.number().int().min(1).max(500).optional(), reason: z.string().min(1).max(200).optional(), }
  ```
- **BodySchema** (`supabase/functions/web-scrape-enqueue/index.ts`, z.object):
  ```ts
  { url: z.string().url().refine((u) => u.startsWith("http://") || u.startsWith("https://"), { message: "URL deve ser http(s)", }), formats: z.array(z.enum(["markdown", "html", "links"])).min(1).max(3).default(["markdown"]), extract_schema: z.record(z.unknown()).optional(), wait_for_ms: z.number().int().min(0).max(15000).default(0), max_bytes: z.number().int().min(1024).max(10 * 1024 * 1024).default(2 * 1024 * 1024), priority: z.number().int().min(0).max(10).default(0), // SLA opcional (segundos). Se omitido é derivado abaixo por heurística. sla_seconds: z.number().int().min(10).max(3600).optional(), }
  ```
  - Regras cruzadas (refine): “URL deve ser http(s)”
- **BodySchema** (`supabase/functions/web-scrape-extract/index.ts`, z.object):
  ```ts
  { task_id: z.string().uuid(), schema: z.record(z.unknown()), instruction: z.string().min(1).max(1000).default("Extraia os campos do schema a partir do markdown."), }
  ```
- **CreateWorkflowSchema** (`supabase/functions/workflow-engine/index.ts`, z.object):
  ```ts
  { name: z.string().min(1).max(255), description: z.string().max(1000).optional().default(""), steps: z.array(z.record(z.unknown())).min(1).max(20), config: z.record(z.unknown()).default({}), }
  ```
- **RunWorkflowSchema** (`supabase/functions/workflow-engine/index.ts`, z.object):
  ```ts
  { workflow_id: z.string().uuid("Invalid workflow_id"), }
  ```
- **ToggleStatusSchema** (`supabase/functions/workflow-engine/index.ts`, z.object):
  ```ts
  { workflow_id: z.string().uuid("Invalid workflow_id"), new_status: z.enum(["active", "paused", "draft"]), }
  ```
- **ActionSchema** (`supabase/functions/workflow-engine/index.ts`, z.enum):
  ```ts
  ["list", "create", "run", "retry-step", "toggle-status", "delete"]
  ```

### F.2 react-hook-form (register/rules)

_nenhum item encontrado_

### F.3 Restrições em inputs HTML (required/min/max/pattern)

| Campo | Restrições | Arquivo |
|---|---|---|
| `settings-email` | disabled | `src/components/lux/SettingsView.tsx` |
| `settings-new-password` | type=password | `src/components/lux/SettingsView.tsx` |
| `settings-confirm-password` | type=password | `src/components/lux/SettingsView.tsx` |
| `id` | type=email | `src/components/lux/auth/EmailInput.tsx` |
| `lat-pc` | type=number, min=1, disabled=!isAdmin \|\| !state | `src/components/lux/monitoring/ApiLatencyAlertSettingsCard.tsx` |
| `lat-cons` | type=number, min=1, max=24, disabled=!isAdmin \|\| !state | `src/components/lux/monitoring/ApiLatencyAlertSettingsCard.tsx` |
| `lat-cd` | type=number, min=1, max=168, disabled=!isAdmin \|\| !state | `src/components/lux/monitoring/ApiLatencyAlertSettingsCard.tsx` |
| `dlq-pc` | type=number, min=1, disabled=!isAdmin \|\| !state | `src/components/lux/monitoring/DlqAlertSettingsCard.tsx` |
| `dlq-cons` | type=number, min=1, max=24, disabled=!isAdmin \|\| !state | `src/components/lux/monitoring/DlqAlertSettingsCard.tsx` |
| `dlq-cd` | type=number, min=1, max=168, disabled=!isAdmin \|\| !state | `src/components/lux/monitoring/DlqAlertSettingsCard.tsx` |
| `concurrent` | type=number, min=1, max=100 | `src/components/lux/monitoring/OrgRateLimitsView.tsx` |
| `perhour` | type=number, min=1, max=10000 | `src/components/lux/monitoring/OrgRateLimitsView.tsx` |
| `sla-window` | type=number, min=1, max=168 | `src/components/lux/monitoring/SlaAlertSettingsCard.tsx` |
| `sla-breach` | type=number, min=1, max=100, step=0.1 | `src/components/lux/monitoring/SlaAlertSettingsCard.tsx` |
| `sla-sample` | type=number, min=1, max=10000, min | `src/components/lux/monitoring/SlaAlertSettingsCard.tsx` |
| `sla-cooldown` | type=number, min=1, max=168 | `src/components/lux/monitoring/SlaAlertSettingsCard.tsx` |
| `ws-wait` | type=number, min=0, max=15000 | `src/components/lux/monitoring/WebScrapeView.tsx` |
| `ws-max` | max, type=number, min=1024, max=10 * 1024 * 1024, max | `src/components/lux/monitoring/WebScrapeView.tsx` |
| `alerts-threshold` | type=number, min=1 | `src/components/lux/security/OrgViolationAlertsPanel.tsx` |
| `alerts-window` | type=number, min=5, max=1440 | `src/components/lux/security/OrgViolationAlertsPanel.tsx` |
| `alerts-cooldown` | type=number, min=1, max=1440 | `src/components/lux/security/OrgViolationAlertsPanel.tsx` |

## G. Fórmulas e derivações (como valores são calculados)

### G.1 Colunas calculadas no banco

_nenhum item encontrado_

### G.2 Views (consultas derivadas)

| View | SELECT |
|---|---|
| `oracle_v2_health` | `SELECT organization_id, source, count(*) FILTER (WHERE created_at >= now() - interval '24 hours') AS events_24h, count(*) FILTER (WHERE status = 'error' AND created_at >= now() - interval '24 hours') AS errors_24h, count(*) FILTER (WHERE status = 'success' AND created_at >= now() - interval '24 hour …` |

### G.3 Funções de cálculo/decisão no código

- **invalidate()** — `src/components/lux/RecycleBinView.tsx`
  ```
  queryClient.invalidateQueries({ queryKey: ["trash", table] }); queryClient.invalidateQueries({ queryKey: [`${table}-list`] }); queryClient.invalidateQueries({ queryKey: [table] });
  ```
- **computeIPC(raw: RawData)** — `src/components/lux/ScrapeResultsView.tsx`
  ```
  let s = 50; if (pickString(raw, ["email"])) s += 15; if (pickString(raw, ["phone"])) s += 10; if (pickString(raw, ["website", "web_site"])) s += 10; const rating = pickString(raw, ["rating"]); if (rating && parseFloat(rating) >= 4) s += 15; return Math.min(s, 100);
  ```
- **generateSparkData(seed: number, points = 7)** — `src/components/lux/StatsGrid.tsx`
  ```
  const data: number[] = []; let val = Math.max(seed * 0.4, 1); for (let i = 0; i < points; i++) { val = Math.max(0, val + (Math.sin(seed + i * 1.3) * seed * 0.15)); data.push(Math.round(val)); } // Ensure last point trends toward current value data[data.length - 1] = seed; return data;
  ```
- **generateNonce(bytes = 24)** — `src/components/lux/integrations/AuthUrlConfirmDialog.tsx`
  ```
  const arr = new Uint8Array(bytes); crypto.getRandomValues(arr); return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
  ```
- **apply(p: EnvProfile)** — `src/components/lux/integrations/EnvProfilesPanel.tsx`
  ```
  setActiveId(p.id); onApply(p.redirect_uri, p); toast({ title: `Perfil "${p.name}" aplicado`, description: p.redirect_uri });
  ```
- **calculateDuration()** — `src/components/lux/monitoring/JobDetailsSheet.tsx`
  ```
  if (!job?.started_at) return "0s"; const end = job.completed_at ? new Date(job.completed_at) : new Date(); const diff = differenceInSeconds(end, new Date(job.started_at)); if (diff < 60) return `${diff}s`; return `${Math.floor(diff / 60)}m ${diff % 60}s`;
  ```
- **validate()** — `src/components/lux/monitoring/OrgRateLimitsView.tsx`
  ```
  if (concurrent < 1 || concurrent > 100) return "Simultaneidade deve estar entre 1 e 100"; if (perHour < 1 || perHour > 10000) return "Jobs por hora deve estar entre 1 e 10.000"; return null;
  ```
- **computeStatus(snap: SnapshotRow | undefined)** — `src/components/lux/monitoring/VaultCookiesPanel.tsx`
  ```
  if (!snap) { return { label: "Sem dados", icon: ShieldQuestion, badge: "border-muted-foreground/40 text-muted-foreground bg-muted/10", dot: "bg-muted-foreground", desc: "Nenhuma checagem registrada ainda.", }; } if (!snap.vault_available) { return { label: "Vault indisponível", icon: ShieldAlert, badge: "border-red-500/40 text-red-400 bg-red-500/10", dot: "bg-red-400", desc: snap.error_message ?? "Sem detalhes.", }; } if (snap.is_healthy === false) { return { label: "Não saudável", icon: ShieldA …
  ```
- **copyGenerated()** — `src/components/lux/settings/RLSDiscoveryView.tsx`
  ```
  try { await navigator.clipboard.writeText(generatedSnippet); toast({ title: "Payload copiado", description: `Cole em RLS_TABLES para ${genTable}` }); } catch { toast({ variant: "destructive", title: "Falha ao copiar" }); }
  ```
- **computeBitrixReadiness(bitrixCompanyId: string, bitrixUserId: string,)** — `src/hooks/oracleV2Helpers.ts`
  ```
  const companyOk = bitrixCompanyId.trim().length > 0; const userTrim = bitrixUserId.trim(); const userOk = userTrim.length > 0 && /^\d+$/.test(userTrim); if (companyOk && userOk) return { pronto: true, motivoBloqueio: null }; const faltas: string[] = []; if (!companyOk) faltas.push("ID da empresa no Bitrix"); if (userTrim.length === 0) faltas.push("ID do responsável no Bitrix"); else if (!/^\d+$/.test(userTrim)) faltas.push("ID do responsável precisa ser numérico"); return { pronto: false, motivo …
  ```
- **generateKey()** — `src/hooks/useApiKeys.ts`
  ```
  full: string; prefix: string
  ```
- **invalidate(key: string)** — `src/hooks/useAutomationsMonitor.ts`
  ```
  
  ```
- **computeAlerts(snapshots: DbHealthSnapshot[])** — `src/hooks/useDbHealth.ts`
  ```
  if (snapshots.length === 0) return []; const latest = snapshots[0]; const history = snapshots.slice(1); // baseline exclui o ponto atual const alerts: HealthAlert[] = []; // --- Saturação de conexões --- const connBaseline = history.map((s) => s.connection_pct); const connMean = mean(connBaseline); const connSd = stddev(connBaseline); const connThreshold = Math.max(connMean + 2 * connSd, 80); alerts.push({ key: "connections", label: "Conexões", value: `${latest.connection_pct}% (${latest.active_ …
  ```
- **calc(base: string, weights: number[])** — `src/lib/cnpj.ts`
  ```
  const sum = base.split("").reduce((acc, d, i) => acc + Number(d) * weights[i], 0); const rest = sum % 11; return rest < 2 ? 0 : 11 - rest;
  ```
- **totalsForSource(rows: readonly SourceQualityRow[], source: ContactSource,)** — `src/lib/sourceQualityReport.ts`
  ```
  const scoped = rows.filter((row) => row.source === source); const total = scoped.reduce((sum, row) => sum + (row.total ?? 0), 0); const withEmail = scoped.reduce((sum, row) => sum + (row.with_email ?? 0), 0); const brCount = scoped.reduce((sum, row) => sum + (row.br_count ?? 0), 0); const suppressed = scoped.reduce((sum, row) => sum + (row.suppressed ?? 0), 0); return { source, total, with_email: withEmail, br_count: brCount, suppressed, email_rate: rate(withEmail, total), br_rate: rate(brCount, …
  ```
- **generateTraceId()** — `src/lib/utils.ts`
  ```
  return Array.from(crypto.getRandomValues(new Uint8Array(16))) .map(b => b.toString(16).padStart(2, '0')) .join('');
  ```
- **generateSpanId()** — `src/lib/utils.ts`
  ```
  return Array.from(crypto.getRandomValues(new Uint8Array(8))) .map(b => b.toString(16).padStart(2, '0')) .join('');
  ```
- **computePeriodStats(rows: AlertHistoryPoint[])** — `src/lib/dlq/aggregations.ts`
  ```
  if (rows.length === 0) return null; const pendings = rows.map((h) => h.pending_items); const total = pendings.reduce((a, b) => a + b, 0); const notified = rows.reduce((a, h) => a + h.admins_notified, 0); return { count: rows.length, avg: Math.round(total / rows.length), peak: Math.max(...pendings), notified, };
  ```
- **computeDailyFrequency(rows: AlertHistoryPoint[])** — `src/lib/dlq/aggregations.ts`
  ```
  if (rows.length === 0) return []; const byDay = new Map<string, number>(); for (const h of rows) { const d = new Date(h.triggered_at); const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String( d.getDate(), ).padStart(2, "0")}`; byDay.set(key, (byDay.get(key) ?? 0) + 1); } return Array.from(byDay.entries()) .sort(([a], [b]) => a.localeCompare(b)) .map(([key, count]) => { const [, mm, dd] = key.split("-"); return { day: `${dd}/${mm}`, count }; });
  ```
- **computePeriodDelta(rows: TrendPoint[], rangeHours: number, nowMs: number,)** — `src/lib/dlq/aggregations.ts`
  ```
  if (rows.length < 2) return null; const cutoff = nowMs - rangeHours * 3600_000; const cur: number[] = []; const prev: number[] = []; for (const p of rows) { const val = Number(p.pending_items); if (new Date(p.captured_at).getTime() >= cutoff) cur.push(val); else prev.push(val); } if (cur.length === 0 || prev.length === 0) return null; const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length; const curAvg = avg(cur); const prevAvg = avg(prev); const diff = curAvg - prevAvg; const p …
  ```
- **computeAlertDots(alerts: AlertDotSource[], trendData: TrendChartPoint[], rangeHours: number, nowMs: number,)** — `src/lib/dlq/aggregations.ts`
  ```
  if (trendData.length === 0) return []; const rangeStart = nowMs - rangeHours * 3600_000; return alerts .filter((a) => new Date(a.triggered_at).getTime() >= rangeStart) .map((a) => { const at = new Date(a.triggered_at).getTime(); const nearest = trendData.reduce((best, cur) => Math.abs(cur.ts - at) < Math.abs(best.ts - at) ? cur : best, ); return { ...a, x: nearest.t, y: nearest.pending, }; });
  ```
- **scorePolicy(successRate: number, dlqRate: number, slaBreachRate: number, weights: TuningWeights = DEFAULT_WEIGHTS,)** — `src/lib/resilience/autotune.ts`
  ```
  const s = weights.success * successRate + weights.dlq * (1 - dlqRate) + weights.slaBreach * (1 - slaBreachRate); return clamp01(s);
  ```
- **severityRank(s: GapSeverity)** — `src/lib/resilience/report.ts`
  ```
  return s === "critical" ? 3 : s === "warning" ? 2 : 1;
  ```
- **generateScenarios(config: ScenarioGridConfig = {})** — `src/lib/resilience/scenarios.ts`
  ```
  const grid = { ...DEFAULT_GRID, ...config }; const scenarios: ScenarioSpec[] = []; for (const fault of grid.faults) { for (const failureRate of grid.failureRates) { for (const latencyMs of grid.latenciesMs) { for (const slaSecs of grid.slasSecs) { scenarios.push({ id: `${fault}|fr${failureRate}|lat${latencyMs}|sla${slaSecs}`, fault, failureRate, latencyMs, slaSecs, retryAfterSecs: fault === "rate_limit" ? 60 : undefined, }); } } } } return scenarios;
  ```
- **validateCampaign(data: { name: string; prospects: number })** — `src/lib/schemas/campaign.ts`
  ```
  const result = campaignSchema.safeParse(data); if (result.success) return { success: true as const, data: result.data }; const errors: Record<string, string> = {}; for (const issue of result.error.issues) { const key = issue.path[0]; if (typeof key === "string" && !errors[key]) errors[key] = issue.message; } return { success: false as const, errors };
  ```
- **validateCompany(data: CompanyFormData)** — `src/lib/schemas/company.ts`
  ```
  success: true; data: CompanyFormData
  ```
- **validateScrapeJob(data: ScrapeJobFormData)** — `src/lib/schemas/scrapeJob.ts`
  ```
  const result = scrapeJobSchema.safeParse(data); if (result.success) return { success: true as const, data: result.data }; const errors: Record<string, string> = {}; for (const issue of result.error.issues) { const key = issue.path[0]; if (typeof key === "string" && !errors[key]) errors[key] = issue.message; } return { success: false as const, errors };
  ```
- **invalidateClosedCache(serviceName: string)** — `supabase/functions/_shared/circuit-breaker.ts`
  ```
  closedCache.delete(serviceName);
  ```
- **computeBackoff(attempt: number, baseMs: number, capMs: number, retryAfterMs?: number, rand: ()** — `supabase/functions/_shared/hiker-client.ts`
  ```
  number = Math.random,
  ```
- **computeConfigHash(input: ConfigHashInput)** — `supabase/functions/_shared/instagram-config-hash.ts`
  ```
  return sha256Hex(canonicalizeConfig(input));
  ```
- **scoreLead(source: string, ident: LeadIdentity)** — `supabase/functions/_shared/lead-identity.ts`
  ```
  return (SOURCE_RANK[source] ?? 0) * 100 + (ident.publicId ? 10 : 0) + (ident.title ? 1 : 0);
  ```
- **assertValidDepartments(en: readonly string[])** — `supabase/functions/_shared/lusha-departments.ts`
  ```
  const bad = en.filter((d) => !LUSHA_DEPARTMENTS.includes(d)); if (bad.length > 0) { throw new Error( `departamento inválido para a Lusha: ${bad.join(", ")}. ` + `Válidos: ${LUSHA_DEPARTMENTS.join(", ")}`, ); }
  ```
- **generateTraceId()** — `supabase/functions/_shared/tracing.ts`
  ```
  return Array.from(crypto.getRandomValues(new Uint8Array(16))) .map(b => b.toString(16).padStart(2, '0')) .join('');
  ```
- **generateSpanId()** — `supabase/functions/_shared/tracing.ts`
  ```
  return Array.from(crypto.getRandomValues(new Uint8Array(8))) .map(b => b.toString(16).padStart(2, '0')) .join('');
  ```
- **canTransitionScrapeJob(current: ScrapeJobStatus, event: string)** — `supabase/functions/_shared/domain/scrape-job-machine.ts`
  ```
  const state = ScrapeJobStateMachine.states[current]; if (!state) return false; return !!state.on[event];
  ```
- **calculateIPCScore(company: CompanyData, criteria?: IPCHittingCriteria)** — `supabase/functions/_shared/domain/ipc/scoring.ts`
  ```
  let score = 0; const sector = company.category || company.type; const location = company.address || company.city || ""; // 1. Criteria matching (Sectors & Locations) if (criteria) { if (sector && criteria.sectors?.some(s => sector.toLowerCase().includes(s.toLowerCase()))) { score += 30; } if (location && criteria.locations?.some(loc => location.toLowerCase().includes(loc.toLowerCase()))) { score += 20; } } else { // Default baseline if no config score = 50; } // 2. Data Enrichment signals if (co …
  ```
- **shouldInjectChaos(taskId: string, rate = 0.01)** — `supabase/functions/_shared/web-scrape/chaos.ts`
  ```
  if (!taskId || rate <= 0) return false; if (rate >= 1) return true; const seed = hashString(`chaos|${taskId}`); return mulberry32(seed)() < rate;
  ```
- **calc(base: string, weights: number[])** — `supabase/functions/cnpj-enrich/index.ts`
  ```
  const sum = base.split("").reduce((acc, d, i) => acc + Number(d) * weights[i], 0); const rest = sum % 11; return rest < 2 ? 0 : 11 - rest;
  ```
- **validate(p: unknown)** — `supabase/functions/qa-ingest-run/index.ts`
  ```
  if (!p || typeof p !== "object") return false; const r = p as Record<string, unknown>; const kinds = ["unit", "edge", "e2e", "integration", "lint", "typecheck"]; if (typeof r.kind !== "string" || !kinds.includes(r.kind)) return false; const nums = ["tests_total", "tests_passed", "tests_failed", "duration_ms"]; for (const k of nums) { if (typeof r[k] !== "number" || !Number.isFinite(r[k] as number) || (r[k] as number) < 0) return false; } if (r.tests_skipped !== undefined && typeof r.tests_skippe …
  ```

### G.4 Percentuais e multiplicadores no código

| Trecho | Arquivo |
|---|---|
| `transition={{ delay: i * 0.07 + 0.1, type: "spring" as const, stiffness: 400, damping: 15 }}` | `src/components/lux/ActivityFeed.tsx` |
| `transition={{ delay: i * 0.07 + 0.15, type: "spring" as const, stiffness: 300, damping: 20 }}` | `src/components/lux/ActivityFeed.tsx` |
| `transition={{ delay: i * 0.07, duration: 0.35 }}` | `src/components/lux/ActivityFeed.tsx` |
| `transition={{ delay: i * 0.08, duration: 0.3 }}` | `src/components/lux/AutomationsList.tsx` |
| `transition={{ duration: 1, delay: 0.2 + i * 0.1, ease: "easeOut" }}` | `src/components/lux/AutomationsList.tsx` |
| `transition={{ delay: i * 0.06 }}` | `src/components/lux/CampaignsView.tsx` |
| `transition={{ delay: i * 0.04 }}` | `src/components/lux/CompanyDetailModal.tsx` |
| `transition={{ delay: i * 0.05 }}` | `src/components/lux/CompanyDetailModal.tsx` |
| `transition={{ delay: i * 0.03, duration: 0.2 }}` | `src/components/lux/CompanyFilters.tsx` |
| `delay: i * 0.01,` | `src/components/lux/CompanyTable.tsx` |
| `transition={{ delay: 0.15 + idx * 0.1, duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}` | `src/components/lux/DashboardView.tsx` |
| `transition={{ delay: Math.min(i * 0.02, 0.3) }}` | `src/components/lux/EmailSuppressionsView.tsx` |
| `transition={{ delay: 0.3 + i * 0.1, ease: "easeOut" }}` | `src/components/lux/EmptyState.tsx` |
| `transition={{ duration: 3, repeat: Infinity, delay: j * 0.8, ease: "easeInOut" }}` | `src/components/lux/EmptyState.tsx` |
| `transition={{ delay: 0.3 + i * 0.15 }}` | `src/components/lux/EnrichmentFunnel.tsx` |
| `transition={{ duration: 0.8, delay: 0.2 + i * 0.15, ease: "easeOut" }}` | `src/components/lux/EnrichmentFunnel.tsx` |
| `transition={{ delay: i * 0.03 }}` | `src/components/lux/GmapsScraperView.tsx` |
| `transition={{ delay: idx * 0.05 }}` | `src/components/lux/ICPConfigView.tsx` |
| `transition={{ delay: i * 0.03 }}` | `src/components/lux/IntentSignalsView.tsx` |
| `transition={{ delay: gi * 0.08 }}` | `src/components/lux/KeyboardShortcutsDialog.tsx` |
| `transition={{ delay: 0.3 + i * 0.08, duration: 0.35, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] }}` | `src/components/lux/QuickActions.tsx` |
| `transition={{ delay: Math.min(i * 0.02, 0.3) }}` | `src/components/lux/ScrapeResultsView.tsx` |
| `let val = Math.max(seed * 0.4, 1);` | `src/components/lux/StatsGrid.tsx` |
| `val = Math.max(0, val + (Math.sin(seed + i * 1.3) * seed * 0.15));` | `src/components/lux/StatsGrid.tsx` |
| `const baseO = Math.random() * 0.35 + 0.1;` | `src/components/lux/auth/FloatingParticles.tsx` |
| `dx: (Math.random() - 0.5) * 0.25,` | `src/components/lux/auth/FloatingParticles.tsx` |
| `dy: (Math.random() - 0.5) * 0.25,` | `src/components/lux/auth/FloatingParticles.tsx` |
| `p.o += (p.baseO - p.o) * 0.05;` | `src/components/lux/auth/FloatingParticles.tsx` |
| `ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);` | `src/components/lux/auth/GoldConfetti.tsx` |
| `transition={{ duration: 0.3, delay: i * 0.05, ease: "easeOut" }}` | `src/components/lux/auth/PasswordStrengthMeter.tsx` |
| `transition={{ delay: index * 0.02 }}` | `src/components/lux/companies/CompanyTableRow.tsx` |
| `transition={{ duration: 0.15, delay: Math.min(idx * 0.015, 0.2) }}` | `src/components/lux/integrations/EmailAccountsAuditPanel.tsx` |
| `border-radius: 50%;` | `src/components/lux/map/MarkerClusterLayer.tsx` |
| `Quando habilitado, o worker injeta 1% de falhas sintéticas (rate limit, unavailable, timeout)` | `src/components/lux/monitoring/ChaosEngineeringPanel.tsx` |
| `* Filas com meta inatingível: p95 acima do SLA configurado. Tolerância de 5%` | `src/components/lux/monitoring/SlaHistoryCard.tsx` |
| `Mais de 5% dos itens estouram o prazo por definição — aplicar a recomendação` | `src/components/lux/monitoring/SlaHistoryCard.tsx` |
| `* definição, mais de 5% dos itens da fila estouram o prazo — é um alvo` | `src/components/lux/monitoring/slaRiskAnalysis.ts` |
| `delay: Math.random() * 0.5,` | `src/components/lux/onboarding/ConfettiEffect.tsx` |
| `transition={{ delay: index * 0.03 }}` | `src/components/lux/organizations/MemberRow.tsx` |
| `transition={{ delay: index * 0.03 }}` | `src/components/lux/stakeholders/StakeholderCard.tsx` |
| `transition={{ delay: index * 0.02 }}` | `src/components/lux/stakeholders/StakeholderListRow.tsx` |
| `transition={{ delay: index * 0.06 }}` | `src/components/lux/workflows/WorkflowCard.tsx` |
| `* (reduz ~66% das queries vs. o polling anterior de 10s sem perda` | `src/hooks/useCircuitBreakers.ts` |
| `if (Math.abs(deltaX) > threshold && deltaY < Math.abs(deltaX) * 0.7) {` | `src/hooks/useSwipeGesture.ts` |
| `* respeitar 100% das políticas RLS (isolamento multi-tenant por organização).` | `src/lib/mcp/supabase.ts` |
| `/** +2pp em success OU −5% em p95 ⇒ improved; inverso ⇒ regressed. */` | `src/lib/resilience/compareReport.ts` |
| `* - backoff exponencial com jitter (base 5s, cap 300s, 20% jitter)` | `src/lib/resilience/simulator.ts` |
| `* ↑ pass rate 51%→58%, ↓ warnings 121→87 vs. baseline (30/3600/5). */` | `src/lib/resilience/simulator.ts` |
| `const jittered = (b: number) => Math.max(100, Math.round(b + b * 0.3 * (Math.random() * 2 - 1)));` | `supabase/functions/_shared/bitrix-client.ts` |
| `// aceita sem consultar o banco. Reduz load em ~80% em cenário de carga` | `supabase/functions/_shared/circuit-breaker.ts` |
| `// Jitter ±30% para evitar thundering herd quando múltiplas edges falham simultaneamente` | `supabase/functions/_shared/cookies.ts` |
| `const jitter = base * 0.3 * (Math.random() * 2 - 1);` | `supabase/functions/_shared/cookies.ts` |
| `* - Base 15s, cap 600s, max 4 tentativas, jitter ±20%.` | `supabase/functions/_shared/hiker-client.ts` |
| `const jitter = 1 + (rand() * 0.2 - 0.1);` | `supabase/functions/_shared/hiker-client.ts` |
| `const jitter = 1 + (rand() * 0.4 - 0.2); // ±20%` | `supabase/functions/_shared/hiker-client.ts` |
| `// esm.sh em runtime Deno). Cobre 90% dos casos de scraping: title, headings,` | `supabase/functions/_shared/web-scrape/html-to-markdown.ts` |
| `// eslint-disable-next-line no-control-regex -- intencional: detecta se o assunto é 100% ASCII (0-127)` | `supabase/functions/campaign-dispatch/index.ts` |
| `// 30s, 60s, 2m, 4m, 8m (cap 15m) + jitter até 20%` | `supabase/functions/cnpj-enrich-worker/index.ts` |
| `return Math.floor(base * (1 + Math.random() * 0.2));` | `supabase/functions/cnpj-enrich-worker/index.ts` |
| `// Chaos Engineering: injeta falha sintética em 1% das tasks quando habilitado` | `supabase/functions/scrape-queue-worker/index.ts` |
| `// Chaos: 1% de falha sintética (determinística por task_id, auditada).` | `supabase/functions/web-scrape-worker/index.ts` |

## H. Parâmetros de negócio (constantes, prazos, limites)

### H.1 Constantes

| Constante | Valor | Arquivo |
|---|---|---|
| `STATIC_CACHE` | `"lux-ia-static-v2"` | `public/sw.js` |
| `OFFLINE_PAGE` | `"/offline.html"` | `public/sw.js` |
| `EXAMPLE_DOMAIN` | `"natura.com.br"` | `src/components/lux/LushaIntelligenceView.tsx` |
| `EXAMPLE_LINKEDIN` | `"linkedin.com/company/natura"` | `src/components/lux/LushaIntelligenceView.tsx` |
| `MAX_ATTEMPTS` | `3` | `src/components/lux/LushaIntelligenceView.tsx` |
| `COUNT` | `35` | `src/components/lux/auth/FloatingParticles.tsx` |
| `MOUSE_RADIUS` | `120` | `src/components/lux/auth/FloatingParticles.tsx` |
| `MAX_UNREAD` | `99` | `src/components/lux/layout/MobileBottomNav.tsx` |
| `MAX_BADGE` | `9` | `src/components/lux/layout/Sidebar.tsx` |
| `PAGE_SIZE` | `10` | `src/components/lux/lusha/SessionsPanel.tsx` |
| `DUPLICATE_WINDOW_MS` | `24` | `src/components/lux/lusha/historyUtils.ts` |
| `REFETCH_MS` | `15` | `src/components/lux/monitoring/AutomationStatusPanel.tsx` |
| `WINDOW_HOURS` | `24` | `src/components/lux/monitoring/AutomationStatusPanel.tsx` |
| `DEFAULT_PAGE_SIZE` | `5` | `src/components/lux/monitoring/DlqAlertSettingsCard.tsx` |
| `ALERT_THRESHOLD` | `3` | `src/components/lux/monitoring/SlaAutoTuneBlockedCard.tsx` |
| `PAGE_SIZE` | `30` | `src/components/lux/monitoring/SlaHistoryCard.tsx` |
| `MAX_ROWS` | `300` | `src/components/lux/monitoring/SlaHistoryCard.tsx` |
| `ALL_QUEUES` | `"__all__"` | `src/components/lux/monitoring/SourceComparisonReport.tsx` |
| `PAGE_SIZE` | `50` | `src/components/lux/organizations/MembershipAuditLog.tsx` |
| `SIDEBAR_COOKIE_MAX_AGE` | `60` | `src/components/ui/sidebar.tsx` |
| `SIDEBAR_WIDTH` | `"16rem"` | `src/components/ui/sidebar.tsx` |
| `SIDEBAR_WIDTH_MOBILE` | `"18rem"` | `src/components/ui/sidebar.tsx` |
| `MOBILE_BREAKPOINT` | `768` | `src/hooks/use-mobile.tsx` |
| `TOAST_LIMIT` | `1` | `src/hooks/use-toast.ts` |
| `TOAST_REMOVE_DELAY` | `1000000` | `src/hooks/use-toast.ts` |
| `EVENT` | `"lux:cnpj-auto-enrich-changed"` | `src/hooks/useCnpjAutoEnrichSetting.ts` |
| `POLL_INTERVAL_MS` | `2500` | `src/hooks/useCnpjEnrich.ts` |
| `POLL_TIMEOUT_MS` | `90` | `src/hooks/useCnpjEnrich.ts` |
| `HISTORY_LIMIT` | `288` | `src/hooks/useDbHealth.ts` |
| `MAX_ENTRIES` | `200` | `src/hooks/useDryRunLogs.ts` |
| `CACHE_TTL_MS` | `60` | `src/hooks/useFeatureFlag.ts` |
| `MAX_UNREAD` | `99` | `src/hooks/useNotificationCount.ts` |
| `GOOGLE_MONTHLY_CREDIT_USD` | `200` | `src/hooks/usePlacesApiUsage.ts` |
| `MAX_RECENT` | `5` | `src/hooks/useRecentViews.ts` |
| `THROTTLE_MS` | `1500` | `src/lib/orgErrorHandler.ts` |
| `CORRELATION_WINDOW_MS` | `5` | `src/lib/orgErrorHandler.ts` |
| `AUDIT_THROTTLE_MS` | `1000` | `src/lib/orgErrorHandler.ts` |
| `IMPROVE_SUCCESS_DELTA` | `0.02` | `src/lib/resilience/compareReport.ts` |
| `IMPROVE_P95_PCT` | `0.05` | `src/lib/resilience/compareReport.ts` |
| `APOLLO_CACHE_TTL_HIT_SECONDS` | `7` | `supabase/functions/_shared/apollo-cache.ts` |
| `APOLLO_CACHE_TTL_EMPTY_SECONDS` | `24` | `supabase/functions/_shared/apollo-cache.ts` |
| `APOLLO_COOLDOWN_FORBIDDEN_SECONDS` | `6` | `supabase/functions/_shared/apollo-cache.ts` |
| `APOLLO_COOLDOWN_RATE_LIMIT_SECONDS` | `15` | `supabase/functions/_shared/apollo-cache.ts` |
| `DEFAULT_TIMEOUT_MS` | `15` | `supabase/functions/_shared/apollo-client.ts` |
| `CLOSED_CACHE_TTL_MS` | `3000` | `supabase/functions/_shared/circuit-breaker.ts` |
| `BASE` | `"https://api.leadcontact.ai/api/contact"` | `supabase/functions/_shared/leadcontact-client.ts` |
| `EXT_ORIGIN` | `"chrome-extension://imhlnhlbiencamnbpigopiibddajimep"` | `supabase/functions/_shared/leadcontact-client.ts` |
| `RETENTION_DAYS` | `90` | `supabase/functions/audit-logs-prune/index.ts` |
| `MAX_ATTEMPTS` | `5` | `supabase/functions/auth-rate-limit/index.ts` |
| `WINDOW_MINUTES` | `15` | `supabase/functions/auth-rate-limit/index.ts` |
| `MAX_IDENTIFIER_LEN` | `254` | `supabase/functions/auth-rate-limit/index.ts` |
| `BATCH_PER_CAMPAIGN` | `25` | `supabase/functions/campaign-dispatch/index.ts` |
| `TTL_SUCCESS_MS` | `30` | `supabase/functions/cnpj-enrich/index.ts` |
| `TTL_NOT_FOUND_MS` | `24` | `supabase/functions/cnpj-enrich/index.ts` |
| `TTL_SUCCESS_MS` | `30` | `supabase/functions/cnpj-enrich-worker/index.ts` |
| `TTL_NOT_FOUND_MS` | `24` | `supabase/functions/cnpj-enrich-worker/index.ts` |
| `GATEWAY` | `"https://connector-gateway.lovable.dev/google_maps"` | `supabase/functions/gmaps-places-search/index.ts` |
| `CB_THRESHOLD` | `5` | `supabase/functions/gmaps-proxy/index.ts` |
| `CB_RESET_TIMEOUT` | `60000` | `supabase/functions/gmaps-proxy/index.ts` |
| `GMAPS_API_BASE` | `"https://gmaps.atomicabr.com.br/api/v1"` | `supabase/functions/gmaps-proxy/index.ts` |
| `REVEAL_RATE_LIMIT_PER_HOUR` | `50` | `supabase/functions/lusha-reveal/index.ts` |
| `ALERT_EVENT` | `"security.org_violation_threshold"` | `supabase/functions/org-violation-alerts/index.ts` |
| `ERROR_RATE_THRESHOLD` | `5.0` | `supabase/functions/pg-net-watchdog/index.ts` |
| `BACKLOG_THRESHOLD` | `100` | `supabase/functions/pg-net-watchdog/index.ts` |
| `CIRCUIT_SERVICE` | `"gmaps"` | `supabase/functions/scrape-queue-worker/index.ts` |
| `DEFER_DELAY_SECS` | `60` | `supabase/functions/scrape-queue-worker/index.ts` |
| `GMAPS_API_BASE` | `"https://gmaps.atomicabr.com.br/api/v1"` | `supabase/functions/scrape-queue-worker/index.ts` |
| `BATCH_SIZE` | `10` | `supabase/functions/scrape-queue-worker/index.ts` |
| `PARALLEL_CHUNK` | `3` | `supabase/functions/scrape-queue-worker/index.ts` |
| `BATCH_SIZE` | `8` | `supabase/functions/web-scrape-worker/index.ts` |
| `PARALLEL_CHUNK` | `3` | `supabase/functions/web-scrape-worker/index.ts` |
| `DEFAULT_TIMEOUT_MS` | `20` | `supabase/functions/web-scrape-worker/index.ts` |
| `MAX_REDIRECTS` | `5` | `supabase/functions/web-scrape-worker/index.ts` |
| `ROBOTS_TTL_HOURS` | `24` | `supabase/functions/web-scrape-worker/index.ts` |
| `USER_AGENT` | `"lux-web-scraper/1.0 (+https://lux-ai-finder.lovable.app)"` | `supabase/functions/web-scrape-worker/index.ts` |
| `MAX_ATTEMPTS` | `5` | `supabase/functions/webhook-dispatcher/index.ts` |
| `BATCH` | `25` | `supabase/functions/webhook-dispatcher/index.ts` |
| `GMAPS_API_BASE` | `"https://gmaps.atomicabr.com.br/api/v1"` | `supabase/functions/workflow-engine/index.ts` |

### H.2 Prazos, expirações e janelas de tempo

| Trecho | Arquivo |
|---|---|
| `timeout: 120_000,` | `playwright.config.ts` |
| `setTimeout(() => onSuccess?.(), 1500);` | `src/components/auth/MFAEnroll.tsx` |
| `setTimeout(() => setSecretCopied(false), 2000);` | `src/components/auth/MFAEnroll.tsx` |
| `await new Promise((r) => setTimeout(r, 1100));` | `src/components/lux/CompaniesMapView.tsx` |
| `setTimeout(() => setCopied(false), 1500);` | `src/components/lux/CompanyDetailModal.tsx` |
| `setTimeout(() => setShowReconnected(false), 3000);` | `src/components/lux/ConnectionStatus.tsx` |
| `phaseTimers.push(window.setTimeout(() => { setSearchStatusMsg("Buscando decisores (Decision Makers V3)..."); setSearchProgress(55); }, 2200));` | `src/components/lux/LushaIntelligenceView.tsx` |
| `phaseTimers.push(window.setTimeout(() => { setSearchStatusMsg("Persistindo contatos no banco..."); setSearchProgress(85); }, 7500));` | `src/components/lux/LushaIntelligenceView.tsx` |
| `phaseTimers.push(window.setTimeout(() => { setSearchStatusMsg("Recebendo resposta e normalizando dados..."); setSearchProgress(72); }, 4500));` | `src/components/lux/LushaIntelligenceView.tsx` |
| `const timer = setTimeout(() => setActive(true), 1200);` | `src/components/lux/OnboardingTour.tsx` |
| `{ value: "24h", label: "Últimas 24h", ms: 24 * 60 * 60 * 1000 },` | `src/components/lux/OrgViolationsView.tsx` |
| `{ value: "30d", label: "Últimos 30 dias", ms: 30 * 24 * 60 * 60 * 1000 },` | `src/components/lux/OrgViolationsView.tsx` |
| `{ value: "7d", label: "Últimos 7 dias", ms: 7 * 24 * 60 * 60 * 1000 },` | `src/components/lux/OrgViolationsView.tsx` |
| `{ value: "90d", label: "Últimos 90 dias", ms: 90 * 24 * 60 * 60 * 1000 },` | `src/components/lux/OrgViolationsView.tsx` |
| `window.setTimeout(() => setHighlightedMemberId((id) => (id === member.id ? null : id)), 2400);` | `src/components/lux/OrganizationsView.tsx` |
| `const expires = new Date(deletedAt).getTime() + 30 * 24 * 60 * 60 * 1000;` | `src/components/lux/RecycleBinView.tsx` |
| `return Math.max(0, Math.ceil((expires - Date.now()) / (24 * 60 * 60 * 1000)));` | `src/components/lux/RecycleBinView.tsx` |
| `setTimeout(() => window.location.reload(), 1000);` | `src/components/lux/SettingsView.tsx` |
| `setTimeout(() => setCopiedEmail(null), 2000);` | `src/components/lux/StakeholderFinderView.tsx` |
| `setTimeout(() => setCopied(false), 1500);` | `src/components/lux/integrations/ApiKeysPanel.tsx` |
| `.gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())` | `src/components/lux/layout/Sidebar.tsx` |
| `setTimeout(() => setCopied(false), 1500);` | `src/components/lux/lusha/OracleV2Panel.tsx` |
| `const DUPLICATE_WINDOW_MS = 24 * 60 * 60 * 1000;` | `src/components/lux/lusha/historyUtils.ts` |
| `const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();` | `src/components/lux/monitoring/SlaTrendChart.tsx` |
| `const start = new Date(end.getTime() - Number(days) * 24 * 60 * 60 * 1000);` | `src/components/lux/monitoring/SourceComparisonReport.tsx` |
| `const timer = setTimeout(() => setParticles([]), 3000);` | `src/components/lux/onboarding/ConfettiEffect.tsx` |
| `setTimeout(() => setCopied(false), 2000);` | `src/components/lux/settings/MFASetup.tsx` |
| `const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();` | `src/components/lux/settings/RLSVerificationPanel.tsx` |
| `staleTime: 5 * 60 * 1000,` | `src/hooks/useResilienceComparison.ts` |
| `const CORRELATION_WINDOW_MS = 5 * 60 * 1000; // 5 min` | `src/lib/orgErrorHandler.ts` |
| `setTimeout(() => navigate("/"), 2000);` | `src/pages/ResetPassword.tsx` |
| `export const APOLLO_CACHE_TTL_EMPTY_SECONDS = 24 * 60 * 60; // 24 horas` | `supabase/functions/_shared/apollo-cache.ts` |
| `export const APOLLO_CACHE_TTL_HIT_SECONDS = 7 * 24 * 60 * 60; // 7 dias` | `supabase/functions/_shared/apollo-cache.ts` |
| `export const APOLLO_COOLDOWN_FORBIDDEN_SECONDS = 6 * 60 * 60; // 6 horas` | `supabase/functions/_shared/apollo-cache.ts` |
| `_next_action_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),` | `supabase/functions/campaign-dispatch/index.ts` |
| `const TTL_NOT_FOUND_MS = 24 * 60 * 60 * 1000; // 24h` | `supabase/functions/cnpj-enrich/index.ts` |
| `const TTL_SUCCESS_MS = 30 * 24 * 60 * 60 * 1000; // 30 dias` | `supabase/functions/cnpj-enrich/index.ts` |
| `const TTL_NOT_FOUND_MS = 24 * 60 * 60 * 1000;` | `supabase/functions/cnpj-enrich-worker/index.ts` |
| `const TTL_SUCCESS_MS = 30 * 24 * 60 * 60 * 1000;` | `supabase/functions/cnpj-enrich-worker/index.ts` |
| `const CB_RESET_TIMEOUT = 60000; // 1 minuto` | `supabase/functions/gmaps-proxy/index.ts` |
| `const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();` | `supabase/functions/instagram-worker-health/index.ts` |
| `await new Promise(r => setTimeout(r, 1500));` | `supabase/functions/lusha-search/index.ts` |
| `const timeout = setTimeout(() => ctrl.abort(), 10000);` | `supabase/functions/webhook-dispatcher/index.ts` |
| `expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),` | `supabase/migrations/20260422201601_940b28cc-0f04-4a93-9866-11fd3d1edba5.sql` |
| `DELETE FROM public.idempotency_keys WHERE created_at < now() - interval '24 hours';` | `supabase/migrations/20260513140150_d44106d4-96e5-428a-912a-640f138f2e57.sql` |
| `DELETE FROM public.campaigns WHERE deleted_at IS NOT NULL AND deleted_at < now() - interval '30 days';` | `supabase/migrations/20260711153030_aa1d1717-df92-42e1-b3b4-639bb3547ce1.sql` |
| `DELETE FROM public.companies WHERE deleted_at IS NOT NULL AND deleted_at < now() - interval '30 days';` | `supabase/migrations/20260711153030_aa1d1717-df92-42e1-b3b4-639bb3547ce1.sql` |
| `DELETE FROM public.deals WHERE deleted_at IS NOT NULL AND deleted_at < now() - interval '30 days';` | `supabase/migrations/20260711153030_aa1d1717-df92-42e1-b3b4-639bb3547ce1.sql` |
| `DELETE FROM public.workflows WHERE deleted_at IS NOT NULL AND deleted_at < now() - interval '30 days';` | `supabase/migrations/20260711153030_aa1d1717-df92-42e1-b3b4-639bb3547ce1.sql` |
| `count(*) FILTER (WHERE failed_at >= now() - interval '24 hours')::bigint AS added_last_24h,` | `supabase/migrations/20260712195044_12db549b-7825-4961-a631-6d62b64c4e79.sql` |
| `count(*) FILTER (WHERE replayed_at >= now() - interval '24 hours')::bigint AS replayed_last_24h` | `supabase/migrations/20260712195044_12db549b-7825-4961-a631-6d62b64c4e79.sql` |
| `WHERE captured_at < now() - interval '30 days'` | `supabase/migrations/20260712195304_af0be010-9de3-4b89-a80b-ca8cd03fb754.sql` |
| `WHERE captured_at >= now() - interval '24 hours'` | `supabase/migrations/20260712195509_f5608513-95f0-4f4d-8157-5e5da2e7326e.sql` |
| `WHERE captured_at >= now() - interval '24 hours'` | `supabase/migrations/20260712195625_958a9a6c-29bf-4cb9-9188-cb2258d8656c.sql` |
| `WHERE captured_at >= now() - interval '24 hours'` | `supabase/migrations/20260712200213_b4344f28-90cf-4c1a-bdb9-2b6fdf0bc489.sql` |
| `WHERE captured_at < now() - interval '30 days'` | `supabase/migrations/20260712220855_4ed03020-3c5a-4753-b895-59fc25ee7447.sql` |
| `WHERE captured_at >= now() - interval '24 hours'` | `supabase/migrations/20260712220855_4ed03020-3c5a-4753-b895-59fc25ee7447.sql` |
| `RETURN QUERY SELECT (v_count <= _limit)::boolean, v_count, (v_window + interval '1 hour');` | `supabase/migrations/20260715170326_8df3cb34-aee7-4980-903a-e98875f35c75.sql` |
| `/ NULLIF(count(*) FILTER (WHERE created_at >= now() - interval '24 hours'), 0),` | `supabase/migrations/20260715170411_d78dbcae-7de5-419d-8e89-a88f64ad3211.sql` |
| `100.0 * count(*) FILTER (WHERE status = 'success' AND created_at >= now() - interval '24 hours')` | `supabase/migrations/20260715170411_d78dbcae-7de5-419d-8e89-a88f64ad3211.sql` |
| `count(*) FILTER (WHERE created_at >= now() - interval '24 hours') AS events_24h,` | `supabase/migrations/20260715170411_d78dbcae-7de5-419d-8e89-a88f64ad3211.sql` |
| `count(*) FILTER (WHERE status = 'error' AND created_at >= now() - interval '24 hours') AS errors_24h,` | `supabase/migrations/20260715170411_d78dbcae-7de5-419d-8e89-a88f64ad3211.sql` |
| `count(*) FILTER (WHERE status = 'success' AND created_at >= now() - interval '24 hours') AS success_24h,` | `supabase/migrations/20260715170411_d78dbcae-7de5-419d-8e89-a88f64ad3211.sql` |
| `/ NULLIF(count(*) FILTER (WHERE created_at >= now() - interval '24 hours'), 0),` | `supabase/migrations/20260715170429_60ef5195-eadf-4adc-843a-f23012c9aa3a.sql` |
| `100.0 * count(*) FILTER (WHERE status = 'success' AND created_at >= now() - interval '24 hours')` | `supabase/migrations/20260715170429_60ef5195-eadf-4adc-843a-f23012c9aa3a.sql` |
| `count(*) FILTER (WHERE created_at >= now() - interval '24 hours') AS events_24h,` | `supabase/migrations/20260715170429_60ef5195-eadf-4adc-843a-f23012c9aa3a.sql` |
| `count(*) FILTER (WHERE status = 'error' AND created_at >= now() - interval '24 hours') AS errors_24h,` | `supabase/migrations/20260715170429_60ef5195-eadf-4adc-843a-f23012c9aa3a.sql` |
| `count(*) FILTER (WHERE status = 'success' AND created_at >= now() - interval '24 hours') AS success_24h,` | `supabase/migrations/20260715170429_60ef5195-eadf-4adc-843a-f23012c9aa3a.sql` |
| `WHERE checked_at > now() - interval '2 hours'` | `supabase/migrations/20260715203137_54228599-d263-451d-953e-efa5710f18d7.sql` |
| `v_cooldown interval := interval '24 hours';` | `supabase/migrations/20260715203137_54228599-d263-451d-953e-efa5710f18d7.sql` |
| `count(*) FILTER (WHERE failed_at >= now() - interval '24 hours')::BIGINT,` | `supabase/migrations/20260721223228_9f320c24-b3f3-4067-9e70-b9924824f7c9.sql` |
| `count(*) FILTER (WHERE replayed_at >= now() - interval '24 hours')::BIGINT` | `supabase/migrations/20260721223228_9f320c24-b3f3-4067-9e70-b9924824f7c9.sql` |
| `WHERE q.updated_at >= now() - interval '24 hours'` | `supabase/migrations/20260722111704_d767ae92-d4c9-4722-b181-a07f63a8954d.sql` |
| `WHERE q.updated_at >= now() - interval '8 days' AND q.updated_at < now() - interval '24 hours'` | `supabase/migrations/20260722111704_d767ae92-d4c9-4722-b181-a07f63a8954d.sql` |
| `(public.sla_deadline(created_at, sla_seconds) <= now() + interval '30 seconds') AS breaching,` | `supabase/migrations/20260726154832_c0dc9709-892f-472b-ad37-30beedd48605.sql` |
| `(public.sla_deadline(created_at, sla_seconds) <= now() + interval '30 seconds') DESC,` | `supabase/migrations/20260726154832_c0dc9709-892f-472b-ad37-30beedd48605.sql` |
| `(public.sla_deadline(q.created_at, q.sla_seconds) <= now() + interval '30 seconds') DESC,` | `supabase/migrations/20260726154832_c0dc9709-892f-472b-ad37-30beedd48605.sql` |
| `DELETE FROM public.apollo_search_cache WHERE expires_at < now() - interval '7 days';` | `supabase/migrations/20260726202430_a6a7d5f4-f0a9-4d11-b9fe-c203c5f222e3.sql` |

### H.3 Limites de paginação

| Limite | Arquivo |
|---|---|
| 5 | `src/components/lux/AutomationsList.tsx` |
| 100 | `src/components/lux/CommandPalette.tsx` |
| 50 | `src/components/lux/CommandPalette.tsx` |
| 50 | `src/components/lux/IntentSignalsView.tsx` |
| 1 | `src/components/lux/LushaIntelligenceView.tsx` |
| 200 | `src/components/lux/LushaIntelligenceView.tsx` |
| 50 | `src/components/lux/NotificationsPanel.tsx` |
| 500 | `src/components/lux/OrgViolationsView.tsx` |
| 500 | `src/components/lux/ScrapeResultsView.tsx` |
| 100 | `src/components/lux/campaigns/CampaignTrackingDrawer.tsx` |
| 50 | `src/components/lux/campaigns/CampaignTrackingDrawer.tsx` |
| 0 | `src/components/lux/lusha/SessionsPanel.tsx` |
| 1000 | `src/components/lux/monitoring/AutomationStatusPanel.tsx` |
| 25 | `src/components/lux/monitoring/AutomationStatusPanel.tsx` |
| 20 | `src/components/lux/monitoring/ChaosEngineeringPanel.tsx` |
| 100 | `src/components/lux/monitoring/JobDetailsSheet.tsx` |
| 10 | `src/components/lux/monitoring/MonitoringView.tsx` |
| 1 | `src/components/lux/monitoring/MultiQueueResilienceCard.tsx` |
| 5000 | `src/components/lux/monitoring/MultiQueueResilienceCard.tsx` |
| 200 | `src/components/lux/monitoring/QaHistoryPanel.tsx` |
| 30 | `src/components/lux/monitoring/RetryPolicyAdvisoriesPanel.tsx` |
| 1 | `src/components/lux/monitoring/SlaAlertSettingsCard.tsx` |
| 8 | `src/components/lux/monitoring/SlaCompliancePanel.tsx` |
| 1000 | `src/components/lux/monitoring/SlaHistoryCard.tsx` |
| 20 | `src/components/lux/monitoring/VaultCookiesPanel.tsx` |
| 50 | `src/components/lux/monitoring/VaultCookiesPanel.tsx` |
| 60 | `src/components/lux/monitoring/VaultCookiesPanel.tsx` |
| 20 | `src/components/lux/security/OrgViolationAlertsPanel.tsx` |
| 50 | `src/components/lux/settings/RLSVerificationPanel.tsx` |
| 1000 | `src/hooks/useAuditTrail.ts` |
| 200 | `src/hooks/useAutomationLogs.ts` |
| 100 | `src/hooks/useAutomationsMonitor.ts` |
| 120 | `src/hooks/useAutomationsMonitor.ts` |
| 200 | `src/hooks/useAutomationsMonitor.ts` |
| 500 | `src/hooks/useAutomationsMonitor.ts` |
| 10 | `src/hooks/useDashboardData.ts` |
| 50 | `src/hooks/useOAuthSandboxSnapshots.ts` |
| 50 | `src/hooks/usePartitionAdvisories.ts` |
| 200 | `src/hooks/useScrapeQueue.ts` |
| 50 | `src/hooks/useWebhooks.ts` |
| 1 | `supabase/functions/ai-agent/index.ts` |
| 10 | `supabase/functions/ai-agent/index.ts` |
| 5 | `supabase/functions/ai-agent/index.ts` |
| 1 | `supabase/functions/campaign-dispatch/index.ts` |
| 1000 | `supabase/functions/cnpj-settings-status/index.ts` |
| 1 | `supabase/functions/dlq-alerts/index.ts` |
| 1 | `supabase/functions/gmaps-proxy/index.ts` |
| 10 | `supabase/functions/gmaps-proxy/index.ts` |
| 1 | `supabase/functions/health/index.ts` |
| 1 | `supabase/functions/instagram-enqueue/index.ts` |
| 10 | `supabase/functions/instagram-worker-health/index.ts` |
| 1 | `supabase/functions/latency-alerts/index.ts` |
| 10 | `supabase/functions/latency-alerts/index.ts` |
| 1 | `supabase/functions/lusha-decision-makers/index.ts` |
| 2000 | `supabase/functions/oracle-search-decisors/index.ts` |
| 1 | `supabase/functions/reaper-alerts/index.ts` |
| 5000 | `supabase/functions/retry-policy-tuner/index.ts` |
| 1 | `supabase/functions/rls-tests/index.ts` |
| 1 | `supabase/functions/sla-alerts/index.ts` |
| 1 | `supabase/functions/sla-auto-tune/index.ts` |
| 1 | `supabase/functions/web-scrape-enqueue/index.ts` |
| 1 | `supabase/functions/workflow-engine/index.ts` |
| 5 | `supabase/functions/workflow-engine/index.ts` |
| 500 | `supabase/functions/workflow-engine/index.ts` |

## I. Regras implícitas em mensagens de erro/validação

| Mensagem | Arquivo |
|---|---|
| [lushaMocks] mock  | `e2e/helpers/lushaMocks.ts` |
| Login E2E falhou para ${creds.email}: ${error.message} | `e2e/helpers/supabase.ts` |
| ${msg}: esperado ${JSON.stringify(b)} obtido ${JSON.stringify(a)} | `scripts/ai-context/cenarios.mjs` |
| ${label} falhou com exit ${result.status}: ${normalizeWhitespace(result.stderr)} | `scripts/ci/lint-ratchet.mjs` |
| --base nao combina com --staged. | `scripts/ci/lint-ratchet.mjs` |
| --base nao combina com --update-baseline. | `scripts/ci/lint-ratchet.mjs` |
| --staged nao combina com --update-baseline. | `scripts/ci/lint-ratchet.mjs` |
| Argumento desconhecido: ${argument} | `scripts/ci/lint-ratchet.mjs` |
| Baseline ESLint invalido ou com schema diferente de ${SCHEMA_VERSION}. | `scripts/ci/lint-ratchet.mjs` |
| ESLint falhou com exit ${result.status}: ${normalizeWhitespace(result.stderr)} | `scripts/ci/lint-ratchet.mjs` |
| ESLint local nao encontrado. Execute a instalacao das dependencias primeiro. | `scripts/ci/lint-ratchet.mjs` |
| ESLint nao produziu JSON valido: ${error.message} | `scripts/ci/lint-ratchet.mjs` |
| Entrada invalida no relatorio JSON do ESLint. | `scripts/ci/lint-ratchet.mjs` |
| Nao foi possivel ler ${description} em ${filePath}: ${error.message} | `scripts/ci/lint-ratchet.mjs` |
| O ESLint ou eslint.config.js mudou desde a geracao do baseline. Revise a mudanca e regenere o baseline. | `scripts/ci/lint-ratchet.mjs` |
| O relatorio do ESLint deve ser um array JSON. | `scripts/ci/lint-ratchet.mjs` |
| Valor ausente para ${argument}. | `scripts/ci/lint-ratchet.mjs` |
| ripgrep (rg) falhou com exit ${status}; o inventário não foi gerado. | `scripts/inventario/gerar-repo.mjs` |
| ripgrep (rg) não encontrado; o inventário não pode ser gerado com segurança. | `scripts/inventario/gerar-repo.mjs` |
| caminho de  | `scripts/lib/seguranca-processo.mjs` |
| comando nao encontrado no PATH:  | `scripts/lib/seguranca-processo.mjs` |
| O teste offline não permite consultas ao banco | `scripts/supabase_snapshot/test_snapshot.py` |
| banco indisponível na fixture | `scripts/supabase_snapshot/test_snapshot.py` |
| catálogo indisponível na fixture | `scripts/supabase_snapshot/test_snapshot.py` |
| permission denied for schema auth | `scripts/supabase_snapshot/test_snapshot.py` |
| relation  | `scripts/supabase_snapshot/test_snapshot.py` |
| statement timeout simulado | `scripts/supabase_snapshot/test_snapshot.py` |
| view removida depois da consulta ao catálogo | `scripts/supabase_snapshot/test_snapshot.py` |
| view sem permissão na fixture | `scripts/supabase_snapshot/test_snapshot.py` |
| ; import { Shield, Copy, CheckCircle2, AlertCircle, RefreshCw } from  | `src/components/auth/MFAEnroll.tsx` |
| ; import { ShieldCheck, AlertCircle, RefreshCw } from  | `src/components/auth/MFAVerify.tsx` |
| Erro ao limpar | `src/components/lux/AIAgentView.tsx` |
| Not authenticated | `src/components/lux/AIAgentView.tsx` |
| Corrija os campos inválidos | `src/components/lux/AddCompanyDialog.tsx` |
| Erro ao criar empresa | `src/components/lux/AddCompanyDialog.tsx` |
| Erro ao exportar | `src/components/lux/AnalyticsView.tsx` |
| Erro ao alternar status | `src/components/lux/CampaignsView.tsx` |
| Erro ao atualizar | `src/components/lux/CampaignsView.tsx` |
| Erro no envio | `src/components/lux/CampaignsView.tsx` |
| Conflito detectado | `src/components/lux/CompaniesView.tsx` |
| Erro ao enriquecer | `src/components/lux/CompaniesView.tsx` |
| Erro ao favoritar | `src/components/lux/CompaniesView.tsx` |
| Erro ao remover | `src/components/lux/CompaniesView.tsx` |
| Erro na exportação | `src/components/lux/CompaniesView.tsx` |
| Nada para exportar | `src/components/lux/CompaniesView.tsx` |
| Não é possível ${action} um registro de outra organização. | `src/components/lux/CompaniesView.tsx` |
| Organização não carregada | `src/components/lux/CompaniesView.tsx` |
|          >           <WifiOff className= | `src/components/lux/ConnectionStatus.tsx` |
|              className= | `src/components/lux/EditCompanyDialog.tsx` |
| Corrija os campos inválidos | `src/components/lux/EditCompanyDialog.tsx` |
| Empresa foi atualizada por outra pessoa | `src/components/lux/EditCompanyDialog.tsx` |
| Erro ao atualizar | `src/components/lux/EditCompanyDialog.tsx` |
| Organização ativa alterada | `src/components/lux/EditCompanyDialog.tsx` |
| Organização incompatível | `src/components/lux/EditCompanyDialog.tsx` |
| Organização não carregada | `src/components/lux/EditCompanyDialog.tsx` |
|              >               {/* Glow effect */}               <div className= | `src/components/lux/ErrorBoundary.tsx` |
| Corrija os campos | `src/components/lux/GmapsScraperView.tsx` |
| Falha ao criar job: ${err.message} | `src/components/lux/GmapsScraperView.tsx` |
| Falha ao deletar: ${err.message} | `src/components/lux/GmapsScraperView.tsx` |
| Falha ao exportar: ${err.message} | `src/components/lux/GmapsScraperView.tsx` |
| Falha ao importar: ${err.message} | `src/components/lux/GmapsScraperView.tsx` |
| Erro ao atualizar | `src/components/lux/IntentSignalsView.tsx` |
|            className= | `src/components/lux/LushaIntelligenceView.tsx` |
| ${msg} Você poderá tentar novamente em ${wait}s. | `src/components/lux/LushaIntelligenceView.tsx` |
| Domínio inválido | `src/components/lux/LushaIntelligenceView.tsx` |
| Domínio obrigatório | `src/components/lux/LushaIntelligenceView.tsx` |
| Erro na busca | `src/components/lux/LushaIntelligenceView.tsx` |
| Erro na busca por domínio | `src/components/lux/LushaIntelligenceView.tsx` |
| Falha ao copiar | `src/components/lux/LushaIntelligenceView.tsx` |
| Falha ao remover | `src/components/lux/LushaIntelligenceView.tsx` |
| Notificações indisponíveis | `src/components/lux/LushaIntelligenceView.tsx` |
| O contato foi revelado na tela, mas falhou ao gravar no banco: ${error.message} | `src/components/lux/LushaIntelligenceView.tsx` |
| Sessão de busca não encontrada | `src/components/lux/LushaIntelligenceView.tsx` |
| Sessão expirada. Faça login novamente. | `src/components/lux/LushaIntelligenceView.tsx` |
| no_data_returned | `src/components/lux/LushaIntelligenceView.tsx` |
|              aria-live= | `src/components/lux/OrgErrorBanner.tsx` |
| Falha ao excluir: ${err instanceof Error ? err.message :  | `src/components/lux/OrgProxiesView.tsx` |
| Falha: ${err instanceof Error ? err.message :  | `src/components/lux/OrgProxiesView.tsx` |
| ; import { EmptyState } from  | `src/components/lux/OrgViolationsView.tsx` |
| Erro ao criar | `src/components/lux/OrganizationsView.tsx` |
| Erro ao reenviar | `src/components/lux/OrganizationsView.tsx` |
| Falha ao alterar papel | `src/components/lux/OrganizationsView.tsx` |
| Falha ao revogar | `src/components/lux/OrganizationsView.tsx` |
| Nada para exportar | `src/components/lux/OrganizationsView.tsx` |
| Nome muito curto | `src/components/lux/OrganizationsView.tsx` |
| Falha: ${err instanceof Error ? err.message :  | `src/components/lux/PlacesApiNewToggle.tsx` |
| Falha ao salvar proxy: ${msg} | `src/components/lux/ProxyFormDialog.tsx` |
| Erro ao excluir | `src/components/lux/RecycleBinView.tsx` |
| Erro ao restaurar | `src/components/lux/RecycleBinView.tsx` |
| Erro ao converter | `src/components/lux/ScrapeResultsView.tsx` |
| A senha deve ter pelo menos 8 caracteres. | `src/components/lux/SettingsView.tsx` |
| As senhas não coincidem. | `src/components/lux/SettingsView.tsx` |
| Erro ao salvar | `src/components/lux/SettingsView.tsx` |
| Erro ao executar | `src/components/lux/WorkflowsView.tsx` |
|        aria-live= | `src/components/lux/auth/RateLimitWarning.tsx` |
| CSV precisa de uma coluna de nome (ex:  | `src/components/lux/companies/ImportCompaniesDialog.tsx` |
| CSV vazio ou sem linhas de dados. | `src/components/lux/companies/ImportCompaniesDialog.tsx` |
| Erro na importação | `src/components/lux/companies/ImportCompaniesDialog.tsx` |
| Nenhuma organização ativa. | `src/components/lux/companies/ImportCompaniesDialog.tsx` |
| Não foi possível copiar | `src/components/lux/integrations/AuthUrlConfirmDialog.tsx` |
| No account | `src/components/lux/integrations/DisconnectAccountDialog.tsx` |
| Falha ao exportar. | `src/components/lux/integrations/DryRunLogsPanel.tsx` |
| ${acc.email} — ${info.description} ${info.actionHint} | `src/components/lux/integrations/EmailAccountsPanel.tsx` |
| Apenas administradores podem conectar caixas compartilhadas (scope organization). | `src/components/lux/integrations/EmailAccountsPanel.tsx` |
| Apenas administradores podem converter caixas compartilhadas. | `src/components/lux/integrations/EmailAccountsPanel.tsx` |
| Apenas administradores podem promover uma caixa para compartilhada. | `src/components/lux/integrations/EmailAccountsPanel.tsx` |
| Apenas administradores podem sincronizar caixas compartilhadas da organização. | `src/components/lux/integrations/EmailAccountsPanel.tsx` |
| Falha ao conectar | `src/components/lux/integrations/EmailAccountsPanel.tsx` |
| Falha ao converter | `src/components/lux/integrations/EmailAccountsPanel.tsx` |
| Não autenticado. | `src/components/lux/integrations/EmailAccountsPanel.tsx` |
| Permissão negada | `src/components/lux/integrations/EmailAccountsPanel.tsx` |
| Não foi possível copiar | `src/components/lux/integrations/OAuthSandboxPanel.tsx` |
| Validação falhou | `src/components/lux/integrations/OAuthSandboxPanel.tsx` |
| Falha ao salvar | `src/components/lux/integrations/OAuthSnapshotsPanel.tsx` |
| Informe um nome | `src/components/lux/integrations/OAuthSnapshotsPanel.tsx` |
| Não foi possível copiar | `src/components/lux/integrations/RedirectUriChecklist.tsx` |
|          aria-live= | `src/components/lux/lusha/OracleV2ErrorBoundary.tsx` |
|        aria-live= | `src/components/lux/lusha/OracleV2Panel.tsx` |
| Não foi possível copiar. Copie manualmente. | `src/components/lux/lusha/OracleV2Panel.tsx` |
|                className= | `src/components/lux/lusha/SessionsPanel.tsx` |
| ${session.company_name}: ${msg} | `src/components/lux/lusha/SessionsPanel.tsx` |
| Flag não inicializada | `src/components/lux/monitoring/ChaosEngineeringPanel.tsx` |
| Falha no replay: ${err instanceof Error ? err.message : String(err)} | `src/components/lux/monitoring/DLQReplayPanel.tsx` |
| Selecione uma organização ativa. | `src/components/lux/monitoring/DLQReplayPanel.tsx` |
| Falha ao reprocessar: ${err instanceof Error ? err.message :  | `src/components/lux/monitoring/DlqTriageView.tsx` |
| ; import {   Camera,   CheckCircle2,   XCircle,   AlertTriangle,   RefreshCw,   Key,   ExternalLink,   Loader2,   Info, } from  | `src/components/lux/monitoring/InstagramConnectionPanel.tsx` |
| Falha ao executar ação. | `src/components/lux/monitoring/JobDetailsSheet.tsx` |
| Falha ao reiniciar etapa. | `src/components/lux/monitoring/JobDetailsSheet.tsx` |
| Falha ao salvar: ${e instanceof Error ? e.message :  | `src/components/lux/monitoring/OrgRateLimitsView.tsx` |
| Falha ao aplicar | `src/components/lux/monitoring/RetryPolicyAdvisoriesPanel.tsx` |
| Falha ao dispensar | `src/components/lux/monitoring/RetryPolicyAdvisoriesPanel.tsx` |
| Falha ao reverter | `src/components/lux/monitoring/RetryPolicyAdvisoriesPanel.tsx` |
| Falha ao salvar: ${e.message} | `src/components/lux/monitoring/SlaAlertSettingsCard.tsx` |
| Falha ao exportar | `src/components/lux/monitoring/SlaHistoryCard.tsx` |
| Não foi possível aplicar o SLA | `src/components/lux/monitoring/SlaHistoryCard.tsx` |
| Não foi possível alterar o auto-ajuste | `src/components/lux/monitoring/SlaRecommendationsCard.tsx` |
| Não foi possível aplicar o SLA | `src/components/lux/monitoring/SlaRecommendationsCard.tsx` |
| Nada para exportar no período selecionado. | `src/components/lux/monitoring/SourceComparisonReport.tsx` |
| Falha na checagem | `src/components/lux/monitoring/VaultCookiesPanel.tsx` |
| Falha ao copiar | `src/components/lux/organizations/MembershipAuditDetailSheet.tsx` |
| Falha ao avaliar | `src/components/lux/security/OrgViolationAlertsPanel.tsx` |
| Falha ao salvar | `src/components/lux/security/OrgViolationAlertsPanel.tsx` |
| Sem organização ativa | `src/components/lux/security/OrgViolationAlertsPanel.tsx` |
| Erro ao desativar | `src/components/lux/settings/MFASetup.tsx` |
| Erro na verificação | `src/components/lux/settings/MFASetup.tsx` |
|  className={cn(alertVariants({ variant }), className)} {...props} /> )); Alert.displayName =  | `src/components/ui/alert.tsx` |
| useCarousel must be used within a <Carousel /> | `src/components/ui/carousel.tsx` |
| useChart must be used within a <ChartContainer /> | `src/components/ui/chart.tsx` |
| useFormField should be used within <FormField> | `src/components/ui/use-form-field.ts` |
| useSidebar must be used within a SidebarProvider. | `src/components/ui/use-sidebar.ts` |
| useConfirm must be used within <ConfirmProvider> | `src/hooks/confirm-context.ts` |
| Erro ao criar chave | `src/hooks/useApiKeys.ts` |
| Falha ao reiniciar disjuntor: ${err.message} | `src/hooks/useCircuitBreakers.ts` |
| Erro ao criar estágio | `src/hooks/useDeals.ts` |
| No deal selected | `src/hooks/useDeals.ts` |
| Não foi possível remover | `src/hooks/useDeals.ts` |
| Informe um e-mail válido. | `src/hooks/useEmailSuppressions.ts` |
| Erro ao salvar | `src/hooks/useICPConfig.ts` |
| Acesso bloqueado | `src/hooks/useLoginForm.ts` |
| Dados inválidos | `src/hooks/useLoginForm.ts` |
| Erro no cadastro | `src/hooks/useLoginForm.ts` |
| Erro no login | `src/hooks/useLoginForm.ts` |
| Segurança: Bloqueio Ativo | `src/hooks/useLoginForm.ts` |
| Bitrix indisponível — circuit breaker aberto. Tente em 1 min. | `src/hooks/useOracleV2.ts` |
| Bitrix não configurado (secret BITRIX_WEBHOOK_BASE ausente). | `src/hooks/useOracleV2.ts` |
| Busca de decisores falhou: ${msg} | `src/hooks/useOracleV2.ts` |
| Cookie LeadContact expirou. Renove no vault. | `src/hooks/useOracleV2.ts` |
| Empresa não encontrada na Lusha. | `src/hooks/useOracleV2.ts` |
| Enriquecimento falhou: ${err.message} | `src/hooks/useOracleV2.ts` |
| Envio ao Bitrix falhou: ${msg} | `src/hooks/useOracleV2.ts` |
| Limite de buscas atingido. Tente novamente em ~${mins} min. | `src/hooks/useOracleV2.ts` |
| Limite de envios ao Bitrix atingido. Tente mais tarde. | `src/hooks/useOracleV2.ts` |
| Rate limit atingido. ${enriched} enriquecidos, ${error_rate_limit} pendentes. | `src/hooks/useOracleV2.ts` |
| Organização não selecionada | `src/hooks/useOrgProxies.ts` |
| Organização não selecionada | `src/hooks/useOrgRateLimit.ts` |
| Não autenticado | `src/hooks/useOrganizations.ts` |
| Org ou usuário ausente | `src/hooks/useOrganizations.ts` |
| Falha ao carregar ${url}: HTTP ${res.status} | `src/hooks/useResilienceComparison.ts` |
| Falha ao expurgar: ${err.message} | `src/hooks/useScrapeQueue.ts` |
| Falha ao reprocessar em lote: ${err.message} | `src/hooks/useScrapeQueue.ts` |
| Falha ao reprocessar: ${err.message} | `src/hooks/useScrapeQueue.ts` |
| Falha ao enfileirar: ${e.message} | `src/hooks/useWebScrape.ts` |
| Falha ao reprocessar DLQ: ${e.message} | `src/hooks/useWebScrape.ts` |
| Falha na extração: ${e.message} | `src/hooks/useWebScrape.ts` |
| Falha no reenvio | `src/hooks/useWebhooks.ts` |
| [withOrg] Acesso bloqueado: tabela  | `src/integrations/supabase/withOrg.ts` |
| Bloqueado por pop-up. Permita pop-ups para exportar PDF. | `src/lib/exportRLSReport.ts` |
| Falha ao reexecutar | `src/lib/orgErrorHandler.ts` |
| Export failed: ${res.status} | `src/lib/api/gmaps.ts` |
| Not authenticated | `src/lib/api/gmaps.ts` |
| Not authenticated | `src/lib/api/workflows.ts` |
| Configuração do backend indisponível para esta ferramenta. | `src/lib/mcp/supabase.ts` |
| HTTP ${res.status}: ${body} | `src/pages/AdminCompanies.tsx` |
| >As senhas não coincidem.</p>           )}            <Button type= | `src/pages/ResetPassword.tsx` |
| Dados inválidos | `src/pages/ResetPassword.tsx` |
| Apify não configurado: defina APIFY_MOCK_MODE=true ou conecte o Apify (LOVABLE_API_KEY + APIFY_API_KEY). | `supabase/functions/_shared/apify-gateway.ts` |
| [apify-gateway ${response.status}] getDatasetItems: ${body} | `supabase/functions/_shared/apify-gateway.ts` |
| [apify-gateway ${response.status}] getRunStatus: ${body} | `supabase/functions/_shared/apify-gateway.ts` |
| [apify-gateway ${response.status}] startActorRun: ${body} | `supabase/functions/_shared/apify-gateway.ts` |
| [apify-gateway 429] ${stage}: rate limit exceeded (mock fault) | `supabase/functions/_shared/apify-gateway.ts` |
| [apify-gateway timeout] getDatasetItems: exceeded ${fault.timeoutMs ?? 50}ms (mock fault) | `supabase/functions/_shared/apify-gateway.ts` |
| [apify-gateway timeout] startActorRun: exceeded ${fault.timeoutMs ?? 50}ms (mock fault) | `supabase/functions/_shared/apify-gateway.ts` |
| ${method}: ${code} — ${desc} | `supabase/functions/_shared/bitrix-client.ts` |
| ${method}: HTTP ${res.status} — ${text.slice(0, 180)} | `supabase/functions/_shared/bitrix-client.ts` |
| ${method}: resposta não-JSON (${res.status}): ${text.slice(0, 180)} | `supabase/functions/_shared/bitrix-client.ts` |
| BITRIX_WEBHOOK_BASE ausente nos secrets | `supabase/functions/_shared/bitrix-client.ts` |
| crm.contact.add: id inválido na resposta (${JSON.stringify(id)}) | `supabase/functions/_shared/bitrix-client.ts` |
| crm.item.add: id inválido na resposta (${JSON.stringify(result)}) | `supabase/functions/_shared/bitrix-client.ts` |
| vault HTTP ${res.status}: ${body.slice(0, 200)} | `supabase/functions/_shared/cookies.ts` |
| cookie linkedin sem JSESSIONID (csrfToken) | `supabase/functions/_shared/leadcontact-client.ts` |
| leadcontact ${path} ${res.status}: ${text.slice(0, 200)} | `supabase/functions/_shared/leadcontact-client.ts` |
| leadcontact ${path}: code ${code} — ${msg} | `supabase/functions/_shared/leadcontact-client.ts` |
| linkedin_url sem publicId utilizável | `supabase/functions/_shared/leadcontact-client.ts` |
| departamento inválido para a Lusha: ${bad.join( | `supabase/functions/_shared/lusha-departments.ts` |
| AI API error: ${aiResponse.status} | `supabase/functions/ai-agent/index.ts` |
| Unauthorized | `supabase/functions/audit-logs-prune/index.ts` |
| Gmail send [${res.status}]: ${JSON.stringify(data)} | `supabase/functions/campaign-dispatch/index.ts` |
| No refresh token; reconnect required | `supabase/functions/campaign-dispatch/index.ts` |
| OAuth credentials not configured for ${acc.provider} | `supabase/functions/campaign-dispatch/index.ts` |
| Outlook send [${res.status}]: ${txt} | `supabase/functions/campaign-dispatch/index.ts` |
| Refresh failed: ${summary} | `supabase/functions/campaign-dispatch/index.ts` |
| load email account: ${accErr.message} | `supabase/functions/campaign-dispatch/index.ts` |
| load recipients: ${recErr.message} | `supabase/functions/campaign-dispatch/index.ts` |
| load suppressions: ${supErr.message} | `supabase/functions/campaign-dispatch/index.ts` |
| token refresh: ${e instanceof Error ? e.message : String(e)} | `supabase/functions/campaign-dispatch/index.ts` |
| Gmail list: ${JSON.stringify(list)} | `supabase/functions/email-poll-replies/index.ts` |
| No refresh token; reconnect required | `supabase/functions/email-poll-replies/index.ts` |
| OAuth credentials not configured for ${acc.provider} | `supabase/functions/email-poll-replies/index.ts` |
| Outlook list: ${JSON.stringify(data)} | `supabase/functions/email-poll-replies/index.ts` |
| Refresh failed: ${summary} | `supabase/functions/email-poll-replies/index.ts` |
| Circuit breaker is open | `supabase/functions/gmaps-proxy/index.ts` |
| Failed to download results from external API | `supabase/functions/gmaps-proxy/index.ts` |
| Job not found or has no external ID | `supabase/functions/gmaps-proxy/index.ts` |
| results_insert_failed: ${insErr.message} | `supabase/functions/instagram-worker/index.ts` |
| Configura\xE7\xE3o do backend indispon\xEDvel para esta ferramenta. | `supabase/functions/mcp/index.ts` |
| unauthorized | `supabase/functions/migrate-helper/index.ts` |
| unknown_action | `supabase/functions/migrate-helper/index.ts` |
| CookieVaultUnavailable após 3 tentativas: ${(lastErr as Error).message} | `supabase/functions/oracle-cookies-preflight/index.ts` |
| SUPABASE_EXTERNAL_ANON_KEY ausente | `supabase/functions/oracle-cookies-preflight/index.ts` |
| vault HTTP ${res.status}: ${body.slice(0, 200)} | `supabase/functions/oracle-cookies-preflight/index.ts` |
| Unauthorized | `supabase/functions/purge-soft-deleted/index.ts` |
| insert_advisory_${kind}: ${error.message} | `supabase/functions/retry-policy-tuner/index.ts` |
| createAdminUserFixture: createUser failed: ${createErr?.message} | `supabase/functions/rls-tests/_fixtures.ts` |
| createAdminUserFixture: insert org failed: ${orgErr?.message} | `supabase/functions/rls-tests/_fixtures.ts` |
| createAdminUserFixture: linha admin não persistiu (${checkErr?.message ??  | `supabase/functions/rls-tests/_fixtures.ts` |
| createAdminUserFixture: signIn failed: ${signErr?.message} | `supabase/functions/rls-tests/_fixtures.ts` |
| createAdminUserFixture: upsert member failed: ${memberErr.message} | `supabase/functions/rls-tests/_fixtures.ts` |
| createNonAdminUserFixture: createUser failed: ${createErr?.message} | `supabase/functions/rls-tests/_fixtures.ts` |
| createNonAdminUserFixture: signIn failed: ${signErr?.message} | `supabase/functions/rls-tests/_fixtures.ts` |
| Failed to create user ${email}: ${error.message} | `supabase/functions/rls-tests/index.ts` |
| Failed to sign in ${email}: ${error.message} | `supabase/functions/rls-tests/index.ts` |
| create orgA: ${orgAErr.message} | `supabase/functions/rls-tests/index.ts` |
| create orgB: ${orgBErr.message} | `supabase/functions/rls-tests/index.ts` |
| stats_rpc: ${statsErr.message} | `supabase/functions/sla-alerts/index.ts` |
| Invalid URL | `supabase/functions/track-click/index.ts` |
| Invalid recipient | `supabase/functions/track-click/index.ts` |
| Invalid signature | `supabase/functions/track-click/index.ts` |
| insert_result_failed: ${insErr?.message ??  | `supabase/functions/web-scrape-worker/index.ts` |
| no_response | `supabase/functions/web-scrape-worker/index.ts` |
| , { type:  | `supabase/functions/workflow-engine/index.ts` |
| Step not found | `supabase/functions/workflow-engine/index.ts` |
| Unauthorized | `supabase/functions/workflow-engine/index.ts` |
| Workflow not found | `supabase/functions/workflow-engine/index.ts` |

## J. Controle de acesso no código (checagens de perfil/permissão)

| Valor comparado | Arquivo |
|---|---|
| `agent` | `src/components/lux/AIAgentView.tsx` |
| `user` | `src/components/lux/AIAgentView.tsx` |
| `granted` | `src/components/lux/LushaIntelligenceView.tsx` |
| `admin` | `src/components/lux/OrganizationsView.tsx` |
| `newRole` | `src/components/lux/OrganizationsView.tsx` |
| `admin` | `src/components/lux/monitoring/ApiLatencyAlertSettingsCard.tsx` |
| `admin` | `src/components/lux/monitoring/DlqAlertSettingsCard.tsx` |
| `admin` | `src/hooks/usePermissions.ts` |
| `sdr` | `src/hooks/usePermissions.ts` |
| `viewer` | `src/hooks/usePermissions.ts` |
| `true` | `supabase/functions/system-recovery-status/index.ts` |
| `admin` | `supabase/migrations/20260721204338_c3449eb5-c14f-4f87-a0ef-49debf3d12bf.sql` |

## K. Testes como especificação (1136 testes em 106 arquivos — nomes completos em `context.json`)

| Arquivo | Testes | Exemplos do que o sistema DEVE fazer |
|---|---|---|
| `supabase/functions/_shared/__tests__/lusha-client.test.ts` | 80 | normalizeLushaCookie · JWT cru ganha o nome  · cookie string já nomeado passa intacto · string completa do DevTools passa intacta … |
| `src/hooks/__tests__/useRateLimit.logic.test.ts` | 78 | BUG REGRESSION — else if (locked) vs else if (!locked) · BUG: UI permanece LOCKED após expiração (demonstração do bug original) · FIX: UI desbloqueada automaticamente após expiração · FIX: isLocked() e UI em sincronia após unlock … |
| `e2e/navigation.spec.ts` | 40 | Login Page · renders login form with all elements · switches between login and signup tabs · shows demo mode button … |
| `src/lib/dlq/__tests__/aggregations.test.ts` | 39 | filterByPeriod · retorna tudo quando period é null · filtra por janela de 24h · filtra por janela de 7 dias … |
| `src/lib/__tests__/sanitize.test.ts` | 33 | escapeHtml · escapes & < > \ · leaves safe strings unchanged · handles empty string … |
| `supabase/functions/_shared/__tests__/ssrf-guard.test.ts` | 25 | isPrivateOrReservedIPv4 · bloqueia ${nome} (${ip}) · permite ${nome} (${ip}) · isPrivateOrReservedIPv6 … |
| `supabase/functions/_shared/__tests__/lead-identity.test.ts` | 24 | normalizePersonName · remove acento, caixa e espaço extra · remove título de tratamento e sufixo geracional · remove pronomes/siglas entre parênteses e e-mail colado … |
| `supabase/functions/_shared/__tests__/phone-br.test.ts` | 21 | normalizePhoneBR · normaliza celular BR 11 dígitos · normaliza fixo BR 10 dígitos · aceita já com +55 … |
| `supabase/functions/_shared/__tests__/omkar-gmaps-config.test.ts` | 19 | normalizeLang · reduz a tag regional ao código base · cai no fallback quando inválido · mapToOmkarTaskInput … |
| `src/components/lux/lusha/__tests__/historyUtils.test.ts` | 18 | filterHistory · busca por domínio e por linkedin (case-insensitive) · filtra por status · aplica janela de datas inclusiva … |
| `src/integrations/supabase/__tests__/withOrg.maliciousFilters.test.ts` | 18 | db (withOrg) — malicious payloads & filter bypass attempts · UPDATE — tentativas de mover registro para outra org · bloqueia update com organization_id divergente no payload (singular) · bloqueia update com organization_id divergente em array (bulk) … |
| `supabase/functions/_shared/__tests__/apollo-cache.test.ts` | 18 | buildApolloCacheKey · é estável independente da ordem dos filtros · normaliza caixa do domínio e dos filtros · remove duplicatas dos filtros … |
| `src/components/lux/__tests__/CompanyFilters.test.tsx` | 17 | CompanyFilters — P0 Mobile Collapsible · renders filter title with icon · renders all facet groups on desktop · computes sector facets correctly … |
| `supabase/functions/_shared/__tests__/apollo-fallback.test.ts` | 17 | normalizeDomain · normaliza URLs completas · extrai domínio de e-mail corporativo · rejeita valores inválidos e provedores gratuitos … |
| `src/integrations/supabase/__tests__/withOrg.batch.test.ts` | 16 | db (withOrg) — batch operations atomic rejection · INSERT em lote · falha o lote inteiro quando a última linha é de outra org · falha o lote inteiro quando a primeira linha é de outra org … |
| `src/lib/schemas/__tests__/validation.test.ts` | 16 | validateScrapeJob · accepts valid input · rejects empty name · rejects empty keywords … |
| `supabase/functions/_shared/domain/ipc/__tests__/scoring.test.ts` | 16 | calculateIPCScore · returns baseline 50 with no criteria and no enrichment signals · matches sector case-insensitively (substring) · matches sector as a substring, not just exact … |
| `e2e/lusha-flows.spec.ts` | 15 | Lusha Intelligence — fluxos ampliados (R33) · A · Busca · 1) sucesso rápido devolve SearchResponse mínimo · 2) resposta lenta (2s) resolve sem erro … |
| `src/lib/lusha/__tests__/departmentMap.test.ts` | 15 | departmentMap — fonte de verdade compartilhada · congela DEPT_MAP e sugestões (imutabilidade) · mantém pelo menos 12 sugestões PT sem duplicatas · mapeia todas as sugestões PT canônicas para um enum EN válido … |
| `supabase/functions/_shared/__tests__/bitrix-client.test.ts` | 15 | resolveDeptEnum · resolve Compras · resolve Marketing · resolve Recursos Humanos … |
| `src/components/lux/lusha/SessionsPanel.test.tsx` | 14 | SessionsPanel (R36 server-side) · estado vazio original quando o backend retorna zero sem filtros · renderiza uma linha por sessão retornada pelo servidor · mostra badge  … |
| `src/lib/sourceQualityReport.test.ts` | 14 | totalsForSource · soma linhas e recalcula taxas sobre os totais · retorna taxas nulas sem amostra · ignora linhas de outra fonte … |
| `src/lib/__tests__/orgErrorHandler.test.ts` | 14 | handleOrgError → toast · dispara toast específico para INSERT sem org · dispara toast específico para UPDATE sem org · dispara toast específico para DELETE sem org … |
| `src/hooks/__tests__/useRealtimeScrapeJobs.test.ts` | 13 | useRealtimeScrapeJobs · uses private channel name scoped to org id · applies organization_id filter for UPDATE events only · does not subscribe when user is null … |
| `supabase/functions/_shared/__tests__/leadcontact-client.test.ts` | 13 | assertLeadContactOk · deixa passar resposta sem code · deixa passar code 0 · deixa passar code 200 … |
| `e2e/companies-crud.spec.ts` | 12 | Companies — List & Filters (Demo) · loads company list with header controls · real-time search filters list · filters panel exposes sector and IPC score facets … |
| `src/components/lux/__tests__/StatsGrid.test.tsx` | 12 | StatsGrid — P1 Visual Differentiation · renders all 5 KPI cards · shows loading skeletons when data is loading · displays unique color themes per card via CARD_STYLES … |
| `src/lib/__tests__/exportCSV.test.ts` | 12 | sanitizeCell · prefixes formula injection with a quote · does not corrupt legitimate negative numbers · still blocks a non-numeric string that merely starts with - … |
| `e2e/auth.spec.ts` | 11 | Auth — Login Page · renders login card with brand and core elements · renders both Entrar and Criar Conta tabs · toggles password visibility … |
| `e2e/rls-guarantees.spec.ts` | 11 | RLS — leitura anônima bloqueada em tabelas multi-tenant · anon não lê linhas de  · RLS — leitura anônima bloqueada em tabelas isentas sensíveis · anon não lê linhas de  … |
| `src/components/lux/__tests__/CompanyTableRow.test.tsx` | 11 | HighlightText · highlights matching text · returns plain text when no match · returns plain text for short queries … |
| `src/components/lux/__tests__/SidebarFooter.test.tsx` | 11 | Sidebar — P1 Dynamic Footer · renders all nav items when expanded · renders system status section when expanded · hides system status when collapsed … |
| `src/components/lux/__tests__/StakeholderCard.test.tsx` | 11 | StakeholderCard utilities · getInitials returns first+last initials · getSeniority returns correct config · getScoreGradient returns gradient classes … |
| `src/hooks/__tests__/useRealtimeCompanies.test.ts` | 11 | useRealtimeCompanies · uses private channel name scoped to org id · applies organization_id filter in subscription config · does not subscribe when user is null … |
| `supabase/functions/_shared/__tests__/web-scrape.test.ts` | 11 | robots.txt parser · permite quando não há regras · aplica Disallow para User-agent: * · prefere grupo específico do UA sobre wildcard … |
| `src/components/lux/lusha/StatusBadge.test.tsx` | 10 | StatusBadge — contrato visual (R34) · renderiza status  · cobre exatamente as 13 chaves conhecidas do map · agrupa todos os estados error* sob label  … |
| `src/hooks/__tests__/oracleV2Helpers.test.ts` | 10 | computeBitrixReadiness · marca pronto quando company_id e user_id numérico estão preenchidos · bloqueia quando company_id vazio · bloqueia quando user_id vazio … |
| `src/components/lux/lusha/DecisionMakersGrid.test.tsx` | 9 | DecisionMakersGrid · renderiza header do domínio + badge com total quando não há erro · renderiza badge de erro e não desenha a tabela quando r.error existe · renderiza linha por decisor com nome, cargo e link do LinkedIn … |
| `src/components/lux/lusha/types.test.ts` | 9 | types.ts (R34) — contratos · DeptGroup: label + items · LushaContact aceita nullables e recusa campos ausentes · LushaSession: arrays nullable e status nullable … |
| `src/hooks/__tests__/useAuditTrail.test.ts` | 9 | fetchAuditTrail · pagina via range() com base em page/pageSize (1-indexada) · filtra apenas automações com .in() no conjunto esperado · filtra por tabela específica com .eq(table_name) … |
| `src/integrations/supabase/__tests__/withOrg.switching.test.ts` | 9 | withOrg — E2E switching de organização ativa · fluxo completo: opera em Org A, troca para Org B, e o filtro de leitura acompanha · bloqueia leitura cross-org: estando em Org A, cliente NÃO consegue forçar SELECT em Org B · bloqueia escrita cross-org após switch: tentar inserir com org antiga é interceptado … |
| `src/lib/dlq/__tests__/classify.test.ts` | 9 | classifyDlqReason · classifica rede · classifica rate limit · classifica auth … |
| `src/lib/resilience/simulator.test.ts` | 9 | simulator - backoff · cresce exponencialmente e respeita o cap · simulator - cenários · erro permanente (4xx) sempre vai para DLQ quando falha … |
| `supabase/functions/_shared/__tests__/tracking-signature.test.ts` | 9 | tracking-signature · round-trips a click URL · round-trips an open pixel (null url) · rejects a tampered url … |
| `src/components/lux/__tests__/CompanyTable.test.tsx` | 8 | CompanyTable — Virtualized list · renders Score IPC header · renders company names · applies correct score color classes … |
| `src/components/lux/layout/__tests__/Sidebar.test.tsx` | 8 | Sidebar · renders all nav items when expanded · hides labels when collapsed · calls onNavigate when a nav item is clicked … |
| `src/components/lux/lusha/__tests__/historyUtils.fuzz.test.ts` | 8 | R35 fuzz — historyUtils robusto contra payloads adversos · filterHistory nunca lança e retorna subconjunto válido · filterHistory com janelas inválidas não estoura · formatDurationMs blindado contra NaN/negativos/infinito … |
| `src/components/lux/monitoring/__tests__/DlqHealthCard.test.tsx` | 8 | DlqHealthCard · renderiza título e severidade  · mostra severidade  · exibe o valor de itens pendentes … |
| `src/hooks/__tests__/usePersistedFilters.test.ts` | 8 | usePersistedFilters · returns default state on first render · persists state updates to localStorage · restores state from localStorage … |
| `src/integrations/supabase/__tests__/withOrg.bulkDelete.test.ts` | 8 | db (withOrg) — bulk DELETE scope guards · injeta organization_id ANTES de filtros adicionais (.in) · soft delete: em companies, DELETE vira UPDATE deleted_at mantendo escopo de org · injeta filtro de org mesmo quando chamador encadeia múltiplos .eq/.neq … |
| `src/lib/__tests__/orgErrorHandler.e2e.test.ts` | 8 | orgErrorHandler — E2E switching de org durante edição · mostra toast quando UPDATE falha após troca de org no meio da edição · ação  · handler global captura unhandledrejection com OrgMismatchError e mostra toast … |
| `src/lib/resilience/autotune.test.ts` | 8 | autotune - score · recompensa sucesso e penaliza DLQ/SLA · autotune - enumeração · descarta políticas com cap menor que base … |
| `supabase/functions/_shared/__tests__/instagram-config-hash.test.ts` | 8 | normalizeTarget: trim, lowercase, remove @ e # · clampLimit: default, floor, ceil e truncamento · computeConfigHash: mesma tupla ⇒ mesmo hash (estabilidade) · computeConfigHash: invariante a variações de forma do target … |
| `e2e/protected-navigation.spec.ts` | 7 | Navegação protegida — redirecionamento · rota protegida ${route} redireciona para /login sem sessão · rota inexistente renderiza página 404 · Navegação protegida — modo demo … |
| `src/components/lux/__tests__/CompaniesView.test.tsx` | 7 | CompaniesView — P0 Mobile Actions & P1 Score Tooltip · renders the view title · renders Score column header with HelpCircle tooltip · renders export CSV button … |
| `src/components/lux/__tests__/DashboardView.test.tsx` | 7 | DashboardView — P1 Chart Legibility · renders Performance Semanal chart section · renders chart with strokeWidth 2.5 for better legibility · renders chart dots for data points … |
| `src/components/lux/__tests__/ErrorBoundary.test.tsx` | 7 | ErrorBoundary · renders children when no error · renders error UI when child throws · shows error message in details … |
| `src/components/lux/lusha/constants.test.ts` | 7 | DEPT_GROUPS (R34) — estrutura e invariantes · expõe exatamente 5 grupos · labels PT-BR canônicos em ordem estável · grupo  … |
| `src/components/lux/monitoring/__tests__/DlqAlertSettingsCard.test.tsx` | 7 | DlqAlertSettingsCard · renderiza título e campos de configuração · chama a mutação de salvar com valores saneados ao clicar em Salvar · desabilita edição para não-administradores … |
| `src/components/lux/monitoring/__tests__/slaRiskAnalysis.test.ts` | 7 | detectSlaRisk · sinaliza fila cujo p95 excede o SLA configurado · não sinaliza quando o p95 está dentro do SLA · respeita a tolerância percentual … |
| `src/hooks/__tests__/useRecentViews.test.ts` | 7 | useRecentViews · starts with empty recent views · tracks a viewed page · deduplicates on revisit and moves to front … |
| `src/lib/__tests__/orgErrorHandler.audit.test.ts` | 7 | recordOrgViolation — resiliência fire-and-forget · não quebra quando RLS rejeita o insert (retorno {error}) · não quebra quando o insert rejeita (rede/offline) · não quebra quando supabase.from(...).insert lança síncrono … |
| `src/lib/__tests__/utils.test.ts` | 7 | cn (class merge utility) · merges class names · handles conditional classes · deduplicates conflicting tailwind classes … |
| `src/tests/load-stress.test.ts` | 7 | load-stress: motor de resiliência · processa 500 cenários em menos de 5s (throughput >= 100 cenários/s) · mantém sucesso >= 70% no agregado com política default · cenários client_4xx com failureRate 0.95 vão majoritariamente para DLQ (comportamento correto) … |
| `supabase/functions/_shared/apify-gateway.test.ts` | 7 | fault: rate_limit_429 em startActorRun · fault: timeout em startActorRun respeita timeoutMs · fault: actor_run_failed marca run como FAILED e propaga no poll · fault: empty_dataset devolve [] em getDatasetItems … |
| `supabase/functions/_shared/__tests__/chaos.stress.test.ts` | 7 | Chaos determinístico — stress · A1: Determinismo em 1.000 amostras · A2: Distribuição rate=0.01 em 20.000 tasks dentro de [0.005, 0.020] · A3: Bordas rate=0 e rate=1 em 500 tasks … |
| `src/components/lux/__tests__/EmptyState.test.tsx` | 6 | EmptyState · renders title and description · renders action button when actionLabel and onAction provided · renders multiple action buttons … |
| `src/components/lux/__tests__/WorkflowCard.test.tsx` | 6 | WorkflowCard · renders workflow name and description · renders status badge · calls onToggleExpand when clicked … |
| `src/components/lux/layout/__tests__/Header.test.tsx` | 6 | Header · renders user initial when no avatar · renders avatar component when url provided · calls onOpenMobileSidebar on menu click … |
| `src/components/lux/monitoring/__tests__/slaHistoryChartData.test.ts` | 6 | buildSlaChartData · retorna vazio para entrada vazia · ordena cronologicamente mesmo com entrada fora de ordem · aplica carry-forward: fila não alterada mantém o último valor … |
| `src/hooks/__tests__/useSidebarState.test.ts` | 6 | useSidebarState · starts expanded by default · toggles collapse state · persists collapsed state to localStorage … |
| `src/integrations/supabase/__tests__/withOrg.registry.test.ts` | 6 | withOrg registry ↔ banco (sincronia multi-tenant) · classifica TODA tabela com organization_id em exatamente um conjunto · não classifica a mesma tabela em mais de um conjunto · toda tabela ESCOPADA realmente possui organization_id no banco … |
| `src/lib/__tests__/csv.test.ts` | 6 | buildCsv · prepends a UTF-8 BOM for Excel/PT-BR compatibility · quotes cells containing comma, quote, newline or semicolon · neutralizes formula injection (CSV injection) … |
| `supabase/functions/_shared/__tests__/chaos.chi2.test.ts` | 6 | Chaos — χ² & colisões (Rodada #20) · χ² para rate=${rate} em ${N} tasks (erro relativo < 5%) · rate=0 absoluto (0 hits em 5.000) · rate=1 absoluto (5.000/5.000) … |
| `supabase/functions/_shared/__tests__/chaos.test.ts` | 6 | shouldInjectChaos · é determinístico para o mesmo task_id · respeita rate=0 (nunca injeta) · respeita rate=1 (sempre injeta) … |
| `supabase/functions/_shared/__tests__/hiker-normalize-extra.test.ts` | 6 | hashtags/mentions: unicode preservado, case lowercased, dedup · hashtags: extraídos do caption combinam com o campo  · hashtag(): tag do contexto entra como primeira hashtag sem duplicar · reply threads: parentCommentId resolvido em N níveis … |
| `src/components/lux/__tests__/CompanyTable.integration.test.tsx` | 5 | CompanyTable — integração de virtualização com scroll · renderiza apenas uma janela de linhas, não a lista inteira · mostra os primeiros itens no topo e esconde os itens distantes · revela itens mais abaixo após rolar e recicla os do topo … |
| `src/components/lux/__tests__/DataError.test.tsx` | 5 | DataError · renders default error message · renders custom error message · renders retry button when onRetry provided … |
| `src/components/lux/__tests__/MapFilters.test.tsx` | 5 | MapFilters · renders search input and filter count · displays IPC score label with current value · calls onSearchChange when typing … |
| `src/hooks/__tests__/useDlqReplay.test.ts` | 5 | useDlqReplay · invoca instagram-dlq-replay com o payload correto e retorna o result · invoca web-dlq-replay quando motor é  · extrai a mensagem de FunctionsHttpError via context.text() … |
| `src/lib/resilience/__tests__/compareReport.test.ts` | 5 | buildComparison · classifies improvement, regression and stability · marks new and removed scenarios · computes aggregate deltas and top lists … |
| `supabase/functions/_shared/__tests__/hiker-normalize.test.ts` | 5 | normalize(profile) — business + creator sem undefined · normalize(posts) — image, reel, carousel, sponsored sem undefined · normalize(hashtag) — inclui tag e cobre reel/carousel · normalize(comments) — root + reply sem undefined … |
| `e2e/instagram-dlq-replay.spec.ts` | 4 | Instagram motor — enqueue → resultados → DLQ replay · ciclo completo: sucesso + DLQ + replay bem-sucedido · Monitoring → aba Instagram (UI) · renderiza painel de conexão e expõe ação de testar credenciais |
| `e2e/invite-accept.spec.ts` | 4 | Convite — /invite/:token · redireciona visitante não autenticado para /login preservando o token · página de login continua funcional após vir de um convite · não aceita o convite automaticamente (requer ação do usuário) |
| `src/components/lux/SafeHTML.test.tsx` | 4 | SafeHTML XSS Protection · should escape script tags · should escape event handlers · should convert newlines to <br /> |
| `src/components/lux/__tests__/CampaignsView.test.tsx` | 4 | CampaignsView · renders heading · renders create button · shows campaign card when data loads |
| `src/components/lux/__tests__/ICPConfigView.test.tsx` | 4 | useICPConfig (mocked) · returns activeConfig with criteria · returns isLoading false · returns save function |
| `src/components/lux/__tests__/WorkflowsView.test.tsx` | 4 | WorkflowsView · renders heading · renders create button · shows workflow cards when data loads |
| `src/hooks/__tests__/useConfirm.test.tsx` | 4 | useConfirm · resolves true when the user confirms · resolves false when the user cancels · throws when used outside the provider |
| `src/hooks/__tests__/useOraclePushBitrix.test.ts` | 4 | useOraclePushBitrix — contrato da edge oracle-push-bitrix · envia payload com contact_ids + destino Bitrix opcional · propaga erro da edge (bitrix_open) para onError · aceita resposta com status variados no results[] |
| `src/hooks/__tests__/useRateLimit.test.ts` | 4 | useRateLimit · should not be locked initially · should lock after exceeding max attempts · should unlock after window windowMs |
| `src/integrations/supabase/withOrg.test.ts` | 4 | withOrg Multi-tenant Isolation · should block access to unclassified tables (Deny-by-Default) · should allow access to scoped tables when org is active · should block write operations without active organization |
| `src/tests/fuzzing-validation.test.ts` | 4 | Fuzzing & Validation: Webhooks and Edge Functions · should reject malformed JSON payloads · should reject missing required fields (e.g., event_type) · should handle invalid UUIDs gracefully |
| `src/tests/multi-tenant.test.ts` | 4 | Multi-Tenant Isolation (SafeOrg) · should automatically inject organization_id into SELECT queries · should warn but not throw on SELECT when no organization is active · should block cross-tenant injection attempts in values |
| `supabase/functions/rls-tests/index.test.ts` | 4 | rls-tests: rejeita 401 quando NÃO há Authorization Bearer · rls-tests: rejeita Bearer JWT corrompido (gateway OU guard) · rls-tests: retorna 403 quando JWT é válido mas user não é admin · rls-tests: retorna relatório estruturado quando admin chama |
| `e2e/accessibility.spec.ts` | 3 | Acessibilidade (axe-core) · Dashboard não tem violações WCAG 2 A/AA · Configurações não tem violações WCAG 2 A/AA |
| `e2e/instagram-worker-smoke.spec.ts` | 3 | Instagram motor — smoke · enfileira → worker processa → resultados gravados (profile + hashtag) · deduplicação: mesmo config_hash não cria duplicata em queued/running |
| `e2e/monitoring-navigation.spec.ts` | 3 | Monitoramento — navegação · carrega a página com o título e as abas de monitoramento · troca de aba atualiza o conteúdo exibido |
| `supabase/functions/_shared/__tests__/gmaps-mapper.test.ts` | 3 | parseCsv respects quoted commas and escapes · mapGmapsRow extracts full 36-field set from gosom CSV row · mapGmapsRow uses safe fallbacks for missing fields |
| `supabase/functions/_shared/__tests__/linkedin-url.test.ts` | 3 | publicIdFromLinkedInUrl · extrai de ${nome} · retorna vazio para ${nome} |
| `e2e/dlq-web-smoke.spec.ts` | 2 | DLQ web — smoke · ciclo enqueue → DLQ → snapshot → replay |
| `e2e/lusha-smoke.spec.ts` | 2 | Lusha Intelligence — smoke · carrega a view sem erros de runtime |
| `e2e/oracle-decisor-flow.spec.ts` | 2 | Oracle v2 — fluxo end-to-end real (busca → decisores → enriquecimento) · busca decisores em empresa real e enriquece pelo menos um contato |
| `e2e/oracle-v2.spec.ts` | 2 | Oracle v2 — smoke · painel resiliente: Error Boundary não derruba a aba quando preflight falha |
| `src/contexts/__tests__/AuthContext.test.tsx` | 2 | AuthProvider.signOut · clears the React Query cache and the active org before calling supabase.auth.signOut |
| `src/test/example.test.ts` | 2 | example · should pass |

## L. Eventos de webhook tratados (contratos com sistemas externos)

_nenhum item encontrado_

## M. Efeitos colaterais (e-mail, SMS, cobrança, fila — não são idempotentes por padrão)

| Chamada | Arquivo |
|---|---|
| `notify` | `src/components/automation/WorkflowEditor.tsx` |
| `invoke(` | `src/components/lux/CampaignsView.tsx` |
| `notifyLongSearch` | `src/components/lux/LushaIntelligenceView.tsx` |
| `notifyOnCancel` | `src/components/lux/LushaIntelligenceView.tsx` |
| `notifyOnFailure` | `src/components/lux/LushaIntelligenceView.tsx` |
| `invoke(` | `src/components/lux/integrations/DisconnectAccountDialog.tsx` |
| `invoke(` | `src/components/lux/integrations/EmailAccountsPanel.tsx` |
| `invoke(` | `src/components/lux/integrations/OAuthSandboxPanel.tsx` |
| `invoke(` | `src/components/lux/monitoring/InstagramConnectionPanel.tsx` |
| `invoke(` | `src/components/lux/monitoring/JobDetailsSheet.tsx` |
| `invoke(` | `src/components/lux/monitoring/VaultCookiesPanel.tsx` |
| `invoke(` | `src/components/lux/security/OrgViolationAlertsPanel.tsx` |
| `invoke(` | `src/hooks/useDlqReplay.ts` |
| `invoke(` | `src/hooks/useRateLimit.ts` |
| `notify` | `src/hooks/useRealtimeScrapeJobs.ts` |
| `invoke(` | `src/hooks/useWebhooks.ts` |
| `sendMail` | `supabase/functions/campaign-dispatch/index.ts` |
| `notifyRows` | `supabase/functions/org-violation-alerts/index.ts` |
| `notify` | `supabase/functions/workflow-engine/index.ts` |
| `notify_on_scrape_import` | `supabase/migrations/20260331104943_bad1a93f-0ffb-4464-9289-e3fc1ccfe273.sql` |
| `notify_on_enrichment` | `supabase/migrations/20260331113407_e60b6db5-9894-4230-8999-6f5365d420a3.sql` |
| `notify_on_workflow_complete` | `supabase/migrations/20260331113407_e60b6db5-9894-4230-8999-6f5365d420a3.sql` |
| `notify_on_scrape_import` | `supabase/migrations/20260331113456_de65eef0-aa9f-4757-a972-321770e4365c.sql` |
| `notify_on_enrichment` | `supabase/migrations/20260404121419_e1e0de78-f9e7-471c-8922-4c966024385a.sql` |
| `notify_on_workflow_complete` | `supabase/migrations/20260404121419_e1e0de78-f9e7-471c-8922-4c966024385a.sql` |
| `notify_on_enrichment` | `supabase/migrations/20260405144948_934c8ede-500a-4593-afdb-6f219e284fbc.sql` |
| `notify_on_workflow_complete` | `supabase/migrations/20260405144948_934c8ede-500a-4593-afdb-6f219e284fbc.sql` |
| `notify_on_enrichment` | `supabase/migrations/20260711182448_78ef4fa7-e466-45a0-a375-8906c868d031.sql` |
| `notify_on_workflow_complete` | `supabase/migrations/20260711182448_78ef4fa7-e466-45a0-a375-8906c868d031.sql` |
| `notify_on_enrichment` | `supabase/migrations/20260711182609_359679b5-9ff3-4263-abe3-752986dea8b8.sql` |
| `notify_on_workflow_complete` | `supabase/migrations/20260711182609_359679b5-9ff3-4263-abe3-752986dea8b8.sql` |
| `notify_on_enrichment` | `supabase/migrations/20260711185013_f352702d-a680-4b7a-916a-0de5cfc603b7.sql` |
| `notify_on_workflow_complete` | `supabase/migrations/20260711185013_f352702d-a680-4b7a-916a-0de5cfc603b7.sql` |
| `notify_on_enrichment` | `supabase/migrations/20260712112638_42e21fe1-53f4-4a40-98e2-d60931b3ab61.sql` |
| `notify_on_workflow_complete` | `supabase/migrations/20260712112638_42e21fe1-53f4-4a40-98e2-d60931b3ab61.sql` |
| `notify` | `supabase/migrations/20260715190111_34d421ca-d6a1-4754-ad88-4566225925c9.sql` |
| `notify_on_workflow_complete` | `supabase/migrations/20260721230244_719383a4-5877-4561-a2f0-368eb1ce49be.sql` |

## N. Regras citadas em comentários do código

| Comentário | Arquivo |
|---|---|
| PGRST301/PGRST302: JWT ausente/expirado. 42501: RLS/permissão negada. | `src/App.tsx` |
| Deve ser montado DENTRO de <BrowserRouter>. | `src/App.tsx` |
| * Instala o listener de unhandledrejection apenas no client. */ | `src/App.tsx` |
| Difere do MFAEnroll: aqui não cadastramos, apenas verificamos o código. | `src/components/auth/MFAVerify.tsx` |
| nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(loc)}`, | `src/components/lux/AddCompanyDialog.tsx` |
| Auto-preencher apenas campos vazios (não sobrescreve edição do usuário). | `src/components/lux/AddCompanyDialog.tsx` |
| Compõe uma descrição estruturada apenas se o usuário ainda não digitou nada. | `src/components/lux/AddCompanyDialog.tsx` |
| Validação imediata ao abrir: se a org do registro não bate com a | `src/components/lux/EditCompanyDialog.tsx` |
| nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(loc)}`, | `src/components/lux/EditCompanyDialog.tsx` |
| ── Tempo médio por domínio (apenas buscas concluídas com sucesso) ── | `src/components/lux/LushaIntelligenceView.tsx` |
| ── Auto-retry de buscas falhadas (respeita fila + rate-limit) ── | `src/components/lux/LushaIntelligenceView.tsx` |
| ── Helpers de normalização e validação ── | `src/components/lux/LushaIntelligenceView.tsx` |
| mantém v como está — validação abaixo pegará o erro */ } | `src/components/lux/LushaIntelligenceView.tsx` |
| opcional — apenas referência | `src/components/lux/LushaIntelligenceView.tsx` |
| Sessão mais recente — usada apenas como fallback para `activeSessionId`. | `src/components/lux/LushaIntelligenceView.tsx` |
| ── Countdown do rate limit (decrementa 1s a 1s) ── | `src/components/lux/LushaIntelligenceView.tsx` |
| apenas conveniência para evitar 400 previsível. | `src/components/lux/LushaIntelligenceView.tsx` |
| confiável, o que fazia o "cancelar" ser apenas cosmético. | `src/components/lux/LushaIntelligenceView.tsx` |
| Variantes A/B — apenas na primeira etapa de e-mail. */} | `src/components/lux/campaigns/CampaignFormFields.tsx` |
| Dispara validação automática para feedback rápido por perfil | `src/components/lux/integrations/OAuthSandboxPanel.tsx` |
| * Lista snapshots de validação OAuth da organização e permite comparar dois | `src/components/lux/integrations/OAuthSnapshotsPanel.tsx` |
| Degradado: serviços bloqueantes prontos, apenas opcionais (LinkedIn) com falha. | `src/components/lux/lusha/OracleV2Panel.tsx` |
| nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(location)}`, | `src/components/lux/map/MapMarkerIcons.tsx` |
| definem o limite crítico (ms), quantos ciclos consecutivos disparam o alerta | `src/components/lux/monitoring/ApiLatencyAlertSettingsCard.tsx` |
| buildCsv exportado apenas para uso externo/testes. | `src/components/lux/monitoring/ResilienceReport.tsx` |
| RLS restringe SELECT/UPDATE a admins globais — para não-admins, o botão apenas | `src/components/lux/monitoring/SlaAlertSettingsCard.tsx` |
| sem permissão ou sem row | `src/components/lux/monitoring/SlaAlertSettingsCard.tsx` |
| * Limite de execuções consecutivas bloqueadas antes de tratar como alerta. */ | `src/components/lux/monitoring/SlaAutoTuneBlockedCard.tsx` |
| definição, mais de 5% dos itens da fila estouram o prazo — é um alvo | `src/components/lux/monitoring/slaRiskAnalysis.ts` |
| inatingível, não uma meta ambiciosa. Isolamos a regra aqui para permitir | `src/components/lux/monitoring/slaRiskAnalysis.ts` |
| * Render this when the user lacks the permission instead of nothing. */ | `src/components/lux/permissions/PermissionGate.tsx` |
| - Mostra/edita configurações da org ativa (limite, janela, cooldown). | `src/components/lux/security/OrgViolationAlertsPanel.tsx` |
| * Acesso: apenas admins (gate feito por `usePermissions` no caller). | `src/components/lux/security/OrgViolationAlertsPanel.tsx` |
| Regras: company_id não vazio; user_id somente dígitos. | `src/hooks/oracleV2Helpers.ts` |
| apenas administradores enxerguem os registros do próprio workspace. | `src/hooks/useAuditTrail.ts` |
| * Configuração global (singleton) dos alertas de disjuntor. Somente admins | `src/hooks/useCircuitBreakerAlerts.ts` |
| Apenas flag global | `src/hooks/useFeatureFlag.ts` |
| Only if not in a modal or menu (those handle Esc themselves) | `src/hooks/useKeyboardShortcuts.ts` |
| - SQL action must be `delete` | `src/hooks/useMembershipAuditLog.ts` |
| - `old_data` must exist with an explicit `user_id` (cascades that null | `src/hooks/useMembershipAuditLog.ts` |
| - `actor_id` must be present and equal to `old_data.user_id` (not merely | `src/hooks/useMembershipAuditLog.ts` |
| * Backward-compatible single-page fetch (used by callers that pass a flat limit). | `src/hooks/useMembershipAuditLog.ts` |
| então basta contar até MAX_UNREAD + 1 via limit — index-only scan. | `src/hooks/useNotificationCount.ts` |
| * Lista snapshots de validação OAuth da organização ativa. | `src/hooks/useOAuthSandboxSnapshots.ts` |
| * true somente quando TODOS os serviços, inclusive o opcional linkedin, estão prontos. */ | `src/hooks/useOracleV2.ts` |
| HTTP 429 do rate-limit por organização vem com Retry-After em segundos. | `src/hooks/useOracleV2.ts` |
| * Hook de Rate Limit Híbrido: | `src/hooks/useRateLimit.ts` |
| GAP-5: validação de parâmetros em modo de desenvolvimento. | `src/hooks/useRateLimit.ts` |
| Check original: apenas quando ambos são finitos (evita falso positivo com Infinity) | `src/hooks/useRateLimit.ts` |
| * Verifica o rate limit no servidor via Edge Function. | `src/hooks/useRateLimit.ts` |
| FIX ADV-7: parseLockTs usa Number() + validação > 0 em vez de parseInt(). | `src/hooks/useRateLimit.ts` |
| Cap mantém as entradas mais recentes (mais relevantes para o rate limit). | `src/hooks/useRateLimit.ts` |
| - Semanticamente: "lock expira em 13/09/2285" (≈285 anos) — intent de "permanente" | `src/hooks/useRateLimit.ts` |
| * GAP-4: Reseta o estado de rate limit para esta chave. | `src/hooks/useRateLimit.ts` |
| `any`, modelamos apenas o contrato realmente usado pelo wrapper e a cadeia de | `src/integrations/supabase/withOrg.ts` |
| ou apenas por edge functions / admin). Ficam sob RLS específica e NÃO | `src/integrations/supabase/withOrg.ts` |
| * Utilitários de CNPJ — normalização e validação dos dígitos verificadores. | `src/lib/cnpj.ts` |
| Também limpa o banner. Se a tabela não tiver mapeamento, apenas | `src/lib/orgErrorHandler.ts` |
| pistas concretas do que o usuário deve fazer. | `src/lib/orgErrorHandler.ts` |
| - sdr    : day-to-day operator — can create/edit business data, cannot delete or manage workspace | `src/lib/permissions.ts` |
| * Sanitize user input: trim, strip tags, limit length */ | `src/lib/sanitize.ts` |
| Aqui ficam apenas transformações determinísticas — nada de I/O — para que | `src/lib/sourceQualityReport.ts` |
| * Item mínimo do histórico de alertas necessário para as agregações. */ | `src/lib/dlq/aggregations.ts` |
| * Ponto mínimo de tendência necessário para o comparativo período-a-período. */ | `src/lib/dlq/aggregations.ts` |
| janela; usamos isso — em vez de um limite absoluto — para que a detecção se | `src/lib/dlq/aggregations.ts` |
| * zScore mínimo para um ponto ser considerado pico. Default 1.5. */ | `src/lib/dlq/aggregations.ts` |
| * Registro de log mínimo necessário para correlação temporal. */ | `src/lib/dlq/aggregations.ts` |
| nem estado global. Logs são ordenados por proximidade ao pico e apenas picos | `src/lib/dlq/aggregations.ts` |
| caminho relativo. NÃO adicionar deps externas aqui — deve permanecer puro. | `src/lib/lusha/departmentMap.data.ts` |
| Business Development | `src/lib/lusha/departmentMap.data.ts` |
| enriquecimento e presença digital. RLS garante que apenas empresas da | `src/lib/mcp/tools/get-company.ts` |
| e poucas tentativas — caso contrário toda retentativa já estoura o prazo e só | `src/lib/resilience/autotune.ts` |
| tentativas, elevando a taxa de sucesso sem violar o prazo. | `src/lib/resilience/autotune.ts` |
| * Limite inferior inclusivo (s). */ | `src/lib/resilience/autotune.ts` |
| * Limite superior exclusivo (s); Infinity para a última faixa. */ | `src/lib/resilience/autotune.ts` |
| 100).toFixed(0)}% de trabalho recuperável perdido em dead-letter (limite ${(thresholds.maxDlqRate * 100).toFixed(0)}%).`; | `src/lib/resilience/report.ts` |
| Nunca é crítico; no máximo warning. SLA < backoff mínimo é config. | `src/lib/resilience/report.ts` |
| SLA mínimo elevado de 30s → 120s: 30s é menor que o próprio backoff base | `src/lib/resilience/scenarios.ts` |
| * Máximo de deferrals (esperas por recuperação do provedor) antes de | `src/lib/resilience/simulator.ts` |
| espelha `defer_scrape_task` no banco: a tarefa apenas aguarda o provedor. | `src/lib/resilience/simulator.ts` |
| AutoTopProgressBar está no App.tsx para escopo global, o local trata apenas navegação suave se necessário */} | `src/pages/Index.tsx` |
| apenas os três métodos usados, sem depender de tipos ainda não publicados. | `src/pages/OAuthConsent.tsx` |
| - profile: business account + creator account (sem publicPhone/publicEmail). | `supabase/functions/_shared/apify-fixtures.ts` |
| Contato (profile + posts quando business account) | `supabase/functions/_shared/apify-fixtures.ts` |
| Localização/negócio (profile) | `supabase/functions/_shared/apify-fixtures.ts` |
| Business account completo (contato exposto) | `supabase/functions/_shared/apify-fixtures.ts` |
| Creator sem publicEmail/phone — normalizador deve extrair da bio | `supabase/functions/_shared/apify-fixtures.ts` |
| - "actor_run_failed"  → startActorRun retorna run FAILED (worker deve reagir) | `supabase/functions/_shared/apify-gateway.ts` |
| In mock mode dispatches by actorId → static fixture. `limit` is honored. | `supabase/functions/_shared/apify-gateway.ts` |
| Cache agressivo + controle de rate limit para as chamadas ao Apollo. | `supabase/functions/_shared/apollo-cache.ts` |
| * Resposta vazia expira mais rápido: a empresa pode ganhar contatos. */ | `supabase/functions/_shared/apollo-cache.ts` |
| * Cooldown curto para 429 — é cota de janela, não falta de permissão. */ | `supabase/functions/_shared/apollo-cache.ts` |
| * Cliente mínimo (structural typing) — evita import cruzado do supabase-js. */ | `supabase/functions/_shared/apollo-cache.ts` |
| * Grava o cache. Nunca lança: falha de gravação não pode quebrar a busca. */ | `supabase/functions/_shared/apollo-cache.ts` |
| // Usado APENAS como fallback de identificação quando a Lusha devolve zero | `supabase/functions/_shared/apollo-client.ts` |
| • Timeout explícito: uma busca não pode ficar pendurada no Apollo. | `supabase/functions/_shared/apollo-client.ts` |
| * true quando o fallback deve ser desligado nesta execução (401/403) */ | `supabase/functions/_shared/apollo-client.ts` |
| Cache local por-isolate SOMENTE do fast-path (state === "closed"). | `supabase/functions/_shared/circuit-breaker.ts` |
| Invalidar cache imediatamente: qualquer falha deve forçar próxima | `supabase/functions/_shared/circuit-breaker.ts` |
| Aceita tanto o header completo quanto apenas o valor bruto. | `supabase/functions/_shared/cookies.ts` |
| caminho relativo. NÃO adicionar deps externas aqui — deve permanecer puro. | `supabase/functions/_shared/departmentMap.ts` |
| Business Development | `supabase/functions/_shared/departmentMap.ts` |
| * Parser CSV mínimo RFC 4180 — trata aspas e vírgulas dentro de campos. | `supabase/functions/_shared/gmaps-mapper.ts` |
| - Mesma tupla (organization_id, target_type, target_value normalizado, limit) | `supabase/functions/_shared/instagram-config-hash.ts` |
| - `limit` é coagido a inteiro (default 200, clamp 1..1000) e faz parte do payload. | `supabase/functions/_shared/instagram-config-hash.ts` |
| * vazio = registro sem identidade utilizável (deve ser descartado) */ | `supabase/functions/_shared/lead-identity.ts` |
| * A API do LeadContact devolve HTTP 200 mesmo em erro de negócio. | `supabase/functions/_shared/leadcontact-client.ts` |
| Erro de negócio com HTTP 200 — a armadilha-mãe deste projeto | `supabase/functions/_shared/lusha-client.ts` |
| "Business Development" (27 na Lactalis) e perdia "Sales" (1421). | `supabase/functions/_shared/lusha-departments.ts` |
| ── Sales / Business Development | `supabase/functions/_shared/lusha-departments.ts` |
| "vendas"  -> ["Sales", "Business Development"] | `supabase/functions/_shared/lusha-departments.ts` |
| * O omkar aceita apenas o código base ISO-639-1 ("pt-BR" → "pt"). */ | `supabase/functions/_shared/omkar-gmaps-config.ts` |
| - `excludeFromAnon`: pula o teste de "anon não pode ler/inserir" (ex.: tabelas | `supabase/functions/_shared/rlsTableRegistry.ts` |
| somente service_role como webhook_deliveries). | `supabase/functions/_shared/rlsTableRegistry.ts` |
| * Ambientes nos quais esta tabela ainda não existe ou deve ser ignorada no teste de isolamento. | `supabase/functions/_shared/rlsTableRegistry.ts` |
| * Parte pura/síncrona da validação: protocolo, host literalmente proibido, e | `supabase/functions/_shared/ssrf-guard.ts` |
| tracking (ex.: campaign-dispatch, quando enviar emails reais) deve seguir: | `supabase/functions/_shared/tracking-signature.ts` |
| * Simple State Machine for Business Workflows | `supabase/functions/_shared/domain/scrape-job-machine.ts` |
| * Retorna true se a task deve receber injeção sintética de falha. | `supabase/functions/_shared/web-scrape/chaos.ts` |
| * SPA sem SSR: shell HTML mínimo, texto visível curto e scripts pesados. | `supabase/functions/_shared/web-scrape/heuristics.ts` |
| Conversor mínimo HTML → Markdown sem dependências (para não depender de | `supabase/functions/_shared/web-scrape/html-to-markdown.ts` |
| Parser mínimo de robots.txt (User-agent + Disallow/Allow) com cache em banco. | `supabase/functions/_shared/web-scrape/robots.ts` |
| * Segundos entre requests (Crawl-delay). Não aplicado aqui — apenas exposto. */ | `supabase/functions/_shared/web-scrape/robots.ts` |
| * Parse muito enxuto: usa apenas grupos User-agent: * e User-agent: lux-web-scraper. */ | `supabase/functions/_shared/web-scrape/robots.ts` |
| Precedência: o rule com prefixo mais específico vence (comprimento). | `supabase/functions/_shared/web-scrape/robots.ts` |
| 2. Avalia se alguma rota cruzou o limite crítico de p95 por N ciclos | `supabase/functions/api-latency-alerts/index.ts` |
| * Não retorna dados sensíveis: apenas contadores agregados. Toda a lógica | `supabase/functions/api-latency-alerts/index.ts` |
| Prune email_sync_log (fecha gap de retenção — crescia sem limite) | `supabase/functions/audit-logs-prune/index.ts` |
| limite de email por RFC 5321 | `supabase/functions/auth-rate-limit/index.ts` |
| { campaign_id } processa apenas aquela campanha (trigger manual). | `supabase/functions/campaign-dispatch/index.ts` |
| limite defensivo por ciclo para respeitar rate limits do provedor | `supabase/functions/campaign-dispatch/index.ts` |
| podem mais ser contatados. Consulta apenas os e-mails do batch corrente. | `supabase/functions/campaign-dispatch/index.ts` |
| Etapas de espera (wait/delay): apenas agenda a próxima ação e avança. | `supabase/functions/campaign-dispatch/index.ts` |
| Etapa de e-mail: validação defensiva do endereço. | `supabase/functions/campaign-dispatch/index.ts` |
| Seleção de variante A/B: apenas a etapa 0 decide (etapas seguintes | `supabase/functions/campaign-dispatch/index.ts` |
| Evento "sent" apenas na primeira mensagem da sequência (métrica de envio). | `supabase/functions/campaign-dispatch/index.ts` |
| * Duração de uma etapa de espera em milissegundos (mínimo 1 minuto). */ | `supabase/functions/campaign-dispatch/index.ts` |
| apenas orquestra e retorna contadores agregados (sem PII). | `supabase/functions/circuit-breaker-alerts/index.ts` |
| 3. Reserva slot no rate-limit atômico (`cnpj_reserve_rate_slot`). | `supabase/functions/cnpj-enrich/index.ts` |
| 2. Rate-limit reserve | `supabase/functions/cnpj-enrich/index.ts` |
| rate-limit compartilhado e aplica backoff exponencial em falhas transitórias. | `supabase/functions/cnpj-enrich-worker/index.ts` |
| Rate-limit por chamada — se estourar, retorna para pending | `supabase/functions/cnpj-enrich-worker/index.ts` |
| limite/minuto vigente e métricas resumidas de cache/fila. | `supabase/functions/cnpj-settings-status/index.ts` |
| Validação básica de redirect_uri | `supabase/functions/email-oauth-connect/index.ts` |
| Permissão: dono pode remover a sua própria; org accounts exigem admin | `supabase/functions/email-oauth-disconnect/index.ts` |
| Falha silenciosa: contabilidade não deve derrubar a resposta. | `supabase/functions/gmaps-places-search/index.ts` |
| params?: { limit?: number, correlation_id?: string, max_attempts?: number } } | `supabase/functions/instagram-enqueue/index.ts` |
| Não expõe payload sensível — retorna somente resumo. | `supabase/functions/instagram-worker/index.ts` |
| ── 3. Chamada Lusha V3 (apenas domínios sem cache) ── | `supabase/functions/lusha-decision-makers/index.ts` |
| ── Rate limit dedicado: extrai Retry-After (segundos ou HTTP date) ── | `supabase/functions/lusha-decision-makers/index.ts` |
| ── 4. Persistência em public.lusha_contacts (apenas resultados frescos) ── | `supabase/functions/lusha-decision-makers/index.ts` |
| Reveal (V2) é crédito pago da Lusha por contato — sem limite por org, um | `supabase/functions/lusha-reveal/index.ts` |
| ── 1b) Rate limit por organização — reveal gasta crédito pago da Lusha. | `supabase/functions/lusha-reveal/index.ts` |
| LinkedIn é opcional para o Oracle v2 (fluxo usa apenas Lusha + LeadContact). | `supabase/functions/oracle-cookies-preflight/index.ts` |
| * Este preflight NÃO chama a API do serviço — ele apenas lê o que o vault | `supabase/functions/oracle-cookies-preflight/index.ts` |
| além de manipular o rate limit de uma org à qual não pertence. | `supabase/functions/oracle-push-bitrix/index.ts` |
| de consumir o rate limit de busca da vítima (IDOR cross-tenant). | `supabase/functions/oracle-search-decisors/index.ts` |
| Rate limit por organização (30 buscas/hora) | `supabase/functions/oracle-search-decisors/index.ts` |
| limite configurado de OrgMismatchError dentro da janela definida | `supabase/functions/org-violation-alerts/index.ts` |
| limite e está fora do cooldown: | `supabase/functions/org-violation-alerts/index.ts` |
| * O endpoint não retorna dados sensíveis: apenas resumo agregado. | `supabase/functions/org-violation-alerts/index.ts` |
| GET    /companies?limit=&offset= | `supabase/functions/public-api/index.ts` |
| Só os campos de negócio legítimos abaixo passam; tudo mais é descartado | `supabase/functions/public-api/index.ts` |
| limitado: apenas leituras + inserts em history/notifications com cooldown. | `supabase/functions/reaper-alerts/index.ts` |
| ignore — cleanup deve ser idempotente */ } | `supabase/functions/rls-tests/_fixtures.ts` |
| * Classifica se um erro deve ser retentado (transitório) ou não (permanente). */ | `supabase/functions/scrape-queue-worker/index.ts` |
| 4xx é erro do payload do cliente — não deve abrir o circuito. | `supabase/functions/scrape-queue-worker/index.ts` |
| de cada fila (scrape/web/instagram) quando o desvio entre o prazo configurado | `supabase/functions/sla-auto-tune/index.ts` |
| aberto). Isolado do motor GMaps — reusa apenas a malha compartilhada | `supabase/functions/web-scrape-worker/index.ts` |
| ---------- SSRF (mínimo, sem DNS async pra evitar custo por task) ---------- | `supabase/functions/web-scrape-worker/index.ts` |
| ainda assim precisa estar pending/retrying e dentro do limite de | `supabase/functions/webhook-dispatcher/index.ts` |
| best-effort: falha ao disparar alerta não deve mascarar o erro original */ } | `supabase/functions/workflow-engine/index.ts` |
| 41 · Escalonamento EDF (Earliest Deadline First) sensível a SLA | `supabase/migrations/20260726154832_c0dc9709-892f-472b-ad37-30beedd48605.sql` |
