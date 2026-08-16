# Dimensão 5 — Infraestrutura, CI e Testes

> Anexo de [`../ESTADO_ATUAL.md`](../ESTADO_ATUAL.md) · Commit `890c18d` · 2026-08-16
> **A dimensão mais grave da auditoria: zero itens ✅.**

**Total: 12 itens** — ✅ **0** · 🟨 7 · 🟦 2 · ⬛ 3

> ⚠️ **Nada foi executado.** `node_modules` vazio, Deno e Supabase CLI ausentes. Nenhuma afirmação aqui diz que algo compila ou que um teste passa. Todo o estado de CI vem da **API do GitHub** (conclusão real das execuções), não do que o YAML aparenta.

---

## 1. Estado dos 3 workflows — conclusão real, não aparência

| Workflow | Execuções | Conclusão | Classe |
|---|---:|---|:---:|
| `.github/workflows/ci.yml` | **382** | 30 mais recentes: **100% `failure`** (27/07 → 11/08) | ⬛ |
| `.github/workflows/edge-tests-daily.yml` | **24** | **24 / 24 `failure`** (24/07 → 16/08) | 🟨 |
| `.github/workflows/db-migrations.yml` | **1** | **1 / 1 `failure`** (01/08) | 🟨 |

**Nenhum workflow do repositório jamais concluiu com sucesso na janela observada.**

---

## 2. ⬛ O portão de qualidade nunca executou — `ci.yml` em base64

### 2.1 Três provas independentes

**Prova 1 — o arquivo no disco:**
```
$ wc -c .github/workflows/ci.yml   → 6168
$ wc -l .github/workflows/ci.yml   → 0
$ head -c 32 .github/workflows/ci.yml | od -c
0000000  b  m  F  t  Z  T  o  g  Q  0  k  g  U  G  l  w  ...
```
6.168 bytes, **zero quebras de linha**. `base64 -di` decodifica para YAML válido começando em `name: CI Pipeline`. **O que está versionado é o base64, não o YAML.**

**Prova 2 — o GitHub não consegue ler o arquivo.** `GET /actions/workflows` retorna:
```json
{ "name": ".github/workflows/ci.yml", "path": ".github/workflows/ci.yml", "state": "active" }
```
O campo `name` caiu para o caminho — o parser não encontrou `name:`. Comparação com os vizinhos íntegros, no mesmo endpoint: `"name": "Database Migrations"` e `"name": "Edge Functions Daily Tests (Deno)"`.

**Prova 3 — 382 execuções, 30/30 falhas** na amostra mais recente.

### 2.2 O que está morto junto

Decodificando o arquivo, o pipeline que **nunca rodou** contém 3 jobs e 12 steps:

| Job | Steps mortos |
|---|---|
| `quality-gate` | `npm run lint` · `npx tsc --noEmit` · `npm run test` · `npm run build` |
| `security-scan` | scan de `console.log` em produção (ADR-006) · scan de secrets hardcoded (AWS, Stripe) |
| `db-guards` | `check-function-grants.sh` · `check-audit-triggers.sh` · `check-anon-grants-view.sh` · `check-security-definer.sh` (ADR-009) · `check-queue-kind-coverage.sh` |

### 2.3 Bug de segunda ordem: consertar o base64 não basta

Duas falhas adicionais, invisíveis hoje porque o arquivo nem é lido:

**(a) Nome de secret digitado errado.** Contagem no arquivo decodificado:
```
2 × secrets.SUPAAASE_DB_URL     ← três letras A
3 × secrets.SUPABASE_DB_URL
```
Os 2 steps afetados são *"Verify function EXECUTE grants"* e *"Verify audit trigger integrity"*.

**(b) Os guards passam em verde quando a variável está vazia.** `scripts/check-function-grants.sh:14-19`:
```bash
DB_URL="${SUPABASE_DB_URL:-${DATABASE_URL:-}}"
if [[ -z "$DB_URL" ]]; then
  echo "::warning::SUPABASE_DB_URL ... não configurada — guard de grants/RLS ignorado."
  exit 0
fi
```
`check-audit-triggers.sh:13` tem o mesmo padrão. Variável vazia → **`exit 0` → step verde**.

**Combinação:** typo garante variável vazia → script emite *warning* e sai com 0 → o portão reporta "✅ Grants/RLS conforme o esperado" **sem ter consultado o banco**. É a asserção vacuamente verdadeira em forma pura. Corrigir apenas o base64 produz um CI que mente de forma mais discreta que hoje.

### 2.4 Um dos próprios scripts de guard também está em base64

`scripts/check-anon-grants-view.sh` — 2.784 bytes, **0 linhas**. Decodifica para `#!/usr/bin/env bash` + *"CI Guard — v_sec_definer_anon_grants view"*. Inexecutável como está.

**Nota de coerência:** a view que esse guard verifica, `v_sec_definer_anon_grants`, protege contra grants indevidos a `anon` em funções `SECURITY DEFINER`. Há **107** funções `SECURITY DEFINER` em `public` (ver [`03`](./03-dados-e-runtime.md)). O guard que as vigiaria está corrompido, dentro de um pipeline que não roda.

---

## 3. 🟨 `edge-tests-daily.yml` — roda todo dia e falha todo dia

24 execuções agendadas (`0 7 * * *`), **24 falhas**. Causa-raiz extraída do log da execução `31933381197` (2026-08-16):

```
error: Module not found "file:///.../supabase/functions/_shared/bitrix-client".
       Maybe add a '.ts' extension or run with --unstable-sloppy-imports
    at file:///.../supabase/functions/_shared/__tests__/bitrix-client.test.ts:2:91
##[error]Process completed with exit code 1.
```

**O diagnóstico correto não é "falta a extensão `.ts`".** É um descasamento arquitetural: o workflow roda `deno test` sobre arquivos que são **testes Vitest**.

```
$ head -2 supabase/functions/_shared/__tests__/bitrix-client.test.ts
import { describe, it, expect } from "vitest";
import { ... } from "../bitrix-client";
```

Há 10 arquivos com o mesmo padrão em `supabase/functions/**/__tests__/`. Eles estão corretamente registrados em `vitest.config.ts:54` (`include: ["supabase/functions/**/__tests__/**/*.test.ts"]`) — ou seja, o runner certo é `npm run test`, que vive em `ci.yml`… **que está em base64**.

**Resultado líquido:** os 22 testes de Edge Function têm dois runners e **nenhum funciona** — o Deno aborta na resolução de módulos, e o Vitest está dentro do pipeline morto.

---

## 4. Inventário de testes: 111 arquivos, 0 executados em CI

| # | Suíte | Arquivos | Runner configurado | Executa em CI? | Classe |
|---:|---|---:|---|:---:|:---:|
| 1 | Unit / integração (`src/`) | **69** | `vitest.config.ts:45` | ❌ só via `ci.yml` (base64) | 🟨 |
| 2 | Edge Functions | **22** | `vitest.config.ts:54` **e** `deno test` | ❌ ambos quebrados (§3) | 🟨 |
| 3 | E2E Playwright (`e2e/`, 2.221 L) | **20** | `playwright.config.ts` | ❌ **nenhum workflow menciona `playwright` ou `test:e2e`** | 🟦 |

**Verificação da suíte E2E:** `grep -rl "playwright\|test:e2e" .github/workflows/` → **nenhum resultado**. Confirmado também no `ci.yml` decodificado: `grep -c "playwright\|test:e2e"` → **0**. São 20 arquivos e 2.221 linhas de teste de ponta a ponta **sem runner nenhum** — a armadilha "sem runner" em estado puro.

**O que NÃO encontrei** (busquei ativamente, e é justo registrar):
- Apenas **5 ocorrências** de `.skip(` em todo o repositório — não há suíte desligada em massa.
- Apenas **5 `TODO`/`FIXME`** em `src/` — o código não está salpicado de pendências.
- Amostrei os testes de `_shared/__tests__/` e eles **importam o alvo real** (ex.: `import { calculateIPCScore } from "../scoring"`) — **não** são testes-espelho que reimplementam a lógica.

**A qualidade dos testes parece boa. O problema é que ninguém os executa.**

---

## 5. Demais itens de infraestrutura

| # | Item | Evidência | Classe |
|---:|---|---|:---:|
| 4 | `db-migrations.yml` | 158 linhas, YAML íntegro, nomes de secret corretos. **1 execução, `failure`**. **⚠️ Ver nota abaixo — este workflow aplica migrations em produção** | 🟨 |
| 5 | Migrations versionadas | 212 arquivos; **4 em base64**; ledger `supabase_migrations.schema_migrations` **inexistente** (ver [`03`](./03-dados-e-runtime.md) §5) | 🟨 |
| 6 | Husky + lint-staged + commitlint | `.husky/`, `commitlint.config.cjs` **e** `commitlint.config.js` (duplicado), `lint-staged` em `package.json` | 🟨 `NAO_VERIFICADO` — hooks locais, não observáveis daqui |
| 7 | Geração de PDF de auditoria no build | `package.json`: `"build": "vite build && (npm run generate-audit-pdf \|\| echo '...')"` | 🟨 O `\|\|` engole a falha por desenho; o PDF pode nunca ser gerado sem ninguém notar |
| 8 | Cobertura de código | `npm run test:coverage` + `@vitest/coverage-v8` existem; **nenhum gate de cobertura em nenhum workflow** | 🟦 |
| 9 | Scripts de guard de banco (5) | `check-function-grants.sh` (25 L) · `check-audit-triggers.sh` (25 L) · `check-security-definer.sh` (68 L) · `check-queue-kind-coverage.sh` (18 L) · `check-anon-grants-view.sh` (**base64**) | ⬛ Todos dentro do job `db-guards` do `ci.yml`, que nunca executa |
| 10 | Scan de `console.log` / secrets (ADR-006) | job `security-scan` no `ci.yml` decodificado | ⬛ Nunca executou |
| 11 | Portão `quality-gate` (lint/tsc/test/build) | job `quality-gate` no `ci.yml` decodificado | ⬛ Nunca executou |
| 12 | Workflow Copilot PR Reviewer | `dynamic/agents/copilot-pull-request-reviewer`, `state: active` | 🟨 `NAO_VERIFICADO` — gerenciado pela plataforma, fora do repo |

---

### 5.1 ⚠️ `db-migrations.yml` aplica migrations em produção — gap da primeira versão

> **🔧 ADIÇÃO (Errata E5).** A primeira versão classificou este workflow como 🟨 sem registrar o que ele faz ao concluir. Isso é material para o plano de correção.

`db-migrations.yml:22-31`:

```yaml
on:
  pull_request:
    paths: ['supabase/migrations/**', '.github/workflows/db-migrations.yml']
  push:
    branches: [main, master]
    paths: ['supabase/migrations/**']
```

O próprio cabeçalho declara o desenho: *"pull_request → staging (somente validação), push em main → production (aplica)"*, com credenciais em GitHub Environments e *"o Environment `production` deve ter Required reviewers ativado"*.

**Consequência prática para o item 1 do plano de correção:** decodificar `ci.yml`, os 2 scripts/functions e `docs/auth.md` é inócuo. **Decodificar as 4 migrations não é** — assim que o arquivo virar SQL legível e chegar à `main`, ele entra no fluxo de aplicação em produção. O `Required reviewers` é uma trava real, mas passa a ser um clique de aprovação em vez de um passo deliberado e separado.

Por isso o plano executivo foi reescrito: **item 1 agora cobre apenas os 5 arquivos não-migration**, e as 4 migrations migraram para o item 8, na faixa "toca produção — é decisão sua".

*Ressalva:* não consigo verificar daqui se `Required reviewers` está de fato ativado no Environment `production` — isso é configuração da organização no GitHub, fora do repositório. **`NAO_VERIFICADO`.** Se não estiver, o risco sobe de Médio para Alto.

---

## 6. Varredura de corrupção — cobertura de 100% dos arquivos versionados

Critério: arquivo versionado, não-binário, `> 500` bytes, **0 quebras de linha**, primeiros 32 bytes casando `^[A-Za-z0-9+/]+$`. Aplicado aos 952 arquivos de `git ls-files` (excluindo `png|jpg|jpeg|gif|svg|ico|webp|pdf|lockb|lock`).

**9 achados. Todos confirmados por `base64 -di` produzindo código-fonte legível.**

| Arquivo | Bytes | Primeira linha decodificada |
|---|---:|---|
| `.github/workflows/ci.yml` | 6.168 | `name: CI Pipeline` |
| `docs/auth.md` | 2.968 | `# Estratégia de Autenticação — LUX IA` |
| `scripts/check-anon-grants-view.sh` | 2.784 | `#!/usr/bin/env bash` |
| `supabase/functions/deliverability-check/index.ts` | 9.876 | `import { serve } from "https://deno.land/std@0.168.0/http/server.ts";` |
| `supabase/functions/email-verify/index.ts` | 9.844 | idem |
| `supabase/migrations/20260721083823_A1-assert-service-or-admin-guard.sql` | 10.960 | `-- Migration A1: assert_service_or_admin() — Guard Centralizado` |
| `supabase/migrations/20260721084800_A3A4-extensions-audit-partial-indexes.sql` | 8.968 | `CREATE OR REPLACE VIEW public.v_extensions_audit` |
| `supabase/migrations/20260721235500_C14-ab-testing-assignment-chisquare.sql` | 8.824 | `CREATE TABLE IF NOT EXISTS public.ab_assignments` |
| `supabase/migrations/20260722000001_D18-durable-workflow-execution.sql` | 9.778 | `-- Migration D18: Durable Workflow Execution` |

**Origem — corrigida na segunda rodada de validação:**

> **🔧 CORREÇÃO (Errata E1).**
> **Redação original, incorreta:** *"`git log -- .github/workflows/ci.yml` retorna um único commit, `f3400e4` (2026-07-26), e o arquivo já nasceu em base64 nesse commit. Não houve regressão posterior — o dano entrou junto com o arquivo."*
> **Por que estava errada:** paginei a API de execuções até o fim. A run **#1**, de **2026-05-11T13:41:20Z** (*"Add integration configuration from remix"*), **já falhou** — e as 23 mais antigas também, todas `failure`. O CI já estava quebrado **dez semanas antes** do commit que o `git log` aponta.
> **Conclusão:** o histórico git deste repositório foi **esmagado/reimportado** (o workflow existe no GitHub desde 2026-05-11, mas o `git log` local conhece um único commit de 26/07). **`git log` não é fonte confiável para datar a corrupção neste repo.** Não sei quando o dano entrou; sei que **nunca houve um estado bom** no período observável.

**O que a correção reforça:** a amostragem ampliada tornou o achado **mais forte**, não mais fraco. Cobrindo as execuções mais recentes *e* as mais antigas:

| Amostra | Janela | Resultado |
|---|---|---|
| Página 1 (runs 354–383) | 2026-07-27 → 2026-08-11 | 30/30 `failure` |
| Página 4 (runs 264–293) | 2026-07-22 → 2026-07-23 | 30/30 `failure` |
| Página 13 (runs 1–23) | **2026-05-11** → 2026-05-16 | **23/23 `failure`** |

**383 execuções ao longo de 3 meses, e nenhum sucesso em nenhuma amostra — incluindo a primeira execução do workflow.**

**Correção proposta (barata, reversível):** `base64 -di <arquivo> > tmp && mv tmp <arquivo>` para os 9, com `git diff` legível para revisão. Não toca produção.

---

## 7. Lacunas desta dimensão

- **Não executei build, lint, `tsc` nem teste algum.** Não posso afirmar que o código compila, nem que os 111 testes passariam se rodassem. Só afirmo que **não rodam**.
- **Não li os logs de todas as 407 execuções** de workflow. Amostrei: 30 de `ci.yml` (conclusão), 24 de `edge-tests-daily` (conclusão) + 1 log completo, 1 de `db-migrations` (conclusão).
- **Hooks de Git locais** (husky) e o **Copilot PR Reviewer** são `NAO_VERIFICADO` — não observáveis a partir do repositório.
- **Não avaliei a qualidade das asserções** dos 111 testes um a um. Amostrei ~10 e não encontrei teste-espelho; isso é amostra, não prova de ausência.
