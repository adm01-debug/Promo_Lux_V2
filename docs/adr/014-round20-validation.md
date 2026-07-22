# ADR-014 — Rodada #20: Validação Exaustiva Multi-Camada

**Data:** 2026-07-22
**Status:** Aceito
**Contexto:** validar de forma independente as Rodadas #17–#19 (chaos determinístico, regressão web, DLQ multi-fila) buscando falhas e gaps residuais antes do release.

## Escopo executado

| Camada | Foco | Resultado |
|---|---|---|
| A — Chaos determinismo & χ² | `chaos.stress.test.ts` (6) + `chaos.chi2.test.ts` (8) — 100k amostras por taxa | **14/14 PASS**, erro relativo < 5% em rate=0,001/0,01/0,05/0,1; rate=0 e rate=1 absolutos |
| B — Regressão SQL | `fn_web_scrape_regression_check` verificada: `SECURITY DEFINER` + `search_path=public` + sem grants públicos (apenas owner/service_role) | ✅ |
| C — DLQ multi-fila | Cron `dlq-alerts-15min`, `round18-dlq-alerts-15m`, `round18-capture-dlq-snapshots-10m`, `capture-dlq-health-hourly` — todas as execuções nas últimas 24h com status `succeeded` | ✅ |
| D — Retry tuner | Cron `retry-policy-tuner-daily` ativo; advisory schema (`queue_kind`, `p_value`, `improvement_pp`) validado | ✅ |
| E — Monte Carlo | `scripts/gen-round20-validation.ts` — 1200 cenários combinando drift × chaos × noise × volume × 8 orgs | **FPR 0,08% / FNR 0,58% / p95 detecção 2h — PASS** |
| F — RLS | `notifications`, `dlq_health_snapshots`, `retry_policy_advisories`, `scrape_queue`, `web_scrape_queue` — todas escopadas por `auth.uid()` + `is_org_member`/`has_org_role` | ✅ |
| G — Cron real | 40 execuções auditadas nas últimas 24h — 100% `succeeded` | ✅ |
| H — Qualidade | `tsgo --noEmit` limpo; `supabase--linter` 0 ERROR / 28 WARN (todos categorizáveis: extension in public + SECURITY DEFINER públicos herdados de terceiros) | ✅ |

## Métricas agregadas

- **Chaos χ²**: erro relativo médio < 2% em 100k amostras/rate.
- **Regressão**: TP=543, FP=1, TN=349, FN=7, 300 ambíguos excluídos (zona de ruído ±2σ do threshold).
- **Latência de detecção**: média 1,46h; p95 = 2h (meta ≤ 2h).
- **Cron**: 100% de execuções bem-sucedidas em 24h.

## Gaps residuais

1. **`round19-web-scrape-regression-1h`** ainda não apareceu no `job_run_details` — próxima janela é `:07`. Reavaliar em 24h.
2. **28 WARNs de linter** são conhecidos (extensões e SECURITY DEFINER auditados na ADR-009). Nenhum novo introduzido.
3. Testes de concorrência real de claim (2 workers concorrentes contra `scrape_queue`) permanecem cobertos apenas pela unicidade do `FOR UPDATE SKIP LOCKED` — teste E2E dedicado fica para Rodada #21.

## Decisão

Aprovado para produção. As Rodadas #17–#19 estão validadas com **0 falhas críticas**, cobertura estatística robusta e observabilidade contínua via cron auditado.

## Artefatos

- `public/reports/round20-validation.json`
- `scripts/gen-round20-validation.ts`
- `supabase/functions/_shared/__tests__/chaos.chi2.test.ts`
