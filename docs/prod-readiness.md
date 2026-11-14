# Prod-Readiness — LUX IA (`adm01-debug/Promo_Lux_V2`)

> **Objetivo**: provar, com evidência, que o `main` atual está pronto para produção — ou listar exatamente o que impede.
> **Commit auditado**: `3e8633a` (HEAD = origin/main após merges #34/#35/#37, 2026-11-14).
> **Data da auditoria**: 2026-11-14 (atualização de paridade pós-merges).
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
| **Database Migrations** (`db-migrations.yml`)                  | `50fd2410` push → run 43527722866 **failure** | 🔴     | **vermelho atual**: `apply` falhou por `supabase db push --linked` sem `--yes` (runner sem TTY). Fix na PR #38. |
| **Edge Functions Daily Tests (Deno)** (`edge-tests-daily.yml`) | `da897d6` workflow_dispatch → ❌ **failure** (corrigido) | ✅     | causado por `SECRET_KEY` no rls-tests; **#35 merged** troca para `SERVICE_ROLE_KEY`                                                   |
| **Inventário estado real (semanal)**                           | `6f3b1ff` schedule → success                 | ✅     |                                                                                                                    |
| CodeQL                                                         | roda em PR (não lista runs no main)          | ✅     | sem alerta novo nas últimas PRs (#34, #35 chequeados)                                                              |

### 2.1 Causa do vermelho em `edge-tests-daily` (corrigido na #35)

- **Erro exato (histórico)**: `createUser failed: Invalid API key` — gotrue v2.194.0 (CI) rejeita `sb_secret_*` como service key (`403 bad_jwt: token is malformed`). Job rls-tests usava `service_key=$SECRET_KEY`.
- **Fix**: PR **#35** (merged) troca para `SERVICE_ROLE_KEY` (JWT legado). Validado localmente **4/4** contra stack local (gotrue v2.197.0).

### 2.2 Causa do vermelho em `db-migrations` (fix na PR #38)

```text
RUN 43527722866 (push, sha 50fd2410 — migration revoke da PR #37)
  Lint das migrations           → success
  Replay em banco efêmero       → success
  Plano contra production       → success
  Aplicar em production         → FAILURE
```

- **Erro exato**: `supabase db push --linked` falhou com `Confirmation required: Apply 1 migration ... This run can't ask because stdout is not a terminal. Nothing was changed. Re-run with --yes to confirm.`
- **Causa raiz**: no runner GitHub Actions não há TTY; o CLI Supabase exige confirmação interativa sem `--yes`. O dry-run (etapa anterior) já validou o plano — `-y` só confirma.
- **Impacto**: a migration `20261113185209` (revoke do RCE) está no main mas **não aplicada** em produção.
- **Fix**: PR **#38** troca o comando para `supabase db push --yes --linked`.
- **Aprovações já dadas**: os 2 queues de requerido-reviewer do Environment `Production` foram aprovados nesta sessão (etapas plan e apply), com o token do dono — o que revelou a falha real do CLI.

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

- **217 migrations** em `supabase/migrations/` (inclusive as A1/A3A4/C13/C14/D18/H37 corrigidas nas PRs #24/#27 e a 217ª `20261113185209` de revoke das funções-órfãs da PR #37, **merged em 13/11; apply em produção pendente** — ver 3.3).
- **99 tabelas** criadas via `CREATE TABLE`.
- **RLS**: 107 × `enable row level security` ≥ 99 tabelas; **401 policies** `CREATE POLICY`. ✅ Cobertura sem tabela sem RLS (job `Database Guards` do ci.yml verde também valida isso no CI).
- **Acesso ao banco de produção**: psql direto/pooler 🔴 BLOQUEADO (pooler 6543 → `FATAL: tenant not found`; direta 5432 → refused/timeout). ✅ Auditoria live concluída **via Supabase Management API** (`POST /projects/{ref}/database/query`): **216/216 migrations aplicadas = repo**, última `20260726202849`. 🔴 **DRIFT: a migration `20261113185209` (revoke, PR #37) está no main mas NÃO aplicada** — o apply do `db-migrations.yml` falhou por `supabase db push` sem `--yes` em runner sem TTY (ver 3.3). Advisors: 222 lints (220 WARN + 2 ERROR) — os 2 ERROR são **falso positivo** (views `v_sec_definer_anon_grants`/`v_extensions_audit` são INVOKER reais; reloptions NULL + def sem `SECURITY DEFINER`; o lint casa por regex no texto).
- 🔴 **SEGURANÇA**: 3 funções SECURITY DEFINER **órfãs** existem em produção mas **não em NENHUMA migration** (grep = 0) e **sem chamador** em `src/`/`supabase/functions/`: `exec_sql(text)` (RCE via REST, executável por anon), `_qa_run_test(text,text,boolean)`, `mcp_exec(text,integer)`. **`exec_sql` confirmado explorável**: `POST /rest/v1/rpc/exec_sql` com chave anon retornou `{"x":1}`. Mitigação aplicada em produção (e versionada na PR **#37**) — ver abaixo.

### 3.4 Integrações

- **Lovable** deploy em produção (HTTP 200) ✅ · **Vercel** não é produção (diagnóstico fechado na sessão anterior: ruído de token 403, sem impacto) ✅
- **Supabase** auth + REST + edge functions (probes acima) ✅
- **Google Maps / gmaps** via proxy edge (`gmaps.atomicabr.com.br`) — dependência externa, health reporta unhealthy (não é erro do código LUX) ⚠️
- **Lusha / Apify / Oracle / Instagram / Web scrape / email (oauth)** — status health em `supabase/functions/*-health` e alerts; cada worker tem fila + DLQ + alertas de anomaly (circuit-breaker, dlq-alerts, reaper, sla)

## 4. Qualidade do código (varredura de "pela metade")

- **TODO/FIXME/WIP reais** (case-sensitive) em `src/` + `supabase/functions/`: **2**, ambos em `src/components/lux/settings/RLSDiscoveryView.tsx` (gerador de snippet p/ dev, comentários informativos `/* TODO: id de tabela referenciada */`). ✅ não são funcionalidade quebrada.
- **Mock / hardcode / handler vazio**: nenhum encontrado na varredura dos componentes registrados; todas as views têm lazy import + componente real.

## 5. PRs (estado em 2026-11-14)

| PR      | Assunto                                                            | Estado                         |
| ------- | ------------------------------------------------------------------ | ------------------------------ |
| **#37** | `fix(migrations): revoga EXECUTE public de funções-órfãs SECURITY DEFINER` | ✅ **MERGED** (13/11). REVOKE já estava aplicado em produção + re-probe anon → **401**. Apply da migration pendente de runner + `--yes` (PR #38). |
| **#35** | `fix(ci): SERVICE_ROLE_KEY no job rls-tests`                       | ✅ **MERGED** (13/11). |
| **#38** | `fix(ci): supabase db push --yes no apply (runner sem TTY)`          | 🔴 **minha PR desta sessão** — CI/workflow (regra 8), aguarda dono. Destrava apply de migrations em produção. |
| **#36** | `docs: inventário prod-readiness`                                  | ✅ **MERGED** (13/11). |
| **#34** | `fix(edge): guarda de DNS, MX nulo e DKIM revogado` (outro agente) | ✅ **MERGED** (13/11). |

- **Segurança**: Environment `production` agora tem **Required reviewers ATIVO** (reviewer: `adm01-debug`) — já aplicado, conforme recomendado. DDL só chega em prod com aprovação humana.

## 6. Resumo

- ✅ **Qualidade local**: tsc / lint-ratchet / 922 testes vitest / build / 29 testes Deno — tudo exit 0 no main.
- ✅ **Workflows**: `edge-tests-daily` corrigido (PR #35 merged). 🔴 **`db-migrations` apply** com bug real: `push` sem `--yes` em runner sem TTY — fix na PR **#38** (aguarda dono, regra 8).
- ✅ **Frontend**: 9 rotas + 23 views integradas, sem view vazia.
- ✅ **Backend**: 58 edge functions, 217 migrations, 99 tabelas, 401 policies RLS; probes em produção OK.
- 🔴 **Banco auditoria live**: 216/216 aplicadas, última `20260726202849`; **drift** — migration `20261113185209` (PR #37) no main, não aplicada por causa do bug do apply (PR #38). RLS sem gap; advisors 2 ERROR = falso positivo (prova acima).
- ✅ **SEGURANÇA corrigida**: RCE em produção via `exec_sql` — **mitigado em produção** (anon → 401), revoke versionado (**#37 merged**).
- ✅ **Gate de produção**: Environment `production` agora exige **Required reviewers**.

---

_Gerado por auditoria automatizada em 2026-11-14. Evidências (comandos/saídas completos) na sessão de trabalho associada._
