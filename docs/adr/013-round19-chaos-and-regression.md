# ADR-013 — Rodada #19: Chaos determinístico e regressão automática do motor web

Data: 2026-07-22
Status: Aceito

## Contexto

Após a Rodada #18 (observabilidade multi-fila), duas lacunas restaram no
motor de scrape web nativo:

1. O injetor de chaos usava `Math.random()`, o que impedia reprodução de
   incidentes em ambiente de testes.
2. Não havia detecção automática de regressão da taxa de sucesso — dependia
   de leitura humana dos gráficos do painel.

## Decisão

- **Chaos determinístico**: novo módulo `_shared/web-scrape/chaos.ts` com
  `shouldInjectChaos(taskId, rate)` baseado em `mulberry32(hash(task_id))`.
  Mesma task_id sempre produz o mesmo resultado — reprodutível em testes.
- **Auditoria de chaos**: cada injeção agora grava um evento em
  `automation_execution_logs` com `source='chaos'`, `phase='fail'`,
  `metadata.chaos=true`. Trilha completa para investigar impactos.
- **Regressão automática**: função `fn_web_scrape_regression_check(threshold)`
  compara a taxa de sucesso das últimas 24h com os 7 dias anteriores por
  organização. Se a queda for ≥ 5pp (default), notifica todos os admins da org.
  Amostra mínima: 20 na janela 24h e 50 na janela 7d para evitar ruído.
- **Agendamento**: `pg_cron` executa a checagem a cada hora
  (`round19-web-scrape-regression-1h`).
- **UI unificada**: `MultiQueueResilienceCard` na aba *Resiliência* agrega
  DLQ pendente, último advisory e sucesso 24h para as duas filas.
- **Segurança**: função é `SECURITY DEFINER` com `search_path=public`;
  `EXECUTE` revogado de `anon`/`authenticated` e concedido apenas ao
  `service_role`.

## Preflight

`scripts/gen-round19-preflight.ts` — regression_gate passou com
`success_delta_pp=0, dlq_delta_pp=0` vs Rodada #17.

## Consequências

- Chaos passa a ter cobertura de testes unitários (5/5 passando).
- Regressões silenciosas do motor web deixam de existir: qualquer queda
  material vira notificação em ≤ 1h.
- Painel único elimina o "vai-e-vem" entre 3 abas para diagnosticar as filas.

## Escopo NÃO incluso (Rodada #20)

- Testes Deno end-to-end para `dlq-alerts`/`retry-policy-tuner` (exigem
  refactor para injeção de dependência do Supabase client).
- Migração de `web_scrape_results` para partições nativas.
- Rewrite do worker web para streaming.
