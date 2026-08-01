CREATE TABLE public.oauth_sandbox_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL DEFAULT public.default_org_for_current_user(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  label text NOT NULL,
  provider text NOT NULL CHECK (provider IN ('gmail','outlook')),
  scope_type text NOT NULL CHECK (scope_type IN ('user','organization')),
  redirect_uri text NOT NULL,
  redirect_uri_normalized text NOT NULL,
  scopes text[] NOT NULL DEFAULT '{}',
  client_id_configured boolean NOT NULL,
  client_secret_configured boolean NOT NULL,
  warnings text[] NOT NULL DEFAULT '{}',
  auth_url_preview text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_oauth_snapshots_org_created ON public.oauth_sandbox_snapshots(organization_id, created_at DESC);
CREATE INDEX idx_oauth_snapshots_provider ON public.oauth_sandbox_snapshots(organization_id, provider, created_at DESC);

ALTER TABLE public.oauth_sandbox_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view oauth snapshots"
  ON public.oauth_sandbox_snapshots FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));

CREATE POLICY "Admins insert oauth snapshots"
  ON public.oauth_sandbox_snapshots FOR INSERT TO authenticated
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), 'admin'::public.app_role) AND user_id = auth.uid());

CREATE POLICY "Admins update oauth snapshots"
  ON public.oauth_sandbox_snapshots FOR UPDATE TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins delete oauth snapshots"
  ON public.oauth_sandbox_snapshots FOR DELETE TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), 'admin'::public.app_role));