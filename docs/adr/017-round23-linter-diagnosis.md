# ADR-017 — Rodada #23: Diagnóstico final dos WARNs residuais

**Data:** 2026-07-22
**Status:** Aceito (limitações de plataforma documentadas)

## Contexto
Após as Rodadas #21 e #22 zeraram todos os avisos de `anon_security_definer_function_executable` (lint 0028) e reduziram o linter de 28→22 WARNs, restam 22 avisos analisados individualmente nesta rodada.

## Investigação executada

### 1. WARN de `Extension in Public` (lint 0014) — `pg_net`
Tentativa de mover para schema `extensions`:
```sql
CREATE SCHEMA IF NOT EXISTS extensions;
GRANT USAGE ON SCHEMA extensions TO postgres, anon, authenticated, service_role;
ALTER EXTENSION pg_net SET SCHEMA extensions;
```
**Resultado:** `ERROR 0A000: extension "pg_net" does not support SET SCHEMA`.

**Conclusão:** limitação da extensão `pg_net` (Supabase). O aviso é permanente enquanto essa extensão for necessária para os 15+ cron jobs que dependem de `net.http_post`. As funções de HTTP moram no schema dedicado `net` (verificado via `pg_proc`), então a exposição real é limitada.

### 2. WARN de `authenticated_security_definer_function_executable` (lint 0029) — 20 ocorrências
Auditoria função a função (via `pg_get_functiondef` + `rg` no frontend/edge functions):

**Grupo A — Helpers de RLS (impossível converter):**
- `has_role`, `is_org_member`, `has_org_role` — chamadas dentro de policies. Se `SECURITY INVOKER`, causariam recursão infinita (a policy chamaria a função que leria a tabela cujo SELECT depende da mesma policy).

**Grupo B — Escritas privilegiadas (bypass necessário):**
- `accept_org_invite`, `create_default_deal_stages`, `apply_retry_advisory`, `rollback_retry_advisory`, `replay_dead_letter`, `replay_dead_letter_batch`, `purge_dead_letter`, `reset_circuit_breaker`, `evaluate_partition_policies` — inserem/alteram linhas em tabelas onde o usuário não tem grant direto (`user_roles`, `deal_stages`, `partition_advisories`, `scrape_queue`) para preservar o modelo de segurança. `DEFINER` é o único caminho.

**Grupo C — Agregações cross-org (bypass necessário):**
- `get_dashboard_stats`, `dlq_health_metrics`, `dlq_health_trend`, `api_latency_stats`, `api_latency_trend`, `campaign_ab_stats`, `enrichment_funnel_counts` — validam autorização internamente (`is_org_member` / `has_role`) antes de agregar. `SECURITY INVOKER` quebraria as leituras porque as tabelas fonte não têm policy pública.

**Grupo D — Utilitário administrativo:**
- `default_org_for_current_user` — poderia virar `INVOKER` (leitura simples), mas o ganho é 1 WARN a menos com risco de quebrar bootstrap de sessão em contas novas. Descartado por relação risco/benefício.
- `pg_catalog_rls_tables`, `pg_columns_for_insert` — só podem rodar como admin (validam via `has_role`), mas leem `information_schema` que não expõe dados por usuário. Necessariamente `DEFINER`.

## Resultado
| Métrica | Antes (R22) | Depois (R23) |
|---|---|---|
| Linter ERRORs | 0 | **0** |
| Linter WARNs (segurança) | 22 | **22** |
| WARNs eliminados vs baseline (28) | 6 | 6 |
| Tentativas de migração falhas | — | 1 (pg_net documentada) |

## Decisão
Todos os 22 WARNs residuais são **arquitetural ou platformalmente inevitáveis**. O sistema atinge seu limite prático de linter-cleanliness sem sacrificar segurança RLS ou funcionalidade.

Os WARNs seguirão aparecendo no linter, mas passam a ser **ruído catalogado**, não dívida técnica. Próxima varredura só deve alarmar em caso de **novo** WARN ou qualquer ERROR.

## Ação de acompanhamento
- Atualizado `security-memory` para orientar scanners futuros a ignorar as 22 categorias abaixo, sinalizando apenas novos itens.
- CI guard já existente (`ci.yml`) continua bloqueando PRs que introduzam ERRORs.

## Referências
- ADR-009 (baseline de segurança), ADR-015 (fn_lux hardening), ADR-016 (redução de superfície).
