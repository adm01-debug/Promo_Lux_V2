
-- 1) Índice UNIQUE redundante: pkey já cobre service_name com unique
DROP INDEX IF EXISTS public.circuit_breakers_service_name_uk;

-- 2) Índices não utilizados (idx_scan=0 confirmado via pg_stat_user_indexes)
--    circuit_breaker_snapshots é append-only para telemetria; leituras usam
--    outros caminhos ou não estão implementadas. Se leitura for adicionada
--    depois, recriar índices sob demanda.
DROP INDEX IF EXISTS public.idx_cb_snapshots_service_captured;
DROP INDEX IF EXISTS public.idx_cb_snapshots_captured;

-- Documentar decisão
COMMENT ON TABLE public.circuit_breaker_snapshots IS
  'Telemetria append-only. Índices secundários removidos em 2026-07-21 por 0 uso (idx_scan=0). Recriar quando dashboard de histórico for implementado.';
