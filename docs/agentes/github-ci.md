# GitHub (perímetro, CI, workflows) — referência para agentes

Ler quando mexer em settings do repo, branch protection, `.github/workflows/`, ou quando um merge ou um
workflow falhar de forma estranha.

## Escrita no GitHub

- Repo `adm01-debug/Promo_Lux_V2` (grafia canônica; a API aceita `promo_lux_v2`), branch `main`, **privado**.
- **Escrita: somente MCP `GITHUB - MCP - FOREVER`** (`github_push_files`). O MCP padrão do GitHub retorna
  403 em write. `github_push_files` sobrescreve o arquivo — mande o conteúdo integral com apenas a mudança
  semântica, e confira depois que o arquivo remoto bate com o que você testou. Ele aceita `files` e `delete`
  no mesmo commit (1 commit atômico).
- `git push`/`gh` só quando o repo estiver entre as fontes autorizadas da sessão; fora disso o proxy devolve
  403 e a escrita vai pelo MCP.
- Commits: Conventional Commits `<tipo>(<escopo>): <assunto>`. **Nenhum hook valida isso**: `.husky/` tem só
  `pre-commit`; o `commitlint` está instalado com config duplicada (`commitlint.config.cjs` **e**
  `commitlint.config.js`) e nada o chama. Siga o padrão mesmo assim.
- Para listar PRs abertas com os arquivos que tocam numa chamada só, use `github_graphql`
  (`pullRequests(states:OPEN){ nodes { number files { nodes { path } } } }`):
  `github_list_pull_requests` devolve o repositório inteiro em cada nó e estoura o contexto.

## Perímetro do GitHub — estado canônico

**Regra:** qualquer mudança nos campos abaixo atualiza **esta tabela** no mesmo PR.

| Campo | Estado canônico (medido) | Como conferir |
|---|---|---|
| Branch protection | **nenhuma regra** (`branchProtectionRules` vazio) | `github_graphql` |
| Required checks | **nenhum** — não existe check obrigatório | idem |
| Review obrigatório | nenhum | idem |
| Merge | `allow_squash_merge=true` · `allow_merge_commit=true` · `allow_rebase_merge=true` | idem |
| `delete_branch_on_merge` | **`false`** — a branch sobrevive ao merge; apague você mesmo | idem |
| `allow_auto_merge` | **`false`** — não existe auto-merge aqui | idem |
| Environments | `staging` e `production` usados por `db-migrations.yml`; "Required reviewers" em `production` é **NÃO VERIFICADO** (configuração de org, fora do repo) | API / painel |
| Workflow Copilot PR Reviewer | `dynamic/agents/copilot-pull-request-reviewer`, ativo — gerenciado pela plataforma, fora do repo | `docs/estado/05-infra-ci-testes.md` §5 (medido em 2026-08-16, não reconferido) |

**Consequência prática:** "CI verde" não é critério de merge neste repo, porque não há CI que conclua. O
critério utilizável é **os gates locais (`lint`, `tsc`, `vitest`) passando no que você tocou** — rode e cite
a saída na PR. E como `delete_branch_on_merge=false`, o squash-merge não limpa a branch: apague depois.

## Workflows — estado real, não aparência

São **5** arquivos em `.github/workflows/`: `ci.yml`, `db-migrations.yml`, `edge-tests-daily.yml` e,
desde 08/11/2026, `contexto.yml` e `inventario-estado-semanal.yml` (ver `AGENTS.md` › Contexto gerado).
A tabela abaixo cobre só os 3 originais.
**Nenhum deles jamais concluiu com sucesso na janela observada** (`docs/estado/05-infra-ci-testes.md` §1):

| Workflow | Execuções | Conclusão |
|---|---:|---|
| `ci.yml` | 382+ | 100% `failure`, incluindo a execução nº 1 (2026-05-11) |
| `edge-tests-daily.yml` | 24 | 24/24 `failure` |
| `db-migrations.yml` | 1 | 1/1 `failure` |

### Armadilhas já medidas (não repita o diagnóstico)

1. **`ci.yml` está gravado em base64**, não em YAML: 6.168 bytes, **0 quebras de linha**; `base64 -di`
   decodifica para `name: CI Pipeline`. O GitHub não consegue ler o campo `name:` (a API devolve
   `"name": ".github/workflows/ci.yml"`). Morreram junto: `npm run lint`, `npx tsc --noEmit`,
   `npm run test`, `npm run build`, o scan de `console.log` (ADR-006), o scan de secrets hardcoded e os
   **5 guards de banco**.
2. **Consertar o base64 não basta.** No arquivo decodificado, 2 steps leem `secrets.SUPAAASE_DB_URL`
   (três letras A) em vez de `SUPABASE_DB_URL`.
3. **Os guards de banco passam em verde com a variável vazia.** `scripts/check-function-grants.sh:14-19` e
   `scripts/check-audit-triggers.sh:13-18` fazem `exit 0` com um `::warning::` quando `SUPABASE_DB_URL` está
   vazia. Typo + `exit 0` = portão reportando "Grants/RLS conforme o esperado" **sem ter consultado o
   banco**. Ao rodar esses guards localmente, exporte `SUPABASE_DB_URL` ou a saída não vale nada.
4. **`scripts/check-anon-grants-view.sh` também está em base64** (2.784 bytes, 0 linhas) — inexecutável.
5. **`edge-tests-daily.yml` roda o runner errado**: executa `deno test` sobre arquivos que são testes
   **Vitest** (`import { describe, it, expect } from "vitest"`), registrados em `vitest.config.ts`. Daí as
   24 falhas com `Module not found ... _shared/bitrix-client`. Não é "falta a extensão `.ts`".
6. **A suíte E2E não tem runner nenhum**: `grep -rl "playwright\|test:e2e" .github/workflows/` → zero.
   20 specs e ~2.221 linhas sem CI.
7. **São 11 arquivos corrompidos em base64** no total (lista completa com bytes em
   `docs/estado/05-infra-ci-testes.md` §6): `ci.yml`, `docs/auth.md`, `scripts/check-anon-grants-view.sh`,
   `supabase/functions/email-verify/index.ts`, `supabase/functions/deliverability-check/index.ts` e **6
   migrations**.

### Por que você não conserta isso sozinho

- `.github/workflows/`, segredos e Environments são **item do dono** (`AGENTS.md` › Fluxo Git). Deixe a PR
  aberta e chame.
- **As 6 migrations em base64 são o caso mais perigoso**: `db-migrations.yml` aplica `supabase/migrations/**`
  em **produção** no push da `main`. Decodificá-las transforma arquivo ilegível em DDL que entra em
  produção no merge seguinte. Os 5 arquivos não-migration podem ser decodificados com segurança
  (`base64 -di <arquivo> > tmp && mv tmp <arquivo>`, com `git diff` legível) — as migrations, nunca sem o
  dono.

## Guards que você pode rodar antes do PR

- `node scripts/ci/check-claude-md-integrity.mjs` — exige os cabeçalhos do `AGENTS.md` e barra o conjunto
  `AGENTS.md` + `CLAUDE.md` + `docs/agentes/*.md` encolher >30% (ou qualquer arquivo vigiado encolher >50%).
  Rode sempre que mexer em `AGENTS.md` ou `docs/agentes/`.
- `npm run db:lint` (`scripts/check-migrations.sh`) — nomes, ordem e conteúdo das migrations, sem tocar banco.
- `npm run test:grants`, `npm run test:audit-triggers`, `bash scripts/check-security-definer.sh`,
  `bash scripts/check-queue-kind-coverage.sh` — **só com `SUPABASE_DB_URL` exportada** (ver armadilha 3).
