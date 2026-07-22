# ADR-021 — Rodada #27: QA Exaustivo & Hardening Funcional

## Status
Aceito — 2026-07-22

## Contexto

Após 26 rodadas de hardening (arquitetura, RLS, retry, alertas, resiliência, recuperabilidade),
o sistema atingiu maturidade operacional 10/10, mas nunca havia recebido uma **auditoria de QA
horizontal** cobrindo simultaneamente hooks, edge functions, componentes UI e a camada de
defesa em profundidade multi-tenant. A Rodada #27 preencheu esse vazio: 900 cenários Monte
Carlo determinísticos + 4 auditorias estáticas em paralelo, um bug por bug catalogado e
corrigido cirurgicamente.

## Preflight

`scripts/gen-round27-qa-preflight.ts` (seed=2727, 900 cenários em 6 grupos) → gate **PASS**
(100% em todos os grupos), publicado em `public/reports/round27-qa-preflight.json`.

| Grupo | Cenários | Foco | Pass |
|------|----------|------|------|
| A | 200 | Oracle end-to-end (search → reveal → push Bitrix) | 100% |
| B | 200 | GMaps scraping (válidas, malformadas, timeout, duplicadas) | 100% |
| C | 150 | Web scrape queue (robots, 4xx/5xx, redirect loop, payload) | 100% |
| D | 150 | Auth/MFA/Invite/Org switching | 100% |
| E | 100 | Deals pipeline (drag concorrente, versão desatualizada) | 100% |
| F | 100 | Campanhas/email (bounce, suppression, cookie expirado) | 100% |

## Auditorias paralelas (4 subagents `capable`)

| Camada | 🔴 críticos | 🟡 importantes | 🔵 info |
|--------|:-:|:-:|:-:|
| Hooks (src/hooks/**) | 6 | 6 | 6 |
| Edge functions (supabase/functions/**) | 3 | 6 | 6 |
| Componentes UI (src/components/lux/**) | 6 | 15 | 9 |
| Contexts + withOrg | 4 | 6 | 8 |
| **Total** | **19** | **33** | **29** |

## Correções críticas aplicadas nesta rodada

### R27-CRIT-01 — Gate service_role em 6 cron functions
`dlq-alerts`, `latency-alerts`, `pg-net-watchdog`, `retry-policy-tuner`,
`circuit-breaker-alerts`, `api-latency-alerts` aceitavam invocação com anon key pública.
Vetor real de abuso: spam de notificações, poluição de `*_alert_history`, disparo do
watchdog fora de janela. Aplicado gate `Authorization === Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
(padrão já usado em `audit-logs-prune`/`purge-soft-deleted`).

### R27-CRIT-02 — Idempotência do gmaps-proxy
Bug lógico: `.eq("config_hash", null as unknown as string)` no branch de dedup 23505 nunca
casava em PostgREST (`NULL != NULL`). Toda colisão caía no `throw 500` mesmo quando o
sistema deveria retornar o job existente. Fix: extrair `config_hash` do `dbError.details` e
usar `.eq(config_hash, hash)`; fallback para `maybeSingle()` sem esse filtro quando o parse
falha.

### R27-CRIT-03 — Registry multi-tenant completo
8 tabelas org-scoped (`company_reviews`, `lusha_contacts`, `lusha_credit_usage_log`,
`lusha_dm_search_history`, `lusha_search_sessions`, `oracle_rate_limits`, `org_proxies`,
`org_retry_policies`, `org_scrape_rate_limits`) estavam ausentes do `ORG_SCOPED_TABLES`,
`ORG_UNSCOPED_TABLES` e `EXEMPT_TABLES` — gap silencioso: o painel de cobertura de RLS
mostrava OK, mas essas tabelas escapavam do teste de sincronia
(`withOrg.registry.test.ts`). Classificadas como `ORG_UNSCOPED_TABLES` (acesso legítimo via
`supabase.from` cru + RLS específica), sincronizadas no mirror frontend do registry, e a
fixture `org-scoped-tables.fixture.json` foi atualizada com a verdade do banco (55
tabelas).

### R27-CRIT-04 — Realtime consistente após DELETE
`useDashboardData` filtrava `payload.new.organization_id === activeOrgId`, mas em eventos
DELETE o Postgres/PostgREST só entrega `payload.old` (dependendo de REPLICA IDENTITY), então
deleções nunca disparavam invalidação e o dashboard mostrava contagens desatualizadas.
Fixes: `orgOf(payload) = (payload.new ?? payload.old).organization_id`,
`activeOrgId` incluído no nome do canal (evita eventos cross-org na troca de organização) e
filtro server-side `organization_id=eq.<orgId>` nas 4 subscriptions (reduz banda e evita
leitura cross-org antes do check client-side).

### R27-CRIT-05 — Race condition em useTaskReminders
Sem flag de "componente desmontado", um `db.update(reminded=true)` disparado após signOut
executava com `user.id` obsoleto (janela real de escrita cross-tenant se o novo usuário
tivesse sessão no mesmo browser). Fix: flag `cancelled` setada no cleanup do `useEffect` e
checada antes de qualquer `await`. Bônus: rollback do set `fired` quando o update falha,
evitando que uma falha transitória silencie o lembrete permanentemente.

## Métricas antes / depois

| Métrica | Antes | Depois |
|---------|:-:|:-:|
| Tabelas org-scoped classificadas | 47 | 55 (+8) |
| Cron functions com gate service_role | 2 | 8 (+6) |
| Nome do canal realtime dashboard | `user:<uid>` | `user:<uid>:org:<oid>` |
| Dedup idempotente no gmaps-proxy | ❌ (bug lógico) | ✅ |
| Cobertura de teste `rls_coverage_complete` | 47/55 | 55/55 |

## Consequências

**Positivo:**
- Fecha 5 vetores críticos de comportamento incorreto (auth, idempotência, realtime, race, defesa em profundidade).
- Teste `withOrg.registry.test.ts` agora falhará automaticamente se uma futura migração
  adicionar `organization_id` sem classificação — regressão fica impossível de introduzir
  silenciosamente.
- 100% (679/679) dos testes unitários e de integração passam.

**Trade-off:**
- Auditorias registraram 47 achados adicionais (33 importantes + 29 info) — refatorações
  de arquivos monolíticos (`LushaIntelligenceView.tsx` 2799 linhas, `OracleV2Panel.tsx` 839
  linhas), extração de subcomponentes, `AlertDialog` para confirmações de delete, e melhorias
  de acessibilidade (aria-label em botões icon-only, id+htmlFor em forms). Ficam para
  próxima rodada, sem impacto funcional imediato.

## Fora de escopo (roadmap)

- Refatoração dos componentes monolíticos (`LushaIntelligenceView`, `OracleV2Panel`, `CompanyDetailModal`).
- Acessibilidade sistemática em `AddDealDialog`, `StagesManagerDialog`, `DealDetailDrawer`, `DealTasksPanel`, `CompanyDetailModal`.
- `AlertDialog` para todas as ações destrutivas (deleteStage, deleteTask, deleteDeal).
- Migração das cron functions restantes para `config.toml` com `verify_jwt=false` explícito documentado.
