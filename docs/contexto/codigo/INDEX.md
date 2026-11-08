# Contexto do projeto para agentes de IA

GERADO AUTOMATICAMENTE por scripts/ai-context/gerar.mjs — não editar à mão; será sobrescrito.
Publicado em `docs/contexto/codigo/` na branch `contexto` (gerada, nunca abra PR dela) a cada push em `main` e a cada 10 minutos pelo workflow `contexto.yml`; índice único das três fontes em `docs/contexto/00-INDEX.md`. Gere local com `node scripts/ai-context/gerar.mjs`. Commit-base: `4d5d4ee3c46f8351d64c538be291d2acc7c57c76` (2026-11-08T19:23:53-03:00).

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
- linguagens: TypeScript (616), SQL (216), Markdown (72), JSON (32), JavaScript (11), Shell (10), YAML (6), Python (5)
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
- deploy: n/d
- monorepo: n/d
- pastas_fonte: src

## Números
| item | qtd |
|---|---|
| arquivos_total | 984 |
| arquivos_codigo | 631 |
| linhas_codigo | 102479 |
| rotas | 10 |
| rotas_http_backend | 12 |
| vistas_por_id | 0 |
| itens_menu | 26 |
| modulos | 22 |
| componentes | 241 |
| hooks | 79 |
| edge_functions | 58 |
| tabelas | 97 |
| migrations | 212 |
| cron_jobs | 6 |
| testes | 115 |
| workflows | 5 |
| scripts | 40 |
| docs_md | 72 |

## Onde ficam as coisas
- telas: src/pages (9)
- componentes: src/components (226), src/pages (9), src/contexts (3)
- hooks: src/hooks (71), src/components (4), src/contexts (3)
- servicos_logica: src/lib (38), src/integrations (4), src/contexts (3)
- testes: co-localizado (__tests__) (75), e2e/ (19), co-localizado (*.test) (16)
- edge_functions: supabase/functions
- migrations: supabase/migrations
- scripts: scripts/regras_negocio (3), scripts/sql (3), scripts/ai-context (2)
- docs: docs (17), (raiz) (5)
- nomenclatura: {"componentes":"PascalCase (80%)","hooks":"use + PascalCase","servicos":"camelCase (81%)","edge_functions":"kebab-case (97%)","tabelas":"snake_case (89%)"}
- instruções para agentes no repo: AGENTS.md, CLAUDE.md

## Módulos (menu → domínio)
| módulo | itens de menu | telas/rotas | arquivos | hooks locais | edges | tabelas |
|---|---|---|---|---|---|---|
| components/lux | 0 | 0 | 196 | 109 | 15 | 67 |
| components/ui | 0 | 0 | 54 | 4 | 0 | 0 |
| contexts | 0 | 0 | 6 | 10 | 0 | 4 |
| hooks | 0 | 0 | 72 | 118 | 13 | 59 |
| lib | 0 | 0 | 16 | 57 | 12 | 41 |
| lib/mcp | 0 | 0 | 7 | 0 | 0 | 3 |
| lib/resilience | 0 | 0 | 5 | 0 | 0 | 0 |
| pages | 1 | 9 | 9 | 118 | 17 | 68 |

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
- `GET /{t}` → scripts/ai-context/cenarios.mjs
- `GET /a` → scripts/ai-context/cenarios.mjs
- `GET /a` → scripts/ai-context/cenarios.mjs
- `POST /b` → scripts/ai-context/cenarios.mjs
- `POST /b` → scripts/ai-context/cenarios.mjs
- `DELETE /c` → scripts/ai-context/cenarios.mjs
- `PUT /d` → scripts/ai-context/cenarios.mjs
- `GET /items` → scripts/ai-context/gerar.unit.mjs
- `GET /u` → scripts/ai-context/cenarios.mjs
- `GET /users` → scripts/ai-context/cenarios.mjs
- `POST /users/:id` → scripts/ai-context/cenarios.mjs
- `GET /x` → scripts/ai-context/cenarios.mjs

## Vistas por id (menu/ViewRouter → arquivo)
- (nenhum)

## Edge functions
- `admin-list-companies` (verify_jwt=false) — tabelas: companies; chamada por 1 arquivo(s) do front
- `ai-agent` — tabelas: companies, ipc_config, scrape_jobs, workflows; chamada por 1 arquivo(s) do front
- `api-latency-alerts` — tabelas: -; chamada por 0 arquivo(s) do front — **ÓRFÃ**
- `audit-logs-prune` — tabelas: api_request_logs, audit_logs, email_sync_log, health_checks; chamada por 0 arquivo(s) do front — **ÓRFÃ**
- `auth-rate-limit` — tabelas: auth_rate_limits; chamada por 1 arquivo(s) do front
- `campaign-dispatch` — tabelas: campaign_messages, campaign_recipients, campaigns, email_accounts, email_suppressions; chamada por 1 arquivo(s) do front
- `circuit-breaker-alerts` — tabelas: -; chamada por 0 arquivo(s) do front — **ÓRFÃ**
- `cnpj-enrich` — tabelas: cnpj_enrich_cache, cnpj_enrich_queue; chamada por 0 arquivo(s) do front — **ÓRFÃ**
- `cnpj-enrich-worker` — tabelas: cnpj_enrich_cache, cnpj_enrich_queue; chamada por 0 arquivo(s) do front — **ÓRFÃ**
- `cnpj-settings-status` — tabelas: cnpj_enrich_cache, cnpj_enrich_queue, cnpj_enrich_rate_state; chamada por 0 arquivo(s) do front — **ÓRFÃ**
- `deliverability-check` — tabelas: -; chamada por 0 arquivo(s) do front — **ÓRFÃ**
- `dlq-alerts` — tabelas: dlq_alert_history, dlq_alert_settings, dlq_health_snapshots, notifications, organization_members; chamada por 0 arquivo(s) do front — **ÓRFÃ**
- `email-oauth-callback` — tabelas: email_accounts; chamada por 1 arquivo(s) do front
- `email-oauth-connect` — tabelas: -; chamada por 2 arquivo(s) do front
- `email-oauth-disconnect` — tabelas: audit_logs, email_accounts; chamada por 1 arquivo(s) do front
- `email-poll-replies` — tabelas: email_accounts, email_sync_log; chamada por 1 arquivo(s) do front
- `email-verify` — tabelas: -; chamada por 0 arquivo(s) do front — **ÓRFÃ**
- `gmaps-places-search` — tabelas: -; chamada por 0 arquivo(s) do front — **ÓRFÃ**
- `gmaps-proxy` — tabelas: companies, idempotency_keys, ipc_config, notifications, org_proxies, scrape_jobs, scrape_results; chamada por 1 arquivo(s) do front
- `health` — tabelas: health_checks, organizations; chamada por 0 arquivo(s) do front — **ÓRFÃ**
- `instagram-connection-status` — tabelas: -; chamada por 1 arquivo(s) do front
- `instagram-dlq-replay` — tabelas: organization_members; chamada por 0 arquivo(s) do front — **ÓRFÃ**
- `instagram-enqueue` — tabelas: instagram_scrape_queue, organization_members; chamada por 0 arquivo(s) do front — **ÓRFÃ**
- `instagram-worker` — tabelas: instagram_scrape_dead_letter, instagram_scrape_queue, instagram_scrape_results; chamada por 0 arquivo(s) do front — **ÓRFÃ**
- `instagram-worker-health` — tabelas: instagram_scrape_dead_letter, instagram_scrape_queue; chamada por 0 arquivo(s) do front — **ÓRFÃ**
- `latency-alerts` — tabelas: api_latency_alert_history, api_latency_alert_settings, api_latency_snapshots, notifications, organization_members; chamada por 0 arquivo(s) do front — **ÓRFÃ**
- `lusha-cookie-health` — tabelas: -; chamada por 0 arquivo(s) do front — **ÓRFÃ**
- `lusha-decision-makers` — tabelas: lusha_contacts, organization_members; chamada por 1 arquivo(s) do front
- `lusha-reveal` — tabelas: -; chamada por 0 arquivo(s) do front — **ÓRFÃ**
- `lusha-search` — tabelas: audit_logs, lusha_contacts, lusha_search_sessions, notifications; chamada por 0 arquivo(s) do front — **ÓRFÃ**
- `mcp` — tabelas: companies, lusha_contacts, scrape_jobs; chamada por 0 arquivo(s) do front — **ÓRFÃ**
- `migrate-helper` (verify_jwt=false) — tabelas: -; chamada por 0 arquivo(s) do front
- `oracle-cookies-preflight` — tabelas: automation_execution_logs; chamada por 0 arquivo(s) do front — **ÓRFÃ**
- `oracle-enrich-contact` — tabelas: lusha_contacts; chamada por 0 arquivo(s) do front — **ÓRFÃ**
- `oracle-push-bitrix` — tabelas: lusha_contacts, lusha_search_sessions; chamada por 0 arquivo(s) do front — **ÓRFÃ**
- `oracle-search-decisors` — tabelas: companies, lusha_contacts, lusha_search_sessions; chamada por 0 arquivo(s) do front — **ÓRFÃ**
- `org-violation-alerts` — tabelas: notifications, org_violation_alerts, organization_members, webhook_deliveries, webhooks; chamada por 1 arquivo(s) do front
- `pg-net-watchdog` — tabelas: notifications, pg_net_health_snapshots, user_roles; chamada por 0 arquivo(s) do front — **ÓRFÃ**
- `public-api` — tabelas: api_keys, api_request_logs; chamada por 1 arquivo(s) do front
- `purge-soft-deleted` — tabelas: -; chamada por 0 arquivo(s) do front — **ÓRFÃ**
- `qa-ingest-run` (verify_jwt=false) — tabelas: qa_test_runs; chamada por 1 arquivo(s) do front
- `reaper-alerts` — tabelas: notifications, qa_reaper_runs, reaper_alert_history, reaper_alert_settings, user_roles; chamada por 0 arquivo(s) do front — **ÓRFÃ**
- `retry-policy-tuner` — tabelas: automation_execution_logs, retry_policy_advisories, web_scrape_queue; chamada por 0 arquivo(s) do front — **ÓRFÃ**
- `rls-tests` — tabelas: audit_logs, companies, organization_members, organizations, profiles, workflows; chamada por 0 arquivo(s) do front — **ÓRFÃ**
- `scrape-queue-worker` — tabelas: feature_flags, scrape_jobs; chamada por 0 arquivo(s) do front — **ÓRFÃ**
- `sla-alerts` — tabelas: notifications, sla_alert_history, sla_alert_settings, user_roles; chamada por 0 arquivo(s) do front — **ÓRFÃ**
- `sla-auto-tune` — tabelas: notifications, organization_members, sla_autotune_runs, user_roles; chamada por 0 arquivo(s) do front — **ÓRFÃ**
- `system-recovery-status` — tabelas: -; chamada por 0 arquivo(s) do front — **ÓRFÃ**
- `track-click` — tabelas: -; chamada por 0 arquivo(s) do front — **ÓRFÃ**
- `track-open` — tabelas: -; chamada por 0 arquivo(s) do front — **ÓRFÃ**
- `vault-cookie-health` — tabelas: -; chamada por 1 arquivo(s) do front
- `web-dlq-replay` — tabelas: organization_members; chamada por 0 arquivo(s) do front — **ÓRFÃ**
- `web-scrape-enqueue` — tabelas: organization_members, web_scrape_queue; chamada por 0 arquivo(s) do front — **ÓRFÃ**
- `web-scrape-extract` — tabelas: feature_flags, web_scrape_queue, web_scrape_results; chamada por 0 arquivo(s) do front — **ÓRFÃ**
- `web-scrape-status` — tabelas: web_scrape_queue, web_scrape_results; chamada por 0 arquivo(s) do front — **ÓRFÃ**
- `web-scrape-worker` — tabelas: automation_execution_logs, feature_flags, robots_cache, web_scrape_results; chamada por 0 arquivo(s) do front — **ÓRFÃ**
- `webhook-dispatcher` — tabelas: webhook_deliveries, webhooks; chamada por 1 arquivo(s) do front
- `workflow-engine` — tabelas: audit_logs, automation_alerts, automation_steps, companies, ipc_config, organization_members, scrape_jobs, scrape_results, workflow_runs, workflows; chamada por 1 arquivo(s) do front

## Cron jobs (pg_cron / vercel)
- `capture-db-health` */5 * * * * (20260712183806_e5a47f1b-5acb-4925-8862-6b201a553e15.sql)
- `daily-campaign-logs-retention` 30 3 * * * (20260721225949_e0ca6ffa-efa2-4bd0-a116-c6425eb821cd.sql)
- `daily-log-retention` 15 3 * * * (20260721225851_96d1133c-350c-4bd1-be9c-96de97456af1.sql)
- `evaluate-partition-policies-daily` 17 3 * * * (20260712184705_499e82f4-33c4-443a-82b6-21735caafc4b.sql)
- `pg-net-snapshots-prune-weekly` 0 3 * * 0 (20260722123959_e7c39e43-b1a2-4861-a445-6343f477981a.sql)
- `reap-stuck-queue-tasks` * * * * * (20260723134028_4f3b5c29-1e04-4d63-95d1-2bb0f069e917.sql)

## Integrações externas
- SDKs: Supabase, react-query, zod
- hosts mais citados: lux-ai-company-finder.lovable.app, 2e7d5f34-c492-42bd-a233-a5b01098f9b4.lovableproject.com, id-preview--2e7d5f34-c492-42bd-a233-a5b01098f9b4.lovable.app, lux-ai-finder.lovable.app, linkedin.com, supabase.atomicabr.com.br, br.linkedin.com, gmaps.atomicabr.com.br, graph.microsoft.com, login.microsoftonline.com, oauth2.googleapis.com, www.linkedin.com, ai.gateway.lovable.dev, connector-gateway.lovable.dev, nominatim.openstreetmap.org
- webhooks recebidos: admin-list-companies, migrate-helper, qa-ingest-run
- env de integração (só nomes): ADMIN_LIST_TOKEN, APIFY_API_KEY, APIFY_TOKEN, APOLLO_API_KEY, BITRIX_WEBHOOK_BASE, BRIGHTDATA_API_TOKEN, CNPJA_API_KEY, GMAPS_OMKAR_API_KEY, GOOGLE_MAPS_API_KEY, GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET, HIKER_API_KEY, LOVABLE_API_KEY, LUSHA_API_KEY, MS_OAUTH_CLIENT_ID, MS_OAUTH_CLIENT_SECRET, QA_INGEST_TOKEN, TRACKING_SIGNING_SECRET, VITE_ADMIN_LIST_TOKEN

## Permissões / papéis
- papéis no código: admin (11), alert (11), status (10), button (4), dialog (4), user (4), group (3), main (3), CTO (2), agent (2), navigation (2), presentation (2), region (2), system (2), CEO (1), CFO (1), img (1), link (1), listitem (1), member (1), menu (1), progressbar (1), sdr (1), separator (1), sup (1), viewer (1)
- enums de papel: app_role: admin|moderator|sdr|viewer
- guards: nenhum · rotas protegidas: 5 · públicas: /*, /invite/:token, /login, /reset-password
- feature flags: FEATURE_X, nova-tela, novo-inbox, oracle_v2

## Alertas (baseline.json → alertas)
- rotas_sem_arquivo: 0
- componentes_ambiguos: 0
- menu_sem_destino: 24 — ex.: Agente IA -> ai-agent, Analytics -> analytics, API & Webhooks -> integrations
- edges_orfas: 40 — ex.: api-latency-alerts, audit-logs-prune, circuit-breaker-alerts
- edges_chamadas_sem_pasta: 0
- tabelas_sem_rls: 0
- tabelas_usadas_sem_definicao: 0
- tabelas_com_drift_migration_vs_types: 6 — ex.: audit_logs, circuit_breakers, feature_flags
- rpcs_sem_definicao: 0
- componentes_orfaos: 20 — ex.: src/components/auth/MFAEnroll.tsx, src/components/auth/MFAVerify.tsx, src/components/lux/LuxImage.tsx
- componentes_com_nome_duplicado: 2 — ex.: Sidebar, Toaster
- scripts_orfaos: 9 — ex.: scripts/gen-current-report.ts, scripts/gen-legacy-baseline.ts, scripts/gen-round19-validation.ts
- env_usadas_nao_declaradas: 8 — ex.: DEV, PROD, SUPABASE_PUBLISHABLE_KEY
- ciclos_de_import: 5
- possiveis_segredos_no_codigo: 4 — ex.: e2e/helpers/supabase.ts:7, scripts/ai-context/cenarios.mjs:102, supabase/functions/_shared/__tests__/lusha-client.test.ts:31

## Grafo de código (graphify)
- 6133 nós · 13093 arestas · 550 comunidades · grafo do commit `4d5d4ee3`
- comunidades maiores: lucide-react (116), button.tsx (112), CampaignsView.tsx (92), cn (91), OAuthSandboxPanel.tsx (87), badge.tsx (85), vitest (82), simulator.ts (82), gerar.mjs (81), react (78), withOrg.ts (77), generate.py (73)
- símbolos mais chamados: cn() (src/lib/utils.ts), useAuth() (src/contexts/auth-context.ts), q() (scripts/supabase_snapshot/snapshot.py), useActiveOrganization() (src/contexts/active-org-context.ts), useDemo() (src/contexts/demo-context.ts), .collect() (scripts/supabase_snapshot/test_snapshot.py), excluded_sql() (scripts/supabase_snapshot/snapshot.py), useToast() (src/hooks/use-toast.ts), getActiveOrgId() (src/integrations/supabase/withOrg.ts), .metadata() (scripts/supabase_snapshot/test_snapshot.py), header() (scripts/regras_negocio/generate.py), uniq() (scripts/ai-context/gerar.mjs)
- consulta local: `graphify query "<pergunta>"`, `graphify path "<A>" "<B>"`, `graphify explain "<X>"`

## Hotspots (arquivos mais alterados, 90 dias)
- AGENTS.md (5)
- docs/estado/05-infra-ci-testes.md (3)
- docs/ESTADO_ATUAL.md (2)
- docs/agentes/banco.md (2)
- docs/agentes/github-ci.md (2)
- docs/estado/02-backend-edge-functions.md (2)
- docs/estado/03-dados-e-runtime.md (2)
- package.json (2)
- supabase/config.toml (2)
- supabase/functions/migrate-helper/index.ts (2)
- .claude/ecc-tools.json (1)
- .claude/homunculus/instincts/inherited/promo-lux-v2-instincts.yaml (1)
- .claude/hooks/session-start.sh (1)
- .claude/identity.json (1)
- .claude/settings.json (1)

## Workflows
- `ci.yml` — ci.yml ()
- `contexto.yml` — Contexto para agentes de IA (10 min) (push, schedule, workflow_dispatch; cron 3-59/10 * * * *)
- `db-migrations.yml` — Database Migrations (pull_request, push, workflow_dispatch)
- `edge-tests-daily.yml` — Edge Functions Daily Tests (Deno) (pull_request, schedule, workflow_dispatch; cron 0 7 * * *)
- `inventario-estado-semanal.yml` — Inventário do estado real (semanal) (schedule, workflow_dispatch; cron 23 10 * * 1)

## Scripts npm
- `dev`: `vite`
- `build`: `vite build && (npm run generate-audit-pdf || echo 'PDF de auditoria não gerado (requer bun) — build principal (dist/) já concluiu com sucesso')`
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
- `contexto:supabase`: `python3 scripts/supabase_snapshot/snapshot.py`
- `inventario:edges`: `node scripts/inventario/gerar-repo.mjs`

## Documentos (raiz e docs/)
- `AGENTS.md` — AGENTS.md — Promo Lux V2 (LUX IA) (157 linhas)
- `CHANGELOG.md` — Changelog (53 linhas)
- `CLAUDE.md` (2 linhas)
- `CONTRIBUTING.md` — 📐 Guia de Contribuição — LUX IA (29 linhas)
- `README.md` — LUX IA — Sistema de Prospecção B2B Inteligente (280 linhas)
- `docs/AUDITORIA_BACKEND_SENIOR.md` — Auditoria Back-End Sênior — LUX IA (136 linhas)
- `docs/AUDITORIA_FINAL_LUX_IA.md` — 📝 Relatório de Auditoria Enterprise — LUX IA (v10.0) (89 linhas)
- `docs/AUDITORIA_FIRECRAWL.md` — Auditoria de Paridade — LUX IA vs Firecrawl (199 linhas)
- `docs/ESTADO_ATUAL.md` — ESTADO ATUAL DO SISTEMA — LUX IA (297 linhas)
- `docs/FUNCIONALIDADES.md` — LUX IA — Análise Executiva de Funcionalidades (455 linhas)
- `docs/GAPS-ENTERPRISE.md` — LUX IA — Gaps Enterprise (408 linhas)
- `docs/LGPD.md` — 🛡️ Relatório de Conformidade LGPD — LUX IA (45 linhas)
- `docs/LUSHA-INTEGRATION.md` — Lusha Intelligence — Integração LUX (181 linhas)
- `docs/ORACLE_V2.md` — Oracle v2 — Runbook (123 linhas)
- `docs/apify-mock-mode.md` — Apify Mock Mode (Dev / E2E) (51 linhas)
- `docs/auditoria-backend-2026-07-12.md` — Auditoria Profunda de Back-End — LUX IA (106 linhas)
- `docs/auth.md` (1 linhas)
- `docs/edge-functions.md` — Edge Functions — Documentação (202 linhas)
- `docs/erd.md` — 🗺️ Diagrama Entidade-Relacionamento (ERD) (78 linhas)
- `docs/pesquisa-oss-linkedin-enrichment.md` — Levantamento OSS — Descoberta de Email/Telefone a partir do LinkedIn (184 linhas)
- `docs/schema-tabelas-principais.md` — Schema das Tabelas Principais — LUX IA (1189 linhas)
- `docs/webhooks.md` — Webhooks — Guia de Integração (115 linhas)
- subpastas de docs/: docs/adr (29), docs/agentes (6), docs/estado (5), docs/runbooks (3), docs/contexto (1)
- CHANGELOG topo: [Unreleased] - 2026-07-22

## Últimos commits
- 2026-11-08 `4d5d4ee` feat(contexto): scripts autônomos de estado real portados do Zapp Web V2 (#8)
- 2026-11-08 `c8970a8` fix(docs): propaga contagem correta de migrations base64 (6) para github-ci.md e 05-infra-ci-testes.md
- 2026-11-08 `4f78795` fix(banco): corrige contagem de migrations base64 de 4 para 6
- 2026-11-08 `c9b89ab` docs(agentes): replica padrao de instrucoes de agentes do Zapp Web V2 (#5)
- 2026-08-28 `2b5a84f` Visual edit in Lovable
- 2026-08-28 `20373df` Visual edit in Lovable
- 2026-08-18 `c88dc8a` chore(hermes): adiciona .hermes.md (regras da casa Hermes)
- 2026-08-18 `ee80ee4` chore(agents): adiciona AGENTS.md padrao (contexto multi-agente)
- 2026-08-16 `97bb6fb` Merge pull request #4 from adm01-debug/claude/system-status-roadmap-gzt829
- 2026-08-16 `9f9f678` docs: errata da auditoria apos segunda rodada de validacao adversarial
- 2026-08-16 `8e6172d` docs: auditoria de estado do sistema (ESTADO_ATUAL + 5 anexos)
- 2026-08-11 `890c18d` security: remove migrate-helper edge function (exposes service_role key)
- 2026-08-01 `bbe286c` merge: master para main
- 2026-08-01 `4e21608` feat: Migração Banco Lovable para Supabase Promo Lux - V2
- 2026-07-30 `7155047` Visual edit in Lovable

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
