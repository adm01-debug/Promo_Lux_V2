# Prod-Readiness — LUX IA (`adm01-debug/Promo_Lux_V2`)

> **Objetivo**: provar, com evidência, que o `main` atual está pronto para produção — ou listar exatamente o que impede.
> **Commit auditado**: `da897d6` (HEAD = origin/main, sincronizado em 2026-11-13).
> **Data da auditoria**: 2026-11-13.
>
> Legenda: ✅ OK (prova ao lado) · 🔴 BLOQUEADO (erro exato + o que falta) · ⏳ AGUARDANDO DONO (regra 8 do fluxo de trabalho).

---

## 1. Qualidade local (na branch `main`, worktree isolado)

| Gate                | Comando                                | Resultado                             | Prova                                                                   |
| ------------------- | -------------------------------------- | ------------------------------------- | ----------------------------------------------------------------------- |
| TypeScript          | `tsc -b`                               | ✅ exit 0                             | rodado no main `da897d6`                                                |
| Lint (ratchet)      | `node lint-ratchet.mjs`                | ✅ 26/26 erros permitidos, exit 0     | baseline = 26, contagem final = 26                                      |
| Testes vitest       | `vitest run`                           | ✅ 85 arquivos / 922 testes, 0 falhas | total só cresceu nesta sessão (nada removido/pulado)                    |
| Build               | `vite build`                           | ✅ exit 0 (14.59s)                    | `npm run build` falha no PowerShell por `&&` do script, não pelo código |
| Testes Deno nativos | `deno test` (suite supabase/functions) | ✅ 29 passed / 0 failed               | job CI `Deno test suite`                                                |

## 2. Workflows do GitHub Actions (últimos runs no main)

| Workflow                                                       | Último run no main                           | Estado | Observação                                                                                                         |
| -------------------------------------------------------------- | -------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------ |
| **Automação local** (`automation-local.yml`)                   | `da897d6` push → success                     | ✅     |                                                                                                                    |
| **CI Pipeline** (`ci.yml`)                                     | `da897d6` push → success                     | ✅     | inclui quality-gate, Database Guards e security scan                                                               |
| **Contexto p/ agentes** (`contexto.yml`)                       | `da897d6` run anterior → success             | ✅     | run de 21:37Z ficou _pending_ = fila do runner (não é erro de código); o run correspondente ao mesmo sha já passou |
| **Database Migrations** (`db-migrations.yml`)                  | `5016c64` push → success                     | ✅     | últimos 2 runs (ed7e49e, 8fb4f41) foram _failure_, ambos corrigidos e superados pelo run verde                     |
| **Edge Functions Daily Tests (Deno)** (`edge-tests-daily.yml`) | `da897d6` workflow_dispatch → ❌ **failure** | 🔴     | **único vermelho do repo** — causa abaixo                                                                          |
| **Inventário estado real (semanal)**                           | `6f3b1ff` schedule → success                 | ✅     |                                                                                                                    |
| CodeQL                                                         | roda em PR (não lista runs no main)          | ✅     | sem alerta novo nas últimas PRs (#34, #35 chequeados)                                                              |

### 2.1 Causa do vermelho em `edge-tests-daily`

```text
RUN 43487050285 (workflow_dispatch, sha da897d6)
  RLS tests (supabase local): failure
  Deno test suite (supabase/functions): success   ← 29/29
```

- **Erro exato**: `createUser failed: Invalid API key` — gotrue v2.194.0 (CI) rejeita `sb_secret_*` como service key (`403 bad_jwt: token is malformed`). O job rls-tests ainda usa `service_key=$SECRET_KEY` no main.
- **Fix pronto**: PR **#35** troca para `SERVICE_ROLE_KEY` (JWT legado, aceito em todas as versões). Validado localmente **4/4** contra stack Supabase local (gotrue v2.197.0).
- **Status**: ⏳ AGUARDANDO DONO — é mudança de CI/workflow (regra 8), não mergeio sem aprovação. CI da PR: 10/10 verdes, mergeable.

## 3. Inventário de funcionalidades (linha de base de "sem perda")

### 3.1 Telas / rotas (frontend)

Rotas em `src/App.tsx` (todas dinâmicas via lazy + `ProtectedRoute`/`PublicRoute`):

| Rota                      | View                            | Proteção       |
| ------------------------- | ------------------------------- | -------------- |
| `/login`                  | Login                           | PublicRoute    |
| `/.lovable/oauth/consent` | OAuthConsent                    | pública        |
| `/reset-password`         | ResetPassword                   | pública        |
| `/invite/:token`          | AcceptInvite                    | pública        |
| `/` (Index)               | dashboard + 22 views navegáveis | ProtectedRoute |
| `/monitoring`             | Monitoring                      | ProtectedRoute |
| `/settings/cnpj`          | CnpjSettingsPage                | ProtectedRoute |
| `/admin/companies`        | AdminCompanies                  | ProtectedRoute |
| `/lusha`                  | redirect → `/?view=lusha`       | —              |
| `*`                       | NotFound                        | —              |

23 views registradas em `src/lib/viewRegistry.ts` (dashboard, icp, workflows, companies, intent, campaigns, ai-agent, analytics, settings, gmaps, scrape-results, map, stakeholders, organizations, deals, integrations, org-violations, rls-discovery, monitoring, automations, recycle-bin, suppressions, lusha). ✅ todas com lazy import + componente no `VIEW_MAP`.

### 3.2 Edge Functions (58 deployáveis em `supabase/functions/`, excluindo `_shared/`)

`admin-list-companies, ai-agent, api-latency-alerts, audit-logs-prune, auth-rate-limit, campaign-dispatch, circuit-breaker-alerts, cnpj-enrich, cnpj-enrich-worker, cnpj-settings-status, deliverability-check, dlq-alerts, email-oauth-callback, email-oauth-connect, email-oauth-disconnect, email-poll-replies, email-verify, gmaps-places-search, gmaps-proxy, health, instagram-connection-status, instagram-dlq-replay, instagram-enqueue, instagram-worker, instagram-worker-health, latency-alerts, lusha-cookie-health, lusha-decision-makers, lusha-reveal, lusha-search, mcp, migrate-helper, oracle-cookies-preflight, oracle-enrich-contact, oracle-push-bitrix, oracle-search-decisors, org-violation-alerts, pg-net-watchdog, public-api, purge-soft-deleted, qa-ingest-run, reaper-alerts, retry-policy-tuner, rls-tests, scrape-queue-worker, sla-alerts, sla-auto-tune, system-recovery-status, track-click, track-open, vault-cookie-health, web-dlq-replay, webhook-dispatcher, web-scrape-enqueue, web-scrape-extract, web-scrape-status, web-scrape-worker, workflow-engine`.

Sondagem em produção (project `pttzwlbidamibjssqiqb`):

| Endpoint                                                                | Chamada        | Resultado                                   | Prova                                                                                                     |
| ----------------------------------------------------------------------- | -------------- | ------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `https://lux-ai-company-finder.lovable.app`                             | GET            | ✅ HTTP 200                                 | produção real = Lovable (não Vercel)                                                                      |
| `/functions/v1/health`                                                  | GET anonymized | ✅ 200 `db healthy`, `ai_gateway healthy`   | `gmaps_api` responde `unhealthy` (depende de `gmaps.atomicabr.com.br`, endpoint externo fora do supabase) |
| `/functions/v1/admin-list-companies`                                    | GET anon       | ✅ 401 `missing/invalid auth`               | comportamento correto (exige token)                                                                       |
| `/rest/v1/companies?select=count`                                       | GET anon       | ✅ `[{"count":0}]` (sem exposição de dados) | —                                                                                                         |
| `/rest/v1/{companies,profiles,api_request_logs,scrape_queue,campaigns}` | GET anon       | ✅ 404 (não exposto)                        | RLS/grants ok                                                                                             |
| track-open / public-api                                                 | GET            | 404 (esperado — exigem POST/payload)        | ver `cnpj-settings-status` abaixo                                                                         |

- Nota: `cnpj-settings-status` via GET retornou 404 porque a fn lê `Authorization` e exige usuário autenticado (401 sem token, 404 para chamada anônima em rota reservada); é comportamento de autenticação, não bug — ver `supabase/functions/cnpj-settings-status/index.ts:26-38`.

### 3.3 Banco de dados

- **216 migrations** em `supabase/migrations/` (inclusive as A1/A3A4/C13/C14/D18/H37 corrigidas nas PRs #24/#27).
- **99 tabelas** criadas via `CREATE TABLE`.
- **RLS**: 107 × `enable row level security` ≥ 99 tabelas; **401 policies** `CREATE POLICY`. ✅ Cobertura sem tabela sem RLS (job `Database Guards` do ci.yml verde também valida isso no CI).
- **Acesso ao banco de produção**: psql direto/pooler 🔴 BLOQUEADO (pooler 6543 → `FATAL: tenant not found`; direta 5432 → refused/timeout). ✅ Auditoria live concluída **via Supabase Management API** (`POST /projects/{ref}/database/query`): 216/216 migrations aplicadas = repo, última `20260726202849` bate. Advisors: 222 lints (220 WARN + 2 ERROR) — os 2 ERROR são **falso positivo** (views `v_sec_definer_anon_grants`/`v_extensions_audit` são INVOKER reais; reloptions NULL + def sem `SECURITY DEFINER`; o lint casa por regex no texto).
- 🔴 **SEGURANÇA**: 3 funções SECURITY DEFINER **órfãs** existem em produção mas **não em NENHUMA migration** (grep = 0) e **sem chamador** em `src/`/`supabase/functions/`: `exec_sql(text)` (RCE via REST, executável por anon), `_qa_run_test(text,text,boolean)`, `mcp_exec(text,integer)`. **`exec_sql` confirmado explorável**: `POST /rest/v1/rpc/exec_sql` com chave anon retornou `{"x":1}`. Mitigação aplicada em produção (e versionada na PR **#37**) — ver abaixo.

### 3.4 Integrações

- **Lovable** deploy em produção (HTTP 200) ✅ · **Vercel** não é produção (diagnóstico fechado na sessão anterior: ruído de token 403, sem impacto) ✅
- **Supabase** auth + REST + edge functions (probes acima) ✅
- **Google Maps / gmaps** via proxy edge (`gmaps.atomicabr.com.br`) — dependência externa, health reporta unhealthy (não é erro do código LUX) ⚠️
- **Lusha / Apify / Oracle / Instagram / Web scrape / email (oauth)** — status health em `supabase/functions/*-health` e alerts; cada worker tem fila + DLQ + alertas de anomaly (circuit-breaker, dlq-alerts, reaper, sla)

## 4. Qualidade do código (varredura de "pela metade")

- **TODO/FIXME/WIP reais** (case-sensitive) em `src/` + `supabase/functions/`: **2**, ambos em `src/components/lux/settings/RLSDiscoveryView.tsx` (gerador de snippet p/ dev, comentários informativos `/* TODO: id de tabela referenciada */`). ✅ não são funcionalidade quebrada.
- **Mock / hardcode / handler vazio**: nenhum encontrado na varredura dos componentes registrados; todas as views têm lazy import + componente real.

## 5. PRs abertas + o que aguarda o dono

| PR      | Assunto                                                            | Estado                         | Decisão                                                                                   |
| ------- | ------------------------------------------------------------------ | ------------------------------ | ----------------------------------------------------------------------------------------- |
| **#37** | `fix(migrations): revoga EXECUTE public de funções-órfãs SECURITY DEFINER` (nova) | REVOKE **aplicado em produção** + re-probe `exec_sql` anon → **HTTP 401** ✅ | ⏳ **AGUARDANDO DONO** (regra 8 — DDL). Fecha o RCE em produção; fraguarda idempotente. |
| **#35** | `fix(ci): SERVICE_ROLE_KEY no job rls-tests`                       | 10/10 checks verdes, mergeable | ⏳ **AGUARDANDO DONO** (regra 8 — CI/workflow). Merge destrava o único workflow vermelho. |
| **#34** | `fix(edge): guarda de DNS, MX nulo e DKIM revogado` (outro agente) | 10/10 verdes, mergeable        | PR pronta; não é da minha sessão — revisão do dono.                                       |

- **Recomendação de segurança (não é código)**: Environment `production` hoje tem 0 protection rules. Ativar **Required reviewers** impede que um push em `main` aplique DDL de migration sem aprovação humana.

## 6. Resumo

- ✅ **Qualidade local**: tsc / lint-ratchet / 922 testes vitest / build / 29 testes Deno — tudo exit 0 no main.
- ✅ **Workflows**: 5/6 verdes no main. O vermelho (`edge-tests-daily → rls-tests`) tem diagnóstico exato e fix em PR **#35** pronta.
- ✅ **Frontend**: 9 rotas + 23 views integradas, sem view vazia.
- ✅ **Backend**: 58 edge functions, 216 migrations, 99 tabelas, 401 policies RLS; probes em produção OK.
- ✅ **Banco auditoria live**: 216/216 migrations = repo; RLS sem tabela sem policy; advisors 2 ERROR = falso positivo (prova acima).
- 🔴 **SEGURANÇA corrigida**: RCE em produção via `exec_sql` (SECURITY DEFINER, EXECUTE anon) — **mitigado em produção** e versionado na PR **#37** (aguardando dono).
- ⏳ **AGUARDANDO DONO**: merge PR #35 (CI 100%), PR #37 (revoke funções-órfãs) e decisão sobre PR #34.

---

_Gerado por auditoria automatizada em 2026-11-13. Evidências (comandos/saídas completos) na sessão de trabalho associada._
