-- Remove os gatilhos de auditoria antigos (process_audit_log) que são
-- incompatíveis com o schema atual de audit_logs (coluna user_id inexistente
-- e valores de action fora do enum {create,update,delete}). O gatilho correto
-- log_audit_event já cobre estas tabelas.
DROP TRIGGER IF EXISTS audit_companies_trigger ON public.companies;
DROP TRIGGER IF EXISTS audit_deals_trigger ON public.deals;

-- A função obsoleta não é mais referenciada por nenhum gatilho.
DROP FUNCTION IF EXISTS public.process_audit_log();