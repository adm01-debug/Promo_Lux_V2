# 01 — INVENTÁRIO DO SISTEMA E REGISTRO DE COBERTURA

> Auditoria de QA somente leitura · **Data:** 2026-11-22 · **Commit auditado:** `9b85ca6`
> **Branch base:** `main` · **Projeto Supabase oficial:** `pttzwlbidamibjssqiqb`
> Cada item termina com **status de cobertura**: `revisado` ou `não revisado + motivo`.
> Marcações: **EXECUTADO** = comando/teste rodado e resultado observado · **RASTREADO** = caminho seguido pelo código.

---

## 0. Suposições declaradas (o dono não preencheu o campo de contexto)

Deduzidas do código e da documentação do repositório, para registro:

| #   | Suposição                                                                                                                                                                                                                                              | Base                                                                                                                                             |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| S1  | O sistema é uma plataforma de **prospecção B2B / CRM**: raspa empresas (Google Maps), enriquece dados (CNPJ, Lusha, Instagram, Apollo), pontua por perfil ideal de cliente (ICP) e empurra oportunidades para um pipeline de negócios e para o Bitrix. | `src/lib/viewRegistry.ts:10-32`, `supabase/functions/` (gmaps, cnpj, lusha, oracle, bitrix), `docs/agentes/servicos-externos.md`                 |
| S2  | É **multi-organização** (multi-tenant): o mesmo sistema atende várias organizações, com isolamento por `organization_id`.                                                                                                                              | `src/integrations/supabase/withOrg.ts`, `public.has_org_role` em `supabase/migrations/20260422201601_*.sql:46`                                   |
| S3  | Os papéis são **admin, sdr, viewer**.                                                                                                                                                                                                                  | `CREATE TYPE public.app_role AS ENUM ('admin','sdr','viewer')` — `supabase/migrations/20260422201601_940b28cc-0f04-4a93-9866-11fd3d1edba5.sql:3` |
| S4  | **Produção real é a Vercel** (`https://promo-lux-v2.vercel.app`); o endereço Lovable é legado e serve bundle antigo apontando para projeto Supabase extinto.                                                                                           | `vercel.json`, `AGENTS.md` §Serviços, `docs/agentes/lovable-deploy.md`                                                                           |
| S5  | O usuário final típico é um operador comercial (SDR) e o dono/administrador da operação.                                                                                                                                                               | telas de `src/components/lux/` (deals, campaigns, stakeholders)                                                                                  |

---

## 1. Stack, estrutura e build

| Item           | Valor                                                              | Evidência                                  |
| -------------- | ------------------------------------------------------------------ | ------------------------------------------ |
| Front          | Vite 5 + React 19 + TypeScript 5                                   | `package.json`, `vite.config.ts`           |
| UI             | Tailwind 3 + shadcn/ui + framer-motion                             | `tailwind.config.ts`, `components.json`    |
| Estado/dados   | TanStack Query v5 + React Router 6                                 | `src/App.tsx:2-10,48-80`                   |
| Backend        | Supabase Edge Functions (Deno)                                     | `supabase/functions/`                      |
| Banco          | Postgres gerenciado (Supabase)                                     | `supabase/migrations/`                     |
| Testes         | Vitest (projetos `app` e `edge`) + Playwright                      | `vitest.config.ts`, `playwright.config.ts` |
| Deploy front   | Vercel (`framework: vite`, `outputDirectory: dist`)                | `vercel.json`                              |
| Deploy backend | `.github/workflows/edge-functions-deploy.yml` com aprovação manual | `.github/workflows/`                       |
| Deploy banco   | `.github/workflows/db-migrations.yml` no push da `main`            | `.github/workflows/`                       |

**Contagem medida (EXECUTADO — `find`/`ls` em 2026-11-22):**

| Camada                                 | Quantidade |
| -------------------------------------- | ---------: |
| Arquivos TS/TSX em `src/`              |        495 |
| Páginas (`src/pages/`)                 |         11 |
| Componentes (`src/components/`)        |        303 |
| Hooks (`src/hooks/`)                   |        102 |
| Edge Functions (`supabase/functions/`) |         61 |
| Migrations (`supabase/migrations/`)    |        241 |
| Workflows de CI (`.github/workflows/`) |          9 |
| Arquivos de E2E (`e2e/`)               |         20 |

### Ambientes

| Ambiente              | Onde                                | Status de cobertura                                                                                                         |
| --------------------- | ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Produção (front)      | Vercel — `promo-lux-v2.vercel.app`  | **revisado** por configuração (`vercel.json`); **não revisado** em execução ao vivo (sem credencial de deploy nesta sessão) |
| Produção (banco/edge) | Supabase `pttzwlbidamibjssqiqb`     | **não revisado ao vivo** — ver §6 (bloqueio de acesso)                                                                      |
| Legado Lovable        | `lux-ai-company-finder.lovable.app` | **revisado por documentação**; declarado morto em `AGENTS.md`                                                               |
| CI                    | GitHub Actions                      | **revisado**                                                                                                                |
| Local / teste         | Vitest + Playwright (porta 8080)    | **revisado**, com execução                                                                                                  |

---

## 2. Rotas (URLs) — 12 declaradas

Fonte: `src/App.tsx:177-275` (RASTREADO, linha a linha) + `docs/contexto/codigo/rotas.json` (gerado).

| Caminho                   | Componente                      | Guarda                                                                                  | Status cobertura |
| ------------------------- | ------------------------------- | --------------------------------------------------------------------------------------- | ---------------- |
| `/login`                  | `pages/Login.tsx`               | `PublicRoute`                                                                           | revisado         |
| `/.lovable/oauth/consent` | `pages/OAuthConsent.tsx`        | **nenhuma** (público)                                                                   | revisado         |
| `/reset-password`         | `pages/ResetPassword.tsx`       | **nenhuma** (público)                                                                   | revisado         |
| `/invite/:token`          | `pages/AcceptInvite.tsx`        | **nenhuma** (público, por token)                                                        | revisado         |
| `/`                       | `pages/Index.tsx`               | `ProtectedRoute`                                                                        | revisado         |
| `/monitoring`             | `pages/Monitoring.tsx`          | `ProtectedRoute`                                                                        | revisado         |
| `/settings/cnpj`          | `pages/CnpjSettingsPage.tsx`    | `ProtectedRoute`                                                                        | revisado         |
| `/admin/companies`        | `pages/AdminCompanies.tsx`      | `ProtectedRoute` (sem guarda de papel no roteador; o papel é validado na edge function) | revisado         |
| `/survey/:token`          | `pages/SurveyResponse.tsx`      | **nenhuma** (público, por token)                                                        | revisado         |
| `/status`                 | `pages/StatusPage.tsx`          | **nenhuma** (público)                                                                   | revisado         |
| `/lusha`                  | redireciona para `/?view=lusha` | —                                                                                       | revisado         |
| `*`                       | `pages/NotFound.tsx`            | —                                                                                       | revisado         |

**Nota de arquitetura:** o sistema é uma SPA de rota única. As 23 telas de negócio não são rotas: são "views" resolvidas por `?view=<id>` dentro de `/` (`src/lib/viewRegistry.ts`). Consequência registrada como achado: uma view não tem guarda de rota própria.

---

## 3. Views de negócio — 23 registradas

Fonte: `src/lib/viewRegistry.ts:10-32` e `:47-69` (RASTREADO).

`dashboard`, `icp`, `workflows`, `companies`, `intent`, `campaigns`, `ai-agent`, `analytics`, `settings`, `gmaps`, `scrape-results`, `map`, `stakeholders`, `organizations`, `deals`, `integrations`, `org-violations`, `rls-discovery`, `monitoring`, `automations`, `recycle-bin`, `suppressions`, `lusha`.

Status de cobertura: **todas revisadas** quanto a registro e importação; cobertura funcional por tela está em `02-CENARIOS.md`.

---

## 4. Atores e papéis

| Ator                               | Como entra                                                                                            | Pode                                                                             | Status cobertura                                                                       |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Visitante sem login                | `/login`, `/status`, `/survey/:token`, `/invite/:token`, `/reset-password`, `/.lovable/oauth/consent` | ver páginas públicas; responder pesquisa por token; aceitar convite por token    | revisado                                                                               |
| Visitante em **modo demonstração** | botão em `/login` → `enterDemo()` (`src/pages/Login.tsx:17-20`) grava `lux-demo-mode` no navegador    | ver TODAS as telas protegidas com dados fictícios, sem login (`src/App.tsx:145`) | revisado                                                                               |
| `viewer`                           | login + vínculo em `organization_members`                                                             | leitura                                                                          | revisado                                                                               |
| `sdr`                              | idem                                                                                                  | operar prospecção e pipeline                                                     | revisado                                                                               |
| `admin`                            | idem                                                                                                  | administrar organização, membros, integrações; `/admin/companies`                | revisado                                                                               |
| Serviço / cron                     | `pg_cron` no banco chamando edge functions                                                            | executar workers e rotinas                                                       | **parcialmente revisado** — o cron real vive no banco e não é verificável nesta sessão |

---

## 5. Variáveis de ambiente

**Front (vão para o bundle público — EXECUTADO, `grep -rhoE "VITE_[A-Z0-9_]+" src/ e2e/ index.html`):** apenas 3, nenhuma secreta:
`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID`.

**Backend (EXECUTADO, `grep -rhoE 'Deno\.env\.get' supabase/functions/`), por frequência de leitura:**
`SUPABASE_URL` (70), `SUPABASE_SERVICE_ROLE_KEY` (53), `SUPABASE_ANON_KEY` (31), `GOOGLE_MAPS_API_KEY` (7), `SUPABASE_EXTERNAL_URL` (6), `SUPABASE_EXTERNAL_ANON_KEY` (6), `MS_OAUTH_CLIENT_ID` (6), `LOVABLE_API_KEY` (6), `GOOGLE_OAUTH_CLIENT_ID` (6), `EXTERNAL_VAULT_ANON_KEY` (6), `MS_OAUTH_CLIENT_SECRET` (5), `GOOGLE_OAUTH_CLIENT_SECRET` (5), `TRACKING_SIGNING_SECRET` (3), `CNPJA_API_KEY` / `CNPJA_LIMIT_RPM` / `CNPJA_OPEN_LIMIT_RPM` (3), `LUSHA_API_KEY` (2), `HIKER_API_KEY` / `HIKER_MOCK_MODE` (2), `BITRIX_WEBHOOK_BASE` (2), `APOLLO_API_KEY` (2), `APIFY_API_KEY` / `APIFY_MOCK_MODE` (2), `MCP_SECRET` (1), `QA_INGEST_TOKEN` (1), `SUPABASE_DB_URL` (1).

Status de cobertura: **revisado** no código. **Não revisado**: quais estão de fato configuradas em cada ambiente (painel Supabase/Vercel/GitHub Environments não acessível nesta sessão para leitura de nomes).

---

## 6. Camadas NÃO cobertas e por quê

| Camada / item                                                                            | Motivo exato                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Efeito na auditoria                                                                                                                                   |
| ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Estado vivo do banco de produção** (tabelas, policies, índices, dados órfãos, tamanho) | Nesta sessão não há MCP de SQL para `pttzwlbidamibjssqiqb`. Os MCPs Supabase carregados servem outros projetos (`pgxfvjmuubtbowutlide`, `doufsxqlfjyuvxuezpln`, e os gateways Promo Champions / Promo Finance / Zapp), nos quais é proibido escrever ou basear conclusões. O snapshot gerado `docs/contexto/supabase/` **não existe** — `git show origin/contexto:docs/contexto/00-INDEX.md` registra "ainda não existe — o produtor não rodou", porque o job depende do secret `SUPABASE_DB_URL`. | Toda a camada de banco foi auditada **sobre o versionado** (`supabase/migrations/`). Divergência entre migrations e schema real é **NÃO VERIFICADO**. |
| **`pg_cron` real**                                                                       | Vive no banco, fora do repositório.                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Crons são auditados só quando versionados em migration. Worker sem cron versionado é hipótese, não fato.                                              |
| **Logs de produção (edge functions, Vercel)**                                            | Sem credencial de leitura de logs do projeto oficial nesta sessão.                                                                                                                                                                                                                                                                                                                                                                                                                                 | Falhas intermitentes de produção não detectáveis.                                                                                                     |
| **Teste de carga e concorrência real**                                                   | Exigiria escrever em produção.                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Concorrência avaliada só por leitura de código (RASTREADO).                                                                                           |
| **Restore de backup ponta a ponta**                                                      | Exigiria operação destrutiva/custo.                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Não avaliado.                                                                                                                                         |
| **Integrações externas ao vivo** (GMaps Scraper, Lusha, Apify/Hiker, Bitrix, CNPJá)      | Chamadas reais consomem crédito e escrevem no terceiro.                                                                                                                                                                                                                                                                                                                                                                                                                                            | Contratos auditados por leitura do código do cliente.                                                                                                 |
| **MCPs de plugin que falharam ao conectar**                                              | `plugin:rls-schema-explorer:supabase`, `plugin:engineering:github`, `figma`, `slack`, `notion`, `linear`, `datadog` e outros retornaram erro de túnel do proxy (403) ou exigem autorização.                                                                                                                                                                                                                                                                                                        | Nenhuma conclusão foi tirada deles.                                                                                                                   |
| **Acessibilidade completa e i18n**                                                       | Fora do escopo desta passagem; só casos grosseiros foram registrados.                                                                                                                                                                                                                                                                                                                                                                                                                              | Parcial.                                                                                                                                              |

---

## 7. Gates locais executados nesta auditoria (EXECUTADO)

| Comando                                 | Resultado                                                     | Observação                                                                                           |
| --------------------------------------- | ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `npm install --legacy-peer-deps`        | exit 0                                                        | reproduz o CI                                                                                        |
| `npx tsc --noEmit -p tsconfig.app.json` | **exit 0**                                                    | sem erro de tipo                                                                                     |
| `npm run test` (Vitest)                 | **exit 0 — 89 arquivos, 987 testes, todos passando, 25,69 s** |                                                                                                      |
| `npm run lint`                          | **exit 1 — 22 erros, 4 avisos**                               | contradiz `AGENTS.md`/`docs/ESTADO_ATUAL.md`, que afirmam "eslint 0 errors". Registrado como achado. |

---

## 8. Registro de cobertura por camada

| Camada                            |                                              Itens | Como foi coberto                                                                                                                                                                                                    | Status                                                                                                 |
| --------------------------------- | -------------------------------------------------: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Rotas (URLs)                      |                                                 12 | Lidas uma a uma em `src/App.tsx:177-275`, com guarda e ponto de entrada conferidos                                                                                                                                  | **revisado — 12/12**                                                                                   |
| Páginas (`src/pages/`)            |                                                 11 | Lidas; as de maior superfície (`Monitoring.tsx`, `AdminCompanies.tsx`, `Index.tsx`, `Login.tsx`) em detalhe                                                                                                         | **revisado — 11/11**                                                                                   |
| Views de negócio (`viewRegistry`) |                                                 23 | Registro, importação e existência do símbolo conferidos nas 23; cobertura funcional varia por tela                                                                                                                  | **revisado — 23/23** no registro                                                                       |
| Componentes (`src/components/`)   |                               303 (272 sem testes) | Varredura por padrão (botão sem ação, estado de consulta, componente órfão, diálogo sem título, consulta sem limite) + leitura dirigida dos apontados                                                               | **revisado por varredura**; leitura integral: não (volume)                                             |
| Hooks (`src/hooks/`)              |                                                102 | Varredura por padrão (dependência de efeito, chave de cache, invalidação, limpeza de escuta, erro ignorado) + leitura dos apontados                                                                                 | **revisado por varredura**; leitura integral: não                                                      |
| Contextos                         | 5 (Auth, ActiveOrg, Demo, Confirm, UnsavedChanges) | Lidos integralmente                                                                                                                                                                                                 | **revisado — 5/5**                                                                                     |
| Edge Functions                    |                                                 61 | Inventariadas uma a uma (o que faz, exige token, usa chave privilegiada, quem chama); leitura detalhada nas sensíveis                                                                                               | **revisado — 61/61**                                                                                   |
| Migrations                        |                                                241 | Reproduzidas em ordem para montar o estado versionado (tabelas, políticas, funções, gatilhos, índices, chaves estrangeiras), cruzado com o que o código consulta                                                    | **revisado — 241/241, no versionado**                                                                  |
| Tabelas                           |                                        118 criadas | Controle de acesso, políticas por operação, chaves estrangeiras, restrições, índices                                                                                                                                | **revisado no versionado**; estado real: **não coberto** (§6)                                          |
| Funções SQL                       |                                                170 | Privilégio elevado e caminho de busca conferidos                                                                                                                                                                    | **revisado no versionado**                                                                             |
| Gatilhos                          |                                                113 | Cobertura de auditoria conferida                                                                                                                                                                                    | **revisado no versionado**                                                                             |
| Rotinas agendadas                 |                                     18 versionadas | Conferidas contra as funções que chamam                                                                                                                                                                             | **revisado no versionado**; quais rodam de fato: **não coberto**                                       |
| Integrações externas              |                                                 14 | Provedor, onde o código vive, segredo usado, tempo-limite, idempotência, teto de gasto                                                                                                                              | **revisado**; chamadas reais: **não executadas**                                                       |
| Webhooks                          |                                            6 rotas | Assinatura, idempotência, nova tentativa, fila morta                                                                                                                                                                | **revisado**                                                                                           |
| Filas                             |                                                  9 | Produtor, consumidor, reserva, destrave, alerta                                                                                                                                                                     | **revisado no versionado**                                                                             |
| Workflows de CI                   |                                                  9 | Lidos integralmente; gatilho, o que roda, se bloqueia                                                                                                                                                               | **revisado — 9/9**                                                                                     |
| Scripts de guarda                 |                                                  8 | Lidos e executados localmente                                                                                                                                                                                       | **revisado — 8/8**                                                                                     |
| Variáveis de ambiente             |                         3 públicas + 24 de backend | Levantadas por varredura no código                                                                                                                                                                                  | **revisado no código**; configuração em cada ambiente: **não coberto**                                 |
| Buckets de arquivos               |                          nenhum em uso pelo código | Varredura por `storage.from`, `supabase.storage` e `createBucket` em `src/`, `supabase/functions/` e `supabase/migrations/` devolve apenas uma referência de rota no canal MCP e um papel de sistema numa migration | **revisado — nenhum uso no código**; se existem buckets criados no painel, isso é **não coberto** (§6) |
| Testes automatizados              |                            89 arquivos / 987 casos | Executados                                                                                                                                                                                                          | **revisado — executado**                                                                               |
| Testes de interface               |                                        20 arquivos | 5 arquivos executados (46 casos) + suíte de controle de acesso (77 casos)                                                                                                                                           | **parcialmente executado**; os que exigem banco real: **não executados**                               |
| Acessibilidade                    |                                                  — | Apenas casos evidentes                                                                                                                                                                                              | **parcialmente revisado**                                                                              |
| Tradução / idiomas                |                                                  — | Fora do escopo desta passagem                                                                                                                                                                                       | **não revisado**                                                                                       |
