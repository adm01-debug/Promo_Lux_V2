DROP INDEX IF EXISTS public.idx_audit_logs_org;

CREATE INDEX idx_audit_org_violations
  ON public.audit_logs (organization_id, created_at DESC)
  WHERE table_name = '__org_violation';