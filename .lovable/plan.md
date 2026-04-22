

## Documentação Executiva: Funcionalidades do LUX IA

Vou criar um documento técnico completo (`docs/FUNCIONALIDADES.md`) consolidando uma análise minuciosa de todas as funcionalidades do sistema, baseada na exploração completa do codebase.

### O que será documentado

**1. Visão Geral**
- Propósito: Plataforma de Sales Intelligence B2B com automação de prospecção via IPC (Ideal Profile Customer)
- Stack: React 18 + Vite + TypeScript + Tailwind + Supabase (Lovable Cloud)
- Tema: Dark gold com glass morphism, PT-BR

**2. Módulos Principais (12 views)**

| Módulo | Função |
|---|---|
| Dashboard | KPIs, performance semanal, atividades recentes, ações rápidas |
| Analytics | Conversão, enriquecimento de dados, gráficos animados, export PDF |
| Configurar IPC | Definição de critérios de pontuação do cliente ideal |
| Empresas | CRUD, filtros, busca, paginação, export CSV, score IPC |
| Sinais de Intenção | Tracking de visitas, downloads e engajamento por empresa |
| Stakeholders | Decisores por empresa (cargo, senioridade, LinkedIn, contato) |
| Workflows | Automações multi-etapas com workflow-engine edge function |
| Google Maps Scraper | Raspagem de empresas via gmaps-proxy edge function |
| Mapa de Empresas | Visualização geo com markers/clusters Leaflet |
| Campanhas | Sequências de prospecção (prospects, sent, opened, replied, meetings) |
| Agente IA | Chat com Gemini 2.5 Flash via Lovable AI Gateway, contexto do banco |
| Configurações | Perfil, skin, notificações, onboarding |

**3. Recursos Transversais**
- **Autenticação**: Email/senha + Google OAuth, reset de senha, rate limiting, modo demo
- **Realtime**: Subscriptions Supabase para `companies` e `scrape_jobs`
- **Atalhos**: Command Palette (⌘K), Alt+1-9, Modo Foco (⌘⇧F), toggle sidebar (⌘B)
- **Mobile**: Bottom nav, swipe gestures, viewport responsivo
- **Acessibilidade**: Skip nav, ARIA labels, navegação por teclado
- **PWA**: Service worker, manifest, página offline
- **Onboarding**: Tour guiado com spotlight, confetti
- **Notificações**: Painel com tipos system/scrape/signal
- **Personalização**: Skins, tema, preferências de notificação

**4. Backend (Lovable Cloud / Supabase)**
- **Tabelas (12)**: companies, stakeholders, workflows, workflow_runs, scrape_jobs, scrape_results, campaigns, intent_signals, ipc_config, profiles, notifications, agent_chat_messages
- **RLS**: Isolamento por `user_id` em todas as tabelas (ADR-002)
- **Edge Functions (4)**: gmaps-proxy, ai-agent, workflow-engine, rls-tests

**5. Qualidade & Infra**
- 216 testes unitários (Vitest) em 29 arquivos
- Suite E2E Playwright (auth, navegação, CRUD)
- CI no GitHub Actions (lint, typecheck, test, audit, e2e)
- 6 ADRs documentando decisões arquiteturais
- Logging estruturado em edge functions
- Integração GitHub bidirecional ativa

**6. Segurança**
- RLS em 100% das tabelas
- JWT validado em edge functions
- Zod para validação de input (cliente + servidor)
- CORS allowlist em edge functions
- Sanitização de HTML em `lib/sanitize.ts`

### Arquivo a criar
- `docs/FUNCIONALIDADES.md` (~400 linhas, estruturado com TOC, tabelas, e referências cruzadas para arquivos do código)

### Nota sobre análise no GitHub
O repositório GitHub é sincronizado bidirecionalmente em tempo real com o Lovable — o código que analisei aqui é **idêntico** ao do repositório. Não existe divergência entre as duas fontes; portanto a análise cobre ambos.

