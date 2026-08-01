-- ============================================================================
-- MELHORIA: Índice parcial para notificações não lidas + limpeza de redundâncias
-- ============================================================================

-- GAP: o sino de notificações consulta "não lidas do usuário"
-- (user_id = ? AND read = false). O índice booleano completo idx_notifications_read
-- tem baixíssima seletividade (só 2 valores) e cresce com toda a tabela.
-- Um índice parcial escopado por usuário é muito menor e serve exatamente o
-- caminho quente do contador de não lidas.
CREATE INDEX IF NOT EXISTS idx_notifications_unread
  ON public.notifications (user_id, created_at DESC)
  WHERE read = false;

-- Remove o índice booleano completo de baixa seletividade (substituído acima).
DROP INDEX IF EXISTS public.idx_notifications_read;

-- Remove índice redundante: (user_id) já é coberto pelo prefixo de
-- idx_notifications_user_created (user_id, created_at DESC).
DROP INDEX IF EXISTS public.idx_notifications_user_id;