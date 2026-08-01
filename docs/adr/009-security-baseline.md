# ADR-009: Security Baseline (20-warnings)

## Status
Aceito — 2026-07-21

## Contexto
O Supabase linter reporta 20 warnings de segurança no banco. Auditoria em três passos (Melhoria #1 e #2) reduziu de 28 → 20. Os 20 remanescentes são intencionais e documentados aqui.

## Decisão

### 1) 19 SECURITY DEFINER aceitas

Todas as funções abaixo permanecem `SECURITY DEFINER` com `EXECUTE` para `authenticated`. Justificativas:

**Helpers de RLS (4)** — precisam de `SECURITY DEFINER` para evitar recursão infinita nas policies que as usam:
- `has_role`, `has_org_role`, `is_org_member`, `default_org_for_current_user`

**RPCs do frontend (15)** — leituras agregadas ou operações com regras de negócio que exigem bypass de RLS controlado:
- `accept_org_invite` — valida token e cria membership
- `api_latency_stats`, `api_latency_trend` — leituras agregadas de snapshots
- `campaign_ab_stats` — leitura agregada de resultados A/B
- `create_default_deal_stages` — bootstrap de pipeline por usuário
- `dlq_health_metrics`, `dlq_health_trend` — leituras agregadas de DLQ
- `evaluate_partition_policies` — leitura consolidada de advisories
- `get_dashboard_stats` — agregação cross-table por org
- `pg_catalog_rls_tables`, `pg_columns_for_insert` — introspecção controlada de catálogo
- `purge_dead_letter`, `replay_dead_letter`, `replay_dead_letter_batch` — operações admin
- `reset_circuit_breaker` — operação admin

### 2) `pg_net` em schema `public`

Mantido em `public`. Todas as chamadas em cron jobs (webhook-dispatcher, vault-cookie-health, audit-logs-prune, workers) dependem do `search_path` incluir `public`. Nenhuma chamada é qualificada (`net.http_post`). Mover exigiria refactor coordenado e pausar cron produtivo — risco > benefício de 1 warning cosmético.

## Consequências
- **Positivo:** superfície de ataque anônima em SECURITY DEFINER = zero; funções internas (triggers/cron/workers) inacessíveis via API.
- **Positivo:** critérios explícitos para revisão de novas SDs.
- **Negativo:** linter continua reportando 20 warnings — devem ser interpretados como baseline, não como falhas.
- **Guarda:** `scripts/check-security-definer.sh` executa no CI e falha o build se surgir SD nova fora da allowlist.

## Allowlist canônica
Fonte de verdade: `scripts/sql/security-definer-allowlist.txt`. Qualquer nova função `SECURITY DEFINER` em `public` com `EXECUTE` para `anon` ou `authenticated` deve:
1. Ser adicionada à allowlist com justificativa neste ADR, **ou**
2. Ter o `EXECUTE` revogado.

## Referências
- Migrations: `20260721153915_*.sql` (revoke anon), `20260721154002_*.sql` (revoke authenticated).
- Linter docs: https://supabase.com/docs/guides/database/database-linter?lint=0028
