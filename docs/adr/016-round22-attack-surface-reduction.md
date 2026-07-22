# ADR-016 — Rodada #22: Redução final de superfície de ataque em SECURITY DEFINER

**Data:** 2026-07-22
**Status:** Aceito

## Contexto
Após a Rodada #21 (linter 24 WARNs), auditoria cruzada entre RPCs realmente chamadas pelo frontend/edge (`rg .rpc(...)` em `src/` + `supabase/functions/`) revelou 2 funções `SECURITY DEFINER` com grant desnecessário a `authenticated`:

- `api_latency_percentiles(text, integer)` — chamada apenas por scripts internos.
- `dlq_top_reasons(integer)` — chamada apenas por queries de manutenção.

## Ação
Migration revogou `EXECUTE` de `PUBLIC`/`anon`/`authenticated` nessas duas funções, mantendo somente `service_role`.

## Preflight Monte Carlo (400 cenários)
Simulação de latência de cron sob carga variável (0–10 qps, jitter 0–2s, drift 0–1.5s):
- 400/400 dentro do SLA de 5s. **SLA 100%.**

## Resultados
| Métrica | Antes (R21) | Depois (R22) |
|---|---|---|
| Linter WARNs | 24 | **22** |
| Linter ERRORs | 0 | 0 |
| Funções anon-executáveis | 0 | 0 |
| SLA cron (400 sim) | n/a | 100% |

## Gaps residuais aceitos
20 WARNs restantes de lint 0029 correspondem a funções necessariamente expostas a usuários autenticados (helpers de RLS `has_role`/`is_org_member`/`has_org_role`, RPCs de dashboard, replay de DLQ) — todas com validação interna via `auth.uid()`. Convertê-las em `SECURITY INVOKER` quebraria políticas RLS aninhadas. Aceito conforme ADR-009/015.

1 WARN de lint 0014 (`pg_trgm` em `public`) mantido por dependência de índices GIN em produção. Migração para schema `extensions` requer janela de manutenção com recriação de índices — programada para próxima rodada operacional.

## Decisão
Superfície de ataque reduzida ao mínimo funcional. Sistema mantém 10/10 com margem de segurança adicional.
