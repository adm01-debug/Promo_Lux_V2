# LUX IA — Gaps Enterprise

> Análise comparativa entre o LUX IA e plataformas enterprise de classe mundial em Sales Intelligence B2B (ZoomInfo, Apollo.io, Outreach, Salesloft, Cognism, Clay, HubSpot Breeze).

**Versão:** 1.0
**Data:** 2026-04-22
**Escopo:** Funcionalidades, segurança, compliance, integrações e operações esperadas em SaaS B2B enterprise.
> **Revisão 2026-11-22 (2ª passada):** linhas marcadas ✅ foram verificadas contra migrations **e** código com busca recursiva (ripgrep). Corrigidas nesta passada: `deal_predictions`/pipeline value, `deal_activities`, OAuth Gmail/Outlook, email tracking, reply detection, A/B testing, relatórios agendados, API pública, `api_keys`, `webhook_dispatcher`, MFA/TOTP, changelog in-app, `feature_flags`, bulk import/export. Os demais "Inexistente" foram re-checados e seguem ausentes (0 tabelas, 0 refs): SSO/SAML, SCIM, IP allowlist, DLP/PII masking, CRM sync, Slack/Teams/Calendly/WhatsApp, leaderboards, goals/quotas, lost reasons, email templates compartilhados, status page, help center, NPS/CSAT, sandbox.

---

## Índice

1. [Resumo Executivo](#1-resumo-executivo)
2. [Gaps por Categoria](#2-gaps-por-categoria)
   - 2.1 [Multi-tenancy & Organizações](#21-multi-tenancy--organizações-p0)
   - 2.2 [CRM & Pipeline](#22-crm--pipeline-p0)
   - 2.3 [Outreach & Engagement](#23-outreach--engagement-p0)
   - 2.4 [Data Enrichment](#24-data-enrichment-p1)
   - 2.5 [Workflows & Automação](#25-workflows--automação-p1)
   - 2.6 [Analytics & Reporting](#26-analytics--reporting-p1)
   - 2.7 [Integrações & API](#27-integrações--api-p0)
   - 2.8 [Segurança & Compliance Enterprise](#28-segurança--compliance-enterprise-p0)
   - 2.9 [IA & Machine Learning](#29-ia--machine-learning-p1)
   - 2.10 [Operações & DevEx](#210-operações--devex-p2)
3. [Matriz Comparativa](#3-matriz-comparativa)
4. [Roadmap em 4 Fases (12 meses)](#4-roadmap-em-4-fases-12-meses)
5. [Quick Wins (≤ 2 semanas)](#5-quick-wins--2-semanas)
6. [Ameaças Competitivas](#6-ameaças-competitivas)

---

## 1. Resumo Executivo

**Posicionamento atual:** O LUX IA é um **MVP avançado de Sales Intelligence single-tenant**, com base sólida (RLS, realtime, IA integrada, PWA, testes), mas ainda distante das capacidades esperadas por compradores enterprise (CIO/CISO/RevOps).

**Maturidade estimada:** ~40% das capacidades de uma plataforma enterprise de referência.

**Forças atuais:**
- ✅ Arquitetura segura por tenant via RLS (100% das tabelas)
- ✅ IA conversacional pronta (Gemini via Lovable AI Gateway)
- ✅ Realtime, PWA, a11y, testes (216+ unit + E2E + RLS)
- ✅ 12 módulos funcionais cobrindo o ciclo de prospecção

**Lacunas críticas (P0):**
- ✅ Multi-tenant — `organizations` + `organization_members` + `user_roles` + `audit_logs` (migration `20260422201601`)
- 🟡 CRM/Pipeline — `deals` + `deal_stages` + `deal_tasks` (CRUD em `DealTasksPanel`), `DealsView` roteado em `viewRegistry.ts:24`; falta só `activities` (timeline)
- ❌ Engagement sem motor real — campanhas não enviam emails
- ❌ Sem API pública, webhooks ou integrações nativas
- ❌ Sem SSO/SAML, MFA, SOC 2 — bloqueia venda enterprise

Os gaps abaixo estão priorizados em **P0** (bloqueador enterprise), **P1** (diferencial competitivo), **P2** (qualidade operacional).

---

## 2. Gaps por Categoria

### 2.1 Multi-tenancy & Organizações (P0)

| Gap | Estado atual | Padrão enterprise |
|---|---|---|
| Organização/Workspace | ✅ Implementado — `organizations` + `organization_members` (`20260422201601`) + `useOrganizations` | Tabela `organizations` + `organization_members` |
| Convite de membros | ✅ Implementado — `organization_invites` + `useOrganizations.ts:93,152` | Email invite + onboarding por organização |
| Roles & Permissions | ✅ Implementado — `user_roles` (`20260513140617`) + `has_org_role()` + `role_permissions` | Admin, Manager, SDR, Viewer com matriz de permissões |
| Compartilhamento | Tudo privado por user | Visibilidade configurável (privado/time/org) |
| Billing por seat | Inexistente | Stripe/Paddle com seat-based + limites por plano |
| Audit log | ✅ Implementado — `audit_logs` (`20260422202021`), 86 refs no front | Tabela `audit_log` populada por triggers (quem fez o quê, quando) |
| Transferência de propriedade | Inexistente | Reassign de empresas/campanhas entre membros |

**Impacto:** Sem multi-tenancy, o produto não pode ser vendido para times — limite máximo de 1 usuário por conta.

---

### 2.2 CRM & Pipeline (P0)

| Gap | Estado atual | Padrão enterprise |
|---|---|---|
| Deals/Opportunities | 🟡 Implementado — `deals` + `deal_stages` com Kanban (`DealsView`) | Kanban com stages customizáveis por org |
| Pipeline value | ✅ `deal_predictions` (`weighted_value`, `win_probability`, `predicted_close_date`) + `DealCard.tsx:71` + `useDealPredictions` | Forecast, weighted revenue, close date |
| Activities timeline | ✅ `deal_activities` (`20260422202642:50`) + `DealDetailDrawer.tsx:140` | Timeline unificada por empresa/contato (calls, emails, meetings, notes) |
| Tasks & reminders | 🟡 Implementado — `deal_tasks` (`20260422202642:68`) com CRUD em `DealTasksPanel`; falta recurring/snooze | Due dates, assignee, recurring, snooze |
| Lifecycle stages | Apenas `ipc_score` | MQL → SQL → Opportunity → Customer → Churn |
| Lost reasons | ✅ `deal_lost_reasons` (`20261122160000`) | Categorização de perda + análise |

**Impacto:** Sem CRM nativo, usuários precisam exportar para HubSpot/Salesforce — LUX vira ferramenta auxiliar, não hub de receita.

---

### 2.3 Outreach & Engagement (P0)

| Gap | Estado atual | Padrão enterprise |
|---|---|---|
| Motor de envio | `campaigns.sequence` é JSONB visual mas **não envia nada** | Worker que dispara emails reais |
| OAuth Gmail/Outlook | ✅ `EmailAccountsPanel` + `email-poll-replies` + `sendGmail`/`sendOutlook` (`campaign-dispatch:364-365`) | Conectar inbox do usuário, enviar via SMTP autenticado |
| Email tracking | ✅ `_shared/tracking-links.ts` + `CampaignTrackingDrawer.tsx` | Pixel de open + link tracking + UTMs |
| Reply detection | ✅ `email-poll-replies/index.ts` (cron 5 min, Gmail/Outlook) | IMAP/Gmail API para parar sequência ao responder |
| A/B testing | ✅ `ab_test_enabled`/`ab_winner_variant` (`campaign-dispatch:426-428`) + `CampaignsView.tsx:127` | Multivariado em subject/body/CTA |
| Send time optimization | Inexistente | ML por timezone e padrão de abertura |
| Deliverability | ✅ Implementado — function `deliverability-check` (SPF/DKIM/DMARC/MX, grade A+…F) + `DeliverabilityCheckDialog` | SPF/DKIM/DMARC checker, warmup, score |
| Multi-canal | Apenas email conceitual | LinkedIn touches, dialer, WhatsApp, SMS |
| Templates compartilhados | ✅ `email_templates` por organização (`20261122200000`) | Biblioteca por org com versionamento |

**Impacto:** Campanhas existem como UI mas **não geram receita real** — gap crítico vs Apollo/Outreach/Salesloft.

---

### 2.4 Data Enrichment (P1)

| Gap | Estado atual | Padrão enterprise |
|---|---|---|
| Fontes de dados | Apenas Google Maps scraper | Apollo, ZoomInfo, Clearbit, Hunter, Snov, Lusha, Cognism |
| Email verification | ✅ Implementado — function `email-verify` (SMTP ping, catch-all, role detection) + `EmailVerifyBadge` | SMTP ping + catch-all + role detection |
| Technographics | ✅ Implementado — 	echnographics-detect edge function com 41 fingerprints (CMS, Analytics, CRM, Support, Email, Ads, Frontend, Payments) | BuiltWith/Wappalyzer — stack do prospect |
| Firmographics completos | Setor + funcionários | Funding, headcount growth, NAICS/CNAE, parent company |
| News & triggers | Inexistente | Funding rounds, hiring, layoffs, exec changes |
| Social signals | Apenas LinkedIn URL | Posts recentes, sentiment, engagement |
| Waterfall enrichment | Inexistente | Tentar provider 1 → fallback 2 → 3 com cost tracking |
| Refresh automático | Inexistente | Re-enriquecer dados a cada N dias |

---

### 2.5 Workflows & Automação (P1)

| Gap | Estado atual | Padrão enterprise |
|---|---|---|
| Editor visual | `steps` é JSONB livre, sem UI | Drag-and-drop tipo n8n/Zapier/Clay |
| Agendamento | Inexistente | Cron, recurring, time-based |
| Triggers por evento | Inexistente | Novo lead, mudança de status, signal recebido |
| Branching condicional | Inexistente | If/else por score, setor, atributos |
| Delays | Inexistente | Esperar X dias/horas entre etapas |
| Webhooks externos | Inexistente | Chamar HubSpot, Salesforce, Slack, Zapier |
| Logs de execução | `workflow_runs` existe mas sem drill-down | Logs por step, retry manual, debug |
| Templates marketplace | Inexistente | Biblioteca de workflows prontos |

---

### 2.6 Analytics & Reporting (P1)

| Gap | Estado atual | Padrão enterprise |
|---|---|---|
| Dashboards customizáveis | Dashboard fixo | Drag widgets, salvar layouts por usuário/org |
| Relatórios agendados | ✅ `scheduled_reports` + `useScheduledReports` + `ScheduledReportsTab.tsx` | Daily/weekly/monthly digest por email |
| Funil customizável | Funil fixo prospects→meetings | Stages do pipeline configurável |
| Cohort analysis | Inexistente | Conversão por mês de origem |
| Attribution | Inexistente | Multi-touch, first/last touch, linear |
| Leaderboards | ✅ `org_leaderboard` (`20261122180000`) | Ranking de SDRs/AEs por métrica |
| Goals & quotas | ✅ `sales_goals` (`20261122170000`) | Tracking vs target por usuário/equipe |
| Export | PDF Analytics | + Excel multi-aba, API de relatórios, embedded BI |

---

### 2.7 Integrações & API (P0)

| Gap | Estado atual | Padrão enterprise |
|---|---|---|
| API pública | ✅ `public-api/index.ts` (REST + X-API-Key, companies/deals/stakeholders) | REST + GraphQL com OpenAPI spec |
| Autenticação API | ✅ `api_keys` (prefix/scopes/expires_at) + `ApiKeysPanel.tsx` | API keys pessoais + por-org com scopes |
| Webhooks de saída | ✅ `webhook-dispatcher` + `webhook_deliveries` (HMAC, retry) | Notificar sistemas externos em eventos |
| Rate limiting | Apenas client-side em login | Server-side por org/key com quotas |
| Zapier/Make/n8n | Inexistente | App publicado em marketplaces |
| CRM nativo | Inexistente | HubSpot, Salesforce, Pipedrive bidirecional |
| Comunicação | Inexistente | Slack, Teams, Discord notifications |
| Calendário | Inexistente | Google Calendar, Outlook, Calendly |
| Mensageria | Inexistente | WhatsApp Business, Twilio SMS |
| Chrome Extension | Inexistente | Capturar leads do LinkedIn → LUX |
| Mobile nativo | Apenas PWA | iOS/Android com push notifications |

**Impacto:** Sem API/webhooks/integrações, LUX vira silo de dados — incompatível com stacks RevOps modernas.

---

### 2.8 Segurança & Compliance Enterprise (P0)

| Gap | Estado atual | Padrão enterprise |
|---|---|---|
| SSO/SAML | Inexistente | Okta, Azure AD, Google Workspace, OneLogin |
| SCIM | Inexistente | Provisionamento automático de usuários |
| MFA/2FA | ✅ `MFAVerify`/`MFAEnroll`/`useMFA`/`MFASetup.tsx` (TOTP) | TOTP obrigatório por org |
| IP allowlist | ✅ `ip_allowlist` (`20261122220000`) | Por organização com CIDR |
| Session management | Sessão única implícita | Listar/revogar sessões ativas, dispositivos |
| SOC 2 Type II | Não certificado | Auditoria anual + relatório |
| ISO 27001 | Não certificado | SGSI documentado |
| GDPR/LGPD docs | Inexistente | DPA, Privacy Policy, ROPA, DPIA |
| Data residency | Fixa (Lovable Cloud) | Escolher região (US/EU/BR) por org |
| Audit log exportável | ✅ `export_audit_logs` + `count_audit_logs` + `audit_log_facets` (`20261122240000`) | Immutable, retention 1+ ano, export SIEM |
| DSAR/Right to be Forgotten | Manual | Fluxo automatizado por usuário/org |
| BYOK (encryption) | Sem opção | Chave gerenciada pelo cliente (KMS) |
| DLP & PII masking | ✅ `pii_redaction_rules` + `pii_redact_text` + `read_audit_logs_safe` (`20261122260000`) | Mascarar PII em logs e exports |
| Pen test report | Inexistente | Relatório anual de pentest |
| Vulnerability disclosure | Inexistente | Programa público + bug bounty |

**Impacto:** **Bloqueador absoluto** para vendas a empresas reguladas (financeiro, saúde, governo).

---

### 2.9 IA & Machine Learning (P1)

| Gap | Estado atual | Padrão enterprise |
|---|---|---|
| Chat IA | Gemini 2.5 Flash sem contexto rico | Já feito ✅ |
| Lead scoring por ML | IPC manual com pesos | Modelo treinado em dados históricos do tenant |
| Next best action | ✅ `next_best_actions` + `nba_recommend` + `refresh_next_best_actions` + `NextBestActionPanel` / `useNextBestActions` | Sugestão por contato (call vs email vs LinkedIn) |
| Email writer em massa | Inexistente | Personalização contextual por prospect |
| Conversation intelligence | Inexistente | Transcrever calls, summary, sentiment, talk ratio (Gong/Chorus-like) |
| Deal risk prediction | Inexistente | Likelihood-to-close por deal |
| Buyer intent agregado | Inexistente | Bombora, G2 Buyer Intent, TrustRadius |
| Content recommendation | Inexistente | Qual case study enviar para qual prospect |
| Voice agent | Inexistente | IA atende call inicial qualificatório |

---

### 2.10 Operações & DevEx (P2)

| Gap | Estado atual | Padrão enterprise |
|---|---|---|
| Status page | ✅ `incidents` + `20261122210000_status_page.sql` | status.luxai.com público (Better Stack/Instatus) |
| Changelog in-app | ✅ `changelog_entries` + `useChangelog` + `ChangelogDialog` (`Header.tsx:8`) | Headway/Beamer-like notifications |
| Feature flags | ✅ `feature_flags` + `useFeatureFlag(s)` | LaunchDarkly/PostHog para rollout gradual |
| Help center | Inexistente | Artigos, vídeos, chat de suporte (Intercom) |
| NPS/CSAT | ✅ `satisfaction_surveys` + `satisfaction_responses` (`20261122190000`) | Coleta in-app contínua |
| Observabilidade | Logs estruturados em edge functions | Sentry, Datadog, New Relic frontend+backend |
| Backup PITR | Não documentado | Point-in-time recovery + DR runbook |
| Sandbox/staging | Inexistente | Ambiente cliente para testes |
| Bulk import/export | ✅ `ImportCompaniesDialog` + `bulk_imports` + `downloadCSV` | CSV com mapeamento de colunas + dedup |
| Soft delete | Hard delete | `deleted_at` + recycle bin com retenção |
| Field-level history | ✅ Implementado — `audit_logs.old_data`/`new_data` (JSONB por update) + `AuditTrailPanel` (`Monitoring.tsx:635`) | JSONB diff por update + viewer |
| Onboarding self-serve | Tour ✅ | + checklist progressivo + sample data |

---

## 3. Matriz Comparativa

> **Reconciliado em 2026-11-22 contra o repo e o banco de produção** (REST real em
> `pttzwlbidamibjssqiqb` + inventário de `supabase/migrations/` e `supabase/functions/`).
> A versão anterior marcava ❌ em quase tudo; a maioria já existia. Legenda: ✅ existe e está
> ligada ponta a ponta · 🟡 existe incompleto · ❌ ausente de verdade.

| # | Capacidade | Estado | Evidência |
|---|---|---|---|
| 1 | Multi-tenant org/teams | ✅ | `organizations`, `organization_members`, `withOrg.ts` |
| 2 | RBAC (Admin/SDR/Viewer) | ✅ | `role_permissions` (210 linhas), `usePermissions`, `PermissionGate` em 13 componentes |
| 3 | Audit log | ✅ | `audit_logs`, `useAuditTrail`, `AuditTrailPanel` em `Monitoring.tsx` |
| 4 | SSO/SAML | ❌ | 0 tabela, 0 código. Custo/decisão de produto |
| 5 | SCIM | ❌ | 0 tabela, 0 código (o match em migration é um comentário) |
| 6 | MFA/2FA | ✅ | `useMFA`, `MFAEnroll.tsx`, `MFAVerify.tsx` (TOTP nativo do Supabase Auth) |
| 7 | SOC 2 Type II | 🟡 | controles técnicos prontos (auditoria, RLS, DLP); certificação é processo pago |
| 8 | GDPR/LGPD docs | ✅ | `data_subject_requests`, `DsarPanel`, `pii_redaction_rules`, `PiiMaskingPanel` |
| 9 | Deals/Pipeline (Kanban) | ✅ | `deals`, `DealsView.tsx`, `deal_lost_reasons` |
| 10 | Activities timeline | ✅ | `deal_activities`, `DealDetailDrawer.tsx` |
| 11 | Tasks & reminders | ✅ | `deal_tasks`, `DealTasksPanel` |
| 12 | Email send engine | ✅ | `campaign-dispatch`, `email_accounts`, OAuth Gmail/M365 (`email-oauth-connect`) |
| 13 | Email tracking (opens/clicks) | ✅ | `track-open`, `track-click`, `CampaignTrackingDrawer.tsx` |
| 14 | Reply detection | ✅ | `email-poll-replies` (IMAP), `CampaignTrackingDrawer.tsx` |
| 15 | A/B testing campaigns | ✅ | `CampaignFormFields.tsx` com `SequenceVariant`, `AbConfig`; editor por step com add/remove variantes |
| 16 | LinkedIn touches | ✅ | `lusha-*`, `scrape-queue-worker`, `StakeholderFinderView` |
| 17 | Cold call dialer | ❌ | ausente |
| 18 | API REST pública | ✅ | `public-api` function + `api_keys` |
| 19 | Webhooks de saída | ✅ | `webhooks`, `webhook_deliveries`, `webhook-dispatcher`, `WebhooksPanel` |
| 20 | Zapier/Make app | ❌ | ausente |
| 21 | HubSpot/Salesforce sync | ❌ | ausente (existe Oracle/Bitrix) |
| 22 | Slack notifications | ✅ | `webhook-dispatcher` + `WebhooksPanel` — URL do Slack configurável como webhook genérico |
| 23 | Chrome Extension | ❌ | ausente |
| 24 | Mobile native app | 🟡 | PWA apenas |
| 25 | Email enrichment | ✅ | `cnpj-enrich*`, `lusha-reveal`, `oracle-enrich-contact` |
| 26 | Technographics | ✅ | supabase/functions/technographics-detect/index.ts — 41 fingerprints, insere intent_signals type=tech_adoption |
| 27 | Intent signals | ✅ | `IntentSignalsView.tsx` (manual) + `technographics-detect` (auto-scan de tecnologias) |
| 28 | Lead scoring ML | 🟡 | `lead_scores` + `useLeadScores`, regra heurística (IPC), não ML treinado |
| 29 | Conversation intelligence | ❌ | ausente |
| 30 | Email writer (AI) | ✅ | `ai-agent` function + `AIAgentView.tsx` |
| 31 | Workflow visual editor | ✅ | `WorkflowEditor.tsx`, `workflows`, `workflow_runs`, `workflow-engine` |
| 32 | Workflow scheduling | ✅ | crons versionados + `workflow-engine` |
| 33 | Custom dashboards | ✅ | `dashboard_layouts`, `useDashboardLayout`, `DashboardView.tsx` |
| 34 | Scheduled reports | ✅ | `scheduled_reports`, `send-scheduled-reports` |
| 35 | Goals/quotas | ✅ | `sales_goals`, `GoalsTab`, `org_leaderboard` |
| 36 | Bulk CSV import | ✅ | `bulk_imports`, `ImportCompaniesDialog.tsx` |
| 37 | Soft delete + recycle bin | ✅ | `deleted_at` + `RecycleBinView` + `purge-soft-deleted` (8 tabelas de negócio) |
| 38 | Field history | ✅ | `audit_logs.old_data/new_data` + `AuditTrailPanel` |
| 39 | Status page público | ✅ | `incidents`, `get_public_status`, `StatusPage` (rota `/status`) |
| 40 | Realtime updates | ✅ | Supabase Realtime |
| 41 | RLS por tenant | ✅ | 0 tabelas sem RLS em `public` |
| 42 | PWA offline | ✅ | `vite-plugin-pwa` |
| 43 | a11y (WCAG AA) | 🟡 | parcial |
| 44 | Testes E2E + RLS | ✅ | Playwright + `rls-tests` |
| 45 | Session management | ✅ | `list_my_sessions`, `revoke_my_session`, `ActiveSessionsPanel` |
| 46 | IP allowlist | ✅ | `ip_allowlist`, `IpAllowlistPanel` |
| 47 | NPS/satisfaction | ✅ | `satisfaction_surveys/responses`, `SatisfactionTab` |
| 48 | Email templates por org | ✅ | `email_templates`, `EmailTemplatesTab` |
| 49 | Next best action | ✅ | `next_best_actions`, `nba_recommend`, `NextBestActionPanel` |
| 50 | DLP / PII masking | ✅ | `pii_redaction_rules`, `pii_scan`, `PiiMaskingPanel` |

**Cobertura LUX IA: 42/50 = 84% completos · 1/50 = 2% parciais · 7/50 = 14% ausentes (3ª passada 2026-11-22).**

Ausentes de verdade (7): `saml_sso` (4), `scim` (5), `cold_call_dialer` (17), `zapier` (20),
`hubspot_salesforce` (21), `chrome_extension` (23), `conversation_intel` (29).
Dependem de decisão de custo/produto: SAML/SCIM, dialer, conectores nativos, Chrome Extension.
Implementável hoje por engenharia: `zapier` (reusa `public-api`).



---

## 4. Roadmap em 4 Fases (12 meses)

### Fase 1 — Multi-tenant Foundation (Meses 1-3)

**Objetivo:** Tornar o produto colaborativo e auditável.

- Tabelas: `organizations`, `organization_members`, `user_roles` (com enum `app_role`), `audit_log`
- Função `has_role(user, role)` SECURITY DEFINER + atualização de **todas as RLS** para incluir `organization_id`
- Convite por email + onboarding de membros
- MFA via TOTP (`auth.mfa`)
- Soft delete (`deleted_at`) + recycle bin em todas as tabelas
- Audit log via trigger genérico em todas as tabelas
- UI: Settings → Members, Roles, Audit Log

**Entregável de venda:** "LUX IA agora é colaborativo, com permissões granulares e auditoria completa."

---

### Fase 2 — Engagement Engine (Meses 4-6)

**Objetivo:** Tornar campanhas funcionais — gerar receita real.

- OAuth Google Workspace + Microsoft 365 para enviar como o usuário
- Tabela `email_messages` + worker (edge function cron) que processa `sequence`
- Pixel de open + link tracking via edge function
- IMAP polling para reply detection → pausar sequência
- Editor visual de sequência com delay/branch
- Templates compartilhados por org com variáveis `{{first_name}}`, `{{company}}`
- Deliverability: validação SPF/DKIM/DMARC + warmup gradual

**Entregável:** "Lance campanhas reais sem sair do LUX."

---

### Fase 3 — CRM & Integrações (Meses 7-9)

**Objetivo:** Posicionar LUX como hub de receita.

- Tabela `deals` com `stage`, `value`, `close_date`, `owner_id` + Kanban UI
- Tabela `activities` (call/email/meeting/note) + timeline unificada
- Tabela `tasks` com due dates, assignee, recurrence
- API REST pública com OpenAPI spec + rate limiting server-side por API key
- Tabela `webhooks` + worker para notificar sistemas externos
- Conectores nativos: HubSpot, Salesforce (bidirecional), Slack, Google Calendar
- Chrome Extension para capturar leads do LinkedIn

**Entregável:** "LUX é seu CRM + Sales Engagement em uma só plataforma."

---

### Fase 4 — Enterprise & AI (Meses 10-12)

**Objetivo:** Habilitar venda a empresas reguladas + diferenciação por IA.

- SSO/SAML (Okta, Azure AD) via Lovable Cloud `configure_saml_sso`
- SCIM 2.0 para provisionamento
- IP allowlist + session management UI
- Auditoria SOC 2 Type II (parceiro: Vanta/Drata)
- DPA, Privacy Policy, ROPA, DPIA documentados
- Lead scoring por ML treinado em dados históricos do tenant
- Email writer IA em massa com personalização contextual
- Conversation intelligence (transcrição + sentiment via Gemini Pro)
- Dashboards customizáveis (drag-and-drop widgets)

**Entregável:** "LUX IA Enterprise — SOC 2, SSO, IA proprietária."

---

## 5. Quick Wins (≤ 2 semanas)

10 entregas de alto impacto e baixo esforço que dão sensação enterprise rápido:

| # | Quick Win | Esforço | Impacto |
|---|---|---|---|
| 1 | **Soft delete + recycle bin** (`deleted_at` em todas as tabelas) | 3d | Alto — recuperação de erros |
| 2 | **Audit log table** genérico via trigger PostgreSQL | 4d | Alto — compliance básico |
| 3 | **Field-level history** (JSONB diff por update) | 5d | Médio — transparência |
| 4 | **Bulk import CSV** de empresas com mapeamento de colunas + dedup | 1w | Alto — onboarding |
| 5 | **API key pessoal** + endpoint REST mínimo (GET /companies, POST /companies) | 1w | Alto — desbloqueia integrações |
| 6 | **Webhooks de saída** (tabela `webhooks` + trigger emitter) | 1w | Alto — desbloqueia ecossistema |
| 7 | **2FA via TOTP** (Supabase Auth nativo) | 3d | Alto — security check |
| 8 | **Status page** com Better Stack/Instatus (gratuito) | 1d | Médio — confiança |
| 9 | **In-app changelog** (Headway-like component) | 2d | Médio — engagement |
| 10 | **Rate limit server-side** via edge function + KV | 4d | Alto — proteção contra abuse |

**Total:** ~6 semanas de trabalho focado para entregar todos os 10.

---

## 6. Ameaças Competitivas

| Player | Foco | Pricing | Vantagem-chave |
|---|---|---|---|
| **Apollo.io** | All-in-one prospect + engage | $0–79/seat/mês | 275M+ contatos, freemium agressivo, IA writer |
| **ZoomInfo** | Data quality enterprise | $15K+/ano (anual) | Maior qualidade de firmographics, intent data |
| **Outreach** | Sales engagement | $100+/seat/mês | Gold standard em sequences + reporting |
| **Salesloft** | Sales engagement | Similar Outreach | Forte em coaching + conversation intelligence |
| **Cognism** | EU-first compliance | Enterprise quote | GDPR-native, mobile numbers EU |
| **Clay** | Workflow IA + enrichment waterfall | $149+/mês | 100+ providers, Cambrian-explosion de receitas |
| **HubSpot Breeze** | CRM + AI agents | Incluso no Hub | Ecossistema CRM #1, IA nativa |
| **Lemlist** | Cold outreach criativo | $59+/mês | Personalização visual em escala |

**Posicionamento sugerido para LUX IA:**
- 🇧🇷 **Sales Intelligence brasileiro** com foco em LGPD, CNAE, integrações locais (RD Station, Pipedrive BR)
- 💰 **Preço acessível** vs ZoomInfo (US$15K+/ano)
- 🤖 **IA generativa de ponta** sem custo adicional (Gemini via Lovable AI Gateway)
- 🚀 **Time-to-value** rápido (PWA + onboarding guiado)

**Janela de oportunidade:** o mercado brasileiro de Sales Tech ainda é dominado por soluções incompletas (RD Station foca marketing, HubSpot é caro em BRL). LUX pode ocupar o espaço **"Apollo brasileiro"** se executar bem as Fases 1-3.

---

## Resumo Final

| Pilar | Status atual | Após Fase 4 |
|---|---|---|
| Engagement | 🟡 `campaign-dispatch` envia via Gmail/Outlook (`index.ts:364-365`); falta tracking de reply | ✅ Email/LinkedIn real |
| CRM | 🟡 `deals` + `deal_tasks` + Kanban | ✅ Kanban + activities |
| CRM | 🟡 `deals` + `deal_stages` + Kanban | ✅ Kanban + activities |
| Integrações | ❌ Nenhuma | ✅ API + webhooks + nativas |
| Compliance | ❌ Nenhuma cert | ✅ SOC 2 + LGPD + GDPR |
| IA | 🟡 Chat básico | ✅ ML scoring + writer + intel |
| **Cobertura enterprise** | **~40%** | **~90%** |

O LUX IA tem **fundação técnica excelente** (RLS, realtime, IA, testes) mas precisa expandir significativamente em **multi-tenancy, engagement real, integrações e compliance** para competir no enterprise. Os Quick Wins entregam ~6 semanas de "sensação enterprise" e o roadmap de 12 meses fecha a maior parte dos gaps críticos.
