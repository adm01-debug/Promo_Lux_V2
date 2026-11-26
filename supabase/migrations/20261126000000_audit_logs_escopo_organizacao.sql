-- Escopo por organizacao na leitura de audit_logs.
--
-- Causa: duas policies SELECT para `authenticated` coexistiam:
--   * "Admins view org audit logs" (20260422204526) - escopada por organization_id;
--   * "Admins view audit logs"     (20260513140617) - USING (has_role(uid,'admin')), sem escopo.
-- Policies permissivas se somam com OR, entao a global anulava a escopada: um
-- administrador lia a auditoria de todas as organizacoes. `fetchAuditTrail`
-- (src/hooks/useAuditTrail.ts:72) nao filtra organization_id e confia na RLS.

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins view audit logs" ON public.audit_logs;

-- Recria a policy escopada de forma idempotente: cobre o caso de ela nao existir
-- em producao por aplicacao parcial da migration de origem.
DROP POLICY IF EXISTS "Admins view org audit logs" ON public.audit_logs;
CREATE POLICY "Admins view org audit logs" ON public.audit_logs
  FOR SELECT TO authenticated
  USING (
    organization_id IS NOT NULL
    AND public.has_org_role(organization_id, auth.uid(), 'admin'::public.app_role)
  );

-- Registros sem organization_id nao tem org para comparar; ficam visiveis apenas
-- para quem os produziu, comportamento anterior a policy global.
DROP POLICY IF EXISTS "Actor view own orgless audit logs" ON public.audit_logs;
CREATE POLICY "Actor view own orgless audit logs" ON public.audit_logs
  FOR SELECT TO authenticated
  USING (organization_id IS NULL AND actor_id = auth.uid());

COMMENT ON POLICY "Admins view org audit logs" ON public.audit_logs IS
  'Leitura restrita a organizacao do administrador. Nao recriar policy global: policies permissivas se somam com OR.';