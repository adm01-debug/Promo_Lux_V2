-- Add scope_type column to email_accounts
ALTER TABLE public.email_accounts
  ADD COLUMN IF NOT EXISTS scope_type text NOT NULL DEFAULT 'user'
    CHECK (scope_type IN ('user', 'organization'));

CREATE INDEX IF NOT EXISTS idx_email_accounts_org_scope
  ON public.email_accounts (organization_id, scope_type);

-- Drop existing per-user only policies
DROP POLICY IF EXISTS "Owner views own accounts" ON public.email_accounts;
DROP POLICY IF EXISTS "Owner inserts own accounts" ON public.email_accounts;
DROP POLICY IF EXISTS "Owner updates own accounts" ON public.email_accounts;
DROP POLICY IF EXISTS "Owner deletes own accounts" ON public.email_accounts;

-- SELECT: owner sees own user-scoped; all org members see organization-scoped
CREATE POLICY "View own or shared email accounts"
ON public.email_accounts
FOR SELECT
TO authenticated
USING (
  (scope_type = 'user' AND user_id = auth.uid())
  OR (scope_type = 'organization' AND public.is_org_member(organization_id, auth.uid()))
);

-- INSERT: user-scoped requires user owns row; organization-scoped requires admin role
CREATE POLICY "Insert email accounts by scope"
ON public.email_accounts
FOR INSERT
TO authenticated
WITH CHECK (
  (scope_type = 'user' AND user_id = auth.uid())
  OR (scope_type = 'organization' AND public.has_org_role(organization_id, auth.uid(), 'admin'::public.app_role))
);

-- UPDATE: owner updates own user-scoped; admins update org-scoped
CREATE POLICY "Update email accounts by scope"
ON public.email_accounts
FOR UPDATE
TO authenticated
USING (
  (scope_type = 'user' AND user_id = auth.uid())
  OR (scope_type = 'organization' AND public.has_org_role(organization_id, auth.uid(), 'admin'::public.app_role))
)
WITH CHECK (
  (scope_type = 'user' AND user_id = auth.uid())
  OR (scope_type = 'organization' AND public.has_org_role(organization_id, auth.uid(), 'admin'::public.app_role))
);

-- DELETE: owner deletes own user-scoped; admins delete org-scoped
CREATE POLICY "Delete email accounts by scope"
ON public.email_accounts
FOR DELETE
TO authenticated
USING (
  (scope_type = 'user' AND user_id = auth.uid())
  OR (scope_type = 'organization' AND public.has_org_role(organization_id, auth.uid(), 'admin'::public.app_role))
);

-- Service role bypass for edge functions
DROP POLICY IF EXISTS "Service manage email_accounts" ON public.email_accounts;
CREATE POLICY "Service manage email_accounts"
ON public.email_accounts
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);