-- ============================================================================
-- MELHORIA: Tuning de autovacuum/autoanalyze para tabelas de alto churn
-- ----------------------------------------------------------------------------
-- Contexto: os defaults do Postgres (autovacuum_vacuum_scale_factor = 0.2,
-- autovacuum_analyze_scale_factor = 0.1) só disparam limpeza após 20% da tabela
-- virar dead tuples. Em tabelas de altíssima rotatividade (eventos de campanha,
-- logs de auditoria/API, entregas de webhook, chaves de idempotência, rate
-- limits) isso permite acúmulo de bloat e estatísticas defasadas, degradando
-- planos de query e inflando índices antes do vacuum rodar.
--
-- Estratégia: scale factors baixos + thresholds absolutos, para que o vacuum
-- e o analyze disparem de forma mais frequente e previsível conforme o churn,
-- não como fração de tabelas que podem crescer muito.
-- ============================================================================

-- Tabelas de logs/eventos append-heavy com expurgo periódico (alto churn de
-- inserts + deletes de retenção): mantém dead tuples sob controle.
ALTER TABLE public.campaign_events SET (
  autovacuum_vacuum_scale_factor = 0.02,
  autovacuum_vacuum_threshold = 200,
  autovacuum_analyze_scale_factor = 0.01,
  autovacuum_analyze_threshold = 200
);

ALTER TABLE public.audit_logs SET (
  autovacuum_vacuum_scale_factor = 0.02,
  autovacuum_vacuum_threshold = 200,
  autovacuum_analyze_scale_factor = 0.01,
  autovacuum_analyze_threshold = 200
);

ALTER TABLE public.api_request_logs SET (
  autovacuum_vacuum_scale_factor = 0.02,
  autovacuum_vacuum_threshold = 200,
  autovacuum_analyze_scale_factor = 0.01,
  autovacuum_analyze_threshold = 200
);

ALTER TABLE public.email_sync_log SET (
  autovacuum_vacuum_scale_factor = 0.05,
  autovacuum_vacuum_threshold = 100,
  autovacuum_analyze_scale_factor = 0.02,
  autovacuum_analyze_threshold = 100
);

-- Tabelas de estado transacional com UPDATEs frequentes (contadores,
-- avanço de step, status) — geram muitos dead tuples via HOT updates:
ALTER TABLE public.campaign_recipients SET (
  autovacuum_vacuum_scale_factor = 0.05,
  autovacuum_vacuum_threshold = 100,
  autovacuum_analyze_scale_factor = 0.02,
  autovacuum_analyze_threshold = 100
);

ALTER TABLE public.webhook_deliveries SET (
  autovacuum_vacuum_scale_factor = 0.05,
  autovacuum_vacuum_threshold = 100,
  autovacuum_analyze_scale_factor = 0.02,
  autovacuum_analyze_threshold = 100
);

ALTER TABLE public.notifications SET (
  autovacuum_vacuum_scale_factor = 0.05,
  autovacuum_vacuum_threshold = 100,
  autovacuum_analyze_scale_factor = 0.02,
  autovacuum_analyze_threshold = 100
);

-- Tabelas efêmeras com expurgo agressivo (limpeza por trigger/cron): churn
-- quase 100% do conteúdo em janelas curtas — vacuum precisa ser muito ágil.
ALTER TABLE public.idempotency_keys SET (
  autovacuum_vacuum_scale_factor = 0.05,
  autovacuum_vacuum_threshold = 50,
  autovacuum_analyze_scale_factor = 0.05,
  autovacuum_analyze_threshold = 50
);

ALTER TABLE public.auth_rate_limits SET (
  autovacuum_vacuum_scale_factor = 0.05,
  autovacuum_vacuum_threshold = 50,
  autovacuum_analyze_scale_factor = 0.05,
  autovacuum_analyze_threshold = 50
);

ALTER TABLE public.circuit_breakers SET (
  autovacuum_vacuum_scale_factor = 0.05,
  autovacuum_vacuum_threshold = 50,
  autovacuum_analyze_scale_factor = 0.05,
  autovacuum_analyze_threshold = 50
);