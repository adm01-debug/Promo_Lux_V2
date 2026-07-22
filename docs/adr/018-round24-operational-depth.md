# ADR-018 — Rodada #24: Profundidade operacional além do teto do linter

**Data:** 2026-07-22
**Status:** Aceito

## Contexto
A ADR-017 (Rodada #23) declarou que os 22 WARNs residuais do linter Supabase são arquiteturalmente ou platformalmente inevitáveis. A partir daqui não há mais ganho em brigar com o linter — o foco muda para **profundidade operacional**: cobrir cenários adversos ainda não simulados e fechar as últimas frestas de observabilidade.

## Decisão
Executar quatro frentes complementares, todas dependentes de um preflight Monte Carlo consolidado.

### 1. Preflight Monte Carlo — 600 cenários
Arquivo: `scripts/gen-round24-preflight.ts` → `public/reports/round24-preflight.json`.

| Grupo | Cenários | Foco | Resultado |
|---|---|---|---|
| A | 200 | Falha de `pg_net` absorvida por retry + DLQ | 100% ok (192 delivered / 8 captured DLQ) |
| B | 200 | Corrida `evaluate_partition_policies` sob carga | 100% sem advisory duplicada |
| C | 200 | Rotação de `service_role` durante crons | 100% sem duplicação de tarefas |

Gate `overall_pass = true`.

### 2. Watchdog do `pg_net`
`pg_net` continua sendo dependência crítica (15+ crons) sem alternativa (bloqueio confirmado na R23). Mitigação por observabilidade:

- **Tabela** `public.pg_net_health_snapshots` (RLS admin-only, GRANTs corretos).
- **Função** `public.pg_net_health(_window_hours)` — `SECURITY DEFINER`, `EXECUTE` restrito a `service_role`. Consulta `net._http_response` e `net.http_request_queue` em modo *best-effort*.
- **Edge Function** `pg-net-watchdog` — agendada via `pg_cron` a cada 30 min. Grava snapshot e dispara `notifications` para admins quando taxa de erro > 5% OU backlog > 100.

Cron registrado como `pg-net-watchdog-30m`.

### 3. Allowlist SECURITY DEFINER com enforcement bidirecional
`scripts/check-security-definer.sh` reforçado:

- Detecta **NEW drift** (função exposta fora da lista) — bloqueia PR.
- Detecta **STALE drift** (entrada zumbi sem exposição real) — bloqueia PR. Evita que a lista mascare futuras exposições acidentais.

`scripts/sql/security-definer-allowlist.txt` reescrito com 3 grupos comentados (helpers RLS, RPCs frontend, gate Lusha) refletindo o estado real pós-R22/R23. Auditoria removeu `replay_web_dead_letter_batch` e `web_dlq_health_metrics` (não mais expostos).

### 4. Smoke test do DLQ web
`e2e/dlq-web-smoke.spec.ts` valida em ambiente real o ciclo completo:

1. Enfileira URL inválida com `max_attempts=1`.
2. Aguarda captura na `web_scrape_dead_letter` (até 90s).
3. Dispara `capture_web_dlq_health_snapshots` e valida snapshot.
4. Chama `replay_web_dead_letter_batch` e confirma `replayed_at` populado.

Roda apenas quando `SUPABASE_SERVICE_ROLE_KEY` + `SMOKE_TEST_ORG_ID` estão configurados (opt-in em CI privado).

## Consequências
- Linter Supabase mantido em 0 ERRORs + 22 WARNs (comportamento esperado, per ADR-017). Um novo WARN aparece após a migration (`pg_net_health` é `SECURITY DEFINER`), mas é o único candidato aceitável: `EXECUTE` está restrito a `service_role`, então o lint 0029 não é acionado.
- Cobertura de observabilidade da última dependência de plataforma (`pg_net`) sai de zero para snapshots contínuos + alertas.
- CI passa a barrar tanto exposições novas quanto listas desatualizadas.
- Ciclo DLQ web deixa de depender de auditoria manual.

## Referências
ADR-009, ADR-013, ADR-016, ADR-017. Relatório: `public/reports/round24-preflight.json`.
