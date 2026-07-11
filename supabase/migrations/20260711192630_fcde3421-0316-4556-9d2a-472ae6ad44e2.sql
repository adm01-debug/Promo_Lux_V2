-- ============================================================================
-- MELHORIA: Índices parciais para filas quentes + remoção de duplicados
-- ============================================================================

-- GAP 1: O webhook-dispatcher consulta entregas 'pending' prontas para envio
-- (status='pending' AND next_retry_at <= now()), mas só existia índice parcial
-- para status='retrying'. Sem índice, a fila principal fazia scan sequencial.
CREATE INDEX IF NOT EXISTS idx_wh_deliv_pending
  ON public.webhook_deliveries (next_retry_at)
  WHERE status = 'pending';

-- GAP 2: Consultas de fila/monitoramento buscam apenas runs ativos. Um índice
-- parcial é muito menor e mais eficiente que o índice de status completo para
-- este caminho quente (workers fazendo polling de trabalho pendente).
CREATE INDEX IF NOT EXISTS idx_workflow_runs_active
  ON public.workflow_runs (created_at)
  WHERE status IN ('pending', 'queued', 'running');

-- GAP 3: Índices exatamente duplicados inflam escritas e desperdiçam espaço.
-- Mantemos idx_deals_org / idx_workflow_runs_org e removemos os gêmeos.
DROP INDEX IF EXISTS public.idx_deals_org_id;
DROP INDEX IF EXISTS public.idx_workflow_runs_org_id;