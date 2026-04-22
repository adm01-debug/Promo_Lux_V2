

## Documento: Gaps Enterprise vs LUX IA

Vou criar `docs/GAPS-ENTERPRISE.md` comparando o LUX IA com plataformas enterprise de classe mundial em Sales Intelligence B2B (ZoomInfo, Apollo.io, Outreach, Salesloft, Cognism, Clay, Clearbit/HubSpot Breeze).

### Estrutura do documento

**1. Resumo executivo**
- Posicionamento atual do LUX IA: MVP avançado de Sales Intelligence single-tenant
- Maturidade atual: ~40% das capacidades enterprise esperadas
- Gaps agrupados em 10 categorias com priorização P0/P1/P2

**2. Gaps por categoria**

#### 2.1 Multi-tenancy & Organizações (P0)
- Sem conceito de **Organization/Workspace** — cada usuário é uma ilha
- Sem **convite de membros**, sem compartilhamento de empresas/campanhas entre time
- Sem **roles & permissions** (Admin, Manager, SDR, Viewer) — tabela `user_roles` inexistente
- Sem **billing por seat** nem limites por plano
- Sem **audit log** de ações (quem editou/deletou o quê)

#### 2.2 CRM & Pipeline (P0)
- Sem **deals/opportunities** com stages customizáveis (Kanban)
- Sem **pipeline value** (forecast, weighted revenue)
- Sem **activities timeline** unificada por empresa/contato (calls, emails, meetings, notes)
- Sem **tasks & reminders** com due dates
- Sem **lead/contact lifecycle stages** (MQL → SQL → Opportunity → Customer)

#### 2.3 Outreach & Engagement (P0)
- Campanhas têm `sequence` mas **sem motor de envio real** (email/LinkedIn/SMS)
- Sem **integração SMTP/Gmail/Outlook** (OAuth com Google Workspace, Microsoft 365)
- Sem **email tracking** (opens via pixel, click tracking)
- Sem **reply detection** automática
- Sem **A/B testing** de subject lines/templates
- Sem **send time optimization** por timezone do prospect
- Sem **deliverability score** nem warmup de inbox
- Sem **multi-channel** (LinkedIn touches, cold call dialer, WhatsApp)

#### 2.4 Data Enrichment (P1)
- Hoje: scrape Google Maps + IPC scoring
- Falta: integração com **Apollo, ZoomInfo, Clearbit, Hunter, Snov, Lusha** para emails verificados
- Sem **email verification** (SMTP ping, catch-all detection)
- Sem **technographics** (stack tecnológica detectada via BuiltWith/Wappalyzer)
- Sem **firmographics** completos (funding, headcount growth, NAICS/CNAE)
- Sem **news & triggers** (funding rounds, hiring, layoffs, exec changes)
- Sem **social signals** (LinkedIn posts, tweets) além de URL

#### 2.5 Workflows & Automação (P1)
- `steps` é JSONB livre mas **sem editor visual** drag-and-drop tipo n8n/Zapier
- Sem **agendamento** (cron, recurring)
- Sem **triggers por evento** (novo lead, mudança de status, signal recebido)
- Sem **branching condicional** (if/else baseado em score, setor, etc.)
- Sem **delays** (esperar X dias entre etapas)
- Sem **integração com webhooks externos** (HubSpot, Salesforce, Pipedrive, Slack, Zapier)
- Sem **logs de execução** por step com retry manual

#### 2.6 Analytics & Reporting (P1)
- Sem **dashboards customizáveis** (drag widgets, salvar layouts por usuário)
- Sem **relatórios agendados** por email (daily/weekly/monthly digest)
- Sem **funil customizável** por estágio do pipeline
- Sem **cohort analysis** (taxa de conversão por mês de origem)
- Sem **attribution** (qual canal/campanha gerou o deal)
- Sem **leaderboards** de SDRs/AEs
- Sem **goals & quotas** com tracking
- Export PDF existe — falta export Excel multi-aba e API de relatórios

#### 2.7 Integrações & API (P0)
- **Sem API pública REST/GraphQL** documentada (OpenAPI spec)
- **Sem webhooks de saída** (notificar sistemas externos quando algo muda)
- **Sem Zapier/Make/n8n app**
- **Sem integração nativa** com: HubSpot, Salesforce, Pipedrive, Slack, Microsoft Teams, Notion, Calendly, Google Calendar, Outlook Calendar, WhatsApp Business
- Sem **Chrome Extension** (capturar leads do LinkedIn → LUX)
- Sem **mobile native app** (iOS/Android) — só PWA

#### 2.8 Segurança & Compliance Enterprise (P0)
- Sem **SSO/SAML** (Okta, Azure AD, Google Workspace SSO corporativo)
- Sem **SCIM** para provisionamento automático de usuários
- Sem **MFA/2FA** obrigatório
- Sem **IP allowlist** por organização
- Sem **session management** (revogar sessões ativas, ver dispositivos)
- Sem **compliance certifications**: SOC 2 Type II, ISO 27001, GDPR DPA, LGPD compliance docs
- Sem **data residency** opcional (escolher região do banco)
- Sem **audit log exportável** (immutable, retention 1+ ano)
- Sem **DSAR/Right to be Forgotten** automatizado (LGPD/GDPR)
- Sem **encryption at rest** com chave gerenciada pelo cliente (BYOK)
- Sem **DLP** (data loss prevention) e mascaramento de PII em logs

#### 2.9 IA & Machine Learning (P1)
- Hoje: chat com Gemini sem fine-tuning
- Falta: **lead scoring por ML** treinado nos dados históricos do tenant
- Sem **next best action** sugerida por contato
- Sem **email writer** com personalização contextual em massa
- Sem **conversation intelligence** (transcrever calls, summary, sentiment, talk ratio)
- Sem **deal risk prediction** (likelihood to close)
- Sem **buyer intent signals agregados** (Bombora, G2 Buyer Intent)
- Sem **content recommendation** (qual case study enviar para qual prospect)

#### 2.10 Operações & DevEx (P2)
- Sem **status page** público (uptime, incidentes)
- Sem **changelog/release notes** in-app
- Sem **feature flags** para rollout gradual
- Sem **in-app help center** (artigos, vídeos, chat de suporte)
- Sem **NPS/CSAT** in-app
- Sem **observabilidade** (Sentry, Datadog, New Relic) — só logs estruturados em edge functions
- Sem **rate limiting server-side** por organização (apenas client-side em login)
- Sem **backup point-in-time recovery** documentado nem **disaster recovery runbook**
- Sem **sandbox/staging environment** separado para clientes
- Sem **bulk import/export** (CSV de empresas, mapeamento de colunas, dedup)
- Sem **soft delete + recycle bin** (hoje delete é permanente)
- Sem **field-level history** (quem mudou qual campo quando)

**3. Comparativo resumido (matriz)**

Tabela com 30+ capacidades × Status (✅ Pronto / 🟡 Parcial / ❌ Ausente) × Prioridade.

**4. Roadmap sugerido em 4 fases (12 meses)**

| Fase | Meses | Foco | Entregas-chave |
|---|---|---|---|
| **1. Multi-tenant Foundation** | 1-3 | Tornar o produto colaborativo | Organizations, members, roles (`user_roles` table), audit log, MFA, soft delete |
| **2. Engagement Engine** | 4-6 | Tornar campanhas funcionais | Gmail/Outlook OAuth, send engine, email tracking pixel, reply detection, sequence editor |
| **3. CRM & Integrations** | 7-9 | Posicionar como hub de receita | Deals/Pipeline Kanban, activities timeline, API REST + webhooks, HubSpot/Salesforce sync, Chrome Extension |
| **4. Enterprise & AI** | 10-12 | Vender para enterprise | SSO/SAML/SCIM, SOC 2 prep, ML lead scoring, conversation intelligence, dashboards customizáveis |

**5. Quick wins (≤ 2 semanas cada)** — lista de 10 melhorias high-impact/low-effort que dão sensação enterprise rápido:
- Soft delete + recycle bin (`deleted_at` em todas as tabelas)
- Audit log table (genérico via trigger)
- Field-level history (JSONB diff por update)
- Bulk import CSV de empresas com mapeamento
- API key pessoal + endpoint REST mínimo
- Webhooks de saída (table `webhooks` + trigger)
- 2FA via TOTP
- Status page com Better Stack/Instatus
- In-app changelog (Headway-like)
- Rate limit server-side com Upstash/edge function

**6. Ameaças competitivas**
- Apollo.io: 275M+ contatos enriquecidos, $0-79/seat
- ZoomInfo: data quality enterprise, $15K+/ano
- Clay: workflows IA + 100+ data providers
- HubSpot Breeze: AI agents nativos no CRM líder

### Arquivo a criar
- `docs/GAPS-ENTERPRISE.md` (~400 linhas com TOC, 10 seções, tabela comparativa, roadmap, quick wins, análise competitiva)

