-- Bug 4: alinhar a policy INSERT de lusha_contacts com SELECT/UPDATE/DELETE.
DROP POLICY IF EXISTS lc_insert ON public.lusha_contacts;
CREATE POLICY lc_insert ON public.lusha_contacts
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND has_org_role(organization_id, auth.uid(), 'viewer'::app_role)
  );