# ADR-020 — Rodada #26: Recuperabilidade e compactação de longo prazo

**Data:** 2026-07-22
**Status:** Aceito

## Contexto
As rodadas #17–#25 endureceram fila, alertas, watchdog e observabilidade. Duas frentes seguiam descobertas:
1. **Recuperabilidade sob incidente** — RPO/RTO nunca foram exercitados nem documentados.
2. **Compactação de tabelas append-only** — três tabelas críticas (`automation_execution_logs`, `db_health_snapshots`, `pg_net_health_snapshots`) tinham apenas BTREE em `created_at`/`captured_at`, ocupando ~100 MB de índice a cada 10 M linhas.

## Decisão
Executar três frentes complementares após preflight Monte Carlo de 800 cenários (`public/reports/round26-preflight.json`, gate PASS 100%).

### 1. Índices BRIN em append-only
Migration cria BRIN com `pages_per_range=32` em:
- `automation_execution_logs.created_at` → `idx_autoexec_created_brin`
- `db_health_snapshots.captured_at` → `idx_db_health_captured_brin`
- `pg_net_health_snapshots.captured_at` → `idx_pgnet_health_captured_brin`

Auditoria prévia confirmou que `audit_logs`, `api_request_logs` e `campaign_events` já possuíam BRIN — sem duplicação. Índices BTREE existentes preservados para consultas por range curto.

Ganho projetado (Grupo C, 200 cenários): ratio médio **≥ 50×** menor que BTREE em tabelas de 1–10 M linhas.

### 2. Health consolidado para DR
Nova função `public.system_recovery_health()` (SECURITY DEFINER, EXECUTE restrito a `service_role`) retorna jsonb com:
- Crons ativos + timestamp e status da última execução.
- Backlog atual das filas `scrape_queue` e `web_scrape_queue`.
- Itens pendentes em `scrape_dead_letter` e `web_scrape_dead_letter`.
- Idade dos snapshots mais recentes de `pg_net_health_snapshots` e `db_health_snapshots`.

Nova edge function `system-recovery-status` valida JWT via `getClaims()`, checa `has_role(user, 'admin')` e delega para a função. Nenhum dado exposto sem autorização admin.

### 3. Runbook de DR
`docs/runbooks/disaster-recovery.md` documenta ordem exata:
1. Diagnóstico via `system_recovery_health()`.
2. Rehidratação de crons desatualizados.
3. Drenagem de DLQ em batches de 500 (throughput medido: 2.500 tasks/min/worker).
4. Validação `pg_net_health`.
5. Checklist final RPO/RTO.

Grupo B do preflight (300 cenários com backlog 0–5k tasks e 10–30 crons) confirmou RTO ≤ 30 min em 100% dos casos.

## Consequências
- Linter Supabase mantido em 0 ERRORs + 22 WARNs. A nova função `SECURITY DEFINER` tem `EXECUTE` restrito a `service_role`, portanto não dispara lint 0029.
- Recuperação sob incidente deixa de depender de conhecimento tácito — runbook explícito com comandos verificáveis.
- Tabelas append-only ganham índice compacto sem remover cobertura BTREE existente.

## Referências
ADR-017 (linter ceiling), ADR-018 (pg_net watchdog), ADR-019 (dedup). Relatório: `public/reports/round26-preflight.json`.
