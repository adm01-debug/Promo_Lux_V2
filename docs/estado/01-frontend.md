# Dimensão 1 — Frontend / Apresentação

> Anexo de [`../ESTADO_ATUAL.md`](../ESTADO_ATUAL.md) · Commit `890c18d` · 2026-08-16
> **Método:** enumeração de 100% das rotas e views a partir de `src/lib/viewRegistry.ts` e `src/App.tsx`.
> Classificação por evidência de dado real em produção (leitura de banco `VERIFICADO`).

**Escopo medido:** 460 arquivos / 71.309 linhas em `src/`, dos quais `src/components/lux/` concentra 227 arquivos / 40.721 linhas.

**Total: 29 itens** — ✅ 11 · 🟨 13 · 🟦 4 · ⬛ 1

---

## 1. Arquitetura de navegação

A aplicação é uma SPA com **9 rotas** (`src/App.tsx:148-157`) e **23 views** internas comutadas por `?view=` sobre a rota `/` (`src/lib/viewRegistry.ts:9-33`). Todas as 23 views estão registradas em `VIEW_MAP` e são alcançáveis — **não há view órfã**.

| Rota | Arquivo | Proteção | Status |
|---|---|---|---|
| `/login` | `src/pages/Login.tsx` | `PublicRoute` | ✅ |
| `/` | `src/pages/Index.tsx` (host das 23 views) | `ProtectedRoute` | ✅ |
| `/monitoring` | `src/pages/Monitoring.tsx` | `ProtectedRoute` | ✅ |
| `/settings/cnpj` | `src/pages/CnpjSettingsPage.tsx` | `ProtectedRoute` | ✅ |
| `/admin/companies` | `src/pages/AdminCompanies.tsx` | `ProtectedRoute` | ✅ |
| `/reset-password` | `src/pages/ResetPassword.tsx` | pública | ✅ |
| `/invite/:token` | `src/pages/AcceptInvite.tsx` | pública | 🟨 `organization_invites` = **0 linhas** |
| `/.lovable/oauth/consent` | `src/pages/OAuthConsent.tsx` | pública | 🟨 NAO_VERIFICADO |
| `*` | `src/pages/NotFound.tsx` | — | ✅ |

---

## 2. As 23 views — classificação com evidência

Coluna "dado em produção" = leitura direta de `pg_stat_user_tables` no projeto `pttzwlbidamibjssqiqb` (`VERIFICADO` em 2026-08-16).

| # | View | Componente (`viewRegistry.ts`) | Dado em produção | Classe | O que exatamente falta |
|---:|---|---|---|:---:|---|
| 1 | Dashboard | `lux/DashboardView` (L10) | `companies` 5, `deals` 6 | ✅ | — |
| 2 | Config. IPC/ICP | `lux/ICPConfigView` (L11) | `ipc_config` **0** | 🟨 | UI e hook `useICPConfig.ts` existem; **nenhuma configuração jamais salva** |
| 3 | Workflows | `lux/WorkflowsView` (L12) | `workflows` 6, `workflow_runs` 23 | ✅ | — |
| 4 | Empresas | `lux/CompaniesView` (L13) | `companies` 5 | ✅ | — |
| 5 | Sinais de Intenção | `lux/IntentSignalsView` (L14) | `intent_signals` 12 | ✅ | — |
| 6 | Campanhas | `lux/CampaignsView` (L15) | `campaigns` 3; `campaign_recipients` **0**, `campaign_messages` **0**, `campaign_events` **0**, `campaign_replies` **0** | 🟨 | 3 campanhas criadas, **nenhuma jamais disparada**. Métricas quebradas — ver [`02`](./02-backend-edge-functions.md) §3 |
| 7 | Agente IA | `lux/AIAgentView` (L16) | `agent_chat_messages` **0** | 🟨 | Function `ai-agent` (200 L) e 10 referências no front; **nenhuma conversa persistida** |
| 8 | Analytics | `lux/AnalyticsView` (L17) | deriva de tabelas majoritariamente vazias | 🟨 | Renderiza, mas as séries dependem de `campaign_events`/`api_request_logs` = 0 |
| 9 | Configurações | `lux/SettingsView` (L18) | `feature_flags` 6, `profiles` 2 | ✅ | — |
| 10 | GMaps Scraper | `lux/GmapsScraperView` (L19) | `scrape_jobs` 1, `scrape_queue` 32, `scrape_results` **0** | 🟨 | Fila processa (cron 24.919 sucessos) mas `scrape_results` nunca recebeu linha |
| 11 | Resultados de Raspagem | `lux/ScrapeResultsView` (L20) | `scrape_results` **0** | 🟦 | Tela existe, tabela-fonte **sempre vazia** |
| 12 | Mapa de Empresas | `lux/CompaniesMapView` (L21) | `companies` 5 | 🟨 | Renderiza; cobertura de geocoding `NAO_VERIFICADO` |
| 13 | Stakeholder Finder | `lux/StakeholderFinderView` (L22) | `stakeholders` 8 | ✅ | — |
| 14 | Organizações | `lux/OrganizationsView` (L23) | `organizations` 6, `organization_members` 6, `organization_invites` **0** | 🟨 | Fluxo de convite (`InviteSection.tsx`, `/invite/:token`) **nunca exercitado** |
| 15 | Deals / CRM | `lux/DealsView` (L24) | `deals` 6, `deal_stages` 20; `deal_activities` **0**, `deal_tasks` **0** | 🟨 | Pipeline funciona; atividades e tarefas nunca usadas |
| 16 | API & Webhooks | `lux/IntegrationsView` (L25) | `webhooks` 1, `webhook_deliveries` 63; `api_keys` **0**, `email_accounts` **0**, `oauth_sandbox_snapshots` **0** | 🟨 | 5 abas (`IntegrationsView.tsx:24-28`); só a de Webhooks tem lastro |
| 17 | Violações de Org | `lux/OrgViolationsView` (L26) | `org_violation_alerts` **0**, `org_violation_alert_settings` **0** | 🟦 | Tela + function `org-violation-alerts` (257 L); **zero violação registrada** |
| 18 | RLS Discovery | `lux/settings/RLSDiscoveryView` (L27) | 255 policies, 95/95 tabelas com RLS | ✅ | — |
| 19 | Monitoring | `lux/monitoring/MonitoringView` (L28) | `db_health_snapshots` **4.982** | ✅ | — |
| 20 | Automações Realtime | `lux/automations/AutomationsRealtimeView` (L29) | `automation_steps` **0**, `automation_execution_logs` **0**, `automation_alerts` **0** | 🟦 | Módulo inteiro sem uma única execução |
| 21 | Lixeira | `lux/RecycleBinView` (L30) | cron `purge-soft-deleted-daily` 17 sucessos | 🟨 | Expurgo roda; volume de soft-delete `NAO_VERIFICADO` |
| 22 | Supressões de E-mail | `lux/EmailSuppressionsView` (L31) | `email_suppressions` **0** | 🟦 | Tela + hook `useEmailSuppressions.ts`; tabela nunca populada |
| 23 | Lusha Intelligence | `lux/LushaIntelligenceView` (L32) | `lusha_contacts` 12, `lusha_search_sessions` 1; `lusha_credit_usage_log` **0**, `lusha_dm_search_history` **0** | 🟨 | Busca funcionou; **controle de crédito e histórico de decisores nunca gravaram** |

**Subtotal views (23):** ✅ 8 · 🟨 11 · 🟦 4 · ⬛ 0

---

## 3. Recursos transversais

| # | Recurso | Evidência | Classe | Observação |
|---:|---|---|:---:|---|
| 24 | Autenticação + MFA | `src/contexts/AuthContext.tsx`, `src/hooks/useMFA.ts`, `auth.users` = 8 | ✅ | — |
| 25 | Realtime (canais privados) | `useRealtimeCompanies.ts`, `useRealtimeScrapeJobs.ts`, `useRealtimeJobDetails.ts`; schema `realtime` com 7 tabelas | ✅ | — |
| 26 | Command Palette + atalhos | `lux/command-palette/`, `useKeyboardShortcuts.ts`, `Index.tsx:128` | ✅ | — |
| 27 | RBAC / permissões | `src/hooks/usePermissions.ts`, tabela `user_roles` = **1 linha** | 🟨 | Um único papel atribuído em 8 usuários; enforcement declarativo ausente (item 29) |
| 28 | PWA / offline / service worker | `public/` (26 arquivos, 15.261 linhas) | 🟨 | **`NAO_VERIFICADO`** — exigiria execução em navegador |
| 29 | `PermissionGate` | `src/components/lux/permissions/PermissionGate.tsx:17` | ⬛ | **Exportado, usado por ninguém** — ver §4 |

**Subtotal transversais (6):** ✅ 3 · 🟨 2 · 🟦 0 · ⬛ 1

---

## 4. Código morto — critério de detecção testado

O prompt alerta contra listas de "candidato a remover" com falso-negativo. **Testei o critério antes de endossar a lista.**

Critério aplicado a 125 componentes `.tsx` de `src/components/lux/`: o basename do arquivo aparece em algum import de `src/`, excluindo o próprio arquivo. Resultado bruto: **4 órfãos**.

Três eram **falso-positivo do critério**, e por isso foram descartados:

| Arquivo | Por que NÃO é morto |
|---|---|
| `lusha/DecisionMakersGrid.test.tsx` | Arquivo de teste — testes nunca são importados por código de produção |
| `lusha/SessionsPanel.test.tsx` | idem |
| `lusha/StatusBadge.test.tsx` | idem |

Sobrou **1 candidato real**, confirmado por verificação independente:

**`src/components/lux/permissions/PermissionGate.tsx:17`** — `export const PermissionGate = ({ entity, action, children, fallback = null })`.
- `grep -rn "PermissionGate" src/ --include="*.tsx" --include="*.ts"` excluindo o próprio arquivo → **zero ocorrências**.
- Não há barril: `ls src/components/lux/permissions/` retorna apenas `PermissionGate.tsx` e `PermissionsMatrix.tsx`.
- **Classificação: ⬛ MORTO_OU_ABANDONADO.**

**Leitura de negócio:** o gate declarativo de permissões foi projetado e nunca adotado. Combinado com `user_roles` = 1 linha, sugere que o RBAC existe no modelo de dados mas não é aplicado na UI.

---

## 5. Lacunas desta dimensão

- Os **285 componentes** e **84 hooks** foram inventariados por altitude (existência, importador, tabela consumida). **Não foram lidos linha a linha.**
- Renderização, acessibilidade e comportamento responsivo: **`NAO_VERIFICADO`** — nenhum navegador foi executado.
- A coluna "dado em produção" prova **dormência**, não prova ausência de bug: uma tela com dado pode estar exibindo o dado errado. Isso está fora do escopo desta auditoria.
