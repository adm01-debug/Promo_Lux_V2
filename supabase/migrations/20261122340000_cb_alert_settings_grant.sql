-- Permite que administradores salvem a configuração de alertas de disjuntor pela UI.
--
-- A tabela circuit_breaker_alert_settings (20260715190111_34d421ca) recebeu apenas
-- GRANT SELECT para `authenticated` (linha 50). O upsert do front falhava com
-- permission denied mesmo com as policies de RLS já permitindo FOR ALL para admin.
-- Espelha o grant de api_latency_alert_settings (20260712220855_4ed03020:36).

GRANT INSERT, UPDATE ON public.circuit_breaker_alert_settings TO authenticated;