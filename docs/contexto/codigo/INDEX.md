# Contexto do projeto para agentes de IA

GERADO AUTOMATICAMENTE por scripts/ai-context/gerar.mjs — não editar à mão; será sobrescrito.
Publicado em `docs/contexto/codigo/` na branch `contexto` (gerada, nunca abra PR dela) a cada push em `main` e a cada 10 minutos pelo workflow `contexto.yml`; índice único das três fontes em `docs/contexto/00-INDEX.md`. Gere local com `node scripts/ai-context/gerar.mjs`. Commit-base: `9c59a910d5297542620536c87c23cf6851045276` (2026-11-26T12:50:45-03:00).

## Como usar (leia antes de planejar ou executar qualquer tarefa)
1. **Tela/rota/menu** → `rotas.json` (url/vista/menu → arquivo → hooks → tabelas → edges; `rotas_http_backend` para APIs) e `modulos.json` (módulo inteiro + dependências entre módulos).
2. **Hook/serviço/lógica** → `hooks.json`, `logica.json` (quem usa, o que toca, se tem teste).
3. **Edge function / serverless** → `edge-functions.json` (verify_jwt, tabelas, env, quem chama, órfãs).
4. **Banco** → `banco.json` (colunas, RLS, policies, índices, FKs, triggers, cron jobs, buckets, drift migration×types, uso no código) — visão do código; para o banco vivo use o MCP.
5. **Antes de criar arquivo** → `convencoes.json` (onde ficam as coisas, nomenclatura, alias), `componentes.json` (nomes duplicados, órfãos), `grafo.json` (hubs, ciclos de import) e `grafo-graphify.json` (grafo por AST: comunidades, símbolos mais chamados, comunidade de cada arquivo).
6. **CI/scripts/deploy/env/integrações/permissões/flags** → `ferramentas.json` e `scripts.json`.
7. **Antes de abrir PR** → `testes.json` (o que tem e não tem teste, onde os testes ficam), `baseline.json` (alertas, TODOs, hotspots, últimos commits).
Os JSONs são grandes: filtre com `grep`/`jq` pelo caminho/arquivo/tabela da sua tarefa; não carregue tudo.

## Stack
- linguagens: TypeScript (727), SQL (279), Markdown (87), JSON (38), JavaScript (25), Shell (20), YAML (13), Python (5)
- linguagem_principal: TypeScript
- framework: React
- backend_http: n/d
- bundler: Vite
- roteador: react-router
- banco: Supabase
- testes: vitest, playwright
- ui: tailwind, radix/shadcn
- estado: react-query
- gerenciador_pacotes: bun
- node: n/d
- python: n/d
- deploy: vercel
- monorepo: n/d
- pastas_fonte: src

## Números
| item | qtd |
|---|---|
| arquivos_total | 1214 |
| arquivos_codigo | 756 |
| linhas_codigo | 131359 |
| rotas | 12 |
| rotas_http_backend | 0 |
| vistas_por_id | 23 |
| itens_menu | 28 |
| modulos | 23 |
| componentes | 269 |
| hooks | 97 |
| edge_functions | 63 |
| tabelas | 121 |
| migrations | 275 |
| cron_jobs | 44 |
| testes | 167 |
| workflows | 11 |
| scripts | 58 |
| docs_md | 87 |

## Onde ficam as coisas
- telas: src/components (23), src/pages (11)
- componentes: src/components (252), src/pages (11), src/contexts (3)
- hooks: src/hooks (90), src/components (4), src/contexts (3)
- servicos_logica: src/lib (41), src/integrations (4), src/contexts (3)
- testes: co-localizado (__tests__) (120), e2e/ (19), co-localizado (*.test) (16)
- edge_functions: supabase/functions
- migrations: supabase/migrations
- scripts: scripts/maintenance (4), scripts/ci (3), scripts/regras_negocio (3)
- docs: docs (21), (raiz) (5)
- nomenclatura: {"componentes":"PascalCase (82%)","hooks":"use + PascalCase","servicos":"camelCase (82%)","edge_functions":"kebab-case (95%)","tabelas":"snake_case (91%)"}
- instruções para agentes no repo: AGENTS.md, CLAUDE.md

## Módulos (menu → domínio)
| módulo | itens de menu | telas/rotas | arquivos | hooks locais | edges | tabelas |
|---|---|---|---|---|---|---|
| components/lux | 26 | 23 | 222 | 153 | 34 | 94 |
| components/ui | 0 | 0 | 54 | 4 | 0 | 0 |
| contexts | 0 | 0 | 6 | 10 | 0 | 4 |
| hooks | 0 | 0 | 91 | 157 | 29 | 84 |
| lib | 0 | 0 | 19 | 103 | 28 | 66 |
| lib/mcp | 0 | 0 | 7 | 0 | 0 | 3 |
| lib/resilience | 0 | 0 | 5 | 0 | 0 | 0 |
| pages | 2 | 11 | 11 | 162 | 36 | 95 |

## Rotas (url → arquivo)
- `/` [tela] → src/pages/Index.tsx (protegida)
- `/.lovable/oauth/consent` [tela] → src/pages/OAuthConsent.tsx (protegida)
- `/*` [tela] → src/pages/NotFound.tsx
- `/admin/companies` [tela] → src/pages/AdminCompanies.tsx (protegida)
- `/invite/:token` [tela] → src/pages/AcceptInvite.tsx
- `/login` [tela] → src/pages/Login.tsx
- `/lusha` [redirect] → **ARQUIVO NÃO RESOLVIDO**
- `/monitoring` [tela] → src/pages/Monitoring.tsx (protegida)
- `/reset-password` [tela] → src/pages/ResetPassword.tsx
- `/settings/cnpj` [tela] → src/pages/CnpjSettingsPage.tsx (protegida)
- `/status` [tela] → src/pages/StatusPage.tsx
- `/survey/:token` [tela] → src/pages/SurveyResponse.tsx

## Rotas HTTP de backend
- (nenhum)

## Vistas por id (menu/ViewRouter → arquivo)
- `ai-agent` → src/components/lux/AIAgentView.tsx
- `analytics` → src/components/lux/AnalyticsView.tsx
- `automations` → src/components/lux/automations/AutomationsRealtimeView.tsx
- `campaigns` → src/components/lux/CampaignsView.tsx
- `companies` → src/components/lux/CompaniesView.tsx
- `dashboard` → src/components/lux/DashboardView.tsx
- `deals` → src/components/lux/DealsView.tsx
- `gmaps` → src/components/lux/GmapsScraperView.tsx
- `icp` → src/components/lux/ICPConfigView.tsx
- `integrations` → src/components/lux/IntegrationsView.tsx
- `intent` → src/components/lux/IntentSignalsView.tsx
- `lusha` → src/components/lux/LushaIntelligenceView.tsx
- `map` → src/components/lux/CompaniesMapView.tsx
- `monitoring` → src/components/lux/monitoring/MonitoringView.tsx
- `org-violations` → src/components/lux/OrgViolationsView.tsx
- `organizations` → src/components/lux/OrganizationsView.tsx
- `recycle-bin` → src/components/lux/RecycleBinView.tsx
- `rls-discovery` → src/components/lux/settings/RLSDiscoveryView.tsx
- `scrape-results` → src/components/lux/ScrapeResultsView.tsx
- `settings` → src/components/lux/SettingsView.tsx
- `stakeholders` → src/components/lux/StakeholderFinderView.tsx
- `suppressions` → src/components/lux/EmailSuppressionsView.tsx
- `workflows` → src/components/lux/WorkflowsView.tsx

## Edge functions
- `admin-list-companies` (verify_jwt=false) — tabelas: companies, organization_members; chamada por 0 arquivo(s) do front
- `ai-agent` — tabelas: companies, ipc_config, scrape_jobs, workflows; chamada por 1 arquivo(s) do front
- `auth-rate-limit` — tabelas: auth_rate_limits; chamada por 1 arquivo(s) do front
- `campaign-dispatch` (verify_jwt=false) — tabelas: campaign_messages, campaign_recipients, campaigns, email_accounts, email_suppressions; chamada por 1 arquivo(s) do front, por SQL/cron
- `circuit-breaker-alerts` (verify_jwt=false) — tabelas: -; chamada por 0 arquivo(s) do front, por SQL/cron
- `cnpj-enrich` — tabelas: cnpj_enrich_cache, cnpj_enrich_queue; chamada por 1 arquivo(s) do front, por SQL/cron
- `cnpj-enrich-worker` — tabelas: cnpj_enrich_cache, cnpj_enrich_queue; chamada por 0 arquivo(s) do front, por SQL/cron
- `cnpj-settings-status` — tabelas: cnpj_enrich_cache, cnpj_enrich_queue, cnpj_enrich_rate_state; chamada por 1 arquivo(s) do front
- `conversation-intel` — tabelas: deal_activities, deals, organization_members; chamada por 1 arquivo(s) do front
- `deliverability-check` — tabelas: -; chamada por 1 arquivo(s) do front
- `dlq-alerts` (verify_jwt=false) — tabelas: dlq_alert_history, dlq_alert_settings, dlq_health_snapshots, notifications, organization_members; chamada por 0 arquivo(s) do front, por SQL/cron
- `email-oauth-callback` (verify_jwt=false) — tabelas: email_accounts; chamada por 1 arquivo(s) do front
- `email-oauth-connect` — tabelas: -; chamada por 2 arquivo(s) do front
- `email-oauth-disconnect` — tabelas: audit_logs, email_accounts; chamada por 1 arquivo(s) do front
- `email-poll-replies` (verify_jwt=false) — tabelas: email_accounts, email_sync_log; chamada por 1 arquivo(s) do front, por SQL/cron
- `email-verify` — tabelas: -; chamada por 1 arquivo(s) do front
- `export-scrape-job` — tabelas: job_exports, scrape_jobs, scrape_results; chamada por 1 arquivo(s) do front
- `gmaps-places-search` — tabelas: -; chamada por 0 arquivo(s) do front — **ÓRFÃ**
- `gmaps-proxy` (verify_jwt=false) — tabelas: idempotency_keys, notifications, org_proxies, scrape_jobs, scrape_results; chamada por 1 arquivo(s) do front, por SQL/cron
- `health` — tabelas: health_checks, organizations; chamada por 0 arquivo(s) do front — **ÓRFÃ**
- `hubspot-sync` (verify_jwt=false) — tabelas: companies, org_integrations, organization_members; chamada por 2 arquivo(s) do front
- `instagram-connection-status` — tabelas: -; chamada por 1 arquivo(s) do front
- `instagram-dlq-replay` — tabelas: organization_members; chamada por 0 arquivo(s) do front — **ÓRFÃ**
- `instagram-enqueue` — tabelas: instagram_scrape_queue, organization_members; chamada por 1 arquivo(s) do front
- `instagram-worker` — tabelas: instagram_scrape_dead_letter, instagram_scrape_queue, instagram_scrape_results; chamada por 0 arquivo(s) do front, por SQL/cron
- `instagram-worker-health` — tabelas: instagram_scrape_dead_letter, instagram_scrape_queue; chamada por 1 arquivo(s) do front
- `lead-score-ai` — tabelas: deals, intent_signals, lead_scores, organization_members, stakeholders; chamada por 1 arquivo(s) do front
- `lusha-cookie-health` — tabelas: -; chamada por 1 arquivo(s) do front
- `lusha-decision-makers` — tabelas: lusha_contacts, organization_members; chamada por 1 arquivo(s) do front
- `lusha-reveal` — tabelas: -; chamada por 0 arquivo(s) do front — **ÓRFÃ**
- `lusha-search` — tabelas: audit_logs, lusha_contacts, lusha_search_sessions, notifications; chamada por 2 arquivo(s) do front
- `mcp` (verify_jwt=false) — tabelas: companies, lusha_contacts, scrape_jobs; chamada por 0 arquivo(s) do front
- `mcp-query` (verify_jwt=false) — tabelas: -; chamada por 0 arquivo(s) do front
- `oracle-cookies-preflight` — tabelas: automation_execution_logs; chamada por 1 arquivo(s) do front
- `oracle-enrich-contact` — tabelas: lusha_contacts; chamada por 1 arquivo(s) do front
- `oracle-push-bitrix` — tabelas: lusha_contacts, lusha_search_sessions; chamada por 1 arquivo(s) do front
- `oracle-search-decisors` — tabelas: companies, lusha_contacts, lusha_search_sessions; chamada por 1 arquivo(s) do front
- `org-violation-alerts` — tabelas: notifications, org_violation_alerts, organization_members, webhook_deliveries, webhooks; chamada por 1 arquivo(s) do front, por SQL/cron
- `pg-net-watchdog` (verify_jwt=false) — tabelas: notifications, pg_net_health_snapshots, user_roles; chamada por 0 arquivo(s) do front, por SQL/cron
- `prune-job-exports` (verify_jwt=false) — tabelas: job_exports; chamada por 0 arquivo(s) do front, por SQL/cron
- `public-api` (verify_jwt=false) — tabelas: api_keys, api_request_logs; chamada por 1 arquivo(s) do front, por SQL/cron
- `purge-soft-deleted` (verify_jwt=false) — tabelas: -; chamada por 0 arquivo(s) do front, por SQL/cron
- `qa-ingest-run` (verify_jwt=false) — tabelas: qa_ingest_tokens, qa_test_runs, user_roles; chamada por 1 arquivo(s) do front
- `reaper-alerts` (verify_jwt=false) — tabelas: notifications, qa_reaper_runs, reaper_alert_history, reaper_alert_settings, user_roles; chamada por 0 arquivo(s) do front, por SQL/cron
- `retry-policy-tuner` (verify_jwt=false) — tabelas: automation_execution_logs, retry_policy_advisories, web_scrape_queue; chamada por 0 arquivo(s) do front, por SQL/cron
- `rls-tests` — tabelas: audit_logs, companies, organization_members, organizations, profiles, workflows; chamada por 1 arquivo(s) do front
- `scim` (verify_jwt=false) — tabelas: organization_members; chamada por 1 arquivo(s) do front
- `scrape-queue-worker` (verify_jwt=false) — tabelas: feature_flags, scrape_jobs; chamada por 0 arquivo(s) do front, por SQL/cron
- `send-scheduled-reports` (verify_jwt=false) — tabelas: campaign_events, companies, deals, email_accounts, scheduled_report_runs, scheduled_reports; chamada por 0 arquivo(s) do front, por SQL/cron
- `sla-alerts` (verify_jwt=false) — tabelas: notifications, sla_alert_history, sla_alert_settings, user_roles; chamada por 0 arquivo(s) do front, por SQL/cron
- `sla-auto-tune` (verify_jwt=false) — tabelas: notifications, organization_members, sla_autotune_runs, user_roles; chamada por 0 arquivo(s) do front, por SQL/cron
- `system-recovery-status` — tabelas: -; chamada por 1 arquivo(s) do front
- `technographics-detect` — tabelas: companies, intent_signals, organization_members; chamada por 1 arquivo(s) do front
- `track-click` (verify_jwt=false) — tabelas: -; chamada por 0 arquivo(s) do front
- `track-open` (verify_jwt=false) — tabelas: -; chamada por 0 arquivo(s) do front
- `vault-cookie-health` (verify_jwt=false) — tabelas: -; chamada por 1 arquivo(s) do front, por SQL/cron
- `web-dlq-replay` — tabelas: organization_members; chamada por 0 arquivo(s) do front — **ÓRFÃ**
- `web-scrape-enqueue` — tabelas: organization_members, web_scrape_queue; chamada por 0 arquivo(s) do front — **ÓRFÃ**
- `web-scrape-extract` — tabelas: feature_flags, web_scrape_queue, web_scrape_results; chamada por 0 arquivo(s) do front — **ÓRFÃ**
- `web-scrape-status` — tabelas: web_scrape_queue, web_scrape_results; chamada por 0 arquivo(s) do front — **ÓRFÃ**
- `web-scrape-worker` (verify_jwt=false) — tabelas: automation_execution_logs, feature_flags, robots_cache, web_scrape_results; chamada por 0 arquivo(s) do front, por SQL/cron
- `webhook-dispatcher` — tabelas: webhook_deliveries, webhooks; chamada por 1 arquivo(s) do front
- `workflow-engine` — tabelas: audit_logs, automation_alerts, automation_steps, companies, ipc_config, organization_members, scrape_jobs, scrape_results, workflow_runs, workflows; chamada por 1 arquivo(s) do front

## Cron jobs (pg_cron / vercel)
- `campaign-dispatch-10min` */10 * * * * → edge campaign-dispatch (20261121190000_version_crons_with_vault_key.sql)
- `campaign-dispatch-every-10min` */10 * * * * → edge campaign-dispatch (20261121190000_version_crons_with_vault_key.sql)
- `capture-api-latency-15min` */15 * * * * (20261124010000_cron_snapshot_org_guard.sql)
- `capture-db-health` */5 * * * * (20260712183806_e5a47f1b-5acb-4925-8862-6b201a553e15.sql)
- `capture-dlq-health-hourly` 0 * * * * (20261124010000_cron_snapshot_org_guard.sql)
- `circuit-breaker-alerts-every-5min` */5 * * * * → edge circuit-breaker-alerts (20261121190000_version_crons_with_vault_key.sql)
- `cnpj-enrich-worker-every-2min` */2 * * * * → edge cnpj-enrich-worker (20261121190000_version_crons_with_vault_key.sql)
- `cron-http-archive-10min` */10 * * * * (20261125123000_cron_http_archive_7dias.sql)
- `daily-campaign-logs-retention` 30 3 * * * (20260721225949_e0ca6ffa-efa2-4bd0-a116-c6425eb821cd.sql)
- `daily-log-retention` 15 3 * * * (20260721225851_96d1133c-350c-4bd1-be9c-96de97456af1.sql)
- `dlq-alerts-15min` */15 * * * * → edge dlq-alerts (20261121190000_version_crons_with_vault_key.sql)
- `email-poll-replies-5min` */5 * * * * → edge email-poll-replies (20261121190000_version_crons_with_vault_key.sql)
- `evaluate-api-latency-15min` 5,20,35,50 * * * * (20261124125500_cron_evaluate_api_latency_15min.sql)
- `evaluate-partition-policies-daily` 17 3 * * * (20260712184705_499e82f4-33c4-443a-82b6-21735caafc4b.sql)
- `instagram-worker-1min` * * * * * → edge instagram-worker (20261122280000_cron_instagram_worker.sql)
- `job-exports-retencao-diaria` 20 4 * * * → edge prune-job-exports (20261126180000_job_exports_retencao.sql)
- `latency-alerts-15min` */15 * * * * → edge latency-alerts (20261121190000_version_crons_with_vault_key.sql)
- `org-violation-alerts-5min` 4-59/5 * * * * → edge org-violation-alerts (20261122130000_cron_org_violation_alerts.sql)
- `pg-net-snapshots-prune-weekly` 0 3 * * 0 (20260722123959_e7c39e43-b1a2-4861-a445-6343f477981a.sql)
- `pg-net-watchdog-30m` */30 * * * * → edge pg-net-watchdog (20261121190000_version_crons_with_vault_key.sql)
- `process-scrape-queue` * * * * * → edge scrape-queue-worker (20261121190000_version_crons_with_vault_key.sql)
- `prune-api-latency-snapshots-daily` 29 3 * * * (20261124010000_cron_snapshot_org_guard.sql)
- `prune-cron-job-run-details-daily` 41 3 * * * (20261121210000_retencao_cron_runs_e_qa_reaper.sql)
- `prune-dlq-health-snapshots-daily` 23 3 * * * (20261124010000_cron_snapshot_org_guard.sql)
- `prune-qa-reaper-runs-daily` 47 3 * * * (20261121210000_retencao_cron_runs_e_qa_reaper.sql)
- `prune-scheduled-report-runs-monthly` 53 3 1 * * → edge send-scheduled-reports (20261121230000_scheduled_reports_bulk_imports_role_permissions.sql)
- `public-api-smoke-15min` 2,17,32,47 * * * * → edge public-api (20261124190000_public_api_smoke_cron.sql)
- `public-api-warmup-15min` 1,16,31,46 * * * * → edge public-api (20261124210000_public_api_warmup_cron.sql)
- `purge-dead-letter-daily` 17 3 * * * (20261124010000_cron_snapshot_org_guard.sql)
- `purge-soft-deleted-daily` 0 3 * * * → edge purge-soft-deleted (20261121190000_version_crons_with_vault_key.sql)
- `reap-stuck-queue-tasks` * * * * * (20260723134028_4f3b5c29-1e04-4d63-95d1-2bb0f069e917.sql)
- `reaper-alerts-30min` */30 * * * * → edge reaper-alerts (20261121190000_version_crons_with_vault_key.sql)
- `refresh-scores-daily` 23 5 * * * (20261121193000_lead_scores_dashboard_layouts_deal_predictions_changelog.sql)
- `retry-policy-tuner-daily` 0 3 * * * → edge retry-policy-tuner (20261121190000_version_crons_with_vault_key.sql)
- `round18-capture-dlq-snapshots-10m` */10 * * * * (20261124010000_cron_snapshot_org_guard.sql)
- `round18-dlq-alerts-15m` */15 * * * * → edge dlq-alerts (20261121190000_version_crons_with_vault_key.sql)
- `round19-web-scrape-regression-1h` 7 * * * * (20261124010000_cron_snapshot_org_guard.sql)
- `send-scheduled-reports-hourly` 7 * * * * → edge send-scheduled-reports (20261121230000_scheduled_reports_bulk_imports_role_permissions.sql)
- `sla-alerts-hourly` 7 * * * * → edge sla-alerts (20261121190000_version_crons_with_vault_key.sql)
- `sla-auto-tune-daily` 20 4 * * * → edge sla-auto-tune (20261121190000_version_crons_with_vault_key.sql)
- `sla-snapshot-daily` 0 3 * * * (20261124010000_cron_snapshot_org_guard.sql)
- `sync-gmaps-jobs` * * * * * → edge gmaps-proxy (20261121190000_version_crons_with_vault_key.sql)
- `vault-cookie-health-daily` 0 9 * * * → edge vault-cookie-health (20261121190000_version_crons_with_vault_key.sql)
- `web-scrape-worker-30s` 30 seconds → edge web-scrape-worker (20261121190000_version_crons_with_vault_key.sql)

## Integrações externas
- SDKs: Supabase, react-query, zod
- hosts mais citados: promo-lux-v2.vercel.app, linkedin.com, ai.gateway.lovable.dev, graph.microsoft.com, login.microsoftonline.com, oauth2.googleapis.com, supabase.atomicabr.com.br, br.linkedin.com, gmaps.atomicabr.com.br, www.linkedin.com, connector-gateway.lovable.dev, empresa.com, gmail.googleapis.com, nominatim.openstreetmap.org, api.cnpja.com
- webhooks recebidos: admin-list-companies, campaign-dispatch, circuit-breaker-alerts, dlq-alerts, email-oauth-callback, email-poll-replies, gmaps-proxy, hubspot-sync, mcp, mcp-query, pg-net-watchdog, prune-job-exports, public-api, purge-soft-deleted, qa-ingest-run, reaper-alerts, retry-policy-tuner, scim, scrape-queue-worker, send-scheduled-reports, sla-alerts, sla-auto-tune, track-click, track-open, vault-cookie-health, web-scrape-worker
- env de integração (só nomes): APIFY_API_KEY, APIFY_TOKEN, APOLLO_API_KEY, BITRIX_WEBHOOK_BASE, BRIGHTDATA_API_TOKEN, CNPJA_API_KEY, GMAPS_OMKAR_API_KEY, GOOGLE_MAPS_API_KEY, GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET, HIKER_API_KEY, LOVABLE_API_KEY, LUSHA_API_KEY, MCP_SECRET, MS_OAUTH_CLIENT_ID, MS_OAUTH_CLIENT_SECRET, QA_INGEST_TOKEN, TRACKING_SIGNING_SECRET

## Permissões / papéis
- papéis no código: admin (15), alert (12), status (11), user (6), button (4), dialog (4), system (4), group (3), main (3), viewer (3), CEO (2), CTO (2), navigation (2), presentation (2), region (2), CFO (1), agent (1), img (1), link (1), listitem (1), member (1), menu (1), owner (1), progressbar (1), sdr (1), separator (1)
- enums de papel: app_role: admin|sdr|viewer
- guards: nenhum · rotas protegidas: 5 · públicas: /*, /invite/:token, /login, /reset-password, /status, /survey/:token
- feature flags: oracle_v2

## Alertas (baseline.json → alertas)
- rotas_sem_arquivo: 0
- componentes_ambiguos: 0
- menu_sem_destino: 0
- edges_orfas: 8 — ex.: gmaps-places-search, health, instagram-dlq-replay
- edges_chamadas_sem_pasta: 0
- tabelas_sem_rls: 0
- tabelas_usadas_sem_definicao: 0
- tabelas_com_drift_migration_vs_types: 9 — ex.: api_keys, audit_logs, circuit_breakers
- rpcs_sem_definicao: 0
- componentes_orfaos: 19 — ex.: src/components/auth/MFAEnroll.tsx, src/components/lux/LuxImage.tsx, src/components/NavLink.tsx
- componentes_com_nome_duplicado: 2 — ex.: Sidebar, Toaster
- scripts_orfaos: 0
- env_usadas_nao_declaradas: 7 — ex.: DEV, PROD, SUPABASE_PUBLISHABLE_KEY
- ciclos_de_import: 6
- possiveis_segredos_no_codigo: 2 — ex.: supabase/functions/_shared/__tests__/lusha-client.test.ts:33, supabase/functions/_shared/__tests__/lusha-client.test.ts:36

## Grafo de código (graphify)
- 8196 nós · 17634 arestas · 706 comunidades · grafo do commit `9c59a910`
- comunidades maiores: lucide-react (213), useActiveOrganization (208), CampaignsView.tsx (208), react (154), cn (119), LushaIntelligenceView.tsx (114), snapshot.py (102), gerar.mjs (80), lushaMocks.ts (74), generate.py (73), OrganizationsView.tsx (72), Login.tsx (69)
- símbolos mais chamados: cn() (src/lib/utils.ts), useActiveOrganization() (src/contexts/active-org-context.ts), useAuth() (src/contexts/auth-context.ts), q() (scripts/supabase_snapshot/snapshot.py), useDemo() (src/contexts/demo-context.ts), .collect() (scripts/supabase_snapshot/test_snapshot.py), excluded_sql() (scripts/supabase_snapshot/snapshot.py), getActiveOrgId() (src/integrations/supabase/withOrg.ts), useToast() (src/hooks/use-toast.ts), fail() (scripts/automation.mjs), fail() (scripts/graphify-local.mjs), mockFramerMotion() (src/test/mockFramerMotion.ts)
- consulta local: `graphify query "<pergunta>"`, `graphify path "<A>" "<B>"`, `graphify explain "<X>"`

## Hotspots (arquivos mais alterados, 90 dias)
- docs/qa/05-PROGRESSO.md (35)
- package.json (21)
- package-lock.json (20)
- docs/GAPS-ENTERPRISE.md (10)
- scripts/automation.config.json (10)
- supabase/config.toml (10)
- supabase/functions/gmaps-proxy/index.ts (10)
- .github/workflows/db-migrations.yml (9)
- src/integrations/supabase/types.ts (9)
- supabase/functions/public-api/index.ts (9)
- AGENTS.md (8)
- src/pages/Monitoring.tsx (8)
- src/integrations/supabase/withOrg.ts (7)
- .github/workflows/ci.yml (6)
- .github/workflows/edge-tests-daily.yml (6)

## Workflows
- `automation-local.yml` — Automação local (pull_request, push, workflow_dispatch)
- `ci.yml` — CI Pipeline (pull_request, push, workflow_dispatch)
- `contexto.yml` — Contexto para agentes de IA (10 min) (push, schedule, workflow_dispatch; cron 3-59/10 * * * *)
- `db-migrations.yml` — Database Migrations (pull_request, push, workflow_dispatch)
- `dependency-review.yml` — Dependency Review (pull_request)
- `deploy-watchdog.yml` — Deploy Watchdog (schedule, workflow_dispatch; cron */30 * * * *)
- `edge-functions-deploy.yml` — Edge Functions Deploy (pull_request, push, workflow_dispatch)
- `edge-tests-daily.yml` — Edge Functions Daily Tests (Deno) (pull_request, schedule, workflow_dispatch; cron 0 7 * * *)
- `functions-retirement.yml` — Functions Retirement (push, workflow_dispatch)
- `inventario-estado-semanal.yml` — Inventário do estado real (semanal) (schedule, workflow_dispatch; cron 23 10 * * 1)
- `production-smoke.yml` — Production Smoke Test (schedule, workflow_dispatch; cron 0 9 * * *)

## Scripts npm
- `maintenance:doctor`: `sh scripts/maintenance/run.sh doctor --root .`
- `maintenance:check`: `sh scripts/maintenance/run.sh check --root . --ref origin/main`
- `maintenance:heal`: `sh scripts/maintenance/run.sh heal --root . --ref origin/main`
- `test:maintenance`: `node --test scripts/maintenance/maintenance.unit.mjs`
- `dev`: `node scripts/patch-mcp-plugin.mjs && vite`
- `patch:mcp-plugin`: `node scripts/patch-mcp-plugin.mjs`
- `postinstall`: `node scripts/patch-mcp-plugin.mjs`
- `prebuild`: `node scripts/patch-mcp-plugin.mjs`
- `build`: `vite build && (npm run generate-audit-pdf || echo PDF de auditoria nao gerado, requer bun, build principal ja concluiu)`
- `generate-audit-pdf`: `bun scripts/generate-audit-pdf.ts`
- `build:dev`: `vite build --mode development`
- `lint`: `eslint .`
- `preview`: `vite preview`
- `test`: `vitest run`
- `test:coverage`: `vitest run --coverage`
- `test:e2e`: `playwright test`
- `test:watch`: `vitest`
- `format`: `prettier --write .`
- `prepare`: `husky`
- `analyze`: `vite-bundle-visualizer`
- `graph:setup`: `bash scripts/graphify/setup.sh`
- `graph:update`: `graphify update .`
- `test:grants`: `bash scripts/check-function-grants.sh`
- `test:audit-triggers`: `bash scripts/check-audit-triggers.sh`
- `db:start`: `supabase start`
- `db:stop`: `supabase stop`
- `db:new`: `supabase migration new`
- `db:diff`: `supabase db diff --local --schema public`
- `db:reset`: `supabase db reset`
- `db:lint`: `bash scripts/check-migrations.sh`
- `db:verify`: `npm run db:lint && supabase db reset`
- `db:status`: `supabase migration list --linked`
- `db:plan`: `supabase db push --dry-run --linked`
- `contexto:ia`: `node scripts/ai-context/gerar.mjs --out docs/contexto/codigo`
- `contexto:ia:test`: `node --test scripts/ai-context/gerar.unit.mjs`
- `contexto:regras`: `python3 scripts/regras_negocio/generate.py --repo . --out docs/contexto/regras --profile regras --schema-snapshot docs/contexto/supabase --index-path docs/contexto/00-INDEX.md --no-pointer`
- `contexto:supabase`: `SNAPSHOT_DIR=docs/contexto/supabase python3 scripts/supabase_snapshot/snapshot.py`
- `inventario:edges`: `node scripts/inventario/gerar-repo.mjs`
- `inventario:edges:test`: `node --test scripts/inventario/mudou-conteudo.unit.mjs`
- `lint:ratchet`: `node scripts/ci/lint-ratchet.mjs`
- `lint:ratchet:update`: `node scripts/ci/lint-ratchet.mjs --update-baseline`
- `lint:ratchet:test`: `node --test scripts/ci/lint-ratchet.unit.mjs`
- `org:fixture`: `node scripts/ci/gerar-org-scoped-fixture.mjs`
- `org:fixture:check`: `node scripts/ci/gerar-org-scoped-fixture.mjs --check`
- `automation:doctor`: `node scripts/automation.mjs doctor`
- `automation:test`: `node scripts/automation.mjs test`
- `automation:check`: `node scripts/automation.mjs check --ref HEAD`
- `automation:heal`: `node scripts/automation.mjs heal --ref origin/main`
- `automation:nightly`: `node scripts/automation.mjs nightly --ref origin/main`
- `automation:graph`: `node scripts/automation.mjs graph`
- `automation:status`: `node scripts/automation.mjs graph status`
- `automation:install-hooks`: `node scripts/automation.mjs install-hooks`
- `automation:uninstall-hooks`: `node scripts/automation.mjs uninstall-hooks`

## Documentos (raiz e docs/)
- `AGENTS.md` — AGENTS.md — Promo Lux V2 (LUX IA) (166 linhas)
- `CHANGELOG.md` — Changelog (53 linhas)
- `CLAUDE.md` (2 linhas)
- `CONTRIBUTING.md` — 📐 Guia de Contribuição — LUX IA (47 linhas)
- `README.md` — LUX IA — Sistema de Prospecção B2B Inteligente (282 linhas)
- `docs/AUDITORIA-FUNCIONALIDADES.md` — Auditoria de Funcionalidades — Promo_Lux_V2 (134 linhas)
- `docs/AUDITORIA_BACKEND_SENIOR.md` — Auditoria Back-End Sênior — LUX IA (136 linhas)
- `docs/AUDITORIA_FINAL_LUX_IA.md` — 📝 Relatório de Auditoria Enterprise — LUX IA (v10.0) (89 linhas)
- `docs/AUDITORIA_FIRECRAWL.md` — Auditoria de Paridade — LUX IA vs Firecrawl (199 linhas)
- `docs/AUDITORIA_TECNICA_SCORECARD.md` (223 linhas)
- `docs/AUTOMACAO_LOCAL.md` — Automação local — Promo_Lux_V2 (123 linhas)
- `docs/ESTADO_ATUAL.md` — ESTADO ATUAL DO SISTEMA — LUX IA (181 linhas)
- `docs/FUNCIONALIDADES.md` — LUX IA — Análise Executiva de Funcionalidades (455 linhas)
- `docs/GAPS-ENTERPRISE.md` — LUX IA — Gaps Enterprise (433 linhas)
- `docs/LGPD.md` — 🛡️ Relatório de Conformidade LGPD — LUX IA (45 linhas)
- `docs/LUSHA-INTEGRATION.md` — Lusha Intelligence — Integração LUX (181 linhas)
- `docs/ORACLE_V2.md` — Oracle v2 — Runbook (123 linhas)
- `docs/apify-mock-mode.md` — Apify Mock Mode (Dev / E2E) (51 linhas)
- `docs/auditoria-backend-2026-07-12.md` — Auditoria Profunda de Back-End — LUX IA (106 linhas)
- `docs/auth.md` — Estratégia de Autenticação — LUX IA (71 linhas)
- `docs/edge-functions.md` — Edge Functions — Documentação (202 linhas)
- `docs/erd.md` — 🗺️ Diagrama Entidade-Relacionamento (ERD) (78 linhas)
- `docs/pesquisa-oss-linkedin-enrichment.md` — Levantamento OSS — Descoberta de Email/Telefone a partir do LinkedIn (184 linhas)
- `docs/prod-readiness.md` — Prod-Readiness — LUX IA (`adm01-debug/Promo_Lux_V2`) (137 linhas)
- `docs/schema-tabelas-principais.md` — Schema das Tabelas Principais — LUX IA (1189 linhas)
- `docs/webhooks.md` — Webhooks — Guia de Integração (115 linhas)
- subpastas de docs/: docs/adr (29), docs/agentes (6), docs/qa (6), docs/estado (5), docs/runbooks (4), docs/pendencias (3), docs/contexto (1)
- CHANGELOG topo: [Unreleased] - 2026-07-22

## Últimos commits
- 2026-11-26 `9c59a91` feat(monitoramento): cron parado deixa de se confundir com nada vencido (#274)
- 2026-11-26 `2c3abb8` fix(dlq): reprocessar fila morta exige papel de administrador (#256)
- 2026-11-26 `7389012` infra: expurgo dos CSVs de exportacao depois de 90 dias (#273)
- 2026-11-26 `c6c2424` feat(exportacao): guarda o CSV exportado no bucket privado e permite baixar de novo (#272)
- 2026-11-26 `594348f` infra(functions): detector de function publicada fora do repositorio (#271)
- 2026-11-26 `10dc090` feat(raspagem): exporta leads do job em CSV e grava historico em job_exports (#270)
- 2026-11-26 `5f53677` infra: aposenta functions no projeto (a migrate-helper segue ativa em producao) (#269)
- 2026-11-26 `a0f0709` fix(security): remove migrate-helper e o vazamento da chave mestra (etapa 003) (#229)
- 2026-11-26 `5e6fd02` fix(seguranca): restringe a auditoria a organizacao do administrador (etapa 018) (#246)
- 2026-11-26 `1e5a847` fix(api-publica): exclusao vira lixeira e a listagem nao devolve excluido (#255)
- 2026-11-26 `f2a4df6` fix(supressao): so o descadastro ativo bloqueia envio (etapa 048) (#258)
- 2026-11-26 `e739571` fix(api-publica): limite de uso passa a falhar fechado (etapa 038) (#252)
- 2026-11-26 `a14f8c3` fix(raspagem): recupera a gravacao na contingencia, o sync sem consulta dupla e o escopo por organizacao (etapas 052/053
- 2026-11-26 `a2f31f0` fix(seguranca): fecha o worker de Instagram atras de credencial de servico (etapa 034) (#249)
- 2026-11-26 `2c9d9fc` fix(seguranca): exige pertencimento a organizacao em campanhas, webhooks e proxies (etapas 031/032/033) (#248)

## Arquivos deste diretório
- `docs/contexto/codigo/rotas.json`
- `docs/contexto/codigo/modulos.json`
- `docs/contexto/codigo/componentes.json`
- `docs/contexto/codigo/hooks.json`
- `docs/contexto/codigo/edge-functions.json`
- `docs/contexto/codigo/banco.json`
- `docs/contexto/codigo/ferramentas.json`
- `docs/contexto/codigo/scripts.json`
- `docs/contexto/codigo/testes.json`
- `docs/contexto/codigo/logica.json`
- `docs/contexto/codigo/grafo.json`
- `docs/contexto/codigo/grafo-arestas.json`
- `docs/contexto/codigo/convencoes.json`
- `docs/contexto/codigo/grafo-graphify.json`
- `docs/contexto/codigo/baseline.json`
- `docs/contexto/codigo/manifest.json` (commit, data, hashes, erros — único arquivo com data/hora)
