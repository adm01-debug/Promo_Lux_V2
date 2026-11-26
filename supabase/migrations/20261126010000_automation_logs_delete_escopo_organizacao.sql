-- ---------------------------------------------------------------------------
-- Etapa 019: exclusao de log de automacao restrita a organizacao.
--
-- Antes (20260712185444:59-62):
--   CREATE POLICY "Admins removem logs de automação"
--     ON public.automation_execution_logs FOR DELETE TO authenticated
--     USING (public.has_role(auth.uid(), 'admin'));
--
-- `has_role` le `user_roles`, que nao tem organization_id: administrador de
-- QUALQUER organizacao apaga o log de execucao de QUALQUER outra. A trilha e
-- escrita por `log_automation_event` e e o unico registro do que a automacao
-- fez; exclusao entre tenants e destruicao de prova alheia.
--
-- Depois: `has_org_role(organization_id, auth.uid(), 'admin')`, o mesmo idioma
-- das policies escopadas do banco. Registro global (organization_id nulo)
-- continua exigindo papel global, como em "Advisories select scoped".
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Admins removem logs de automação" ON public.automation_execution_logs;

CREATE POLICY "Admins removem logs de automação"
  ON public.automation_execution_logs
  FOR DELETE
  TO authenticated
  USING (
    (organization_id IS NULL AND public.has_role(auth.uid(), 'admin'::public.app_role))
    OR (
      organization_id IS NOT NULL
      AND public.has_org_role(organization_id, auth.uid(), 'admin'::public.app_role)
    )
  );