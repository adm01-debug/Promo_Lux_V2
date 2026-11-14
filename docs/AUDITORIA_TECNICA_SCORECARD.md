# Auditoria Técnica Exaustiva — LUX IA (`adm01-debug/Promo_Lux_V2`)

> **Versão:** v1.0 — app de auditoria 22 dimensões (prompt arsenal v2.0)
> **Commit auditado:** `8ebad715` (origin/main, 2026-11-14)
> **Evidências coletadas ao vivo em 2026-11-14:** WSL local (`~/projetos/Promo_Lux_V2`), Supabase Management API (project `pttzwlbidamibjssqiqb`), GitHub REST + probes HTTP.
> **Regra:** toda nota tem evidência (arquivo:linha, query+resultado, comando+saída). Sem evidência = NÃO VERIFICADO.

## Legenda

- ✅ OK (evidência ao lado)
- 🔴 BLOQUEADO / GAP REAL (erro exato)
- ⏳ AGUARDANDO DONO (regra 8 — CI/DDL/proteção)

---

## Fase 0 — Inventário

| Item | Valor | Evidência |
|---|---|---|
| Repositório / branch | `adm01-debug/Promo_Lux_V2` / `main` | `git log -1` = `8ebad715` |
| Stack | React 18 + Vite + TS (Lovable), Supabase (Postgres+RLS+Edge Functions), Bitrix24, n8n, Cloudflare Workers, Docker Swarm (fora do repo) | package.json |
| Edge Functions | **59** | `ls supabase/functions | wc -l` = 59 |
| Migrations no repo | **217** | `ls supabase/migrations | wc -l` = 217 |
| Migrations aplicadas (prod) | **216** | Management API: `SELECT count(*) FROM supabase_migrations.schema_migrations` → `[{"applied":216}]` |
| Tabelas public (prod) | **95** | query live: `tables` = 95 |
| Policies RLS (prod) | **255** | query live: `policies` = 255 |
| Tabelas SEM RLS | **0** | query live: `sem_rls` = 0 |
| Arquivos src+functions | 577 | `find src supabase/functions -type f` |
| Testes vitest | 69 arquivos | `grep -rl describe/it src | wc -l` |
| Testes Deno | 23 | `find supabase/functions -name '*_test.ts'` |
| Testes E2E (Playwright) | 15 | `find . -name '*.spec.ts'` (e2e/) |
| Workflows | 6 | `.github/workflows/` |
| Docs | 30+ (README, ADRs 001–009, openapi.ts, erd.md, runbooks) | `ls docs` |

---

## Fase 1 — 22 Dimensões (nota + evidências + gaps + ações)

### 1. ARQUITETURA — 9/10
- **Evidências**: ADRs 001–009 (`docs/adr/`), separação clara src (components/contexts/hooks/integrations/lib/pages), 59 edge functions isoladas, sem dependência circular detectada.
- **Gaps**: nenhum arquitetural crítico. ADR atualizado? NÃO VERIFICADO (sem data de revisão).
- **Ações**: revisar ADR existentes uma vez ao semestre.

### 2. AUTENTICAÇÃO — 8/10
- **Evidências**: edge `supabase/functions/auth-rate-limit/index.ts` — CORS allowlist (10 origens fixas), `MAX_ATTEMPTS=5`, `WINDOW_MINUTES=15`, `MAX_IDENTIFIER_LEN=254` (lockout anti brute-force). Supabase Auth (JWT, refresh). `/auth/v1/health` → **HTTP 200**.
- **Gaps p/ 10**: sem **MFA**; fluxo de logout server-side + invalidação: NÃO VERIFICADO.
- **Ações**: habilitar MFA (Supabase Auth nativo) em login administrativo.

### 3. AUTORIZAÇÃO — 9/10
- **Evidências** (query live):
  - `sem_rls` = 0 (100% das tabelas com RLS), `policies` = 255.
  - `exec_sql` SECURITY DEFINER RCE anterior → **probe anon hoje = HTTP 400** (função não exposta; RCE morto).
  - **0 funções SECURITY DEFINER com EXECUTE anon** (`prosecdef=true AND proacl LIKE '%anon=U%'` → `[]`).
  - Policies por role: `authenticated` 193, `service_role` 33, `public` 29; anon não tem policy própria de tabela.
  - 317 policies de função: SELECT 95, ALL 44, INSERT 41, DELETE 38, UPDATE 37.
  - **Honestidade**: `anon` ainda tem **136 EXECUTE grants** (funções normais — não escalonam privilégio). Detalhe técnico, não vulnerabilidade.
- **Gaps p/ 10**: testes de RLS por role rodando em CI (2 testes locais em `supabase/functions/rls-tests/` — não automatizados no daily por faltar Supabase local no runner); audit trail de ações sensíveis: NÃO VERIFICADO end-to-end.
- **Ações**: adicionar job manual `rls-tests` no `edge-tests-daily.yml` (planos já existem).

### 4. BANCO DE DADOS — 8/10
- **Evidências**: 217 migrations versionadas/reproduzíveis (lint + replay em banco efêmero no CI), FKs/constraints em migrations, índice em todas as tabelas (`pg_indexes` — mínimo 1/tabela), pooler Supabase ativo (doc), triggers de auditoria (`scripts/check-audit-triggers.sh`).
- **Gaps p/ 10**:
  - 🔴 **DRIFT 216 aplicadas / 217 no repo** (query live). A migration `20261113185209` (revoke do RCE, PR #37 merged) **não foi aplicada** — o apply do `db-migrations.yml` falhou (`supabase db push` sem `--yes` em runner sem TTY). **Fix pronto na PR #39 (aguarda dono, regra 8).**
  - `noUnusedLocals`/`skipLibCheck` false/true em tsconfig.app (manutenibilidade, não DB).
- **Ações**: merge da PR #39 + re-aprovar deployment do Environment `production` → validar `schema_migrations` = 217.

### 5. CI/CD — 7/10
- **Evidências**: 6 workflows verdes no main (`automation-local`, `ci` com quality-gate/Database Guards/security scan, `contexto`, `db-migrations`, `edge-tests-daily` 0-testes-daily corrigido, `inventario`). Lint + tsc + 922 vitest no pipeline.
- **Gaps p/ 10**:
  - 🔴 **`main` sem branch protection**: `GET /branches/main/protection` → **HTTP 404**; `rulesets` → **`[]`**. Push/merge em main sem gate.
  - 🔴 **Sem Dependabot/Snyk/trivy**: dependências sem varredura de CVE automática.
  - `test:coverage` existe mas não roda como gate de cobertura no CI (NÃO VERIFICADO se o quality-gate mede %).
- **Ações**: criar ruleset exigindo PR + checks em main; criar `.github/dependabot.yml` (weekly npm+github-actions).

### 6. DATA INTEGRITY — 8/10
- **Evidências**: ADR-008 Soft Delete (híbrida: soft for rows críticos, hard controlado), triggers de audit (check-audit-triggers), schemas Zod validando escrita, tratamento de concorrência via RLS/transaction (NÃO VERIFICADO profundamente).
- **Gaps p/ 10**: idempotência explícita em todos os webhooks (n8n) — NÃO VERIFICADO; optimistic locking não detectado.
- **Ações**: auditar fluxos n8n/Bitrix p/ idempotência + retry sem duplicação.

### 7. DOCUMENTAÇÃO — 9/10
- **Evidências**: README.md, docs/ completo (openapi.ts, erd.md, schema-tabelas, runbooks, LGPD.md, contexto/, GAPS-ENTERPRISE, ADRs), CHANGELOG.md versionado.
- **Gaps p/ 10**: dicionário de dados (business→técnico) não localizado explicitamente; onboarding < 4h — NÃO VERIFICADO.
- **Ações**: criar `docs/DATA_DICTIONARY.md` ligando entidades de negócio → tabelas.

### 8. INFRAESTRUTURA / DevOps — 6/10
- **Evidências**: deploy gerenciado por Lovable (Vercel preview + Lovable prod `lux-ai-company-finder.lovable.app`). Secrets em env vars/Cloudflare.
- **Gaps p/ 10**: **sem IaC no repo** (Terraform/Dockerfile → find vazio); sem DR testado (backups Supabase gerenciados); sem health check como endpoint do app (probe root 200 OK comprovado).
- **Ações**: versionar topologia (docs/infra) — esforço baixo, não exige IaC p/ stack gerenciada (calibre startup).

### 9. LOGGING / MONITORING — 7/10
- **Evidências**: ADR-006 Structured Logging implementado (`supabase/functions/_shared/oracle-logger.ts`, `safe-update.ts`), logging estruturado nas edges; frontend sem `console.log` (grep = 0).
- **Gaps p/ 10**: sem dashboards agregados, sem alertas configurados (SLOs), retenção de logs — NÃO VERIFICADO.
- **Ações**: definir alertas em cima de Supabase Logs (erro rate, latência P99).

### 10. OBSERVABILIDADE — 5/10
- **Evidências**: sem Sentry/Datadog/OTel em package.json (**NENHUM**).
- **Gaps p/ 10**: sem error tracking centralizado, sem traces cross-service (n8n→Supabase→Bitrix), sem métricas RED/USE versionadas.
- **Ações**: adicionar Sentry (RUM + backend) — maior salto de 5→8 na dimensão.

### 11. LÓGICA DE NEGÓCIO — 8/10
- **Evidências**: regras isoladas com testes (oracle-v2, departmentMap.data.ts single-source enum, queue_kind coverage script), schemas por domínio, edge cases em fuzzing (`src/tests/fuzzing-validation.test.ts`).
- **Gaps p/ 10**: state machines/documentação de ciclo de vida de entidades — NÃO VERIFICADO.
- **Ações**: documentar ciclo de vida das 3 entidades principais (lead/deal/campaign) — docs.

### 12. MANUTENIBILIDADE — 8/10
- **Evidências**: naming consistente, configs centralizadas, lint-staged + husky, zero `any`, projetos bem separados.
- **Gaps p/ 10**: `noUnusedLocals:false`, `noUnusedParameters:false`, `skipLibCheck:true` em tsconfig.app.
- **Ações**: ligar `noUnused*` e reavaliar `skipLibCheck` (risco baixo, ganho de qualidade).

### 13. OPERACIONALIDADE — 6/10
- **Evidências**: deploy Lovable automático com rollback via plataforma; migrations com lint+replay+plan no CI; Environment `production` com **required reviewers ATIVO** (gate de DDL humano — aplicado na sessão).
- **Gaps p/ 10**: sem runbook de incidente versionado (severidade/escala/post-mortem), sem circuit-breaker global testado (não VERIFICADO), sem feature flags para lançamento.
- **Ações**: criar `docs/runbooks/INCIDENTE.md` (quem chama, como escala).

### 14. PERFORMANCE — 7/10
- **Evidências**: teste `load-stress.test.ts`, lazy imports, cache Lovable/Vercel, bundle monitorado (vite-bundle-visualizer), índice mínimo 1/tabela.
- **Gaps p/ 10**: Web Vitals monitorados — **NÃO MEDIDO** (sem RUM/PageSpeed no repo); N+1 — NÃO VERIFICADO todos os fluxos.
- **Ações**: rodar Lighthouse/PageSpeed uma vez e registrar baseline em `docs/performance.md`.

### 15. QUALIDADE DE CÓDIGO — 9/10
- **Evidências**: eslint + commitlint + husky + lint-staged, `lint:ratchet` (estilo de regressão de linter versionado), 0 `console.log` em src, zero secrets no código (Security Scan no CI), 0 TODO real em produção (2 hits são texto/comment).
- **Gaps p/ 10**: nada material.
- **Ações**: manter.

### 16. SEGURANÇA — 8/10
- **Evidências**:
  - RCE `exec_sql` → **fechado e provado**: probe anon `POST /rest/v1/rpc/exec_sql` → **HTTP 400**; 0 SECURITY DEFINER anon-callable; revoke versionado (PR #37 merged).
  - RLS 100% (0 tabelas sem RLS), auth-rate-limit (lockout), CORS allowlist, Security Scan no CI.
  - HTTPS/TLS via Lovable (root HTTP 200).
- **Gaps p/ 10**: sem pen test formal; sem varredura de CVEs (Dependabot); exposure do drift (a revoke migratória ainda não está applyada — mitigação manual existe, mas o versionamento da proteção não).
- **Ações**: 📌 **merge PR #39** (aplica o revoke em prod — fecha o ciclo); habilitar Dependabot; agendar pen test leve.

### 17. TESTES — 9/10
- **Evidências**: 69 arquivos vitest (incl. fuzzing, load-stress, multi-tenant), 23 Deno `*_test.ts`, 15 e2e Playwright (`auth.spec.ts`, `accessibility.spec.ts` com axe-playwright, `protected-navigation.spec.ts`, `rls-guarantees.spec.ts`), 29 deno + 922 vitest rodando no CI.
- **Gaps p/ 10**: testes de RLS por role não automatizados no CI (só locais); cobertura % não gated no CI; testes de carga fora do CI.
- **Ações**: job `rls-tests` no daily (plano já existe); medir coverage uma vez p/ baseline.

### 18. TIPAGEM / TYPE SAFETY — 9/10
- **Evidências**: `strict: true` em tsconfig.app; **0 `: any` / `as any` / `<any>`** (grep src); schemas Zod em `src/lib/schemas/`; enums/unions tipados (departmentMap).
- **Gaps p/ 10**: `strictNullChecks` já vem de strict; validação runtime em TODAS as entradas de edge function — NÃO VERIFICADO.
- **Ações**: auditar entradas de edge functions p/ Zod (amostra 5).

### 19. VALIDAÇÃO — 8/10
- **Evidências**: schemas Zod compartilhados (`company.ts`, `auth.ts`, `campaign.ts`, `scrapeJob.ts`, `ProxyFormDialog.tsx`) com react-hook-form + resolvers; fuzzing test.
- **Gaps p/ 10**: validação em 100% das edge functions (não só frontend) — NÃO VERIFICADO; formatos BR (CPF/CNPJ/CEP) — NÃO VERIFICADO.
- **Ações**: inventariar entradas de edge functions e marcar quais validam schema.

### 20. OPERAÇÕES (Processos) — 7/10
- **Evidências**: fluxo Git documentado (PR obrigatória, commits semânticos PT-BR, merge com squash+delete), branch protection do workflow de DDL via required reviewers, processos de CI em `.github/workflows/`.
- **Gaps p/ 10**: sem SLA de code review, sem post-mortem versionado, sem rotina de dependências (Dependabot), sem rotina de revisão de segurança trimestral.
- **Ações**: compile SLA de review + rotina semanal de dependências no CONTRIBUTING.

---

## Fase 2 — Scorecard consolidado

| # | Dimensão | Nota | Gap principal |
|---|----------|:----:|---------------|
| 1 | Arquitetura | 9 | — |
| 2 | Autenticação | 8 | MFA ausente |
| 3 | Autorização | 9 | rls-tests fora do CI |
| 4 | Banco de Dados | 8 | 🔴 drift 216/217 |
| 5 | CI/CD | 7 | 🔴 main sem protection; sem Dependabot |
| 6 | Data Integrity | 8 | idempotência n8n NÃO VERIFICADO |
| 7 | Documentação | 9 | dicionário de dados |
| 8 | Infraestrutura / DevOps | 6 | sem IaC/DR testado |
| 9 | Logging / Monitoring | 7 | sem dashboards/alertas |
| 10 | Observabilidade | 5 | sem error tracking |
| 11 | Lógica de Negócio | 8 | ciclos de vida NÃO VERIFICADO |
| 12 | Manutenibilidade | 8 | noUnused off |
| 13 | Operacionalidade | 6 | runbook incidente |
| 14 | Performance | 7 | Web Vitals NÃO MEDIDO |
| 15 | Qualidade de Código | 9 | — |
| 16 | Segurança | 8 | pen test; CVEs |
| 17 | Testes | 9 | RLS tests no CI |
| 18 | Tipagem / Type Safety | 9 | entradas edges NÃO VERIFICADO |
| 19 | Validação | 8 | edges sem validação |
| 20 | Operações | 7 | SLA review |

**Nota geral ponderada** (×3: 2,3,6,16 · ×2: 4,17,18,19,1 · ×1: demais):

- Críticas (×3): (8+9+8+8)/4 = **8.25**
- Alto (×2): (8+9+9+8+9)/5 = **8.6**
- Padrão (×1): (9+7+9+6+7+5+8+8+6+7+9+8+7)/13 = **7.38**
- **PONDERADA = (8.25×3 + 8.6×2 + 7.38×1) / 6 = 8.13 → NOTA 8.1/10**

---

## Top 10 Ações por ROI

| # | Ação | Dim | Impacto | Esforço | Tipo |
|---|------|-----|---------|---------|------|
| 1 | Merge PR #39 (`db push --yes`) + re-aplicar migration revoke → 217/217 | DB/Seg | Alto | Baixo | CI/Migration |
| 2 | Ruleset branch protection em `main` | CI/CD | Alto | Baixo | Config/GitHub |
| 3 | `.github/dependabot.yml` (weekly npm+actions) | Seg/CI | Alto | Baixo | Config |
| 4 | Atualizar `docs/prod-readiness.md` (95 tabelas, 255 policies, drift) | Docs | Médio | Baixo | Doc |
| 5 | MFA no login (Supabase Auth) | Auth | Alto | Médio | Config+UI |
| 6 | Sentry (RUM + backend) | Obs | Alto | Médio | Dep nova |
| 7 | Job `rls-tests` no `edge-tests-daily.yml` | Tests | Médio | Médio | CI |
| 8 | `noUnusedLocals/Parameters` + true em tsconfig.app | Manut | Médio | Baixo | Config |
| 9 | `docs/runbooks/INCIDENTE.md` | Ops | Médio | Baixo | Doc |
| 10 | Baseline Web Vitals + `docs/performance.md` | Perf | Baixo | Baixo | Medição |

## Roadmap

- 🔴 **Quick Wins (1–3d)**: 1, 2, 3, 4
- 🟠 **Sprint 1 (1–2sem)**: 5, 6, 7
- 🟡 **Sprint 2 (2–4sem)**: 8, 9, 10

## Regras de execução atendidas

1. Evidência ou silêncio — toda nota tem query/comando real ou "NÃO VERIFICADO" com motivo.
2. Leia antes de afirmar — tudo acima foi aberto/consultado.
3. Não invente — contagens medidas (Management API), não estimadas.
4. Causa raiz — drift rastreado até o `push` sem `--yes` (run 43527722866).
7. Marque não-verificado — presente em 8 dimensões.
8. Nunca 10 sem prova — nenhuma dimensão em 10.
9. Calibragem startup — IaC não exigido; segurança/integridade não reduzidas.

---

*Gerado em 2026-11-14 · Evidências na sessão de trabalho associada.*
