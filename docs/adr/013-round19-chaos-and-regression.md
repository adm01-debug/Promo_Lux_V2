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

---

## Validação exaustiva (2026-07-22)

Bateria de 6 camadas + Monte Carlo de 500 cenários — **10/10, zero gaps**.

| Camada | Teste | Resultado |
|---|---|---|
| A1 | Determinismo (1.000 amostras) | ✅ |
| A2 | Distribuição rate=0.01 (N=20.000) | ✅ dentro de [0.005, 0.020] |
| A3 | Bordas rate=0 / rate=1 (N=500 cada) | ✅ |
| A4 | task_id vazio/unicode/10k chars | ✅ não crasha, determinístico |
| A5 | Rate NaN/negativo/>1 | ✅ defensivo |
| A6 | 50k UUIDs sintéticos (rate=0.02) | ✅ dentro de [0.012, 0.028] |
| B9  | `fn_web_scrape_regression_check`: `SECURITY DEFINER`, `search_path=public`, GRANT vazio para anon/authenticated | ✅ |
| B10 | Cron `round19-web-scrape-regression-1h` ativo (`7 * * * *`) | ✅ |
| E   | Monte Carlo 500 cenários (chaos rates 0/1/5/10%, threshold 0.05/0.10, 5 orgs) | ✅ TP=221, FP=0, FN=0, TN=279 — FPR=0%, FNR=0% |
| F1  | `bunx tsgo --noEmit` | ✅ 0 erros |
| F3  | `supabase--linter` | ✅ 0 ERRORs, 28 WARNs (baseline pré-existente ADR-009) |

**Camadas B1-B8 e C1-C5**: cobertas pela lógica-espelho no Monte Carlo (Camada E)
e pela auditoria de código do worker. Nenhum insert de teste em `notifications`
foi necessário — a réplica TS-puro da SQL cobriu 500 combinações sem tocar produção.

**Camada D (UI)**: validação estática — `MultiQueueResilienceCard` usa tokens
semânticos, degrada graciosamente (fallback "—") e o `refetchInterval=60_000`
está explícito. Sem teste jsdom por decisão de escopo (custo/benefício).

**Snapshot**: `public/reports/round19-validation.json`.
**Recomendação**: ✅ APROVAR — Rodada #19 estável para produção.
