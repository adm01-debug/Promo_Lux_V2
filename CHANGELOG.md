# Changelog

Todas as mudanças notáveis neste projeto serão documentadas neste arquivo.

## [Unreleased] - 2026-07-22
### Analisado
- **Rodada #23 — Diagnóstico final dos 22 WARNs residuais**: tentativa de mover `pg_net` para schema `extensions` falhou com `ERROR 0A000: extension does not support SET SCHEMA` (limitação da extensão Supabase). Auditoria função a função dos 20 avisos de `authenticated_security_definer_function_executable` classificou-os em 4 grupos (helpers RLS, escritas privilegiadas, agregações cross-org, utilitários admin), todos arquiteturalmente necessários. Sistema atinge o teto prático: **0 ERRORs, 22 WARNs catalogados como ruído inevitável**. ADR-017.
- **Rodada #22 — Redução final de superfície de ataque**: auditoria cruzada `rg .rpc()` identificou 2 funções `SECURITY DEFINER` com grant desnecessário a `authenticated` (`api_latency_percentiles`, `dlq_top_reasons`). Migration revogou EXECUTE, mantendo apenas `service_role`. Linter **24 → 22 WARNs** (0 ERRORs). Preflight Monte Carlo 400 cenários de latência de cron: SLA 100%. ADR-016.
- **Rodada #21 — Concorrência + hardening final**: preflight Monte Carlo de 500 cenários de claim concorrente (2–9 workers × 20–500 tasks) — 0 duplicatas, 0 tasks perdidas, fairness 24,3%. Verificado que `scrape_queue`/`web_scrape_queue`/`fn_web_scrape_regression_check` rejeitam UPDATE não autorizado (`permission denied`). Migration revogou `EXECUTE` de `anon`/`PUBLIC` nas 4 funções `fn_lux_*` SECURITY DEFINER — linter passou de **28 → 24 WARNs** (4 alertas de lint 0028 eliminados, 0 ERRORs). ADR-015.
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

