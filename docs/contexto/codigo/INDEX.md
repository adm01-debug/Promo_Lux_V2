# Contexto do projeto para agentes de IA

GERADO AUTOMATICAMENTE por scripts/ai-context/gerar.mjs — não editar à mão; será sobrescrito.
Publicado em `docs/contexto/codigo/` na branch `contexto` (gerada, nunca abra PR dela) a cada push em `main` e a cada 10 minutos pelo workflow `contexto.yml`; índice único das três fontes em `docs/contexto/00-INDEX.md`. Gere local com `node scripts/ai-context/gerar.mjs`. Commit-base: `ec5349fc1617150b3033114733080dc8d836cec8` (2026-11-25T18:58:37-03:00).

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
- linguagens: TypeScript (694), SQL (274), Markdown (87), JSON (38), JavaScript (25), Shell (16), YAML (12), Python (5)
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
| arquivos_total | 1169 |
| arquivos_codigo | 723 |
| linhas_codigo | 126263 |
| rotas | 12 |
| rotas_http_backend | 0 |
| vistas_por_id | 23 |
| itens_menu | 26 |
| modulos | 23 |
| componentes | 268 |
| hooks | 97 |
| edge_functions | 62 |
| tabelas | 121 |
| migrations | 270 |
| cron_jobs | 43 |
| testes | 141 |
| workflows | 10 |
| scripts | 54 |
| docs_md | 87 |

## Onde ficam as coisas
- telas: src/components (23), src/pages (11)
- componentes: src/components (251), src/pages (11), src/contexts (3)
- hooks: src/hooks (90), src/components (4), src/contexts (3)
- servicos_logica: src/lib (39), src/integrations (4), src/contexts (3)
- testes: co-localizado (__tests__) (95), e2e/ (19), co-localizado (*.test) (16)
- edge_functions: supabase/functions
- migrations: supabase/migrations
- scripts: scripts/maintenance (4), scripts/ci (3), scripts/regras_negocio (3)
- docs: docs (21), (raiz) (5)
- nomenclatura: {"componentes":"PascalCase (82%)","hooks":"use + PascalCase","servicos":"camelCase (82%)","edge_functions":"kebab-case (95%)","tabelas":"snake_case (91%)"}
- instruções para agentes no repo: AGENTS.md, CLAUDE.md

## Módulos (menu → domínio)
| módulo | itens de menu | telas/rotas | arquivos | hooks locais | edges | tabelas |
|---|---|---|---|---|---|---|
| components/lux | 26 | 23 | 220 | 153 | 33 | 93 |
| components/ui | 0 | 0 | 54 | 4 | 0 | 0 |
| contexts | 0 | 0 | 6 | 10 | 0 | 4 |
| hooks | 0 | 0 | 91 | 157 | 28 | 83 |
| lib | 0 | 0 | 17 | 91 | 27 | 63 |
| lib/mcp | 0 | 0 | 7 | 0 | 0 | 3 |
| lib/resilience | 0 | 0 | 5 | 0 | 0 | 0 |
| pages | 0 | 11 | 11 | 162 | 35 | 94 |

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
- `gmaps-places-search` — tabelas: -; chamada por 0 arquivo(s) do front — **ÓRFÃ**
- `gmaps-proxy` (verify_jwt=false) — tabelas: idempotency_keys, ipc_config, notifications, org_proxies, scrape_jobs, scrape_results; chamada por 1 arquivo(s) do front, por SQL/cron
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
- `migrate-helper` (verify_jwt=false) — tabelas: -; chamada por 0 arquivo(s) do front
- `oracle-cookies-preflight` — tabelas: automation_execution_logs; chamada por 1 arquivo(s) do front
- `oracle-enrich-contact` — tabelas: lusha_contacts; chamada por 1 arquivo(s) do front
- `oracle-push-bitrix` — tabelas: lusha_contacts, lusha_search_sessions; chamada por 1 arquivo(s) do front
- `oracle-search-decisors` — tabelas: companies, lusha_contacts, lusha_search_sessions; chamada por 1 arquivo(s) do front
- `org-violation-alerts` — tabelas: notifications, org_violation_alerts, organization_members, webhook_deliveries, webhooks; chamada por 1 arquivo(s) do front, por SQL/cron
- `pg-net-watchdog` (verify_jwt=false) — tabelas: notifications, pg_net_health_snapshots, user_roles; chamada por 0 arquivo(s) do front, por SQL/cron
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
- webhooks recebidos: admin-list-companies, campaign-dispatch, circuit-breaker-alerts, dlq-alerts, email-oauth-callback, email-poll-replies, gmaps-proxy, hubspot-sync, mcp, mcp-query, migrate-helper, pg-net-watchdog, public-api, purge-soft-deleted, qa-ingest-run, reaper-alerts, retry-policy-tuner, scim, scrape-queue-worker, send-scheduled-reports, sla-alerts, sla-auto-tune, track-click, track-open, vault-cookie-health, web-scrape-worker
- env de integração (só nomes): APIFY_API_KEY, APIFY_TOKEN, APOLLO_API_KEY, BITRIX_WEBHOOK_BASE, BRIGHTDATA_API_TOKEN, CNPJA_API_KEY, GMAPS_OMKAR_API_KEY, GOOGLE_MAPS_API_KEY, GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET, HIKER_API_KEY, LOVABLE_API_KEY, LUSHA_API_KEY, MCP_SECRET, MS_OAUTH_CLIENT_ID, MS_OAUTH_CLIENT_SECRET, QA_INGEST_TOKEN, TRACKING_SIGNING_SECRET

## Permissões / papéis
- papéis no código: admin (11), alert (11), status (11), user (6), button (4), dialog (4), system (4), group (3), main (3), viewer (3), CEO (2), CTO (2), navigation (2), presentation (2), region (2), CFO (1), agent (1), img (1), link (1), listitem (1), member (1), menu (1), progressbar (1), sdr (1), separator (1)
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
- tabelas_com_drift_migration_vs_types: 10 — ex.: api_keys, audit_logs, circuit_breakers
- rpcs_sem_definicao: 0
- componentes_orfaos: 19 — ex.: src/components/auth/MFAEnroll.tsx, src/components/lux/LuxImage.tsx, src/components/NavLink.tsx
- componentes_com_nome_duplicado: 2 — ex.: Sidebar, Toaster
- scripts_orfaos: 0
- env_usadas_nao_declaradas: 7 — ex.: DEV, PROD, SUPABASE_PUBLISHABLE_KEY
- ciclos_de_import: 6
- possiveis_segredos_no_codigo: 2 — ex.: supabase/functions/_shared/__tests__/lusha-client.test.ts:33, supabase/functions/_shared/__tests__/lusha-client.test.ts:36

## Grafo de código (graphify)
- 7985 nós · 17037 arestas · 700 comunidades · grafo do commit `ec5349fc`
- comunidades maiores: lucide-react (141), @tanstack/react-query (139), button.tsx (134), cn (123), react (121), EmailAccountsPanel.tsx (104), vitest (82), gerar.mjs (80), ref_node_fs (75), generate.py (73), lushaMocks.ts (71), DealDetailDrawer.tsx (68)
- símbolos mais chamados: cn() (src/lib/utils.ts), useActiveOrganization() (src/contexts/active-org-context.ts), useAuth() (src/contexts/auth-context.ts), q() (scripts/supabase_snapshot/snapshot.py), useDemo() (src/contexts/demo-context.ts), .collect() (scripts/supabase_snapshot/test_snapshot.py), excluded_sql() (scripts/supabase_snapshot/snapshot.py), getActiveOrgId() (src/integrations/supabase/withOrg.ts), useToast() (src/hooks/use-toast.ts), fail() (scripts/automation.mjs), fail() (scripts/graphify-local.mjs), .metadata() (scripts/supabase_snapshot/test_snapshot.py)
- consulta local: `graphify query "<pergunta>"`, `graphify path "<A>" "<B>"`, `graphify explain "<X>"`

## Hotspots (arquivos mais alterados, 90 dias)
- package.json (21)
- package-lock.json (20)
- docs/qa/05-PROGRESSO.md (12)
- docs/GAPS-ENTERPRISE.md (10)
- .github/workflows/db-migrations.yml (9)
- supabase/config.toml (9)
- AGENTS.md (8)
- src/integrations/supabase/types.ts (8)
- scripts/automation.config.json (7)
- supabase/functions/gmaps-proxy/index.ts (7)
- supabase/functions/public-api/index.ts (7)
- .github/workflows/edge-tests-daily.yml (6)
- src/integrations/supabase/withOrg.ts (6)
- src/pages/Monitoring.tsx (6)
- .github/workflows/ci.yml (5)

## Workflows
- `automation-local.yml` — Automação local (pull_request, push, workflow_dispatch)
- `ci.yml` — CI Pipeline (pull_request, push, workflow_dispatch)
- `contexto.yml` — Contexto para agentes de IA (10 min) (push, schedule, workflow_dispatch; cron 3-59/10 * * * *)
- `db-migrations.yml` — Database Migrations (pull_request, push, workflow_dispatch)
- `dependency-review.yml` — Dependency Review (pull_request)
- `deploy-watchdog.yml` — Deploy Watchdog (schedule, workflow_dispatch; cron */30 * * * *)
- `edge-functions-deploy.yml` — Edge Functions Deploy (pull_request, push, workflow_dispatch)
- `edge-tests-daily.yml` — Edge Functions Daily Tests (Deno) (pull_request, schedule, workflow_dispatch; cron 0 7 * * *)
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
- `docs/prod-readiness.md` (137 linhas)
- `docs/schema-tabelas-principais.md` — Schema das Tabelas Principais — LUX IA (1189 linhas)
- `docs/webhooks.md` — Webhooks — Guia de Integração (115 linhas)
- subpastas de docs/: docs/adr (29), docs/agentes (6), docs/qa (6), docs/estado (5), docs/runbooks (4), docs/pendencias (3), docs/contexto (1)
- CHANGELOG topo: [Unreleased] - 2026-07-22

## Últimos commits
- 2026-11-25 `ec5349f` feat(ci): fixture multi-tenant passa a vir das migrations (etapa 008) (#227)
- 2026-11-25 `580b952` fix(e2e): suite de RLS para de passar verde sem backend real (#226)
- 2026-11-25 `f889110` fix: leitura sem organizacao ativa falha fechada no wrapper (#225)
- 2026-11-25 `8c4a8f1` fix: escopo de organizacao nas consultas e no cache do front (#224)
- 2026-11-25 `d7c7ccf` fix: consultas do painel e da auditoria so rodam com organizacao ativa (#223)
- 2026-11-25 `d15f85e` feat: aviso de demonstracao em todas as telas e estado de demo por view (#222)
- 2026-11-25 `40e6a6e` fix: separa o cache do modo demonstracao do cache real (#221)
- 2026-11-25 `21eb9db` fix: remove rotulo ambiguo do e2e de login (#219)
- 2026-11-25 `8b6a870` fix: corrige os textos duplamente codificados da tela de monitoramento (#220)
- 2026-11-25 `6783576` fix: oferece a acao que faltava nos estados vazios e guarda contra botoes mortos (#218)
- 2026-11-25 `06193a9` fix: liga as acoes do detalhe da empresa e o Ver detalhes da lista (#217)
- 2026-11-25 `b0e85af` fix: liga os botoes do card de Automacoes no painel inicial (#216)
- 2026-11-25 `b4dc737` chore(config): versiona o verify_jwt das 62 edge functions (#215)
- 2026-11-25 `b5ca5ec` fix(config): botao de custo Places API para de mentir (#214)
- 2026-11-25 `f5c5bab` feat: audita as 5 tabelas criticas fora da trilha (#212)

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
