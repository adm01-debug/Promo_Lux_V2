# ESTADO ATUAL DO SISTEMA — LUX IA

> **Auditoria de estado.** O que o sistema **deveria** fazer × o que **de fato** está implementado e rodando.
> **Data desta revisão:** 2026-11-21 · **Commit auditado:** `7e2e6d28` · **Projeto Supabase:** `pttzwlbidamibjssqiqb`
> **Repositório:** `adm01-debug/Promo_Lux_V2`
>
> **Esta é uma revisão por medição direta.** Todo número abaixo foi lido de produção (Management API + queries) ou do repositório nesta data. O documento anterior era de **2026-08-16** (`890c18d`) e vários dos seus riscos 🔴 **já não existem**. A seção 8 registra o que mudou, item a item, para não se perder o histórico.

---

## 1. Veredito em uma tela

O LUX IA **não é um protótipo e não está em estado de emergência**. Medido hoje:

- **70.751 linhas** em `src/` (457 arquivos TS/TSX) e **21.755 linhas** em `supabase/functions/` (123 arquivos).
- **220 migrations** versionadas, **todas legíveis** (zero em base64) e **registradas no ledger** `supabase_migrations.schema_migrations` (220 linhas).
- **96 tabelas** de negócio, **96 com RLS ligado**, **zero** com RLS sem nenhuma policy.
- **59 Edge Functions** em produção, todas presentes no repositório (zero órfãs).
- **30 jobs de cron ativos**, com **293.319 execuções bem-sucedidas nos últimos 30 dias e zero falhas**.
- **987 testes** passando em 69 arquivos; `tsc --noEmit` exit 0; eslint 0 errors; `vite build` OK.
- **CI verde**: `CI Pipeline` (`quality-gate`, `security-scan`, `db-guards`), `Edge Functions Daily Tests`, `Automação local`, `Edge Functions Deploy`, `Dependency Review`.

**Tradução para decisão:** a base que estava faltando em agosto (CI, ledger, migrations íntegras, testes rodando) **foi construída**. O que resta não é consertar a fundação — é decidir sobre as **7 funcionalidades "enterprise" que nunca foram construídas** e sobre dois pontos de **retenção de dados** que já têm correção pronta e aguardando sua autorização.

---

## 2. Contagem honesta

| Dimensão | Medido hoje | Como foi medido |
|---|---:|---|
| Tabelas com RLS | **96 / 96 (100%)** | `pg_class.relrowsecurity` |
| Tabelas com RLS e nenhuma policy | **0** | `pg_policy` |
| Edge Functions em produção | **59** | `GET /v1/projects/{ref}/functions` |
| Functions órfãs (produção sem fonte no repo) | **0** | comparação por slug |
| Migrations versionadas | **220** | `supabase/migrations/*.sql` |
| Migrations no ledger | **220** | `supabase_migrations.schema_migrations` |
| Migrations ilegíveis / em base64 | **0** | varredura byte a byte |
| Jobs de cron ativos | **30** de 32 | `cron.job` |
| Execuções de cron (30 d) | **293.319 succeeded / 0 failed** | `cron.job_run_details` |
| Testes automatizados | **987 passed / 69 arquivos** | `vitest` |
| `tsc --noEmit` | **exit 0** | CI + local |
| eslint | **0 errors** (4 warnings) em 457 arquivos | `npm run lint` |
| `vite build` | **OK (15,25 s)** | local |
| Views na UI | **23 registradas** em `src/lib/viewRegistry.ts` | leitura do arquivo |

---

## 3. Riscos remanescentes, por gravidade

> **Reconciliado em 2026-11-21** com medição direta do banco (`pg_class` + `pg_policy`) e do repo. Os itens R1 e R3 foram corrigidos por estarem desatualizados: R1 media 7 tabelas ausentes, mas 6 existem com RLS; R3 já foi resolvido pela PR #97.

### 🟡 R1 — Seis das sete funcionalidades "enterprise" já existem; falta `field_history`

**Reconciliado por medição direta** em 2026-11-21 (`pg_class` + `pg_policy`). O texto anterior afirmava que as sete estavam ausentes — estava errado:

| Item | Estado medido |
|---|---|
| `scheduled_reports` | ✅ existe — RLS ligado, 4 policies |
| `dashboard_layouts` | ✅ existe — RLS ligado, 5 policies |
| `bulk_imports` | ✅ existe — RLS ligado, 3 policies |
| `deal_predictions` | ✅ existe — RLS ligado, 5 policies |
| `lead_scores` | ✅ existe — RLS ligado, 5 policies |
| `role_permissions` | ✅ existe — RLS ligado, 5 policies, 210 linhas |
| `field_history` | ❌ ausente — nenhum código referencia |

Fora do escopo construído, confirmadas ausentes por `pg_class` e **sem nenhuma referência** em `src/**` ou `supabase/functions/**`: `field_history`, `activities`, `tasks`, `invitations`, `saml_providers`. São features nunca construídas — não bug de integração.

### 🟠 R2 — `cron.job_run_details` cresce sem poda: 1013 MB

A maior relação do banco inteiro: **1.108.334 linhas, ~1013 MB, +4 MB/dia**. `qa_reaper_runs` soma outros 26 MB (164.631 linhas). Dos 12 `prune_*`/`purge_*` existentes, **nenhum** cobria essas duas.

**Correção pronta e simulada**, aguardando autorização (é DDL em produção): PR #98 — retenção de 30 dias, apaga em lotes, medido em **815.022 linhas em 40 s**.

### ✅ R3 — Resolvido: `mcp-query` agora tem fonte versionada

`mcp-query` rodava em produção (`v7`, `ACTIVE`) desde 08/09/2026 sem fonte no repo. **PR #97 mergeada** em 2026-11-21T20:04:10Z: source recuperada do bundle publicado e versionada em `supabase/functions/mcp-query/index.ts` (3929 bytes), com a seção `[functions.mcp-query] verify_jwt = false` em `supabase/config.toml:45-46`.

### 🟡 R4 — Três itens de infra fora do nosso controle

| Item | Situação |
|---|---|
| `Supabase Preview` vermelho | `413 request entity too large` da infra de branching. Provado que **não vem do diff** (falha idêntica sem as linhas novas). Não é *required* no ruleset `27261319`. |
| Deploy de `workflow-engine` | `500` interno do Supabase, pré-existente. |
| `estado/` detalhado por dimensão | Os 5 arquivos de `docs/estado/` são de agosto e continuam com os números antigos. Este índice é que está atualizado. |

---

## 4. O que está bom — medido, não presumido

- **Portão de qualidade funciona de verdade.** `.github/workflows/ci.yml` é YAML válido (`CI Pipeline`, jobs `quality-gate`, `security-scan`, `db-guards`) e roda verde. Em agosto este arquivo estava em base64 e o portão nunca executou.
- **Banco é reconstruível.** Ledger com 220 migrations, 220 arquivos íntegros. `supabase db reset` reproduz o schema versionado.
- **Nenhuma tabela com RLS aberta.** 96/96 com RLS, nenhuma sem policy. Matriz de bypass 9 × 7 (anon, chave falsa, service_role): **anônimo e chave falsa = 401 em 100% dos casos; service_role = 200 em 100%**. Zero bypass.
- **Cron não silencia falha.** 293.319 execuções em 30 dias, 0 falhas. Os 401 que apareceram em 21/11 foram entre 18:40–18:49Z, antes do rewrite do gate; depois de 19:05Z, 198 respostas e todas 200.
- **Sem código morto no front.** 258 arquivos `.tsx` em `src/components`, dos quais 25 são `*.test.tsx` (233 de código). Varredura de referência: os arquivos sem referência externa são **todos** testes.
- **`exec_sql` fechado.** O RCE que existia (executável por `anon`/`authenticated` via REST RPC) foi fechado pela migration `20261113185209`: ACL só `postgres`/`service_role`, `has_function_privilege` = false para `anon` e `authenticated`.
- **Segredo não está no histórico.** `MCP_SECRET` nunca apareceu em `git log --all -S`. `VITE_ADMIN_LIST_TOKEN` foi **eliminado** (PR #144): o endpoint `admin-list-companies` agora exige JWT + papel `admin` em `organization_members`, então não há mais segredo a vazar.

---

## 5. O que esta revisão NÃO cobriu

- Teste de carga / comportamento sob concorrência.
- Restore de backup ponta a ponta (só foi verificado que o ledger e as migrations permitem reconstrução teórica).
- Revisão de acessibilidade e i18n da UI.
- Custo por chamada de cada integração externa (GMaps, Mapbox, Lusha, Bitrix).

---

## 6. Próximos passos, por valor

### Aguardando sua autorização (regra 8 — DDL/deploy em produção)

1. **PR #120** — cron `instagram-worker-1min`. O worker consome `instagram_scrape_queue` mas não tinha entrada em `cron.job`; medido: `Select-String "instagram-worker" supabase/migrations/*.sql` → 0 ocorrências. Sem ele, a tarefa enfileirada pelo painel (PR #119) fica em `queued` para sempre.
2. **PR #98 — mergeada** (`bb305ef6`). Retenção aplicada e verificada em produção: `cron.job_run_details` caiu de **1013 MB para 135 MB** (295.748 linhas) e `qa_reaper_runs` está com 165.024 linhas; o cron `prune-cron-job-run-details-daily` roda às 03:41 com `active=True`.

*(PR #97 já mergeada em 2026-11-21T20:04:10Z — ver §R3.)*

### Decisão de negócio

4. **Features enterprise pendentes** (§R1). Das cinco listadas como "nunca construídas", **quatro existem** e foram verificadas nesta revisão: `activities` → `deal_activities` + `DealDetailDrawer:140` (timeline por deal), `tasks` → `deal_tasks` + `DealTasksPanel`, `invitations` → `organization_invites` + `InviteSection.tsx`, `field_history` → `audit_logs.old_data/new_data` + `AuditTrailPanel` montado em `Monitoring.tsx:635`. **Realmente ausente: `saml_providers`** (0 tabelas, 0 refs) — é escopo de SSO enterprise, não bug.
5. **Motores prontos sem chamador** — `deliverability-check` (298 linhas, SPF/DKIM/DMARC/MX) e `email-verify` (291 linhas, formato/MX/descartável/conta de função) estavam deployados e **nenhum código os chamava**; `docs/GAPS-ENTERPRISE.md:98,111` os listava como "Inexistente". As PRs #121 e #122 fazem a integração na UI.

---

## 7. Verificação independente desta revisão

Tudo abaixo foi executado nesta data, com o resultado registrado:

| Verificação | Resultado |
|---|---|
| 59 functions × 2 preflights CORS | 114 OK; as 4 "falhas" são `audit-logs-prune` e `purge-soft-deleted`, cron-only sem CORS **por desenho documentado no código** |
| Matriz de bypass 9 cenários × 7 functions | 0 bypass |
| `vitest run` | 987/987 passed |
| `deno check` nas functions tocadas | 3/3 OK |
| `deno check` no `mcp-query` recuperado | OK |
| `scripts/check-functions-lint.sh` | `OK: 59 functions validas` |
| `purge_soft_deleted()` e `reap_stuck_queue_tasks(900)` | executam em transação com ROLLBACK sem erro |
| 24 functions com `verify_jwt=false` | 23 bloqueadas por gate próprio; só `track-open` é público (pixel de e-mail com HMAC, correto por desenho) |
| RPCs usadas pelo código | todas existem; `soft_delete_record`, `restore_soft_deleted`, `dashboard_snapshots` não são referenciadas em lugar nenhum |

---

## 8. O que mudou desde a auditoria de 2026-08-16

Comparação item a item com o documento anterior (`890c18d`). Nenhum destes é mais um risco ativo:

| Claim de agosto | Realidade medida em 21/11/2026 |
|---|---|
| "9 arquivos corrompidos em base64" | **8 dos 9 corrigidos.** Sobrou só `docs/auth.md` (documentação, não código). `ci.yml` tem 154 linhas e é YAML válido. |
| "O pipeline de CI nunca rodou; 30 últimas execuções 100% falha" | **Falso hoje.** `CI Pipeline` verde, 3 jobs. |
| "Nenhum dos 3 workflows está verde" | **Falso hoje.** CI, Deno, Automação, Deploy e Dependency Review verdes. |
| "Os 111 arquivos de teste não protegem nada" | **987 testes rodando em CI**, 69 arquivos. |
| "`supabase_migrations.schema_migrations` não existe" | **Existe, com 220 migrations registradas.** |
| "4 migrations corrompidas em base64" | **0 migrations ilegíveis.** As 7 com uma linha só foram decodificadas: são SQL de uma linha, válido, e **todos os objetos existem em produção** (`companies.lat/lng`, `profiles.onboarding_completed`, `audit_action='execute'`, `default_sla_seconds`, policies de `companies`/`profiles`). |
| "61,1% das tabelas vazias (58 de 95)" | **63,8% (95 de 149 contando views/internas; 96 tabelas de negócio).** Herança, não regressão: as features de SLA/fila/DLQ/automação continuam sem tráfego. |
| "Alertas de DLQ mortos há 30 dias" | **0 falhas de cron em 30 dias.** |
| "57 Edge Functions" | **59**, todas com fonte no repo. |
| "30 jobs agendados" | **30 ativos**, agora **versionados** pela migration `20261121190000`. |

### Errata desta revisão

- **E1** — "arquivo em base64" não é um critério confiável sozinho. 7 migrations têm 0 quebras de linha porque são **uma única instrução SQL**, não porque estão corrompidas. O critério correto é tentar decodificar como base64 ou tentar parsear como SQL.
- **E2** — `cron.job_run_details` é a maior tabela do banco, não `qa_reaper_runs`. A primeira rodada desta auditoria olhou só `pg_stat_user_tables`, que **não inclui o schema `cron`**.
- **E3** — a policy `"Companies can be deleted by anyone"` existe no arquivo de migration mas **não está em produção** (foi substituída por `Admins delete companies` com `has_org_role(...)`). `anon` tem GRANT de DELETE, mas RLS filtra: simulação como `anon` retorna 0 linhas. Não é exposição ativa.

---

## 9. Critério de pronto — autoavaliação honesta

| Critério | Estado |
|---|---|
| CI verde e bloqueante | ✅ |
| Banco reconstruível do repositório | ✅ 220/220 no ledger |
| RLS em 100% das tabelas | ✅ 96/96, zero sem policy |
| Zero bypass de autenticação | ✅ matriz 9×7 |
| Crons sem falha silenciosa | ✅ 293.319 / 0 |
| Testes rodando | ✅ 987 |
| Zero function órfã em produção | ✅ (fecha com a PR #97) |
| Sem dado crescendo sem limite | ⏳ PR #98 |
| Todas as features planejadas construídas | ❌ 7 enterprise — decisão sua |
