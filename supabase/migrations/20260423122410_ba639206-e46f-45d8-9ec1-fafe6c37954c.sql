-- Attach audit trigger to organization_members so role changes, additions and removals are logged
DROP TRIGGER IF EXISTS trg_audit_organization_members ON public.organization_members;
CREATE TRIGGER trg_audit_organization_members
AFTER INSERT OR UPDATE OR DELETE ON public.organization_members
FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();