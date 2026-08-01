# ADR-019 — Rodada #25: Alert dedup, retenção de snapshots e idempotência do watchdog

**Data:** 2026-07-22
**Status:** Aceito

## Contexto
A ADR-018 (Rodada #24) instalou o watchdog do `pg_net` a cada 30 min. Sob incidente prolongado (ex.: 12h), isso geraria 24 notificações por admin, causando alert fatigue. Além disso, a tabela `pg_net_health_snapshots` cresceria indefinidamente (~17.500 linhas/ano), e overlap de execução do cron pode gerar snapshots duplicados.

## Decisão
Três controles complementares, validados por preflight Monte Carlo de 700 cenários (`public/reports/round25-preflight.json`, gate PASS 100%).

### 1. Dedup por cooldown (60 min)
Nova função `public.pg_net_watchdog_should_notify(_admin_id, _cooldown_minutes)` retorna `false` quando o admin recebeu notificação `pg_net degradado` na última hora. `EXECUTE` restrito a `service_role`.

Impacto: incidente de 12h passa de 24 → ≤ 12 notificações por admin (uma por hora).

### 2. Retenção de snapshots (90 dias)
Nova função `public.prune_pg_net_health_snapshots(retention_days)` remove snapshots antigos. Novo cron semanal `pg-net-snapshots-prune-weekly` (`0 3 * * 0`) mantém a tabela em ≤ 4.320 linhas (90 × 48).

### 3. Advisory lock (idempotência)
Nova função `public.pg_net_watchdog_try_lock()` retorna `pg_try_advisory_xact_lock(hashtext('pg_net_watchdog'))`. Edge function `pg-net-watchdog` chama a função no início e aborta silenciosamente se outro processo já detém o lock — elimina risco de dois snapshots simultâneos quando o cron atrasa.

## Consequências
- Linter Supabase mantido em 0 ERRORs + 22 WARNs (as três novas funções são `SECURITY DEFINER` com `EXECUTE` restrito a `service_role`, portanto não disparam lint 0029).
- Tabela `pg_net_health_snapshots` estabilizada em janela previsível.
- Watchdog resiliente a overlap de cron e a incidentes longos sem sobrecarregar admins.

## Referências
ADR-017, ADR-018. Relatório: `public/reports/round25-preflight.json`.
