-- Attach the existing log_audit_event() trigger to email_accounts so connect
-- (insert), updates (token refresh, scope change, reactivation) and disconnect
-- (delete) are automatically captured in audit_logs with old_data / new_data.
DROP TRIGGER IF EXISTS trg_audit_email_accounts ON public.email_accounts;
CREATE TRIGGER trg_audit_email_accounts
AFTER INSERT OR UPDATE OR DELETE ON public.email_accounts
FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();