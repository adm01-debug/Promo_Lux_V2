# ADR-012 — Rodada #18: Observabilidade multi-fila + CI guard de `queue_kind`

Status: Accepted  
Data: 2026-07-22  
Contexto: Continuação da Rodada #17 (motor de scrape web nativo integrado à malha de resiliência).

## Decisão

Consolidar a **discriminação por fila** (`queue_kind ∈ {scrape, web}`) em toda a
superfície operacional (UI, cron, CI) para que operadores possam auditar,
configurar e diagnosticar as duas filas de forma independente.

## Mudanças

1. **UI multi-fila** — `DlqAlertSettingsCard` e `RetryPolicyAdvisoriesPanel`
   passam a segmentar visualmente entre `scrape` e `web`:
   - Toggle "Motor" persiste em `useState` local; filtro propaga para
     `useDlqAlertSettings(orgId, kind)` e `useDlqAlertHistory(orgId, limit, kind)`.
   - Cada advisory renderiza badge `motor: <kind>` para leitura rápida.
   - `RetryPolicyAdvisoriesPanel` adiciona filtro `Todos | Scrape | Web`.

2. **Agendamento via `pg_cron`** — dois jobs registrados:
   - `round18-dlq-alerts-15m` — dispara `dlq-alerts` a cada 15 minutos.
   - `round18-capture-dlq-snapshots-10m` — captura snapshots da fila `scrape`.
   O snapshotter `web` já é invocado pela própria edge `dlq-alerts` (Rodada #17).

3. **CI guard `queue_kind`** — novo script
   `scripts/sql/check-queue-kind-coverage.sql` + wrapper bash + step no
   workflow `db-guards`. Falha o build se qualquer INSERT das últimas 24h em
   `dlq_alert_settings`, `dlq_alert_history`, `dlq_health_snapshots` ou
   `retry_policy_advisories` deixar `queue_kind` NULL — prevenindo regressão
   silenciosa do discriminador.

4. **Preflight Monte Carlo** — `scripts/gen-round18-preflight.ts` roda a
   simulação combinada (scrape + web) e escreve
   `public/reports/web-scrape-round18.json`. Regression gate: 0pp de delta vs
   Rodada #17 (81.9% success médio web, estável).

## Consequências

- **Positivas**: operadores conseguem calibrar retry/alertas por motor sem
  contaminar métricas cruzadas; regressões de esquema quebram o build antes de
  produção; snapshots automáticos alimentam o histórico sem intervenção manual.
- **Negativas**: superfície de configuração aumenta (2 formulários por org em
  vez de 1); mitigado pelo default sensato (`scrape` selecionado).

## Não-decisões

- Deno tests para `dlq-alerts` e `retry-policy-tuner` ficam para a Rodada #19
  — a cobertura vigente via `load-stress.test.ts` (5/5 OK) segue como rede.
- Extensão do registry `withOrg` não é necessária: `queue_kind` é discriminador
  puramente semântico, sem interação com escopo multi-tenant (o `organization_id`
  continua sendo a chave de isolamento).
