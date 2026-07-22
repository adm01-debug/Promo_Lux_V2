# Changelog

Todas as mudanças notáveis neste projeto serão documentadas neste arquivo.

## [Unreleased] - 2026-07-22
### Adicionado
- **Rodada #20 — Validação exaustiva multi-camada**: 8 camadas (A–H) cobrindo chaos determinístico (χ² em 100k amostras, rate=0/1 absolutos), regressão web (SQL + Monte Carlo 1200 cenários, FPR 0,08% / FNR 0,58% / p95 detecção 2h), auditoria de crons (últimas 24h — todos `succeeded`), RLS multi-tenant (notifications/DLQ snapshots/advisories) e linter (0 ERRORs, 28 WARNs). Novo `scripts/gen-round20-validation.ts` e `chaos.chi2.test.ts`. Relatório em `public/reports/round20-validation.json`. ADR-014.
- **Rodada #19 — Chaos determinístico + regressão automática (web)**: injetor de chaos determinístico por `task_id` (`_shared/web-scrape/chaos.ts`) com auditoria em `automation_execution_logs`; função `fn_web_scrape_regression_check` agendada a cada hora via `pg_cron` para notificar admins quando a taxa de sucesso 24h cair ≥ 5pp vs 7d; novo card `MultiQueueResilienceCard` unificando DLQ, advisories e sucesso 24h por motor. ADR-013.

## [Unreleased] - 2026-07-21
### Adicionado
- **Relatório comparativo de resiliência**: aba "Resiliência" em Monitoring com cards de Δ successRate/p95/DLQ, gráficos (barras dos 20 piores cenários + linhas de p95) e tabela completa. Download JSON e CSV client-side. Snapshots servidos como assets estáticos em `public/reports/` (`baseline.json`, `current.json`). Módulo `src/lib/resilience/compareReport.ts` com testes unitários cobrindo cenários novos/removidos, empates e regressão.


## [10.0.0] - 2026-05-13
### Adicionado
- **Maturidade 10/10 Concluída**: Sistema em estado de perfeição técnica e operacional.
- **Observabilidade**: Distributed Tracing full-stack com headers `traceparent` (W3C).
- **Observabilidade**: Dashboard de Monitoramento com SLIs/SLOs e status de Edge Functions.
- **Segurança**: Tabela de `idempotency_keys` para prevenção de duplicatas em operações críticas.
- **Integridade**: Optimistic Locking (`version`) implementado em `companies` e `deals` com triggers de banco.
- **Operações**: Edge Function de `prune` automático de logs para conformidade com LGPD.
- **Arquitetura**: Máquina de Estados (XState-pattern) para fluxos de raspagem.
- **Documentação**: Diagrama ER (Mermaid), OpenAPI Spec e Relatório de Conformidade LGPD.
- **Qualidade**: Testes de acessibilidade (axe-core) integrados ao pipeline.

### Alterado
- UI: Sidebar atualizada com seção de Monitoramento e Status do Sistema.
- Banco de Dados: Migrations para suporte a tracing e versionamento de registros.

