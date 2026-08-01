# ADR-011: Rodada #17 — Motor de scrape web + hardening final

## Status
Aceito — 2026-07-22

## Contexto
Continuação natural das rodadas #4/#16. O motor de scrape web nativo (Opção C — ADR-010) estava operacional mas fora da malha de observabilidade compartilhada: sem auto-tuning de retry, sem alertas proativos de DLQ e sem chaos test dedicado. Além disso, o linter Supabase reportava 35 warnings (nenhum ERROR).

## Decisão

### 1) Discriminador `queue_kind` na malha de resiliência
As tabelas `retry_policy_advisories`, `dlq_health_snapshots`, `dlq_alert_history` e `dlq_alert_settings` ganharam a coluna `queue_kind text CHECK (queue_kind IN ('scrape','web'))` com default `scrape` (compatível). A PK de `dlq_alert_settings` passou de `(organization_id)` para `(organization_id, queue_kind)`, permitindo settings independentes por motor.

### 2) `retry-policy-tuner` cobre `scrape` + `web`
A edge function agora executa `tuneKind()` para ambos os motores em uma mesma execução. O motor `web` observa `web_scrape_queue.status ∈ {succeeded,failed,dead}` nas últimas 24h como sample base. Advisories são gravadas com `queue_kind` preenchido; a UI existente de aprovação/rollback continua funcionando por herdar o wire.

### 3) `dlq-alerts` cobre `scrape` + `web`
A edge function agora invoca `capture_web_dlq_health_snapshots()` antes de avaliar e depois processa `processKind('scrape')` e `processKind('web')` independentemente. Cada alerta grava `queue_kind` no histórico e notifica os admins da org com o rótulo correspondente.

### 4) Chaos Engineering do motor web
`web-scrape-worker` já contava com injeção de 1% de falhas sintéticas gated por `feature_flags.chaos_web_enabled` (default false). Confirmado e mantido — permite validar continuamente o caminho de retry sem impacto real.

### 5) Hardening de `search_path`
Sete funções `fn_lux_*` / `fn_lusha_*` estavam sem `search_path` fixo; ganharam `SET search_path = public` via `ALTER FUNCTION`. Warnings do linter: **35 → 28**.

### 6) SECURITY DEFINER — allowlist atualizada
Nenhuma nova SD introduzida com `EXECUTE` para `anon`/`authenticated` nesta rodada. `capture_web_dlq_health_snapshots` é `SECURITY DEFINER` mas restrita a `service_role` (chamada pela cron edge function).

## Métricas antes/depois (Simulação Monte Carlo — 500 cenários web)

| Métrica              | Baseline | Current | Δ       |
|----------------------|---------:|--------:|--------:|
| avg success rate     |    82.5% |   81.9% |  −0.6pp |
| avg DLQ rate         |    17.5% |   18.1% |  +0.6pp |

> Observação: o `current` do web scrape é mais conservador (menos tentativas, backoff maior) para reduzir custo por URL sob falha permanente (4xx/robots). O trade-off é intencional; o motor de auto-tuning (`retry-policy-tuner.web`) pode revisar caso o mix mude.

## Testes de carga (Rodada #17)
`src/tests/load-stress.test.ts` ganhou 2 cenários dedicados ao motor web (1000 URLs mistas, política otimizada). Ambos passam.

## Postura do linter
- ERRORs: **0** (baseline confortável).
- WARNs: **28**, todos categorizados no ADR-009 (extension_in_public + SECURITY DEFINER allowlistadas).

## Consequências
- **Positivo:** paridade completa das duas filas na malha de resiliência.
- **Positivo:** UI existente de advisories/alertas passa a exibir ambos os motores sem retrabalho.
- **Guarda:** `scripts/check-security-definer.sh` mantém o veto a novas SDs fora da allowlist.

## Referências
- ADR-009 (security baseline), ADR-010 (motor de scrape web).
- Migration Rodada #17 (queue_kind discriminator + `capture_web_dlq_health_snapshots`).
- `public/reports/web-scrape-round17.json`.
