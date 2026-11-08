---
name: promo-lux-v2
description: Convenções de código e commit do Promo Lux V2 / LUX IA (TypeScript, Conventional Commits). Use ao alterar código, criar testes ou escrever mensagem de commit neste repositório; as regras operacionais ficam em AGENTS.md.
---

# Promo Lux V2 (LUX IA) — convenções

As regras de trabalho (banco, fluxo Git, PR, comunicação) estão em `AGENTS.md` na raiz — este skill só
resume convenções de código e commit.

## Commits

Padrão Conventional Commits (`@commitlint/config-conventional`): `<tipo>(<escopo>): <descrição>` — escopo
opcional e minúsculo, assunto curto no imperativo e sem ponto final; tipos: `feat fix docs style refactor
perf test build ci chore revert`. Mensagem em PT-BR.

**Nada cobra isso localmente:** `.husky/` tem só `pre-commit` (`bun run lint && bunx tsc --noEmit &&
bun run test`); não existe hook `commit-msg`, e as duas configs do commitlint
(`commitlint.config.cjs` e `commitlint.config.js`) não são executadas por ninguém. Siga o padrão mesmo assim.

Exemplo: `fix(withOrg): bloqueia update cross-org em bulkDelete`

## Código

- Linguagem: TypeScript (front Vite 5 + React 19 em `src/`, edge functions Deno em `supabase/functions/`).
- Funções `camelCase`, componentes/classes `PascalCase`, constantes `SCREAMING_SNAKE_CASE`.
- Imports do front usam o alias `@/` (`@/components/...`, `@/hooks/...`) — configurado em `vite.config.ts`
  e `tsconfig.app.json`. Nas edges, import relativo com extensão `.ts` (runtime Deno).
- Exports nomeados; siga o padrão de import do arquivo vizinho.
- Acesso a tabela org-scoped no front **sempre** por `import { db } from "@/integrations/supabase/withOrg"`,
  nunca pelo client cru (ver `docs/agentes/regras-dominio.md`).
- `src/integrations/supabase/client.ts` e `types.ts` são **gerados** — não editar à mão.
- Sem `console.log` em código de produção (ADR-006): logging estruturado, nas edges via
  `_shared/oracle-logger.ts`.
- Testes unitários: `src/**/*.test.ts(x)` (projeto `app`, jsdom) e
  `supabase/functions/**/__tests__/*.test.ts` (projeto `edge`, node) — ambos **Vitest**. Rode só o que
  tocou: `npx vitest run <caminho>`. E2E Playwright em `e2e/` (`npm run test:e2e`, porta 8080).
- Siga os padrões já existentes no módulo; não desvie sem motivo registrado na PR.
