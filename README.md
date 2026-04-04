# LUX IA — Sistema de Prospecção B2B Inteligente

> Plataforma de automação de raspagem, enriquecimento e scoring de empresas com IA integrada.

[![Built with Lovable](https://img.shields.io/badge/Built%20with-Lovable-ff69b4)](https://lovable.dev)

---

## Índice

- [Visão Geral](#visão-geral)
- [Arquitetura](#arquitetura)
- [Stack Tecnológico](#stack-tecnológico)
- [Setup Local](#setup-local)
- [Estrutura do Projeto](#estrutura-do-projeto)
- [Edge Functions](#edge-functions)
- [Banco de Dados](#banco-de-dados)
- [Autenticação e Segurança](#autenticação-e-segurança)
- [Testes](#testes)
- [Design System](#design-system)
- [Deploy](#deploy)

---

## Visão Geral

LUX IA é um sistema de prospecção B2B que automatiza:

1. **Raspagem** — Coleta empresas via Google Maps (GMaps Scraper)
2. **Enriquecimento** — Extrai emails, telefones, websites e metadados
3. **Scoring IPC** — Classifica empresas por Ideal Customer Profile (0–100)
4. **Workflows** — Pipelines automatizados: raspar → enriquecer → pontuar
5. **Agente IA** — Chat inteligente com contexto do banco de dados
6. **Campanhas** — Gestão de outreach com métricas de conversão
7. **Sinais de Intenção** — Monitoramento de atividades de prospects
8. **Stakeholders** — Mapeamento de decisores por empresa

---

## Arquitetura

```
┌─────────────────────────────────────────────┐
│                  Frontend                    │
│  React 18 + Vite 5 + Tailwind + TypeScript  │
│  SPA com lazy loading e code splitting      │
└──────────────┬──────────────────────────────┘
               │ HTTPS (JWT Bearer)
┌──────────────▼──────────────────────────────┐
│           Lovable Cloud (Supabase)           │
│                                              │
│  ┌────────────┐  ┌───────────────────────┐  │
│  │  Auth       │  │  PostgreSQL + RLS     │  │
│  │  (email)    │  │  12 tabelas           │  │
│  └────────────┘  └───────────────────────┘  │
│                                              │
│  ┌────────────────────────────────────────┐  │
│  │         Edge Functions (Deno)          │  │
│  │  ai-agent │ gmaps-proxy │ workflow     │  │
│  │  rls-tests                             │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  ┌────────────┐  ┌───────────────────────┐  │
│  │  Realtime   │  │  Lovable AI Gateway  │  │
│  │  (private   │  │  (Gemini 2.5 Flash)  │  │
│  │   channels) │  │                      │  │
│  └────────────┘  └───────────────────────┘  │
└──────────────────────────────────────────────┘
               │
┌──────────────▼──────────────┐
│  GMaps Scraper API Externo  │
│  gmaps.atomicabr.com.br     │
└─────────────────────────────┘
```

### Fluxo de Dados

1. Usuário configura IPC (setores, locais, critérios)
2. Cria um job de raspagem ou workflow automatizado
3. Edge function `gmaps-proxy` envia job para API externa
4. Resultados são sincronizados, empresas criadas com scoring IPC
5. Realtime (canais privados por `user_id`) atualiza UI em tempo real
6. Agente IA consulta dados para responder perguntas e sugerir ações

---

## Stack Tecnológico

| Camada       | Tecnologia                                    |
|-------------|------------------------------------------------|
| Framework   | React 18 + TypeScript 5                        |
| Build       | Vite 5                                         |
| Estilização | Tailwind CSS v3 + shadcn/ui                    |
| Estado      | TanStack React Query + Context API             |
| Roteamento  | React Router DOM v6                            |
| Backend     | Lovable Cloud (Supabase PostgreSQL + Auth)      |
| Serverless  | Edge Functions (Deno runtime)                   |
| IA          | Lovable AI Gateway (Google Gemini 2.5 Flash)    |
| Realtime    | Supabase Realtime (canais privados)             |
| Testes      | Vitest + Testing Library + Playwright           |
| Animações   | Framer Motion                                   |
| Gráficos    | Recharts                                        |
| Tema        | next-themes (dark mode padrão)                  |

---

## Setup Local

### Pré-requisitos

- Node.js 18+ ou Bun
- Git

### Instalação

```bash
git clone <repo-url>
cd lux-ia
npm install   # ou bun install
```

### Desenvolvimento

```bash
npm run dev   # Inicia dev server em localhost:8080
```

### Testes

```bash
npm run test         # Vitest (103 testes unitários)
npx playwright test  # E2E (navegação)
```

### Build

```bash
npm run build
npm run preview      # Preview do build local
```

---

## Estrutura do Projeto

```
src/
├── App.tsx                    # Rotas, providers, ErrorBoundary
├── main.tsx                   # Entry point
├── index.css                  # Design tokens CSS (gold theme)
├── contexts/
│   └── AuthContext.tsx         # Auth state + session management
├── components/
│   ├── lux/                   # Componentes de domínio
│   │   ├── DashboardView      # Dashboard principal
│   │   ├── CompaniesView      # Lista de empresas
│   │   ├── WorkflowsView      # Gestão de workflows
│   │   ├── CampaignsView      # Campanhas de outreach
│   │   ├── AIAgentView        # Chat com IA
│   │   ├── GmapsScraperView   # Raspagem Google Maps
│   │   ├── ICPConfigView      # Configuração IPC
│   │   ├── AnalyticsView      # Analytics e relatórios
│   │   ├── SettingsView       # Configurações do usuário
│   │   ├── layout/            # Sidebar + Header
│   │   └── __tests__/         # Testes unitários
│   └── ui/                    # shadcn/ui components
├── hooks/                     # Custom hooks (realtime, data, UI)
├── lib/                       # APIs, schemas, utils
├── integrations/supabase/     # Client + types (auto-gerados)
└── pages/                     # Index, Login, NotFound

supabase/functions/
├── ai-agent/       # Chat IA com contexto
├── gmaps-proxy/    # Proxy para GMaps Scraper
├── workflow-engine/# Motor de workflows
└── rls-tests/      # Testes de RLS
```

---

## Edge Functions

Veja [docs/edge-functions.md](docs/edge-functions.md) para documentação detalhada.

| Função            | Método     | Descrição                              |
|-------------------|-----------|----------------------------------------|
| `ai-agent`        | POST      | Chat IA com contexto do banco          |
| `gmaps-proxy`     | GET/POST/DELETE | CRUD de jobs + sync de resultados |
| `workflow-engine` | GET/POST/DELETE | Pipeline: raspar→enriquecer→pontuar |
| `rls-tests`       | POST      | Testes automatizados de isolamento RLS |

---

## Banco de Dados

### Tabelas Principais

| Tabela             | Propósito                         |
|--------------------|------------------------------------|
| `companies`        | Empresas prospectadas              |
| `workflows`        | Definições de pipelines            |
| `workflow_runs`    | Execuções de workflows             |
| `campaigns`        | Campanhas de outreach              |
| `scrape_jobs`      | Jobs de raspagem                   |
| `scrape_results`   | Resultados brutos de raspagem      |
| `intent_signals`   | Sinais de intenção de compra       |
| `stakeholders`     | Decisores/contatos por empresa     |
| `ipc_config`       | Configurações de IPC scoring       |
| `notifications`    | Notificações do sistema            |
| `profiles`         | Perfis de usuário                  |
| `agent_chat_messages` | Histórico do chat com IA        |

### RLS (Row-Level Security)

Todas as tabelas possuem RLS habilitado com isolamento por `user_id`:
- `SELECT/INSERT/UPDATE/DELETE` para `authenticated` onde `user_id = auth.uid()`
- `ALL` para `service_role` (operações internas das edge functions)
- Profiles usam `id = auth.uid()` (PK referencia auth.users)

---

## Autenticação e Segurança

- **Auth**: Email/senha via Lovable Cloud
- **JWT**: Validado em código nas edge functions
- **CORS**: Origin whitelist dinâmico
- **Input Validation**: Zod em todas as edge functions
- **RLS**: Isolamento completo por usuário
- **Realtime**: Canais privados por `user_id`
- **Logging**: Structured JSON em edge functions, sem console em produção
- **Error Boundary**: Fallback gracioso para erros React

---

## Testes

- **103 testes unitários** (Vitest + Testing Library)
- **E2E** (Playwright) — navegação e rotas protegidas
- **RLS** (edge function) — isolamento cross-user automatizado

---

## Design System

- **Tema**: Dark mode, accent dourado (#D4A520)
- **Background**: ~#0A0D14 com glass morphism
- **Tipografia**: Space Grotesk + JetBrains Mono
- **Tokens**: CSS custom properties → `tailwind.config.ts`

---

## Deploy

Deployado automaticamente via Lovable. Edge functions deployam ao salvar.

- **Produção**: `https://lux-ai-company-finder.lovable.app`

---

## ADRs

Veja [docs/adr/](docs/adr/) para Architecture Decision Records:

- [ADR-001: Design system gold/dark](docs/adr/001-design-system.md)
- [ADR-002: RLS por user_id](docs/adr/002-rls-isolation.md)
- [ADR-003: Edge functions como proxy](docs/adr/003-edge-functions-proxy.md)
- [ADR-004: Realtime privado](docs/adr/004-private-realtime-channels.md)
- [ADR-005: Lovable AI Gateway](docs/adr/005-ai-gateway.md)
- [ADR-006: Structured logging](docs/adr/006-structured-logging.md)
