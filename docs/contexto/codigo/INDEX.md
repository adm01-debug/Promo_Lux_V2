# Contexto do projeto para agentes de IA

GERADO AUTOMATICAMENTE por scripts/ai-context/gerar.mjs — não editar à mão; será sobrescrito.
Publicado em `docs/contexto/codigo/` na branch `contexto` (gerada, nunca abra PR dela) a cada push em `main` e a cada 10 minutos pelo workflow `contexto.yml`; índice único das três fontes em `docs/contexto/00-INDEX.md`. Gere local com `node scripts/ai-context/gerar.mjs`. Commit-base: `77b7e67116dee8504b52b9fe9099168aeec7ac7a` (2026-11-21T21:34:52-03:00).

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
- linguagens: TypeScript (636), SQL (229), Markdown (81), JSON (38), JavaScript (22), Shell (13), YAML (11), Python (5)
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
| arquivos_total | 1051 |
| arquivos_codigo | 662 |
| linhas_codigo | 113970 |
| rotas | 10 |
| rotas_http_backend | 0 |
| vistas_por_id | 23 |
| itens_menu | 26 |
| modulos | 22 |
| componentes | 243 |
| hooks | 84 |
| edge_functions | 60 |
| tabelas | 105 |
| migrations | 225 |
| cron_jobs | 29 |
| testes | 125 |
| workflows | 9 |
| scripts | 49 |
| docs_md | 81 |

## Onde ficam as coisas
- telas: src/components (23), src/pages (9)
- componentes: src/components (228), src/pages (9), src/contexts (3)
- hooks: src/hooks (77), src/components (4), src/contexts (3)
- servicos_logica: src/lib (38), src/integrations (4), src/contexts (3)
- testes: co-localizado (__tests__) (80), e2e/ (19), co-localizado (*.test) (16)
- edge_functions: supabase/functions
- migrations: supabase/migrations
- scripts: scripts/maintenance (4), scripts/regras_negocio (3), scripts/sql (3)
- docs: docs (21), (raiz) (5)
- nomenclatura: {"componentes":"PascalCase (80%)","hooks":"use + PascalCase","servicos":"camelCase (81%)","edge_functions":"kebab-case (97%)","tabelas":"snake_case (90%)"}
- instruções para agentes no repo: AGENTS.md, CLAUDE.md

## Módulos (menu → domínio)
| módulo | itens de menu | telas/rotas | arquivos | hooks locais | edges | tabelas |
|---|---|---|---|---|---|---|
| components/lux | 26 | 23 | 198 | 115 | 23 | 75 |
| components/ui | 0 | 0 | 54 | 4 | 0 | 0 |
| contexts | 0 | 0 | 6 | 10 | 0 | 4 |
| hooks | 0 | 0 | 78 | 123 | 21 | 67 |
| lib | 0 | 0 | 16 | 61 | 20 | 48 |
| lib/mcp | 0 | 0 | 7 | 0 | 0 | 3 |
| lib/resilience | 0 | 0 | 5 | 0 | 0 | 0 |
| pages | 0 | 9 | 9 | 124 | 26 | 76 |

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
- `admin-list-companies` (verify_jwt=false) — tabelas: companies; chamada por 1 arquivo(s) do front
- `ai-agent` — tabelas: companies, ipc_config, scrape_jobs, workflows; chamada por 1 arquivo(s) do front
- `api-latency-alerts` — tabelas: -; chamada por 0 arquivo(s) do front — **ÓRFÃ**
- `audit-logs-prune` — tabelas: api_request_logs, audit_logs, email_sync_log, health_checks; chamada por 0 arquivo(s) do front — **ÓRFÃ**
- `auth-rate-limit` — tabelas: auth_rate_limits; chamada por 1 arquivo(s) do front
- `campaign-dispatch` — tabelas: campaign_messages, campaign_recipients, campaigns, email_accounts, email_suppressions; chamada por 1 arquivo(s) do front, por SQL/cron
- `circuit-breaker-alerts` — tabelas: -; chamada por 0 arquivo(s) do front, por SQL/cron
- `cnpj-enrich` — tabelas: cnpj_enrich_cache, cnpj_enrich_queue; chamada por 1 arquivo(s) do front, por SQL/cron
- `cnpj-enrich-worker` — tabelas: cnpj_enrich_cache, cnpj_enrich_queue; chamada por 0 arquivo(s) do front, por SQL/cron
- `cnpj-settings-status` — tabelas: cnpj_enrich_cache, cnpj_enrich_queue, cnpj_enrich_rate_state; chamada por 1 arquivo(s) do front
- `deliverability-check` — tabelas: -; chamada por 0 arquivo(s) do front — **ÓRFÃ**
- `dlq-alerts` — tabelas: dlq_alert_history, dlq_alert_settings, dlq_health_snapshots, notifications, organization_members; chamada por 0 arquivo(s) do front, por SQL/cron
- `email-oauth-callback` (verify_jwt=false) — tabelas: email_accounts; chamada por 1 arquivo(s) do front
- `email-oauth-connect` — tabelas: -; chamada por 2 arquivo(s) do front
- `email-oauth-disconnect` — tabelas: audit_logs, email_accounts; chamada por 1 arquivo(s) do front
- `email-poll-replies` — tabelas: email_accounts, email_sync_log; chamada por 1 arquivo(s) do front, por SQL/cron
- `email-verify` — tabelas: -; chamada por 0 arquivo(s) do front — **ÓRFÃ**
- `gmaps-places-search` — tabelas: -; chamada por 0 arquivo(s) do front — **ÓRFÃ**
- `gmaps-proxy` — tabelas: companies, idempotency_keys, ipc_config, notifications, org_proxies, scrape_jobs, scrape_results; chamada por 1 arquivo(s) do front, por SQL/cron
- `health` — tabelas: health_checks, organizations; chamada por 0 arquivo(s) do front — **ÓRFÃ**
- `instagram-connection-status` — tabelas: -; chamada por 1 arquivo(s) do front
- `instagram-dlq-replay` — tabelas: organization_members; chamada por 0 arquivo(s) do front — **ÓRFÃ**
- `instagram-enqueue` — tabelas: instagram_scrape_queue, organization_members; chamada por 0 arquivo(s) do front — **ÓRFÃ**
- `instagram-worker` — tabelas: instagram_scrape_dead_letter, instagram_scrape_queue, instagram_scrape_results; chamada por 0 arquivo(s) do front — **ÓRFÃ**
- `instagram-worker-health` — tabelas: instagram_scrape_dead_letter, instagram_scrape_queue; chamada por 0 arquivo(s) do front — **ÓRFÃ**
- `latency-alerts` — tabelas: api_latency_alert_history, api_latency_alert_settings, api_latency_snapshots, notifications, organization_members; chamada por 0 arquivo(s) do front, por SQL/cron
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
- `org-violation-alerts` — tabelas: notifications, org_violation_alerts, organization_members, webhook_deliveries, webhooks; chamada por 1 arquivo(s) do front
- `pg-net-watchdog` — tabelas: notifications, pg_net_health_snapshots, user_roles; chamada por 0 arquivo(s) do front, por SQL/cron
- `public-api` (verify_jwt=false) — tabelas: api_keys, api_request_logs; chamada por 1 arquivo(s) do front
- `purge-soft-deleted` — tabelas: -; chamada por 0 arquivo(s) do front, por SQL/cron
- `qa-ingest-run` (verify_jwt=false) — tabelas: qa_test_runs; chamada por 1 arquivo(s) do front
- `reaper-alerts` — tabelas: notifications, qa_reaper_runs, reaper_alert_history, reaper_alert_settings, user_roles; chamada por 0 arquivo(s) do front, por SQL/cron
- `retry-policy-tuner` — tabelas: automation_execution_logs, retry_policy_advisories, web_scrape_queue; chamada por 0 arquivo(s) do front, por SQL/cron
- `rls-tests` — tabelas: audit_logs, companies, organization_members, organizations, profiles, workflows; chamada por 1 arquivo(s) do front
- `scrape-queue-worker` — tabelas: feature_flags, scrape_jobs; chamada por 0 arquivo(s) do front, por SQL/cron
- `send-scheduled-reports` (verify_jwt=false) — tabelas: campaign_events, companies, deals, email_accounts, scheduled_report_runs, scheduled_reports; chamada por 0 arquivo(s) do front, por SQL/cron
- `sla-alerts` — tabelas: notifications, sla_alert_history, sla_alert_settings, user_roles; chamada por 0 arquivo(s) do front, por SQL/cron
- `sla-auto-tune` — tabelas: notifications, organization_members, sla_autotune_runs, user_roles; chamada por 0 arquivo(s) do front, por SQL/cron
- `system-recovery-status` — tabelas: -; chamada por 0 arquivo(s) do front — **ÓRFÃ**
- `track-click` (verify_jwt=false) — tabelas: -; chamada por 0 arquivo(s) do front
- `track-open` (verify_jwt=false) — tabelas: -; chamada por 0 arquivo(s) do front
- `vault-cookie-health` — tabelas: -; chamada por 1 arquivo(s) do front, por SQL/cron
- `web-dlq-replay` — tabelas: organization_members; chamada por 0 arquivo(s) do front — **ÓRFÃ**
- `web-scrape-enqueue` — tabelas: organization_members, web_scrape_queue; chamada por 0 arquivo(s) do front — **ÓRFÃ**
- `web-scrape-extract` — tabelas: feature_flags, web_scrape_queue, web_scrape_results; chamada por 0 arquivo(s) do front — **ÓRFÃ**
- `web-scrape-status` — tabelas: web_scrape_queue, web_scrape_results; chamada por 0 arquivo(s) do front — **ÓRFÃ**
- `web-scrape-worker` — tabelas: automation_execution_logs, feature_flags, robots_cache, web_scrape_results; chamada por 0 arquivo(s) do front, por SQL/cron
- `webhook-dispatcher` — tabelas: webhook_deliveries, webhooks; chamada por 1 arquivo(s) do front
- `workflow-engine` — tabelas: audit_logs, automation_alerts, automation_steps, companies, ipc_config, organization_members, scrape_jobs, scrape_results, workflow_runs, workflows; chamada por 1 arquivo(s) do front

## Cron jobs (pg_cron / vercel)
- `campaign-dispatch-10min` */10 * * * * → edge campaign-dispatch (20261121190000_version_crons_with_vault_key.sql)
- `campaign-dispatch-every-10min` */10 * * * * → edge campaign-dispatch (20261121190000_version_crons_with_vault_key.sql)
- `capture-db-health` */5 * * * * (20260712183806_e5a47f1b-5acb-4925-8862-6b201a553e15.sql)
- `circuit-breaker-alerts-every-5min` */5 * * * * → edge circuit-breaker-alerts (20261121190000_version_crons_with_vault_key.sql)
- `cnpj-enrich-worker-every-2min` */2 * * * * → edge cnpj-enrich-worker (20261121190000_version_crons_with_vault_key.sql)
- `daily-campaign-logs-retention` 30 3 * * * (20260721225949_e0ca6ffa-efa2-4bd0-a116-c6425eb821cd.sql)
- `daily-log-retention` 15 3 * * * (20260721225851_96d1133c-350c-4bd1-be9c-96de97456af1.sql)
- `dlq-alerts-15min` */15 * * * * → edge dlq-alerts (20261121190000_version_crons_with_vault_key.sql)
- `email-poll-replies-5min` */5 * * * * → edge email-poll-replies (20261121190000_version_crons_with_vault_key.sql)
- `evaluate-partition-policies-daily` 17 3 * * * (20260712184705_499e82f4-33c4-443a-82b6-21735caafc4b.sql)
- `latency-alerts-15min` */15 * * * * → edge latency-alerts (20261121190000_version_crons_with_vault_key.sql)
- `pg-net-snapshots-prune-weekly` 0 3 * * 0 (20260722123959_e7c39e43-b1a2-4861-a445-6343f477981a.sql)
- `pg-net-watchdog-30m` */30 * * * * → edge pg-net-watchdog (20261121190000_version_crons_with_vault_key.sql)
- `process-scrape-queue` * * * * * → edge scrape-queue-worker (20261121190000_version_crons_with_vault_key.sql)
- `prune-cron-job-run-details-daily` 41 3 * * * (20261121210000_retencao_cron_runs_e_qa_reaper.sql)
- `prune-qa-reaper-runs-daily` 47 3 * * * (20261121210000_retencao_cron_runs_e_qa_reaper.sql)
- `prune-scheduled-report-runs-monthly` 53 3 1 * * → edge send-scheduled-reports (20261121230000_scheduled_reports_bulk_imports_role_permissions.sql)
- `purge-soft-deleted-daily` 0 3 * * * → edge purge-soft-deleted (20261121190000_version_crons_with_vault_key.sql)
- `reap-stuck-queue-tasks` * * * * * (20260723134028_4f3b5c29-1e04-4d63-95d1-2bb0f069e917.sql)
- `reaper-alerts-30min` */30 * * * * → edge reaper-alerts (20261121190000_version_crons_with_vault_key.sql)
- `refresh-scores-daily` 23 5 * * * (20261121193000_lead_scores_dashboard_layouts_deal_predictions_changelog.sql)
- `retry-policy-tuner-daily` 0 3 * * * → edge retry-policy-tuner (20261121190000_version_crons_with_vault_key.sql)
- `round18-dlq-alerts-15m` */15 * * * * → edge dlq-alerts (20261121190000_version_crons_with_vault_key.sql)
- `send-scheduled-reports-hourly` 7 * * * * → edge send-scheduled-reports (20261121230000_scheduled_reports_bulk_imports_role_permissions.sql)
- `sla-alerts-hourly` 7 * * * * → edge sla-alerts (20261121190000_version_crons_with_vault_key.sql)
- `sla-auto-tune-daily` 20 4 * * * → edge sla-auto-tune (20261121190000_version_crons_with_vault_key.sql)
- `sync-gmaps-jobs` * * * * * → edge gmaps-proxy (20261121190000_version_crons_with_vault_key.sql)
- `vault-cookie-health-daily` 0 9 * * * → edge vault-cookie-health (20261121190000_version_crons_with_vault_key.sql)
- `web-scrape-worker-30s` 30 seconds → edge web-scrape-worker (20261121190000_version_crons_with_vault_key.sql)

## Integrações externas
- SDKs: Supabase, react-query, zod
- hosts mais citados: lux-ai-company-finder.lovable.app, promo-lux-v2.vercel.app, 2e7d5f34-c492-42bd-a233-a5b01098f9b4.lovableproject.com, id-preview--2e7d5f34-c492-42bd-a233-a5b01098f9b4.lovable.app, lux-ai-finder.lovable.app, linkedin.com, graph.microsoft.com, login.microsoftonline.com, oauth2.googleapis.com, supabase.atomicabr.com.br, br.linkedin.com, gmaps.atomicabr.com.br, www.linkedin.com, ai.gateway.lovable.dev, connector-gateway.lovable.dev
- webhooks recebidos: admin-list-companies, email-oauth-callback, mcp, mcp-query, migrate-helper, public-api, qa-ingest-run, send-scheduled-reports, track-click, track-open
- env de integração (só nomes): ADMIN_LIST_TOKEN, APIFY_API_KEY, APIFY_TOKEN, APOLLO_API_KEY, BITRIX_WEBHOOK_BASE, BRIGHTDATA_API_TOKEN, CNPJA_API_KEY, GMAPS_OMKAR_API_KEY, GOOGLE_MAPS_API_KEY, GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET, HIKER_API_KEY, LOVABLE_API_KEY, LUSHA_API_KEY, MCP_SECRET, MS_OAUTH_CLIENT_ID, MS_OAUTH_CLIENT_SECRET, QA_INGEST_TOKEN, TRACKING_SIGNING_SECRET, VITE_ADMIN_LIST_TOKEN

## Permissões / papéis
- papéis no código: alert (11), status (10), admin (9), button (4), dialog (4), user (4), group (3), main (3), CTO (2), navigation (2), presentation (2), region (2), system (2), CEO (1), CFO (1), agent (1), img (1), link (1), listitem (1), member (1), menu (1), progressbar (1), sdr (1), separator (1), viewer (1)
- enums de papel: app_role: admin|moderator|sdr|viewer
- guards: nenhum · rotas protegidas: 5 · públicas: /*, /invite/:token, /login, /reset-password
- feature flags: oracle_v2

## Alertas (baseline.json → alertas)
- rotas_sem_arquivo: 0
- componentes_ambiguos: 0
- menu_sem_destino: 0
- edges_orfas: 16 — ex.: api-latency-alerts, audit-logs-prune, deliverability-check
- edges_chamadas_sem_pasta: 0
- tabelas_sem_rls: 0
- tabelas_usadas_sem_definicao: 0
- tabelas_com_drift_migration_vs_types: 10 — ex.: api_keys, audit_logs, circuit_breakers
- rpcs_sem_definicao: 0
- componentes_orfaos: 19 — ex.: src/components/auth/MFAEnroll.tsx, src/components/lux/LuxImage.tsx, src/components/NavLink.tsx
- componentes_com_nome_duplicado: 2 — ex.: Sidebar, Toaster
- scripts_orfaos: 0
- env_usadas_nao_declaradas: 8 — ex.: DEV, PROD, SUPABASE_PUBLISHABLE_KEY
- ciclos_de_import: 5
- possiveis_segredos_no_codigo: 3 — ex.: e2e/helpers/supabase.ts:7, supabase/functions/_shared/__tests__/lusha-client.test.ts:33, supabase/functions/_shared/__tests__/lusha-client.test.ts:36

## Grafo de código (graphify)
- 6738 nós · 14548 arestas · 587 comunidades · grafo do commit `77b7e671`
- comunidades maiores: react (112), @tanstack/react-query (101), badge.tsx (96), gerar.mjs (80), cn (77), generate.py (75), DashboardView.tsx (72), OAuthSandboxPanel.tsx (68), dependencies (65), campaign-dispatch/index.ts (64), framer-motion (64), IntentSignalsView.tsx (63)
- símbolos mais chamados: cn() (src/lib/utils.ts), useAuth() (src/contexts/auth-context.ts), q() (scripts/supabase_snapshot/snapshot.py), useActiveOrganization() (src/contexts/active-org-context.ts), useDemo() (src/contexts/demo-context.ts), .collect() (scripts/supabase_snapshot/test_snapshot.py), excluded_sql() (scripts/supabase_snapshot/snapshot.py), getActiveOrgId() (src/integrations/supabase/withOrg.ts), useToast() (src/hooks/use-toast.ts), fail() (scripts/automation.mjs), fail() (scripts/graphify-local.mjs), .metadata() (scripts/supabase_snapshot/test_snapshot.py)
- consulta local: `graphify query "<pergunta>"`, `graphify path "<A>" "<B>"`, `graphify explain "<X>"`

## Hotspots (arquivos mais alterados, 90 dias)
- package-lock.json (17)
- package.json (14)
- .github/workflows/edge-tests-daily.yml (6)
- AGENTS.md (6)
- supabase/config.toml (6)
- supabase/functions/gmaps-proxy/index.ts (5)
- .github/workflows/ci.yml (4)
- scripts/ci/eslint-baseline.json (4)
- .github/workflows/contexto.yml (3)
- .github/workflows/db-migrations.yml (3)
- .github/workflows/inventario-estado-semanal.yml (3)
- .husky/pre-commit (3)
- docs/agentes/github-ci.md (3)
- docs/agentes/mapa-repo.md (3)
- docs/prod-readiness.md (3)

## Workflows
- `automation-local.yml` — Automação local (pull_request, push, workflow_dispatch)
- `ci.yml` — CI Pipeline (pull_request, push)
- `contexto.yml` — Contexto para agentes de IA (10 min) (push, schedule, workflow_dispatch; cron 3-59/10 * * * *)
- `db-migrations.yml` — Database Migrations (pull_request, push, workflow_dispatch)
- `dependency-review.yml` — Dependency Review (pull_request)
- `edge-functions-deploy.yml` — Edge Functions Deploy (pull_request, push, workflow_dispatch)
- `edge-tests-daily.yml` — Edge Functions Daily Tests (Deno) (pull_request, schedule, workflow_dispatch; cron 0 7 * * *)
- `inventario-estado-semanal.yml` — Inventário do estado real (semanal) (schedule, workflow_dispatch; cron 23 10 * * 1)
- `production-smoke.yml` — Production Smoke Test (schedule, workflow_dispatch; cron 0 9 * * *)

## Scripts npm
- `maintenance:doctor`: `sh scripts/maintenance/run.sh doctor --root .`
- `maintenance:check`: `sh scripts/maintenance/run.sh check --root . --ref origin/main`
- `maintenance:heal`: `sh scripts/maintenance/run.sh heal --root . --ref origin/main`
- `test:maintenance`: `node --test scripts/maintenance/maintenance.unit.mjs`
- `dev`: `vite`
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
- `AGENTS.md` — AGENTS.md — Promo Lux V2 (LUX IA) (162 linhas)
- `CHANGELOG.md` — Changelog (53 linhas)
- `CLAUDE.md` (2 linhas)
- `CONTRIBUTING.md` — 📐 Guia de Contribuição — LUX IA (47 linhas)
- `README.md` — LUX IA — Sistema de Prospecção B2B Inteligente (282 linhas)
- `docs/AUDITORIA-FUNCIONALIDADES.md` — Auditoria de Funcionalidades — Promo_Lux_V2 (134 linhas)
- `docs/AUDITORIA_BACKEND_SENIOR.md` — Auditoria Back-End Sênior — LUX IA (136 linhas)
- `docs/AUDITORIA_FINAL_LUX_IA.md` — 📝 Relatório de Auditoria Enterprise — LUX IA (v10.0) (89 linhas)
- `docs/AUDITORIA_FIRECRAWL.md` — Auditoria de Paridade — LUX IA vs Firecrawl (199 linhas)
- `docs/AUDITORIA_TECNICA_SCORECARD.md` (223 linhas)
- `docs/AUTOMACAO_LOCAL.md` — Automação local — Promo_Lux_V2 (111 linhas)
- `docs/ESTADO_ATUAL.md` — ESTADO ATUAL DO SISTEMA — LUX IA (176 linhas)
- `docs/FUNCIONALIDADES.md` — LUX IA — Análise Executiva de Funcionalidades (455 linhas)
- `docs/GAPS-ENTERPRISE.md` — LUX IA — Gaps Enterprise (408 linhas)
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
- subpastas de docs/: docs/adr (29), docs/agentes (6), docs/estado (5), docs/runbooks (4), docs/pendencias (3), docs/contexto (1)
- CHANGELOG topo: [Unreleased] - 2026-07-22

## Últimos commits
- 2026-11-21 `77b7e67` fix(edge): remove a anon key publica do gate de 8 functions com efeito colateral (#113)
- 2026-11-21 `c45eec0` chore(docs): reconcilia o backlog com o banco real de 2026-11-22 (#112)
- 2026-11-21 `31805c5` fix(edge): restaura auth de 6 functions quebradas por getClaims inexistente (#110)
- 2026-11-21 `99a180a` fix(extracao): grava organization_id nos jobs criados via service_role (#107)
- 2026-11-21 `ab467da` fix(extracao): fallback da Google Places API ressuscita a extracao Google Maps (#106)
- 2026-11-21 `ef039bf` fix: fecha RLS cross-tenant em dashboard_layouts (#105)
- 2026-11-21 `8723328` fix: grant execute de refresh_org_scores para authenticated (#104)
- 2026-11-21 `4931d9e` feat: lead scoring, previsao de deals, layout de dashboard e changelog in-app (#103)
- 2026-11-21 `7432455` feat: relatorios agendados, historico de importacao e matriz de permissoes (#102)
- 2026-11-21 `bb305ef` chore(db): retencao de 30 dias para cron.job_run_details (1013 MB) e qa_reaper_runs (#98)
- 2026-11-21 `cb0dbe3` docs: auditoria das funcionalidades planejadas contra banco e codigo reais (#101)
- 2026-11-21 `6cea020` fix(docs): decodifica auth.md que estava gravado em base64 (#100)
- 2026-11-21 `e5ef06d` fix(functions): versiona a mcp-query (orfa em producao) e a declara no config.toml (#97)
- 2026-11-21 `9f6188b` docs: reescreve ESTADO_ATUAL.md com medicao de 21/11, nao de agosto (#99)
- 2026-11-21 `7e2e6d2` feat(crons): versiona os 18 crons HTTP lendo a chave do vault (#96)

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
