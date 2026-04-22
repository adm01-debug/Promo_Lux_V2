# LUX IA — Gaps Enterprise

> Análise comparativa entre o LUX IA e plataformas enterprise de classe mundial em Sales Intelligence B2B (ZoomInfo, Apollo.io, Outreach, Salesloft, Cognism, Clay, HubSpot Breeze).

**Versão:** 1.0
**Data:** 2026-04-22
**Escopo:** Funcionalidades, segurança, compliance, integrações e operações esperadas em SaaS B2B enterprise.

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
- ❌ Single-user — sem organizações, times, roles, audit log
- ❌ CRM/Pipeline ausente — sem deals, activities, tasks
- ❌ Engagement sem motor real — campanhas não enviam emails
- ❌ Sem API pública, webhooks ou integrações nativas
- ❌ Sem SSO/SAML, MFA, SOC 2 — bloqueia venda enterprise

Os gaps abaixo estão priorizados em **P0** (bloqueador enterprise), **P1** (diferencial competitivo), **P2** (qualidade operacional).

---

## 2. Gaps por Categoria

### 2.1 Multi-tenancy & Organizações (P0)

| Gap | Estado atual | Padrão enterprise |
|---|---|---|
| Organização/Workspace | Inexistente — cada `user_id` é uma ilha | Tabela `organizations` + `organization_members` |
| Convite de membros | Inexistente | Email invite + onboarding por organização |
| Roles & Permissions | Inexistente — sem `user_roles` | Admin, Manager, SDR, Viewer com matriz de permissões |
| Compartilhamento | Tudo privado por user | Visibilidade configurável (privado/time/org) |
| Billing por seat | Inexistente | Stripe/Paddle com seat-based + limites por plano |
| Audit log | Inexistente | Tabela `audit_log` populada por triggers (quem fez o quê, quando) |
| Transferência de propriedade | Inexistente | Reassign de empresas/campanhas entre membros |

**Impacto:** Sem multi-tenancy, o produto não pode ser vendido para times — limite máximo de 1 usuário por conta.

---

### 2.2 CRM & Pipeline (P0)

| Gap | Estado atual | Padrão enterprise |
|---|---|---|
| Deals/Opportunities | Inexistente | Kanban com stages customizáveis por org |
| Pipeline value | Inexistente | Forecast, weighted revenue, close date |
| Activities timeline | Inexistente | Timeline unificada por empresa/contato (calls, emails, meetings, notes) |
| Tasks & reminders | Inexistente | Due dates, assignee, recurring, snooze |
| Lifecycle stages | Apenas `ipc_score` | MQL → SQL → Opportunity → Customer → Churn |
| Lost reasons | Inexistente | Categorização de perda + análise |

**Impacto:** Sem CRM nativo, usuários precisam exportar para HubSpot/Salesforce — LUX vira ferramenta auxiliar, não hub de receita.

---

### 2.3 Outreach & Engagement (P0)

| Gap | Estado atual | Padrão enterprise |
|---|---|---|
| Motor de envio | `campaigns.sequence` é JSONB visual mas **não envia nada** | Worker que dispara emails reais |
| OAuth Gmail/Outlook | Inexistente | Conectar inbox do usuário, enviar via SMTP autenticado |
| Email tracking | Inexistente | Pixel de open + link tracking + UTMs |
| Reply detection | Inexistente | IMAP/Gmail API para parar sequência ao responder |
| A/B testing | Inexistente | Multivariado em subject/body/CTA |
| Send time optimization | Inexistente | ML por timezone e padrão de abertura |
| Deliverability | Inexistente | SPF/DKIM/DMARC checker, warmup, score |
| Multi-canal | Apenas email conceitual | LinkedIn touches, dialer, WhatsApp, SMS |
| Templates compartilhados | Inexistente | Biblioteca por org com versionamento |

**Impacto:** Campanhas existem como UI mas **não geram receita real** — gap crítico vs Apollo/Outreach/Salesloft.

---

### 2.4 Data Enrichment (P1)

| Gap | Estado atual | Padrão enterprise |
|---|---|---|
| Fontes de dados | Apenas Google Maps scraper | Apollo, ZoomInfo, Clearbit, Hunter, Snov, Lusha, Cognism |
| Email verification | Inexistente | SMTP ping + catch-all + role detection |
| Technographics | Inexistente | BuiltWith/Wappalyzer — stack do prospect |
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
| Relatórios agendados | Inexistente | Daily/weekly/monthly digest por email |
| Funil customizável | Funil fixo prospects→meetings | Stages do pipeline configurável |
| Cohort analysis | Inexistente | Conversão por mês de origem |
| Attribution | Inexistente | Multi-touch, first/last touch, linear |
| Leaderboards | Inexistente | Ranking de SDRs/AEs por métrica |
| Goals & quotas | Inexistente | Tracking vs target por usuário/equipe |
| Export | PDF Analytics | + Excel multi-aba, API de relatórios, embedded BI |

---

### 2.7 Integrações & API (P0)

| Gap | Estado atual | Padrão enterprise |
|---|---|---|
| API pública | Inexistente | REST + GraphQL com OpenAPI spec |
| Autenticação API | Inexistente | API keys pessoais + por-org com scopes |
| Webhooks de saída | Inexistente | Notificar sistemas externos em eventos |
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
| MFA/2FA | Inexistente | TOTP obrigatório por org |
| IP allowlist | Inexistente | Por organização com CIDR |
| Session management | Sessão única implícita | Listar/revogar sessões ativas, dispositivos |
| SOC 2 Type II | Não certificado | Auditoria anual + relatório |
| ISO 27001 | Não certificado | SGSI documentado |
| GDPR/LGPD docs | Inexistente | DPA, Privacy Policy, ROPA, DPIA |
| Data residency | Fixa (Lovable Cloud) | Escolher região (US/EU/BR) por org |
| Audit log exportável | Inexistente | Immutable, retention 1+ ano, export SIEM |
| DSAR/Right to be Forgotten | Manual | Fluxo automatizado por usuário/org |
| BYOK (encryption) | Sem opção | Chave gerenciada pelo cliente (KMS) |
| DLP & PII masking | Inexistente | Mascarar PII em logs e exports |
| Pen test report | Inexistente | Relatório anual de pentest |
| Vulnerability disclosure | Inexistente | Programa público + bug bounty |

**Impacto:** **Bloqueador absoluto** para vendas a empresas reguladas (financeiro, saúde, governo).

---

### 2.9 IA & Machine Learning (P1)

| Gap | Estado atual | Padrão enterprise |
|---|---|---|
| Chat IA | Gemini 2.5 Flash sem contexto rico | Já feito ✅ |
| Lead scoring por ML | IPC manual com pesos | Modelo treinado em dados históricos do tenant |
| Next best action | Inexistente | Sugestão por contato (call vs email vs LinkedIn) |
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
| Status page | Inexistente | status.luxai.com público (Better Stack/Instatus) |
| Changelog in-app | Inexistente | Headway/Beamer-like notifications |
| Feature flags | Inexistente | LaunchDarkly/PostHog para rollout gradual |
| Help center | Inexistente | Artigos, vídeos, chat de suporte (Intercom) |
| NPS/CSAT | Inexistente | Coleta in-app contínua |
| Observabilidade | Logs estruturados em edge functions | Sentry, Datadog, New Relic frontend+backend |
| Backup PITR | Não documentado | Point-in-time recovery + DR runbook |
| Sandbox/staging | Inexistente | Ambiente cliente para testes |
| Bulk import/export | Inexistente | CSV com mapeamento de colunas + dedup |
| Soft delete | Hard delete | `deleted_at` + recycle bin com retenção |
| Field-level history | Inexistente | JSONB diff por update + viewer |
| Onboarding self-serve | Tour ✅ | + checklist progressivo + sample data |

---

## 3. Matriz Comparativa

| # | Capacidade | LUX IA | Apollo | ZoomInfo | Outreach | Prioridade |
|---|---|---|---|---|---|---|
| 1 | Multi-tenant org/teams | ❌ | ✅ | ✅ | ✅ | P0 |
| 2 | RBAC (Admin/SDR/Viewer) | ❌ | ✅ | ✅ | ✅ | P0 |
| 3 | Audit log | ❌ | ✅ | ✅ | ✅ | P0 |
| 4 | SSO/SAML | ❌ | ✅ | ✅ | ✅ | P0 |
| 5 | SCIM | ❌ | ✅ | ✅ | ✅ | P0 |
| 6 | MFA/2FA | ❌ | ✅ | ✅ | ✅ | P0 |
| 7 | SOC 2 Type II | ❌ | ✅ | ✅ | ✅ | P0 |
| 8 | GDPR/LGPD docs | ❌ | ✅ | ✅ | ✅ | P0 |
| 9 | Deals/Pipeline (Kanban) | ❌ | ✅ | 🟡 | ✅ | P0 |
| 10 | Activities timeline | ❌ | ✅ | ✅ | ✅ | P0 |
| 11 | Tasks & reminders | ❌ | ✅ | ✅ | ✅ | P0 |
| 12 | Email send engine | ❌ | ✅ | ✅ | ✅ | P0 |
| 13 | Email tracking (opens/clicks) | ❌ | ✅ | ✅ | ✅ | P0 |
| 14 | Reply detection | ❌ | ✅ | ✅ | ✅ | P0 |
| 15 | A/B testing campaigns | ❌ | ✅ | 🟡 | ✅ | P1 |
| 16 | LinkedIn touches | ❌ | ✅ | 🟡 | ✅ | P1 |
| 17 | Cold call dialer | ❌ | ✅ | ✅ | ✅ | P1 |
| 18 | API REST pública | ❌ | ✅ | ✅ | ✅ | P0 |
| 19 | Webhooks de saída | ❌ | ✅ | ✅ | ✅ | P0 |
| 20 | Zapier/Make app | ❌ | ✅ | ✅ | ✅ | P1 |
| 21 | HubSpot/Salesforce sync | ❌ | ✅ | ✅ | ✅ | P0 |
| 22 | Slack notifications | ❌ | ✅ | ✅ | ✅ | P1 |
| 23 | Chrome Extension | ❌ | ✅ | ✅ | ✅ | P1 |
| 24 | Mobile native app | 🟡 PWA | ✅ | ✅ | ✅ | P2 |
| 25 | Email enrichment | ❌ | ✅ | ✅ | 🟡 | P1 |
| 26 | Technographics | ❌ | ✅ | ✅ | ❌ | P1 |
| 27 | Intent signals (3rd party) | 🟡 manual | ✅ | ✅ | ✅ | P1 |
| 28 | Lead scoring ML | 🟡 manual (IPC) | ✅ | ✅ | ✅ | P1 |
| 29 | Conversation intelligence | ❌ | 🟡 | 🟡 | ✅ | P1 |
| 30 | Email writer (AI) | 🟡 chat | ✅ | ✅ | ✅ | P1 |
| 31 | Workflow visual editor | ❌ | ✅ | 🟡 | ✅ | P1 |
| 32 | Workflow scheduling | ❌ | ✅ | ✅ | ✅ | P1 |
| 33 | Custom dashboards | ❌ | ✅ | ✅ | ✅ | P1 |
| 34 | Scheduled reports | ❌ | ✅ | ✅ | ✅ | P1 |
| 35 | Goals/quotas | ❌ | ✅ | ✅ | ✅ | P1 |
| 36 | Bulk CSV import | ❌ | ✅ | ✅ | ✅ | P2 |
| 37 | Soft delete + recycle bin | ❌ | ✅ | ✅ | ✅ | P2 |
| 38 | Field history | ❌ | ✅ | ✅ | ✅ | P2 |
| 39 | Status page público | ❌ | ✅ | ✅ | ✅ | P2 |
| 40 | Realtime updates | ✅ | ✅ | ✅ | ✅ | — |
| 41 | RLS por tenant | ✅ | ✅ | ✅ | ✅ | — |
| 42 | PWA offline | ✅ | 🟡 | 🟡 | 🟡 | — |
| 43 | a11y (WCAG AA) | 🟡 | ✅ | ✅ | ✅ | P1 |
| 44 | Testes E2E + RLS | ✅ | n/d | n/d | n/d | — |

**Cobertura LUX IA:** ~40% (vs ~95% nas plataformas de referência).

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
| Multi-tenancy | ❌ Single-user | ✅ Org + RBAC + Audit |
| Engagement | ❌ UI sem motor | ✅ Email/LinkedIn real |
| CRM | ❌ Inexistente | ✅ Kanban + activities |
| Integrações | ❌ Nenhuma | ✅ API + webhooks + nativas |
| Compliance | ❌ Nenhuma cert | ✅ SOC 2 + LGPD + GDPR |
| IA | 🟡 Chat básico | ✅ ML scoring + writer + intel |
| **Cobertura enterprise** | **~40%** | **~90%** |

O LUX IA tem **fundação técnica excelente** (RLS, realtime, IA, testes) mas precisa expandir significativamente em **multi-tenancy, engagement real, integrações e compliance** para competir no enterprise. Os Quick Wins entregam ~6 semanas de "sensação enterprise" e o roadmap de 12 meses fecha a maior parte dos gaps críticos.
