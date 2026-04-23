-- Adiciona controle de reconexão automática para contas OAuth.
-- Quando o refresh token falhar, o polling vai agendar novas tentativas
-- com backoff exponencial até atingir o limite, em vez de tentar a cada
-- ciclo de cron (5 min) e queimar quota.
ALTER TABLE public.email_accounts
  ADD COLUMN IF NOT EXISTS reconnect_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reconnect_next_at timestamptz,
  ADD COLUMN IF NOT EXISTS reconnect_max_attempts integer NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS reconnect_base_delay_seconds integer NOT NULL DEFAULT 300,
  ADD COLUMN IF NOT EXISTS reconnect_required boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reconnect_last_error text;

COMMENT ON COLUMN public.email_accounts.reconnect_attempts IS 'Tentativas consecutivas de auto-reconexão após falha de refresh token';
COMMENT ON COLUMN public.email_accounts.reconnect_next_at IS 'Próximo horário em que o polling pode tentar refresh novamente';
COMMENT ON COLUMN public.email_accounts.reconnect_max_attempts IS 'Limite configurável de tentativas antes de pedir reconexão manual';
COMMENT ON COLUMN public.email_accounts.reconnect_base_delay_seconds IS 'Atraso base (s) para o backoff exponencial: delay = base * 2^(attempt-1)';
COMMENT ON COLUMN public.email_accounts.reconnect_required IS 'Marcador: usuário precisa reconectar manualmente (todas as tentativas falharam ou erro fatal)';
COMMENT ON COLUMN public.email_accounts.reconnect_last_error IS 'Último erro de refresh observado';