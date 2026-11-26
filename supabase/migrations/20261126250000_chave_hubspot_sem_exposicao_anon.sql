-- Chave da API do HubSpot deixa de ser legivel sem login.
--
-- Causa: `get_hubspot_api_key(uuid)` nasceu em 20261124040000_scim_provisioning.sql
-- como SECURITY DEFINER sem revogar o EXECUTE que o PostgreSQL concede a PUBLIC em
-- toda funcao nova -- e `anon` herda PUBLIC. Com a anon key (que vai no bundle do
-- frontend) qualquer portador chamava POST /rest/v1/rpc/get_hubspot_api_key passando
-- o uuid de uma organizacao e recebia `org_integrations.config->>'api_key'`, ou seja
-- a Private App do HubSpot daquela organizacao. A RLS de `org_integrations` (policy
-- "admins can manage integrations", so para `authenticated`) nao barra SECURITY
-- DEFINER. A migration 20260721153915 revogou anon de todas as SECURITY DEFINER que
-- existiam naquele dia, mas e um retrato do momento, nao um default: funcao criada
-- depois nasce exposta de novo -- esta e uma delas.
--
-- Agora: a leitura exige `service_role` OU admin da propria organizacao, e
-- `anon`/`PUBLIC` perdem o EXECUTE. Assinatura e retorno inalterados
-- (CREATE OR REPLACE); nenhum chamador no repositorio usa a funcao hoje.

CREATE OR REPLACE FUNCTION public.get_hubspot_api_key(p_org_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _key text;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    IF _uid IS NULL THEN
      RAISE EXCEPTION 'Nao autenticado' USING ERRCODE = '28000';
    END IF;
    IF NOT public.has_org_role(p_org_id, _uid, 'admin') THEN
      RAISE EXCEPTION 'Somente administradores da organizacao leem a chave do HubSpot'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  SELECT i.config ->> 'api_key' INTO _key
  FROM public.org_integrations i
  WHERE i.organization_id = p_org_id
    AND i.provider = 'hubspot'
    AND i.enabled = true;

  RETURN _key;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_hubspot_api_key(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_hubspot_api_key(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_hubspot_api_key(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_hubspot_api_key(uuid) TO service_role;