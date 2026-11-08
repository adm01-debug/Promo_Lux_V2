# Mapa do repositório — referência para agentes

Ler quando precisar saber onde fica algo antes de buscar por texto.

## Onde olhar primeiro

| Precisa de | Leia |
|---|---|
| **O que está vivo × o que é fachada — antes de qualquer tarefa** | **`docs/ESTADO_ATUAL.md`** (índice executivo, 156 funcionalidades classificadas com evidência) |
| Evidência por dimensão (front, edge, dados, integrações, infra) | `docs/estado/01-frontend.md` · `02-backend-edge-functions.md` · `03-dados-e-runtime.md` · `04-integracoes.md` · `05-infra-ci-testes.md` |
| Qual banco, migrations, ledger, RLS | `AGENTS.md` + `docs/agentes/banco.md` |
| Deploy, env vars, domínio | `docs/agentes/lovable-deploy.md` |
| Estado do CI, workflows, perímetro do GitHub | `docs/agentes/github-ci.md` |
| Integrações externas (GMaps, Lusha, CNPJá, Apify/Hiker, Bitrix, Apollo, OAuth de e-mail) | `docs/agentes/servicos-externos.md` + `docs/estado/04-integracoes.md` |
| Regras de negócio que o código não deixa óbvio | `docs/agentes/regras-dominio.md` |
| Decisões de arquitetura | `docs/adr/` (29 ADRs) |
| Runbooks operacionais | `docs/runbooks/` (`migrations.md`, `migration-template.md`, `disaster-recovery.md`) |
| Histórico, auditorias e planos antigos | `docs/AUDITORIA_*.md`, `docs/GAPS-ENTERPRISE.md`, `docs/auditoria-backend-2026-07-12.md` — contexto, **não** fonte de verdade |

**O `README.md` está defasado** — anuncia "12 tabelas" e 4 edge functions; a realidade medida é 95 tabelas
e 59 pastas em `supabase/functions/` (`docs/estado/03-dados-e-runtime.md` §1). Use-o para entender a
intenção do produto, nunca para afirmar estado.

## Mapa rápido

| Onde | O que tem |
|---|---|
| `src/` | front Vite + React 19: `components/lux/` (telas por domínio), `components/ui/` (shadcn), `components/auth/`, `components/automation/`, `hooks/` (73 arquivos), `pages/` (9 rotas), `lib/`, `contexts/AuthContext.tsx` |
| `src/integrations/supabase/` | `client.ts` e `types.ts` (**gerados — não editar à mão**) e `withOrg.ts`, a camada de isolamento multi-tenant |
| `supabase/functions/` | 58 edge functions Deno + `_shared/` (clientes de integração, `org-membership.ts`, `ssrf-guard.ts`, `schemas.ts` Zod, `circuit-breaker.ts`, `rlsTableRegistry.ts`) |
| `supabase/functions/mcp/` | servidor MCP do próprio produto (5 tools de leitura); manifesto em `.lovable/mcp/manifest.json` |
| `supabase/migrations/` | 212 arquivos `.sql`; **4 corrompidos em base64** e sem ledger no banco (ver `banco.md`) |
| `supabase/config.toml` | `verify_jwt` por função — e um `project_id` divergente do projeto vivo (ver `banco.md`) |
| `e2e/` | 20 specs Playwright + `helpers/` (`auth.ts`, `supabase.ts`, `lushaMocks.ts`, `selectors.ts`) e `fixtures/companies.json` |
| `scripts/` | guards de banco (`check-*.sh`), SQL dos guards em `scripts/sql/`, geradores de relatório (`gen-*.ts`), `generate-audit-pdf.ts`, `seed_promo_brindes.sql` |
| `scripts/ci/` | guardas que você pode rodar antes do PR (`check-claude-md-integrity.mjs`) |
| `scripts/graphify/` | setup do grafo de código (ver README da pasta) |
| `.lovable/` | `plan.md`, `memory/design/tokens.md`, `mcp/manifest.json` — artefatos da plataforma |

## Automações

Automação nova vive em `scripts/<nome>/` com `README.md` dizendo o que faz, como rodar e que secrets usa.
**Leia o README antes de alterar.** Scripts em `scripts/`; a saída deles em `docs/` — nunca misturar os
dois. Não use `supabase/scripts` (o CLI do Supabase é dono de `supabase/`) nem `src/scripts` (entra no
bundle). Os scripts já existentes na raiz de `scripts/` são legado — não replique o padrão.

## Comandos

O repo tem **`package-lock.json`, `bun.lock` e `bun.lockb`** ao mesmo tempo. O CI instala com
`npm install --legacy-peer-deps` (sem a flag, `ERESOLVE` aborta: a árvore declara peer ranges de React
17/18 e date-fns 2/3) e o hook `pre-commit` usa `bun`. Para reproduzir o CI, use npm; para reproduzir o
hook, bun.

- testes unitários só do que você tocou: `npx vitest run <caminho>` — dois projetos em `vitest.config.ts`:
  `app` (jsdom, `src/**`) e `edge` (node, `supabase/functions/**/__tests__/**`);
- typecheck: `npx tsc --noEmit`; lint dos arquivos tocados: `npx eslint <arquivos>`;
- E2E: `npm run test:e2e` (Playwright; o `webServer` sobe `npm run dev` na **porta 8080** — `baseURL` e
  `vite.config.ts` precisam continuar batendo, senão todo `page.goto` falha);
- cobertura: `npm run test:coverage` (limiar 70% em linhas/funções/branches/statements);
- banco local: `npm run db:start`, `npm run db:reset`, `npm run db:lint`, `npm run db:plan` (dry-run),
  `npm run db:status`;
- guards de banco: `npm run test:grants`, `npm run test:audit-triggers`,
  `bash scripts/check-security-definer.sh`, `bash scripts/check-queue-kind-coverage.sh` — **todos saem
  verdes sem `SUPABASE_DB_URL`** (ver `github-ci.md` §armadilhas);
- integridade das instruções de agente: `node scripts/ci/check-claude-md-integrity.mjs`;
- hook do husky: só `pre-commit` (`bun run lint && bunx tsc --noEmit && bun run test`). **Não há
  `commit-msg`** — o `commitlint` instalado não é executado por nada.

## Grafo de código (graphify) — detalhes

`npm run graph:setup` → `scripts/graphify/setup.sh`; precisa de `uv` ou `pipx`. `graphify-out/` fica no
`.gitignore`: cada clone gera o seu. Frescura: compare `git rev-parse --short HEAD` com a linha
"Built from commit" de `graphify-out/GRAPH_REPORT.md`; se divergir, `graphify update .` (só AST, sem custo
de API). Os hooks `PreToolUse` em `.claude/settings.json` chamam `graphify hook-guard` e não fazem nada
onde o graphify não estiver instalado. Em sessão de nuvem, `.claude/hooks/session-start.sh` instala o
graphify e gera o grafo em segundo plano (log em `graphify-out/.session-start.log`; pula se o grafo já é do
commit atual).
