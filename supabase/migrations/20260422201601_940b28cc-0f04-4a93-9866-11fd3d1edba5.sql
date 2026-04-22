
-- Enum de papéis
CREATE TYPE public.app_role AS ENUM ('admin', 'sdr', 'viewer');

-- Tabela organizations
CREATE TABLE public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  owner_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Tabela organization_members
CREATE TABLE public.organization_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role public.app_role NOT NULL DEFAULT 'viewer',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, user_id)
);

CREATE INDEX idx_org_members_user ON public.organization_members(user_id);
CREATE INDEX idx_org_members_org ON public.organization_members(organization_id);

-- Tabela organization_invites
CREATE TABLE public.organization_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  role public.app_role NOT NULL DEFAULT 'viewer',
  created_by uuid NOT NULL,
  accepted_by uuid,
  accepted_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  revoked boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_invites_org ON public.organization_invites(organization_id);
CREATE INDEX idx_invites_token ON public.organization_invites(token);

-- Função SECURITY DEFINER para checagem de papel sem recursão
CREATE OR REPLACE FUNCTION public.has_org_role(_org_id uuid, _user_id uuid, _min_role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_members
    WHERE organization_id = _org_id
      AND user_id = _user_id
      AND CASE _min_role
        WHEN 'viewer' THEN role IN ('viewer','sdr','admin')
        WHEN 'sdr'    THEN role IN ('sdr','admin')
        WHEN 'admin'  THEN role = 'admin'
      END
  );
$$;

-- Membership check (sem nível mínimo)
CREATE OR REPLACE FUNCTION public.is_org_member(_org_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = _org_id AND user_id = _user_id
  );
$$;

-- Aceitar convite
CREATE OR REPLACE FUNCTION public.accept_org_invite(_token text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite public.organization_invites;
  v_user uuid := auth.uid();
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  SELECT * INTO v_invite
  FROM public.organization_invites
  WHERE token = _token
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Convite inválido';
  END IF;

  IF v_invite.revoked THEN
    RAISE EXCEPTION 'Convite revogado';
  END IF;

  IF v_invite.accepted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Convite já utilizado';
  END IF;

  IF v_invite.expires_at < now() THEN
    RAISE EXCEPTION 'Convite expirado';
  END IF;

  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (v_invite.organization_id, v_user, v_invite.role)
  ON CONFLICT (organization_id, user_id) DO NOTHING;

  UPDATE public.organization_invites
  SET accepted_by = v_user, accepted_at = now()
  WHERE id = v_invite.id;

  RETURN v_invite.organization_id;
END;
$$;

-- Trigger: criar membership de admin para o owner ao criar org
CREATE OR REPLACE FUNCTION public.handle_new_organization()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (NEW.id, NEW.owner_id, 'admin');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_organization_created
AFTER INSERT ON public.organizations
FOR EACH ROW EXECUTE FUNCTION public.handle_new_organization();

CREATE TRIGGER update_organizations_updated_at
BEFORE UPDATE ON public.organizations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_invites ENABLE ROW LEVEL SECURITY;

-- organizations
CREATE POLICY "Members can view their organizations"
  ON public.organizations FOR SELECT TO authenticated
  USING (public.is_org_member(id, auth.uid()));

CREATE POLICY "Authenticated users can create organizations"
  ON public.organizations FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Admins can update organizations"
  ON public.organizations FOR UPDATE TO authenticated
  USING (public.has_org_role(id, auth.uid(), 'admin'))
  WITH CHECK (public.has_org_role(id, auth.uid(), 'admin'));

CREATE POLICY "Owner can delete organization"
  ON public.organizations FOR DELETE TO authenticated
  USING (owner_id = auth.uid());

-- organization_members
CREATE POLICY "Members can view co-members"
  ON public.organization_members FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));

CREATE POLICY "Admins can add members"
  ON public.organization_members FOR INSERT TO authenticated
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), 'admin'));

CREATE POLICY "Admins can update members"
  ON public.organization_members FOR UPDATE TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), 'admin'))
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), 'admin'));

CREATE POLICY "Admins can remove members or self leave"
  ON public.organization_members FOR DELETE TO authenticated
  USING (
    public.has_org_role(organization_id, auth.uid(), 'admin')
    OR user_id = auth.uid()
  );

-- organization_invites
CREATE POLICY "Members can view invites"
  ON public.organization_invites FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));

CREATE POLICY "Admins can create invites"
  ON public.organization_invites FOR INSERT TO authenticated
  WITH CHECK (
    public.has_org_role(organization_id, auth.uid(), 'admin')
    AND created_by = auth.uid()
  );

CREATE POLICY "Admins can revoke invites"
  ON public.organization_invites FOR UPDATE TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), 'admin'))
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), 'admin'));

CREATE POLICY "Admins can delete invites"
  ON public.organization_invites FOR DELETE TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), 'admin'));
