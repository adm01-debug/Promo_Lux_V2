# LUX IA — Análise Executiva de Funcionalidades

> Documento técnico consolidando todas as funcionalidades do sistema LUX IA, baseado em análise minuciosa do codebase (idêntico ao repositório GitHub via sincronização bidirecional).

**Versão:** 1.0  
**Data:** 2026-04-22  
**Escopo:** Frontend (React/Vite), Backend (Lovable Cloud/Supabase), Edge Functions (Deno), Infra (CI/CD, Testes)

---

## Índice

1. [Visão Geral](#1-visão-geral)
2. [Módulos Principais](#2-módulos-principais-12-views)
3. [Recursos Transversais](#3-recursos-transversais)
4. [Backend e Banco de Dados](#4-backend-e-banco-de-dados)
5. [Edge Functions](#5-edge-functions)
6. [Qualidade e Infraestrutura](#6-qualidade-e-infraestrutura)
7. [Segurança](#7-segurança)
8. [Roadmap e ADRs](#8-roadmap-e-adrs)

---

## 1. Visão Geral

**LUX IA** é uma plataforma SaaS de **Sales Intelligence B2B** que automatiza o ciclo completo de prospecção:

```
Configurar IPC  →  Raspar (GMaps)  →  Enriquecer  →  Pontuar (IPC Score)
       ↓                                                      ↓
   Stakeholders  ←  Sinais de Intenção  ←  Empresas qualificadas
       ↓
   Campanhas (outreach) → Métricas → Agente IA (insights)
```

### Stack Tecnológico

| Camada | Tecnologia |
|--------|-----------|
| Frontend | React 18 + TypeScript 5 + Vite 5 |
| UI | Tailwind CSS v3 + shadcn/ui + Framer Motion |
| Estado | TanStack Query + Context API |
| Roteamento | React Router DOM v6 |
| Backend | Lovable Cloud (Supabase PostgreSQL + Auth) |
| Serverless | Edge Functions (Deno runtime) |
| IA | Lovable AI Gateway (Google Gemini 2.5 Flash) |
| Realtime | Supabase Realtime (canais privados por user_id) |
| Mapas | Leaflet + react-leaflet + clustering |
| Gráficos | Recharts |
| Testes | Vitest + Testing Library + Playwright |

### Características de UX

- **Idioma:** PT-BR em toda a interface
- **Tema:** Dark mode dourado (#D4A520) com glass morphism
- **Tipografia:** Space Grotesk (headings) + JetBrains Mono (code)
- **Responsivo:** Desktop, tablet e mobile (bottom nav + swipe)
- **PWA:** Service worker, manifest, página offline
- **Acessibilidade:** Skip nav, ARIA labels, navegação completa por teclado

---

## 2. Módulos Principais (12 Views)

Cada módulo é uma "view" carregada via lazy loading e registrada em `src/lib/viewRegistry.ts`.

### 2.1 Dashboard (`DashboardView`)
**Rota:** `dashboard` · **Atalho:** `Alt+1`

- KPIs em tempo real: total de empresas, qualificadas, taxa de conversão
- Gráfico de performance semanal (`useWeeklyPerformance`)
- Feed de atividades recentes (scrape jobs, novas empresas, sinais)
- Ações rápidas (`QuickActions`): novo scrape, novo workflow, abrir IA
- Funil de enriquecimento visual (`EnrichmentFunnel`)
- Skeletons de loading dedicados

### 2.2 Analytics (`AnalyticsView`)
**Rota:** `analytics` · **Atalho:** `Alt+2`

- **Tab Conversão:** funil prospects → meetings com animações
- **Tab Enriquecimento:** taxa de dados completos por campo
- Donuts e contadores animados (`AnimatedDonut`, `AnimatedCounter`)
- Tooltips customizados (`AnalyticsChartTooltip`)
- **Export PDF** (`exportAnalyticsPDF`) com snapshot dos gráficos
- Hook centralizado: `useAnalyticsData`

### 2.3 Configurar IPC (`ICPConfigView`)
**Rota:** `icp` · **Atalho:** `Alt+3`

- Definição de critérios do Ideal Customer Profile
- Setores-alvo, localizações, faixa de funcionários, faixa de receita
- Pesos por critério para cálculo do **IPC Score (0-100)**
- Ativação/desativação de configurações múltiplas
- Persistência via tabela `ipc_config`

### 2.4 Empresas (`CompaniesView`)
**Rota:** `companies` · **Atalho:** `Alt+4`

- **CRUD completo:** criar, ver, editar, deletar
- Tabela paginada com sort por colunas (`CompanyTable`, `CompanyTableRow`)
- Filtros persistidos (`usePersistedFilters`): setor, localização, score, enriched, starred
- Busca em tempo real
- Detalhe em modal (`CompanyDetailModal`)
- **Export CSV** (`exportCSV`)
- Indicador visual de IPC Score com cores
- Marcar como favorita (starred)
- Realtime: novas empresas aparecem sem reload

### 2.5 Sinais de Intenção (`IntentSignalsView`)
**Rota:** `intent` · **Atalho:** `Alt+5`

- Tracking de sinais por empresa: `website_visit`, `download`, `email_open`, etc.
- Força do sinal (low/medium/high) com badges coloridos
- Detalhes contextuais (página visitada, asset baixado)
- Agrupamento por empresa
- Tabela `intent_signals` com FK para `companies`

### 2.6 Stakeholders (`StakeholderFinderView`)
**Rota:** `stakeholders` · **Atalho:** `Alt+6`

- Decisores por empresa com cargo, departamento, senioridade
- Email, telefone, LinkedIn URL
- Score de confiança da informação (0-100)
- Tags customizáveis e notas internas
- Last contacted timestamp
- Avatar + visualização em card (`StakeholderCard`) ou lista (`StakeholderListRow`)

### 2.7 Workflows (`WorkflowsView`)
**Rota:** `workflows` · **Atalho:** `Alt+7`

- Pipelines automatizados multi-etapa: raspar → enriquecer → pontuar → notificar
- Status: draft, active, paused, completed, failed, running, archived
- Métricas por workflow: leads processados, leads qualificados, success rate
- Card visual (`WorkflowCard`) com estado em tempo real
- Histórico de execuções (`workflow_runs`)
- Disparo via edge function `workflow-engine`

### 2.8 Google Maps Scraper (`GmapsScraperView`)
**Rota:** `gmaps` · **Atalho:** `Alt+8`

- Configuração de jobs de raspagem: termo de busca, localização, limite
- Status do job em tempo real: pending → running → working → completed/failed
- Lista de jobs com progress e resultados
- Cancelamento de jobs em andamento
- Sync automático de resultados via `scrape_results` → `companies`
- Backend: edge function `gmaps-proxy` chama API externa `gmaps.atomicabr.com.br`

### 2.9 Mapa de Empresas (`CompaniesMapView`)
**Rota:** `map` · **Atalho:** `Alt+9`

- Visualização geográfica com Leaflet
- Markers customizados por status/score (`MapMarkerIcons`)
- Clustering automático para densidade (`MarkerClusterLayer`)
- Filtros geo (`MapFilters`): setor, score mínimo, raio
- Popup com dados da empresa ao clicar no marker

### 2.10 Campanhas (`CampaignsView`)
**Rota:** `campaigns`

- Sequências de outreach multi-passo (`sequence` JSONB)
- Métricas por campanha: prospects, sent, opened, replied, meetings
- Status: draft, active, paused, completed, archived
- Data de início configurável
- Cálculo automático de taxa de conversão por etapa

### 2.11 Agente IA (`AIAgentView`)
**Rota:** `ai-agent`

- Chat com **Google Gemini 2.5 Flash** via Lovable AI Gateway
- Contexto automático do banco de dados do usuário
- Histórico persistido em `agent_chat_messages`
- Streaming de respostas
- Edge function: `ai-agent` (sem necessidade de API key do usuário)

### 2.12 Configurações (`SettingsView`)
**Rota:** `settings`

- Edição de perfil (nome, avatar)
- Skins de tema (`useSkin` — gold padrão)
- Preferências de notificação granulares: email, scrape, signal, weekly report
- Reset do tour de onboarding
- Logout

---

## 3. Recursos Transversais

### 3.1 Autenticação (`Login.tsx`, `AuthContext`)

- **Email/senha** com validação Zod (`schemas/auth.ts`)
- **Google OAuth** (`GoogleLoginButton`, `GoogleLoadingOverlay`)
- **Reset de senha** com overlay (`ForgotPasswordOverlay`, `ResetPassword.tsx`)
- **Rate limiting** client-side (`useRateLimit`, `RateLimitWarning`)
- **Modo Demo** (`DemoContext`) — explora sem cadastro
- **Password strength meter** em tempo real
- Confetti dourado em login bem-sucedido (`GoldConfetti`)
- Partículas animadas de fundo (`FloatingParticles`)

### 3.2 Realtime

- `useRealtimeCompanies` — subscriptions na tabela `companies` via canal privado por `user_id`
- `useRealtimeScrapeJobs` — atualizações de status de jobs em tempo real
- Indicador de conexão (`ConnectionStatus`)
- ADR-004 documenta arquitetura de canais privados

### 3.3 Atalhos de Teclado (`useKeyboardShortcuts`)

| Atalho | Ação |
|--------|------|
| `⌘K` / `Ctrl+K` | Command Palette |
| `⌘B` / `Ctrl+B` | Toggle sidebar |
| `⌘⇧F` / `Ctrl+Shift+F` | Modo Foco (oculta sidebar e header) |
| `Alt+1-9` | Navegação direta para views |
| `?` | Dialog de atalhos (`KeyboardShortcutsDialog`) |
| `Esc` | Fechar dialogs/overlays |

### 3.4 Mobile

- **Bottom navigation** (`MobileBottomNav`) com tabs principais
- **Swipe** entre tabs (`useBottomNavSwipe`, `useSwipeGesture`)
- Viewport responsivo (`use-mobile`)
- Sidebar como drawer com backdrop blur

### 3.5 Navegação e Histórico

- `useNavigationHistory` — histórico in-memory com back/forward
- Breadcrumbs dinâmicos (`AppBreadcrumbs`)
- Top progress bar em transições (`TopProgressBar`)
- Page transitions com Framer Motion (`PageTransition`, slide variants)
- Recent views (`useRecentViews`) — últimas 5 views acessadas
- Confirmação de unsaved changes (`useUnsavedChanges`)

### 3.6 Acessibilidade (a11y)

- Skip nav link em `index.html`
- ARIA labels em todos os botões interativos
- `role="main"` + `aria-live="polite"` na área principal
- Navegação completa por teclado em tabelas e dialogs
- Foco visível com ring dourado

### 3.7 PWA

- Service worker (`public/sw.js`)
- Manifest (`public/manifest.json`)
- Página offline (`public/offline.html`)

### 3.8 Onboarding

- Tour guiado interativo (`OnboardingTour`)
- Spotlight em elementos da UI (`TourSpotlight`)
- Tooltips explicativos (`TourTooltip`)
- Steps configuráveis (`TourSteps.ts`)
- Confetti ao concluir (`ConfettiEffect`)
- Estado persistido em `profiles.onboarding_completed`

### 3.9 Notificações (`NotificationsPanel`)

- Painel deslizante com badge de não lidas
- Tipos: `system`, `scrape`, `signal`
- Marcar como lida individualmente
- Metadata JSONB para deep links

### 3.10 Personalização

- Múltiplos skins de tema (`useSkin`)
- Toggle de tema (`ThemeToggle`)
- Cores dinâmicas (`useThemeColors`)
- Preferências granulares de notificação

### 3.11 Error Handling

- `ErrorBoundary` global por view
- `DataError` reutilizável para falhas de fetch
- `EmptyState` para listas vazias
- Skeletons de loading por view (`ViewSkeletons`)
- Toasts via Sonner para feedback de ações

---

## 4. Backend e Banco de Dados

**Lovable Cloud** (Supabase PostgreSQL) com **12 tabelas**, todas com RLS habilitado e isolamento por `user_id`.

| Tabela | Propósito | Registros chave |
|--------|-----------|-----------------|
| `companies` | Empresas prospectadas | name, sector, location, ipc_score, lat/lng, enriched, starred |
| `stakeholders` | Decisores/contatos | full_name, role, seniority, email, linkedin_url, confidence_score |
| `workflows` | Definições de pipelines | name, status, steps (JSONB), success_rate |
| `workflow_runs` | Execuções de workflows | workflow_id, status, current_step, results |
| `scrape_jobs` | Jobs de raspagem | external_id, source, status, results_count, config |
| `scrape_results` | Resultados brutos | job_id, company_id, raw_data, processed |
| `campaigns` | Campanhas de outreach | name, status, sequence, prospects/sent/opened/replied/meetings |
| `intent_signals` | Sinais de intenção | company_name, type, signal, strength, metadata |
| `ipc_config` | Configurações de scoring | name, criteria (JSONB), is_active |
| `notifications` | Notificações in-app | type, title, message, read, metadata |
| `profiles` | Perfis de usuário | full_name, avatar_url, skin, notification_prefs, onboarding_completed |
| `agent_chat_messages` | Histórico do chat IA | role, content, created_at |

### Enums

- `campaign_status`: draft, active, paused, completed, archived
- `scrape_job_status`: pending, running, working, completed, failed, cancelled
- `workflow_status`: draft, active, paused, completed, failed, running, archived

### Triggers e Functions

- `handle_new_user` — cria profile automaticamente no signup

---

## 5. Edge Functions

Localizadas em `supabase/functions/`, executadas no runtime Deno.

| Função | Métodos | Descrição |
|--------|---------|-----------|
| `ai-agent` | POST | Chat com Gemini via Lovable AI Gateway, contexto do banco do usuário |
| `gmaps-proxy` | GET/POST/DELETE | CRUD de jobs + sync de resultados com API externa GMaps Scraper |
| `workflow-engine` | GET/POST/DELETE | Motor de execução de workflows multi-etapa |
| `rls-tests` | POST | Suite automatizada de testes de isolamento RLS cross-user |

**Padrões aplicados:**
- Validação de JWT do usuário
- Validação de input com Zod
- CORS com allowlist dinâmica de origins
- Timeouts explícitos via `AbortSignal.timeout`
- Logging estruturado JSON (ADR-006)
- Sem `console.log` em produção

---

## 6. Qualidade e Infraestrutura

### 6.1 Testes

| Tipo | Framework | Cobertura |
|------|-----------|-----------|
| Unitários | Vitest + Testing Library | 216 testes em 29 arquivos |
| E2E | Playwright | Auth, navegação, CRUD de empresas |
| RLS | Edge function `rls-tests` | Isolamento cross-user automatizado |

**Áreas cobertas por testes unitários:**
- Componentes lux (CompaniesView, CompanyTable, DashboardView, ICPConfigView, WorkflowsView, etc.)
- Sub-componentes refatorados (MapFilters, WorkflowCard, StakeholderCard, CompanyTableRow)
- Hooks (`useRealtimeCompanies`, `useRealtimeScrapeJobs`, `useRateLimit`, `useRecentViews`, `useSidebarState`, `usePersistedFilters`)
- Libs (`exportCSV`, `sanitize`, `utils`, schemas Zod de validação)
- Layout (Header, Sidebar)

**Suíte E2E (`e2e/`):**
- `auth.spec.ts` — login, signup, validações, reset password, route protection
- `navigation.spec.ts` — sidebar, breadcrumbs, atalhos, command palette, mobile
- `companies-crud.spec.ts` — busca, filtros, criação, validação de form

### 6.2 CI/CD (`.github/workflows/ci.yml`)

Pipeline automatizado em GitHub Actions:
1. Checkout
2. Install dependencies
3. Lint (ESLint)
4. Type check (TypeScript)
5. Test unit (Vitest)
6. Audit (npm audit)
7. E2E (Playwright)

### 6.3 Build e Deploy

- **Build:** Vite 5 com code splitting e lazy loading por view
- **Deploy:** Automático via Lovable
- **Edge functions:** Deploy automático ao salvar
- **Produção:** https://lux-ai-company-finder.lovable.app

### 6.4 Observabilidade

- Logging estruturado JSON em edge functions (ADR-006)
- Sem console em código de produção (cliente)
- Toast notifications para feedback de erro
- ErrorBoundary captura crashes React

---

## 7. Segurança

### 7.1 Autenticação e Autorização

- JWT via Supabase Auth (email + Google OAuth)
- JWT validado em código nas edge functions
- Sessão gerenciada via `AuthContext`

### 7.2 Row-Level Security (RLS)

- **100% das tabelas** com RLS habilitado
- Políticas `SELECT/INSERT/UPDATE/DELETE` para `authenticated` com `user_id = auth.uid()`
- Política `ALL` para `service_role` (operações internas)
- `profiles` usa `id = auth.uid()` (PK = auth user ID)
- Testes automatizados via `rls-tests` edge function

### 7.3 Validação de Input

- Zod schemas no cliente (`schemas/auth.ts`, `schemas/company.ts`, `schemas/campaign.ts`, `schemas/scrapeJob.ts`)
- Zod schemas no servidor (edge functions)
- Sanitização HTML em `lib/sanitize.ts`

### 7.4 Comunicação Externa

- Todas as APIs externas atrás de edge functions (ADR-003)
- API externa nunca exposta ao cliente
- CORS allowlist dinâmica em edge functions
- Timeouts explícitos em todas as chamadas

### 7.5 Realtime

- Canais privados por `user_id` (ADR-004)
- Sem broadcast público de dados sensíveis

---

## 8. Roadmap e ADRs

### Architecture Decision Records (`docs/adr/`)

| ADR | Decisão |
|-----|---------|
| 001 | Design system gold/dark com glass morphism |
| 002 | RLS por user_id em todas as tabelas |
| 003 | Edge functions como proxy seguro para APIs externas |
| 004 | Realtime com canais privados |
| 005 | Lovable AI Gateway (sem API key do usuário) |
| 006 | Structured logging JSON em edge functions |

### Documentação Adicional

- `README.md` — visão geral e setup
- `docs/edge-functions.md` — detalhamento de cada edge function
- `.lovable/memory/` — design tokens e preferências do projeto

---

## Resumo Executivo

O **LUX IA** é uma plataforma B2B madura com:

- ✅ **12 módulos de negócio** cobrindo o ciclo completo de prospecção
- ✅ **12 tabelas** com isolamento total por usuário (RLS)
- ✅ **4 edge functions** servindo IA, raspagem, automação e testes de segurança
- ✅ **216+ testes unitários** + suite E2E + testes de RLS automatizados
- ✅ **PWA completo** com offline, service worker e manifest
- ✅ **Acessibilidade** (a11y) com navegação por teclado, ARIA, skip nav
- ✅ **Realtime** em canais privados para companies e scrape jobs
- ✅ **IA integrada** via Gemini 2.5 Flash sem custo adicional para o usuário
- ✅ **6 ADRs** documentando decisões arquiteturais críticas
- ✅ **CI/CD** em GitHub Actions com lint, types, tests, audit, e2e
- ✅ **Sincronização bidirecional** Lovable ↔ GitHub

**Nota sobre análise GitHub:** O repositório GitHub é mantido em sincronia bidirecional em tempo real com o Lovable. O código aqui analisado é idêntico ao do repositório — não há divergência entre as duas fontes.
