-- SCIM 2.0 provisioning support
-- Adds scim_external_id + scim_active to organization_members,
-- and scim_bearer_token (hashed) to organizations.

-- Rastreia o ID externo do IdP (Okta, Azure AD, etc.) por membro
ALTER TABLE public.organization_members
  ADD COLUMN IF NOT EXISTS scim_external_id text,
  ADD COLUMN IF NOT EXISTS scim_active boolean NOT NULL DEFAULT true;

CREATE UNIQUE INDEX IF NOT EXISTS idx_org_members_scim_id
  ON public.organization_members(organization_id, scim_external_id)
  WHERE scim_external_id IS NOT NULL;

-- Token SCIM por org (SHA-256 hex; comparado pelo edge function)
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS scim_token_hash text;

-- RPC: gera e armazena token SCIM para a org do caller (apenas admin)
CREATE OR REPLACE FUNCTION public.generate_scim_token(p_org_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token text;
  v_hash  text;
BEGIN
  -- Somente admin pode gerar token SCIM
  IF NOT has_org_role(p_org_id, auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'permission_denied';
  END IF;

  -- Token aleatorio de 32 bytes em hex
  v_token := encode(gen_random_bytes(32), 'hex');
  v_hash  := encode(sha256(v_token::bytea), 'hex');

  UPDATE public.organizations
     SET scim_token_hash = v_hash
   WHERE id = p_org_id;

  -- Retorna o token em texto-plano UMA vez; o hash fica no banco
  RETURN v_token;
END;
$$;

-- RPC: verifica se um token SCIM pertence a org (usado pelo edge function)
CREATE OR REPLACE FUNCTION public.verify_scim_token(p_org_id uuid, p_token text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hash text;
BEGIN
  SELECT scim_token_hash INTO v_hash
    FROM public.organizations
   WHERE id = p_org_id;

  RETURN v_hash IS NOT NULL
    AND v_hash = encode(sha256(p_token::bytea), 'hex');
END;
$$;

GRANT EXECUTE ON FUNCTION public.generate_scim_token(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.verify_scim_token(uuid, text) TO service_role;

COMMENT ON COLUMN public.organization_members.scim_external_id IS 'ID externo do usuario no IdP (Okta, Azure AD, etc.) — preenchido pelo SCIM endpoint';
COMMENT ON COLUMN public.organization_members.scim_active IS 'Status de provisionamento SCIM; false = usuario desprovisionado pelo IdP';
COMMENT ON COLUMN public.organizations.scim_token_hash IS 'SHA-256 do bearer token SCIM da org; comparado pelo edge function scim';


-- Tabela de integracoes externas por org (HubSpot, Salesforce, etc.)
CREATE TABLE IF NOT EXISTS public.org_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  provider text NOT NULL,            -- 'hubspot', 'salesforce', 'slack', etc.
  config jsonb NOT NULL DEFAULT '{}', -- { api_key, portal_id, ... } — criptografar no app
  enabled boolean NOT NULL DEFAULT true,
  last_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, provider)
);

ALTER TABLE public.org_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins can manage integrations"
  ON public.org_integrations FOR ALL TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), 'admin'))
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), 'admin'));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_integrations TO authenticated;
GRANT ALL ON public.org_integrations TO service_role;

-- View helper: retorna api_key de hubspot da org sem expor outros campos
CREATE OR REPLACE FUNCTION public.get_hubspot_api_key(p_org_id uuid)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT config->>'api_key'
    FROM public.org_integrations
   WHERE organization_id = p_org_id
     AND provider = 'hubspot'
     AND enabled = true;
$$;

GRANT EXECUTE ON FUNCTION public.get_hubspot_api_key(uuid) TO service_role;

COMMENT ON TABLE public.org_integrations IS 'Integracoes externas por org (HubSpot, Salesforce, Slack, etc.)';
