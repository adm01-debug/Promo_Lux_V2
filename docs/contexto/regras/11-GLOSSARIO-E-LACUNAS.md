# 11 · GLOSSÁRIO, DADOS DE REFERÊNCIA E LACUNAS

> Gerado automaticamente por AI Context Sync v1.3.2 · commit `b50e001b5e` · branch `main` · 2026-11-13 16:30 UTC
> Não edite à mão — regras humanas vão em `manual/`.

## Glossário do domínio (entidades do sistema)

| Termo | Significado / valores | Tamanho | Origem |
|---|---|---|---|
| `agent_chat_messages` | _(sem COMMENT ON TABLE — significado não documentado)_ | 6 colunas | migration |
| `api_keys` | _(sem COMMENT ON TABLE — significado não documentado)_ | 11 colunas | migration |
| `api_latency_alert_history` | _(sem COMMENT ON TABLE — significado não documentado)_ | 8 colunas | migration |
| `api_latency_alert_settings` | _(sem COMMENT ON TABLE — significado não documentado)_ | 6 colunas | migration |
| `api_latency_snapshots` | _(sem COMMENT ON TABLE — significado não documentado)_ | 10 colunas | migration |
| `api_request_logs` | _(sem COMMENT ON TABLE — significado não documentado)_ | 15 colunas | migration |
| `apollo_rate_state` | _(sem COMMENT ON TABLE — significado não documentado)_ | 10 colunas | migration |
| `apollo_search_cache` | _(sem COMMENT ON TABLE — significado não documentado)_ | 8 colunas | migration |
| `audit_logs` | _(sem COMMENT ON TABLE — significado não documentado)_ | 12 colunas | migration |
| `auth_rate_limits` | _(sem COMMENT ON TABLE — significado não documentado)_ | 7 colunas | migration |
| `automation_alerts` | _(sem COMMENT ON TABLE — significado não documentado)_ | 8 colunas | migration |
| `automation_execution_logs` | _(sem COMMENT ON TABLE — significado não documentado)_ | 25 colunas | migration |
| `automation_steps` | _(sem COMMENT ON TABLE — significado não documentado)_ | 13 colunas | migration |
| `campaign_events` | _(sem COMMENT ON TABLE — significado não documentado)_ | 10 colunas | migration |
| `campaign_messages` | _(sem COMMENT ON TABLE — significado não documentado)_ | 14 colunas | migration |
| `campaign_recipients` | _(sem COMMENT ON TABLE — significado não documentado)_ | 26 colunas | migration |
| `campaign_replies` | _(sem COMMENT ON TABLE — significado não documentado)_ | 17 colunas | migration |
| `campaigns` | _(sem COMMENT ON TABLE — significado não documentado)_ | 22 colunas | migration |
| `circuit_breaker_alert_history` | _(sem COMMENT ON TABLE — significado não documentado)_ | 7 colunas | migration |
| `circuit_breaker_alert_settings` | _(sem COMMENT ON TABLE — significado não documentado)_ | 7 colunas | migration |
| `circuit_breaker_snapshots` | Telemetria append-only. Índices secundários removidos em 2026-07-21 por 0 uso (idx_scan=0). Recriar quando dashboard de histórico for implementado. | 8 colunas | migration |
| `circuit_breakers` | _(sem COMMENT ON TABLE — significado não documentado)_ | 8 colunas | migration |
| `cnpj_enrich_cache` | _(sem COMMENT ON TABLE — significado não documentado)_ | 7 colunas | migration |
| `cnpj_enrich_queue` | _(sem COMMENT ON TABLE — significado não documentado)_ | 12 colunas | migration |
| `cnpj_enrich_rate_state` | _(sem COMMENT ON TABLE — significado não documentado)_ | 5 colunas | migration |
| `companies` | _(sem COMMENT ON TABLE — significado não documentado)_ | 48 colunas | migration |
| `company_reviews` | _(sem COMMENT ON TABLE — significado não documentado)_ | 12 colunas | migration |
| `db_health_snapshots` | _(sem COMMENT ON TABLE — significado não documentado)_ | 13 colunas | migration |
| `deal_activities` | _(sem COMMENT ON TABLE — significado não documentado)_ | 9 colunas | migration |
| `deal_stages` | _(sem COMMENT ON TABLE — significado não documentado)_ | 10 colunas | migration |
| `deal_tasks` | _(sem COMMENT ON TABLE — significado não documentado)_ | 14 colunas | migration |
| `deals` | _(sem COMMENT ON TABLE — significado não documentado)_ | 19 colunas | migration |
| `dlq_alert_history` | _(sem COMMENT ON TABLE — significado não documentado)_ | 8 colunas | migration |
| `dlq_alert_settings` | _(sem COMMENT ON TABLE — significado não documentado)_ | 8 colunas | migration |
| `dlq_health_snapshots` | _(sem COMMENT ON TABLE — significado não documentado)_ | 8 colunas | migration |
| `email_accounts` | _(sem COMMENT ON TABLE — significado não documentado)_ | 24 colunas | migration |
| `email_suppressions` | _(sem COMMENT ON TABLE — significado não documentado)_ | 9 colunas | migration |
| `email_sync_log` | Histórico de tentativas de polling/sincronização por conta de e-mail | 17 colunas | migration |
| `feature_flags` | _(sem COMMENT ON TABLE — significado não documentado)_ | 10 colunas | migration |
| `health_checks` | _(sem COMMENT ON TABLE — significado não documentado)_ | 6 colunas | migration |
| `idempotency_keys` | _(sem COMMENT ON TABLE — significado não documentado)_ | 7 colunas | migration |
| `instagram_scrape_dead_letter` | _(sem COMMENT ON TABLE — significado não documentado)_ | 12 colunas | migration |
| `instagram_scrape_queue` | _(sem COMMENT ON TABLE — significado não documentado)_ | 20 colunas | migration |
| `instagram_scrape_results` | _(sem COMMENT ON TABLE — significado não documentado)_ | 10 colunas | migration |
| `intent_signals` | _(sem COMMENT ON TABLE — significado não documentado)_ | 11 colunas | migration |
| `ipc_config` | _(sem COMMENT ON TABLE — significado não documentado)_ | 8 colunas | migration |
| `job_exports` | _(sem COMMENT ON TABLE — significado não documentado)_ | 8 colunas | migration |
| `lusha_contacts` | _(sem COMMENT ON TABLE — significado não documentado)_ | 55 colunas | migration |
| `lusha_credit_usage_log` | _(sem COMMENT ON TABLE — significado não documentado)_ | 16 colunas | migration |
| `lusha_dm_search_history` | _(sem COMMENT ON TABLE — significado não documentado)_ | 12 colunas | migration |
| `lusha_search_sessions` | _(sem COMMENT ON TABLE — significado não documentado)_ | 29 colunas | migration |
| `notifications` | _(sem COMMENT ON TABLE — significado não documentado)_ | 9 colunas | migration |
| `oauth_sandbox_snapshots` | _(sem COMMENT ON TABLE — significado não documentado)_ | 15 colunas | migration |
| `oracle_rate_limits` | _(sem COMMENT ON TABLE — significado não documentado)_ | 7 colunas | migration |
| `oracle_v2_health` | _(sem COMMENT ON TABLE — significado não documentado)_ | 7 colunas | types.ts |
| `org_proxies` | _(sem COMMENT ON TABLE — significado não documentado)_ | 10 colunas | migration |
| `org_retry_policies` | _(sem COMMENT ON TABLE — significado não documentado)_ | 5 colunas | migration |
| `org_scrape_rate_limits` | _(sem COMMENT ON TABLE — significado não documentado)_ | 6 colunas | migration |
| `org_violation_alert_settings` | _(sem COMMENT ON TABLE — significado não documentado)_ | 7 colunas | migration |
| `org_violation_alerts` | Histórico de alertas de taxa de OrgMismatchError. Evento webhook: security.org_violation_threshold | 11 colunas | migration |
| `organization_invites` | _(sem COMMENT ON TABLE — significado não documentado)_ | 10 colunas | migration |
| `organization_members` | _(sem COMMENT ON TABLE — significado não documentado)_ | 5 colunas | migration |
| `organizations` | _(sem COMMENT ON TABLE — significado não documentado)_ | 6 colunas | migration |
| `partition_advisories` | _(sem COMMENT ON TABLE — significado não documentado)_ | 13 colunas | migration |
| `partition_policies` | _(sem COMMENT ON TABLE — significado não documentado)_ | 10 colunas | migration |
| `pg_net_health_snapshots` | _(sem COMMENT ON TABLE — significado não documentado)_ | 9 colunas | migration |
| `places_api_usage` | _(sem COMMENT ON TABLE — significado não documentado)_ | 10 colunas | migration |
| `profiles` | _(sem COMMENT ON TABLE — significado não documentado)_ | 8 colunas | migration |
| `qa_reaper_runs` | _(sem COMMENT ON TABLE — significado não documentado)_ | 10 colunas | migration |
| `qa_test_runs` | _(sem COMMENT ON TABLE — significado não documentado)_ | 14 colunas | migration |
| `queue_sla_defaults` | _(sem COMMENT ON TABLE — significado não documentado)_ | 7 colunas | migration |
| `queue_sla_history` | _(sem COMMENT ON TABLE — significado não documentado)_ | 7 colunas | migration |
| `reaper_alert_history` | _(sem COMMENT ON TABLE — significado não documentado)_ | 9 colunas | migration |
| `reaper_alert_settings` | _(sem COMMENT ON TABLE — significado não documentado)_ | 9 colunas | migration |
| `retry_policy_advisories` | _(sem COMMENT ON TABLE — significado não documentado)_ | 20 colunas | migration |
| `robots_cache` | _(sem COMMENT ON TABLE — significado não documentado)_ | 5 colunas | migration |
| `scrape_dead_letter` | _(sem COMMENT ON TABLE — significado não documentado)_ | 12 colunas | migration |
| `scrape_jobs` | _(sem COMMENT ON TABLE — significado não documentado)_ | 18 colunas | migration |
| `scrape_queue` | _(sem COMMENT ON TABLE — significado não documentado)_ | 20 colunas | migration |
| `scrape_results` | _(sem COMMENT ON TABLE — significado não documentado)_ | 8 colunas | migration |
| `scrape_worker_state` | _(sem COMMENT ON TABLE — significado não documentado)_ | 6 colunas | migration |
| `sla_alert_history` | _(sem COMMENT ON TABLE — significado não documentado)_ | 9 colunas | migration |
| `sla_alert_settings` | _(sem COMMENT ON TABLE — significado não documentado)_ | 8 colunas | migration |
| `sla_autotune_runs` | _(sem COMMENT ON TABLE — significado não documentado)_ | 7 colunas | migration |
| `sla_snapshots` | _(sem COMMENT ON TABLE — significado não documentado)_ | 13 colunas | migration |
| `stakeholders` | _(sem COMMENT ON TABLE — significado não documentado)_ | 20 colunas | migration |
| `user_roles` | _(sem COMMENT ON TABLE — significado não documentado)_ | 3 colunas | migration |
| `v_lusha_cache_stats` | _(sem COMMENT ON TABLE — significado não documentado)_ | 12 colunas | types.ts |
| `v_lux_enrichment_health` | _(sem COMMENT ON TABLE — significado não documentado)_ | 22 colunas | types.ts |
| `vault_cookie_alert_history` | _(sem COMMENT ON TABLE — significado não documentado)_ | 6 colunas | migration |
| `vault_cookie_snapshots` | _(sem COMMENT ON TABLE — significado não documentado)_ | 9 colunas | migration |
| `web_scrape_dead_letter` | _(sem COMMENT ON TABLE — significado não documentado)_ | 13 colunas | migration |
| `web_scrape_queue` | _(sem COMMENT ON TABLE — significado não documentado)_ | 23 colunas | migration |
| `web_scrape_results` | _(sem COMMENT ON TABLE — significado não documentado)_ | 20 colunas | migration |
| `webhook_deliveries` | _(sem COMMENT ON TABLE — significado não documentado)_ | 14 colunas | migration |
| `webhooks` | _(sem COMMENT ON TABLE — significado não documentado)_ | 13 colunas | migration |
| `workflow_runs` | _(sem COMMENT ON TABLE — significado não documentado)_ | 11 colunas | migration |
| `workflows` | _(sem COMMENT ON TABLE — significado não documentado)_ | 15 colunas | migration |
| `app_role` (enum) | admin, sdr, viewer |  | banco |
| `audit_action` (enum) | create, update, delete, execute |  | banco |
| `automation_status` (enum) | pending, running, completed, failed, cancelled |  | banco |
| `campaign_status` (enum) | draft, active, paused, completed, archived |  | banco |
| `scrape_job_status` (enum) | pending, running, working, completed, failed, cancelled |  | banco |
| `scrape_queue_status` (enum) | queued, processing, succeeded, dead |  | banco |
| `web_scrape_status` (enum) | queued, processing, succeeded, failed, dead |  | banco |
| `workflow_status` (enum) | draft, active, paused, completed, failed, running, archived |  | banco |
| `StepType` (TS) | email \| wait \| condition \| notify \| webhook \| tag |  | `src/components/automation/WorkflowEditor.tsx` |
| `ScoreRange` (TS) | all \| 90+ \| 75-89 \| 60-74 \| <60 |  | `src/components/lux/company-filters-utils.ts` |
| `DMHistoryStatus` (TS) | done \| failed \| cancelled \| processing \| queued |  | `src/components/lux/lusha/historyUtils.ts` |
| `InviteFilter` (TS) | all \| pending \| accepted \| revoked \| expired |  | `src/components/lux/organizations/InviteSection.tsx` |
| `LatencySeverity` (TS) | critical \| warning \| ok |  | `src/hooks/useApiLatency.ts` |
| `AUTOMATION_TABLES` (TS) | "scrape_jobs", "workflow_runs", "workflows", "automation_steps", |  | `src/hooks/useAuditTrail.ts` |
| `AutomationStage` (TS) | scraping \| enrichment \| localization |  | `src/hooks/useAutomationsMonitor.ts` |
| `StageStatus` (TS) | done \| pending |  | `src/hooks/useAutomationsMonitor.ts` |
| `CircuitBreakerState` (TS) | closed \| open \| half-open |  | `src/hooks/useCircuitBreakers.ts` |
| `CnpjEnrichStatus` (TS) | idle \| loading \| queued \| success \| not_found \| invalid \| error |  | `src/hooks/useCnpjEnrich.ts` |
| `AlertSeverity` (TS) | critical \| warning \| ok |  | `src/hooks/useDbHealth.ts` |
| `DlqQueueKind` (TS) | scrape \| web |  | `src/hooks/useDlqAlertSettings.ts` |
| `DlqHealthSeverity` (TS) | critical \| warning \| ok |  | `src/hooks/useDlqHealth.ts` |
| `DlqMotor` (TS) | instagram \| web |  | `src/hooks/useDlqReplay.ts` |
| `EmailAccountAuditAction` (TS) | connected \| disconnected \| scope_changed \| tokens_refreshed \| reactivated \| deactivated \| error_recorded \| polled \| updated |  | `src/hooks/useEmailAccountAuditLog.ts` |
| `SuppressionReason` (TS) | unsubscribe \| bounce \| complaint \| manual |  | `src/hooks/useEmailSuppressions.ts` |
| `EmailSyncStatus` (TS) | success \| error \| skipped \| refresh_failed |  | `src/hooks/useEmailSyncLog.ts` |
| `MembershipAuditAction` (TS) | added \| removed \| role_changed \| left \| other |  | `src/hooks/useMembershipAuditLog.ts` |
| `View` (TS) | dashboard \| icp \| workflows \| companies \| intent \| campaigns \| ai-agent \| analytics \| settings \| gmaps \| map \| stakeholders \| scrape-results \| organizations \| deals \| integrations \| org-violations \| rls-discovery \| monitoring \| automations \| recycle-bin \| suppressions \| lusha |  | `src/hooks/useNavigationHistory.ts` |
| `NavigationDirection` (TS) | forward \| back |  | `src/hooks/useNavigationHistory.ts` |
| `ReaperAlertReason` (TS) | dead_detected \| no_recent_run |  | `src/hooks/useReaperAlerts.ts` |
| `Skin` (TS) | gold \| blue \| green \| red \| purple \| orange |  | `src/hooks/useSkin.ts` |
| `WEBHOOK_EVENTS` (TS) | "companies.insert", "companies.update", "companies.delete", "deals.insert", "deals.update", "deals.delete", "stakeholders.insert", "stakeholders.update", "stakeholders.delete", "security.org_violation_threshold", "scrape_jobs.completed", "scrape_jobs.failed", "workflows.completed", "workflows.failed … |  | `src/hooks/useWebhooks.ts` |
| `SoftDeleteTable` (TS) | companies \| deals \| campaigns \| workflows |  | `src/integrations/supabase/withOrg.ts` |
| `EmailErrorKind` (TS) | auth \| sync |  | `src/lib/emailErrorMessages.ts` |
| `EmailErrorSeverity` (TS) | warning \| error \| fatal |  | `src/lib/emailErrorMessages.ts` |
| `AppRole` (TS) | admin \| sdr \| viewer |  | `src/lib/permissions.ts` |
| `Action` (TS) | view \| create \| edit \| delete \| manage |  | `src/lib/permissions.ts` |
| `Entity` (TS) | companies \| stakeholders \| deals \| campaigns \| workflows \| scrape_jobs \| integrations \| members \| invites \| audit_logs |  | `src/lib/permissions.ts` |
| `CheckSeverity` (TS) | ok \| warning \| error |  | `src/lib/redirectUriChecklist.ts` |
| `ContactSource` (TS) | lusha \| apollo |  | `src/lib/sourceQualityReport.ts` |
| `SortKey` (TS) | date \| volume |  | `src/lib/dlq/aggregations.ts` |
| `SortDir` (TS) | asc \| desc |  | `src/lib/dlq/aggregations.ts` |
| `Classification` (TS) | improved \| regressed \| stable \| new \| removed |  | `src/lib/resilience/compareReport.ts` |
| `GapSeverity` (TS) | critical \| warning \| info |  | `src/lib/resilience/report.ts` |
| `FaultType` (TS) | timeout \| rate_limit \| server_5xx \| client_4xx \| unavailable |  | `src/lib/resilience/simulator.ts` |
| `FaultKind` (TS) | rate_limit_429 \| timeout \| actor_run_failed \| empty_dataset |  | `supabase/functions/_shared/apify-gateway.ts` |
| `ApifyRunStatus` (TS) | READY \| RUNNING \| SUCCEEDED \| FAILED \| TIMING-OUT \| TIMED-OUT \| ABORTING \| ABORTED |  | `supabase/functions/_shared/apify-gateway.ts` |
| `ApolloRateReason` (TS) | ok \| cooldown \| minute_limit \| daily_limit \| unavailable |  | `supabase/functions/_shared/apollo-cache.ts` |
| `ServicoCookie` (TS) | lusha \| leadcontact \| linkedin |  | `supabase/functions/_shared/cookies.ts` |
| `HikerErrorClass` (TS) | rate_limit \| server \| network \| client \| not_found \| auth \| timeout |  | `supabase/functions/_shared/hiker-client.ts` |
| `InstagramTargetType` (TS) | profile \| posts \| hashtag \| comments |  | `supabase/functions/_shared/instagram-config-hash.ts` |
| `OmkarReviewsSort` (TS) | newest \| most_relevant \| highest_rating \| lowest_rating |  | `supabase/functions/_shared/omkar-gmaps-config.ts` |
| `LogLevel` (TS) | info \| warn \| error |  | `supabase/functions/_shared/oracle-logger.ts` |
| `AppEnv` (TS) | dev \| staging \| prod |  | `supabase/functions/_shared/rlsTableRegistry.ts` |
| `ScrapeJobStatus` (TS) | pending \| running \| completed \| failed \| paused |  | `supabase/functions/_shared/domain/scrape-job-machine.ts` |

## Dados de referência (seed — planos, categorias, perfis fixos)

_nenhum item encontrado_

## Auditoria de consistência (código × schema) — trate como NÃO VERIFICADO

> `status`: inclui estados só de UI/realtime (ex.: `uploading`, `SUBSCRIBED`) que nunca vão ao banco — confira o arquivo antes de concluir que falta valor no enum.

| Tipo | Problema | Onde |
|---|---|---|
| status | valor `start` para `step` usado no código não existe em nenhum enum do banco/TS | `compara:src/components/auth/MFAEnroll.tsx` |
| status | valor `scan` para `step` usado no código não existe em nenhum enum do banco/TS | `compara:src/components/auth/MFAEnroll.tsx` |
| status | valor `verify` para `step` usado no código não existe em nenhum enum do banco/TS | `compara:src/components/auth/MFAEnroll.tsx` |
| status | valor `email_intro` para `step` usado no código não existe em nenhum enum do banco/TS | `escreve:src/lib/demoData.ts` |
| status | valor `follow_up_1` para `step` usado no código não existe em nenhum enum do banco/TS | `escreve:src/lib/demoData.ts` |
| status | valor `linkedin_connect` para `step` usado no código não existe em nenhum enum do banco/TS | `escreve:src/lib/demoData.ts` |
| status | valor `follow_up_2` para `step` usado no código não existe em nenhum enum do banco/TS | `escreve:src/lib/demoData.ts` |
| status | valor `call` para `step` usado no código não existe em nenhum enum do banco/TS | `escreve:src/lib/demoData.ts` |
| status | valor `email_reengagement` para `step` usado no código não existe em nenhum enum do banco/TS | `escreve:src/lib/demoData.ts` |
| status | valor `follow_up` para `step` usado no código não existe em nenhum enum do banco/TS | `escreve:src/lib/demoData.ts` |
| status | valor `number` para `step` usado no código não existe em nenhum enum do banco/TS | `compara:supabase/functions/campaign-dispatch/index.ts` |
| status | valor `enrich_email` para `step` usado no código não existe em nenhum enum do banco/TS | `escreve:supabase/functions/oracle-enrich-contact/index.ts` |
| status | valor `enrich_phone` para `step` usado no código não existe em nenhum enum do banco/TS | `escreve:supabase/functions/oracle-enrich-contact/index.ts` |
| status | valor `cb_check` para `step` usado no código não existe em nenhum enum do banco/TS | `escreve:supabase/functions/oracle-enrich-contact/index.ts`<br>`escreve:supabase/functions/oracle-push-bitrix/index.ts`<br>`escreve:supabase/functions/oracle-search-decisors/index.ts` |
| status | valor `cookie_preflight` para `step` usado no código não existe em nenhum enum do banco/TS | `escreve:supabase/functions/oracle-enrich-contact/index.ts`<br>`escreve:supabase/functions/oracle-search-decisors/index.ts` |
| status | valor `org_check` para `step` usado no código não existe em nenhum enum do banco/TS | `escreve:supabase/functions/oracle-enrich-contact/index.ts`<br>`escreve:supabase/functions/oracle-push-bitrix/index.ts`<br>`escreve:supabase/functions/oracle-search-decisors/index.ts` |
| status | valor `lock_contacts` para `step` usado no código não existe em nenhum enum do banco/TS | `escreve:supabase/functions/oracle-enrich-contact/index.ts` |
| status | valor `batch_done` para `step` usado no código não existe em nenhum enum do banco/TS | `escreve:supabase/functions/oracle-enrich-contact/index.ts`<br>`escreve:supabase/functions/oracle-push-bitrix/index.ts` |
| status | valor `config` para `step` usado no código não existe em nenhum enum do banco/TS | `escreve:supabase/functions/oracle-push-bitrix/index.ts` |
| status | valor `lock` para `step` usado no código não existe em nenhum enum do banco/TS | `escreve:supabase/functions/oracle-push-bitrix/index.ts` |
| status | valor `stage_verificando` para `step` usado no código não existe em nenhum enum do banco/TS | `escreve:supabase/functions/oracle-push-bitrix/index.ts` |
| status | valor `dup_found` para `step` usado no código não existe em nenhum enum do banco/TS | `escreve:supabase/functions/oracle-push-bitrix/index.ts` |
| status | valor `contact_created` para `step` usado no código não existe em nenhum enum do banco/TS | `escreve:supabase/functions/oracle-push-bitrix/index.ts` |
| status | valor `push_failed` para `step` usado no código não existe em nenhum enum do banco/TS | `escreve:supabase/functions/oracle-push-bitrix/index.ts` |
| status | valor `dept_resolve` para `step` usado no código não existe em nenhum enum do banco/TS | `escreve:supabase/functions/oracle-search-decisors/index.ts` |
| status | valor `idempotent_hit` para `step` usado no código não existe em nenhum enum do banco/TS | `escreve:supabase/functions/oracle-search-decisors/index.ts` |
| status | valor `session_create` para `step` usado no código não existe em nenhum enum do banco/TS | `escreve:supabase/functions/oracle-search-decisors/index.ts` |
| status | valor `company_search` para `step` usado no código não existe em nenhum enum do banco/TS | `escreve:supabase/functions/oracle-search-decisors/index.ts` |
| status | valor `dept_search` para `step` usado no código não existe em nenhum enum do banco/TS | `escreve:supabase/functions/oracle-search-decisors/index.ts` |
| status | valor `dept_fallback_apollo` para `step` usado no código não existe em nenhum enum do banco/TS | `escreve:supabase/functions/oracle-search-decisors/index.ts` |
| status | valor `dedup_leads` para `step` usado no código não existe em nenhum enum do banco/TS | `escreve:supabase/functions/oracle-search-decisors/index.ts` |
| status | valor `insert_contacts` para `step` usado no código não existe em nenhum enum do banco/TS | `escreve:supabase/functions/oracle-search-decisors/index.ts` |
| status | valor `search_done` para `step` usado no código não existe em nenhum enum do banco/TS | `escreve:supabase/functions/oracle-search-decisors/index.ts` |
| status | valor `verified` para `status` usado no código não existe em nenhum enum do banco/TS | `compara:src/components/auth/MFAVerify.tsx`<br>`compara:src/components/lux/settings/MFASetup.tsx`<br>`compara:src/hooks/useMFA.ts`<br>`compara:supabase/functions/_shared/leadcontact-client.ts` |
| status | valor `SUBSCRIBED` para `status` usado no código não existe em nenhum enum do banco/TS | `compara:src/components/lux/LushaIntelligenceView.tsx` |
| status | valor `CLOSED` para `status` usado no código não existe em nenhum enum do banco/TS | `compara:src/components/lux/LushaIntelligenceView.tsx` |
| status | valor `unknown` para `status` usado no código não existe em nenhum enum do banco/TS | `compara:src/components/lux/lusha/LushaCookieHealthBanner.tsx`<br>`escreve:supabase/functions/lusha-cookie-health/index.ts` |
| status | valor `expiring_soon` para `status` usado no código não existe em nenhum enum do banco/TS | `compara:src/components/lux/lusha/LushaCookieHealthBanner.tsx` |
| status | valor `enriching` para `status` usado no código não existe em nenhum enum do banco/TS | `compara:src/components/lux/lusha/OracleV2Panel.tsx` |
| status | valor `online` para `status` usado no código não existe em nenhum enum do banco/TS | `compara:src/components/lux/monitoring/MonitoringView.tsx`<br>`escreve:src/components/lux/monitoring/MonitoringView.tsx` |
| status | valor `crit` para `status` usado no código não existe em nenhum enum do banco/TS | `compara:src/components/lux/monitoring/SlaCompliancePanel.tsx` |
| status | valor `enriched` para `status` usado no código não existe em nenhum enum do banco/TS | `compara:supabase/functions/oracle-enrich-contact/index.ts`<br>`escreve:src/hooks/useOracleV2.ts`<br>`escreve:supabase/functions/oracle-enrich-contact/index.ts` |
| status | valor `sent_to_bitrix` para `status` usado no código não existe em nenhum enum do banco/TS | `compara:supabase/functions/oracle-push-bitrix/index.ts`<br>`escreve:src/hooks/useOracleV2.ts`<br>`escreve:supabase/functions/oracle-push-bitrix/index.ts` |
| status | valor `accepting` para `status` usado no código não existe em nenhum enum do banco/TS | `compara:src/pages/AcceptInvite.tsx` |
| status | valor `masked` para `status` usado no código não existe em nenhum enum do banco/TS | `compara:supabase/functions/_shared/lusha-client.ts`<br>`escreve:supabase/functions/_shared/lusha-client.ts` |
| status | valor `error_other` para `status` usado no código não existe em nenhum enum do banco/TS | `compara:supabase/functions/oracle-enrich-contact/index.ts`<br>`escreve:supabase/functions/oracle-enrich-contact/index.ts` |
| status | valor `fulfilled` para `status` usado no código não existe em nenhum enum do banco/TS | `compara:supabase/functions/oracle-enrich-contact/index.ts` |
| status | valor `error_auth` para `status` usado no código não existe em nenhum enum do banco/TS | `compara:supabase/functions/oracle-enrich-contact/index.ts` |
| status | valor `error_rate_limit` para `status` usado no código não existe em nenhum enum do banco/TS | `compara:supabase/functions/oracle-enrich-contact/index.ts` |
| status | valor `error_bitrix` para `status` usado no código não existe em nenhum enum do banco/TS | `compara:supabase/functions/oracle-push-bitrix/index.ts`<br>`escreve:supabase/functions/oracle-push-bitrix/index.ts` |
| status | valor `bitrix_duplicate` para `status` usado no código não existe em nenhum enum do banco/TS | `compara:supabase/functions/oracle-push-bitrix/index.ts`<br>`escreve:supabase/functions/oracle-push-bitrix/index.ts` |
| status | valor `rejected` para `status` usado no código não existe em nenhum enum do banco/TS | `compara:supabase/functions/scrape-queue-worker/index.ts` |
| status | valor `blocked` para `status` usado no código não existe em nenhum enum do banco/TS | `escreve:supabase/functions/webhook-dispatcher/index.ts` |
| status | valor `enriched` para `enrichment_status` usado no código não existe em nenhum enum do banco/TS | `compara:src/components/lux/lusha/OracleV2Panel.tsx`<br>`escreve:src/components/lux/LushaIntelligenceView.tsx`<br>`filtra:supabase/functions/oracle-push-bitrix/index.ts` |
| status | valor `pending_enrichment` para `enrichment_status` usado no código não existe em nenhum enum do banco/TS | `compara:src/components/lux/lusha/OracleV2Panel.tsx`<br>`escreve:supabase/functions/lusha-decision-makers/index.ts`<br>`escreve:supabase/functions/oracle-search-decisors/index.ts` |
| status | valor `enriching` para `enrichment_status` usado no código não existe em nenhum enum do banco/TS | `compara:src/components/lux/lusha/OracleV2Panel.tsx`<br>`escreve:supabase/functions/oracle-enrich-contact/index.ts`<br>`filtra:supabase/functions/oracle-enrich-contact/index.ts` |
| status | valor `sent_to_bitrix` para `enrichment_status` usado no código não existe em nenhum enum do banco/TS | `compara:src/components/lux/lusha/OracleV2Panel.tsx`<br>`escreve:supabase/functions/oracle-push-bitrix/index.ts`<br>`filtra:supabase/functions/oracle-push-bitrix/index.ts` |
| status | valor `bitrix_duplicate` para `enrichment_status` usado no código não existe em nenhum enum do banco/TS | `compara:src/components/lux/lusha/OracleV2Panel.tsx`<br>`escreve:supabase/functions/oracle-push-bitrix/index.ts` |
| status | valor `error_bitrix` para `enrichment_status` usado no código não existe em nenhum enum do banco/TS | `compara:src/components/lux/lusha/OracleV2Panel.tsx`<br>`escreve:supabase/functions/oracle-push-bitrix/index.ts` |
| status | valor `error_other` para `enrichment_status` usado no código não existe em nenhum enum do banco/TS | `escreve:supabase/functions/oracle-enrich-contact/index.ts` |
| status | valor `pushing_bitrix` para `enrichment_status` usado no código não existe em nenhum enum do banco/TS | `escreve:supabase/functions/oracle-push-bitrix/index.ts` |
| status | valor `startActorRun` para `stage` usado no código não existe em nenhum enum do banco/TS | `escreve:supabase/functions/_shared/apify-gateway.ts` |
| status | valor `getDatasetItems` para `stage` usado no código não existe em nenhum enum do banco/TS | `escreve:supabase/functions/_shared/apify-gateway.ts` |
| status | valor `preflight` para `phase` usado no código não existe em nenhum enum do banco/TS | `escreve:supabase/functions/oracle-cookies-preflight/index.ts` |
| status | valor `collapsed` para `state` usado no código não existe em nenhum enum do banco/TS | `compara:src/components/ui/sidebar.tsx` |
| status | valor `expanded` para `state` usado no código não existe em nenhum enum do banco/TS | `escreve:src/components/ui/use-sidebar.ts` |
| status | valor `string` para `state` usado no código não existe em nenhum enum do banco/TS | `compara:supabase/functions/email-oauth-callback/index.ts` |
| status | valor `expiring_soon` para `health_status` usado no código não existe em nenhum enum do banco/TS | `compara:supabase/functions/lusha-cookie-health/index.ts` |
| status | valor `enrich` para `current_step` usado no código não existe em nenhum enum do banco/TS | `escreve:supabase/functions/workflow-engine/index.ts` |
| status | valor `ipc_score` para `current_step` usado no código não existe em nenhum enum do banco/TS | `escreve:supabase/functions/workflow-engine/index.ts` |
| status | valor `save` para `current_step` usado no código não existe em nenhum enum do banco/TS | `escreve:supabase/functions/workflow-engine/index.ts` |
| coluna | coluna `error_reason` usada no código não existe no schema de `instagram_scrape_dead_letter` |  |
| coluna | coluna `triggered_at` usada no código não existe no schema de `api_latency_alert_history` |  |
| coluna | coluna `created_at` usada no código não existe no schema de `health_checks` |  |
| tabela | tabela `a` usada no código não existe nas migrations/types do repo | `scripts/ai-context/cenarios.mjs` |
| tabela | tabela `contacts` usada no código não existe nas migrations/types do repo | `scripts/ai-context/gerar.unit.mjs` |
| tabela | tabela `dashboard_table` usada no código não existe nas migrations/types do repo | `scripts/ai-context/gerar.unit.mjs` |
| tabela | tabela `emails` usada no código não existe nas migrations/types do repo | `scripts/ai-context/gerar.unit.mjs` |
| tabela | tabela `fantasma` usada no código não existe nas migrations/types do repo | `scripts/ai-context/cenarios.mjs` |
| tabela | tabela `fixture_table` usada no código não existe nas migrations/types do repo | `scripts/ai-context/gerar.unit.mjs` |
| tabela | tabela `ghost_table` usada no código não existe nas migrations/types do repo | `scripts/ai-context/gerar.unit.mjs` |
| tabela | tabela `payments` usada no código não existe nas migrations/types do repo | `scripts/ai-context/gerar.unit.mjs` |
| tabela | tabela `runtime_table` usada no código não existe nas migrations/types do repo | `scripts/ai-context/gerar.unit.mjs` |
| tabela | tabela `so_teste` usada no código não existe nas migrations/types do repo | `scripts/ai-context/cenarios.mjs` |
| tabela | tabela `t` usada no código não existe nas migrations/types do repo | `scripts/ai-context/cenarios.mjs` |
| tabela | tabela `t1` usada no código não existe nas migrations/types do repo | `scripts/ai-context/cenarios.mjs` |
| tabela | tabela `tabela` usada no código não existe nas migrations/types do repo | `scripts/inventario/gerar-repo.mjs` |
| tabela | tabela `tools_runtime` usada no código não existe nas migrations/types do repo | `scripts/ai-context/gerar.unit.mjs` |
| tabela | tabela `tx` usada no código não existe nas migrations/types do repo | `scripts/ai-context/cenarios.mjs` |
| rls | `retry_policy_advisories`: front faz UPDATE mas nenhuma política RLS permite UPDATE → vai falhar/retornar vazio para usuários | `src/components/lux/monitoring/RetryPolicyAdvisoriesPanel.tsx` |
| tenant | `health_checks` não tem coluna `organization_id` (isolamento por tenant pode estar incompleto) |  |
| tenant | `circuit_breakers` não tem coluna `organization_id` (isolamento por tenant pode estar incompleto) |  |
| tenant | `auth_rate_limits` não tem coluna `organization_id` (isolamento por tenant pode estar incompleto) |  |
| tenant | `db_health_snapshots` não tem coluna `organization_id` (isolamento por tenant pode estar incompleto) |  |
| tenant | `partition_policies` não tem coluna `organization_id` (isolamento por tenant pode estar incompleto) |  |
| tenant | `partition_advisories` não tem coluna `organization_id` (isolamento por tenant pode estar incompleto) |  |
| tenant | `circuit_breaker_snapshots` não tem coluna `organization_id` (isolamento por tenant pode estar incompleto) |  |
| tenant | `circuit_breaker_alert_history` não tem coluna `organization_id` (isolamento por tenant pode estar incompleto) |  |
| tenant | `vault_cookie_snapshots` não tem coluna `organization_id` (isolamento por tenant pode estar incompleto) |  |
| tenant | `vault_cookie_alert_history` não tem coluna `organization_id` (isolamento por tenant pode estar incompleto) |  |
| tenant | `scrape_worker_state` não tem coluna `organization_id` (isolamento por tenant pode estar incompleto) |  |
| tenant | `robots_cache` não tem coluna `organization_id` (isolamento por tenant pode estar incompleto) |  |
| tenant | `pg_net_health_snapshots` não tem coluna `organization_id` (isolamento por tenant pode estar incompleto) |  |
| tenant | `qa_test_runs` não tem coluna `organization_id` (isolamento por tenant pode estar incompleto) |  |
| tenant | `qa_reaper_runs` não tem coluna `organization_id` (isolamento por tenant pode estar incompleto) |  |
| tenant | `reaper_alert_history` não tem coluna `organization_id` (isolamento por tenant pode estar incompleto) |  |
| tenant | `sla_alert_history` não tem coluna `organization_id` (isolamento por tenant pode estar incompleto) |  |
| tenant | `sla_snapshots` não tem coluna `organization_id` (isolamento por tenant pode estar incompleto) |  |
| tenant | `cnpj_enrich_cache` não tem coluna `organization_id` (isolamento por tenant pode estar incompleto) |  |
| tenant | `cnpj_enrich_rate_state` não tem coluna `organization_id` (isolamento por tenant pode estar incompleto) |  |
| tenant | `cnpj_enrich_queue` não tem coluna `organization_id` (isolamento por tenant pode estar incompleto) |  |
| tenant | `queue_sla_defaults` não tem coluna `organization_id` (isolamento por tenant pode estar incompleto) |  |
| tenant | `queue_sla_history` não tem coluna `organization_id` (isolamento por tenant pode estar incompleto) |  |
| tenant | `sla_autotune_runs` não tem coluna `organization_id` (isolamento por tenant pode estar incompleto) |  |
| tenant | `apollo_search_cache` não tem coluna `organization_id` (isolamento por tenant pode estar incompleto) |  |
| tenant | `apollo_rate_state` não tem coluna `organization_id` (isolamento por tenant pode estar incompleto) |  |
| edge | edge function `dashboard-edge` invocada mas não existe em supabase/functions/ | `scripts/ai-context/gerar.unit.mjs` |
| edge | edge function `fixture-edge` invocada mas não existe em supabase/functions/ | `scripts/ai-context/gerar.unit.mjs` |
| edge | edge function `ghost-edge` invocada mas não existe em supabase/functions/ | `scripts/ai-context/gerar.unit.mjs` |
| edge | edge function `inexistente` invocada mas não existe em supabase/functions/ | `scripts/ai-context/cenarios.mjs` |
| edge | edge function `orphan-fn` invocada mas não existe em supabase/functions/ | `scripts/ai-context/gerar.unit.mjs` |
| edge | edge function `other` invocada mas não existe em supabase/functions/ | `scripts/ai-context/cenarios.mjs` |
| edge | edge function `runtime-fn` invocada mas não existe em supabase/functions/ | `scripts/ai-context/gerar.unit.mjs` |
| edge | edge function `runtime-missing` invocada mas não existe em supabase/functions/ | `scripts/ai-context/gerar.unit.mjs` |
| edge | edge function `send-email` invocada mas não existe em supabase/functions/ | `scripts/ai-context/gerar.unit.mjs` |
| edge | edge function `tools-edge` invocada mas não existe em supabase/functions/ | `scripts/ai-context/gerar.unit.mjs` |
| rpc | RPC `dashboard_rpc` chamada mas não definida nas migrations/types | `scripts/ai-context/gerar.unit.mjs` |
| rpc | RPC `demo` chamada mas não definida nas migrations/types | `scripts/supabase_snapshot/test_snapshot.py` |
| rpc | RPC `fixture_rpc` chamada mas não definida nas migrations/types | `scripts/ai-context/gerar.unit.mjs` |
| rpc | RPC `fn` chamada mas não definida nas migrations/types | `scripts/supabase_snapshot/snapshot.py` |
| rpc | RPC `ghost_rpc` chamada mas não definida nas migrations/types | `scripts/ai-context/gerar.unit.mjs` |
| rpc | RPC `is_admin` chamada mas não definida nas migrations/types | `scripts/ai-context/gerar.unit.mjs` |
| rpc | RPC `nome` chamada mas não definida nas migrations/types | `scripts/supabase_snapshot/snapshot.py` |
| rpc | RPC `r1` chamada mas não definida nas migrations/types | `scripts/ai-context/cenarios.mjs` |
| rpc | RPC `runtime_rpc` chamada mas não definida nas migrations/types | `scripts/ai-context/gerar.unit.mjs` |
| rpc | RPC `tools_rpc` chamada mas não definida nas migrations/types | `scripts/ai-context/gerar.unit.mjs` |
| dinâmico | 2 chamada(s) `.from(variável)` — tabela só conhecida em runtime | `e2e/rls-guarantees.spec.ts` |
| dinâmico | 2 chamada(s) `.from(variável)` — tabela só conhecida em runtime | `scripts/regras_negocio/generate.py` |
| dinâmico | 2 chamada(s) `.from(variável)` — tabela só conhecida em runtime | `src/components/lux/monitoring/AutomationStatusPanel.tsx` |
| dinâmico | 4 chamada(s) `.from(variável)` — tabela só conhecida em runtime | `src/integrations/supabase/withOrg.ts` |
| dinâmico | 1 chamada(s) `.from(variável)` — tabela só conhecida em runtime | `src/integrations/supabase/__tests__/withOrg.batch.test.ts` |
| dinâmico | 1 chamada(s) `.from(variável)` — tabela só conhecida em runtime | `src/integrations/supabase/__tests__/withOrg.bulkDelete.test.ts` |
| dinâmico | 5 chamada(s) `.from(variável)` — tabela só conhecida em runtime | `supabase/functions/public-api/index.ts` |
| dinâmico | 5 chamada(s) `.from(variável)` — tabela só conhecida em runtime | `supabase/functions/rls-tests/index.ts` |
| segurança | função `prune_auth_rate_limits` é SECURITY DEFINER sem `set search_path` (risco de escalação) | `supabase/migrations/20260513164237_24ec468e-ca67-40db-a840-89690b09ca42.sql` |

## Lacunas — o que este contexto NÃO consegue responder (perguntas para o dono do negócio)

- Nenhuma regra manual em `manual/`: prazos, limites, exceções comerciais, quem aprova o quê — só o negócio sabe.
- `companies.business_status` é uma coluna de status sem enum/CHECK — os valores válidos e as transições permitidas não estão no banco.
- `scrape_jobs.status` é uma coluna de status sem enum/CHECK — os valores válidos e as transições permitidas não estão no banco.
- `workflows.status` é uma coluna de status sem enum/CHECK — os valores válidos e as transições permitidas não estão no banco.
- `workflow_runs.current_step` é uma coluna de status sem enum/CHECK — os valores válidos e as transições permitidas não estão no banco.
- `campaigns.status` é uma coluna de status sem enum/CHECK — os valores válidos e as transições permitidas não estão no banco.
- `campaign_recipients.current_step` é uma coluna de status sem enum/CHECK — os valores válidos e as transições permitidas não estão no banco.
- `campaign_recipients.last_step_error` é uma coluna de status sem enum/CHECK — os valores válidos e as transições permitidas não estão no banco.
- `campaign_messages.step_index` é uma coluna de status sem enum/CHECK — os valores válidos e as transições permitidas não estão no banco.
- `automation_execution_logs.step_name` é uma coluna de status sem enum/CHECK — os valores válidos e as transições permitidas não estão no banco.
- `automation_execution_logs.step_index` é uma coluna de status sem enum/CHECK — os valores válidos e as transições permitidas não estão no banco.
- `automation_execution_logs.http_status` é uma coluna de status sem enum/CHECK — os valores válidos e as transições permitidas não estão no banco.
- `lusha_contacts.enrichment_status` é uma coluna de status sem enum/CHECK — os valores válidos e as transições permitidas não estão no banco.
- `lusha_search_sessions.status` é uma coluna de status sem enum/CHECK — os valores válidos e as transições permitidas não estão no banco.
- `circuit_breaker_alert_history.state` é uma coluna de status sem enum/CHECK — os valores válidos e as transições permitidas não estão no banco.
- `vault_cookie_snapshots.health_status` é uma coluna de status sem enum/CHECK — os valores válidos e as transições permitidas não estão no banco.
- `web_scrape_results.http_status` é uma coluna de status sem enum/CHECK — os valores válidos e as transições permitidas não estão no banco.
- `robots_cache.http_status` é uma coluna de status sem enum/CHECK — os valores válidos e as transições permitidas não estão no banco.
- `v_lux_enrichment_health.cnt_other_status` é uma coluna de status sem enum/CHECK — os valores válidos e as transições permitidas não estão no banco.
- 95/98 tabelas sem `COMMENT ON TABLE` — o significado de negócio não está no schema: `companies`, `scrape_jobs`, `scrape_results`, `ipc_config`, `workflows`, `workflow_runs`, `stakeholders`, `profiles`, `notifications`, `intent_signals`, `campaigns`, `agent_chat_messages` …
- Há tabelas usadas no código sem migration no repo — o schema real pode ter sido alterado pelo painel.

## Regras manuais presentes

_nenhuma — copie `manual/TEMPLATE-regras-de-negocio.md`_
