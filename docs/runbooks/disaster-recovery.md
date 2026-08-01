# Runbook — Disaster Recovery

**Última atualização:** 2026-07-22 (Rodada #26)
**Alvo:** RPO ≤ 15 min · RTO ≤ 30 min

## 0. Diagnóstico inicial (30 s)

```bash
curl -s -H "Authorization: Bearer $ADMIN_JWT" \
  https://<project>.functions.supabase.co/system-recovery-status | jq
```

Ou via SQL (com service_role):

```sql
SELECT public.system_recovery_health();
```

O payload traz: crons ativos + última execução, backlog das filas, DLQs pendentes, idade dos snapshots.

## 1. Rehidratação de crons

```sql
-- Auditar crons desatualizados (>1h sem executar)
SELECT j.jobname, j.schedule, r.start_time, r.status
FROM cron.job j
LEFT JOIN LATERAL (
  SELECT start_time, status FROM cron.job_run_details
  WHERE jobid = j.jobid ORDER BY start_time DESC LIMIT 1
) r ON true
WHERE j.active = true
  AND (r.start_time IS NULL OR r.start_time < now() - interval '1 hour');

-- Rearmar cron pontualmente
SELECT cron.unschedule('<jobname>');
-- Reaplicar via migration ou insert manual (ver histórico de migrations R21/R24/R25)
```

## 2. Drenagem de DLQ

```sql
-- DLQ legada (scrape)
SELECT public.replay_dead_letter_batch(NULL, 500);

-- DLQ web
SELECT public.replay_web_dead_letter_batch(NULL, 500);
```

Repetir em batches de 500 até `dlq_*_pending = 0`. Throughput observado: ~2.500 tasks/min por worker × 5 workers.

## 3. Validação pg_net

```sql
SELECT public.pg_net_health(24);
```

Se `error_rate_pct > 5` ou `backlog_pending > 100`: consultar `net._http_response` últimos 30 min para identificar endpoint problemático.

## 4. Reautenticação service_role

Após rotação, invocar edge critical uma vez para validar:

```bash
curl -X POST -H "Authorization: Bearer $SERVICE_ROLE" \
  https://<project>.functions.supabase.co/health
```

## 5. Checklist RPO/RTO

- [ ] Backups automáticos ativos com janela ≤ 15 min (validado no preflight R26 — 300/300 cenários OK)
- [ ] Crons críticos executaram nas últimas 24h
- [ ] DLQs abaixo de 500 itens (senão drenar antes de aceitar novo tráfego)
- [ ] `pg_net_health_snapshots` com snapshot ≤ 45 min de idade
- [ ] `db_health_snapshots` com snapshot ≤ 6 h de idade

## 6. Cenários testados (preflight R26)

| Cenário | Amostras | Resultado |
|---|---|---|
| RPO com backup 5–15 min | 300 | 100% dentro do target |
| RTO drenagem + rehidratação | 300 | 100% ≤ 30 min |
| Ganho BRIN vs BTREE (1M–10M linhas) | 200 | 100% ratio ≥ 50× |

Relatório completo: `public/reports/round26-preflight.json`.
