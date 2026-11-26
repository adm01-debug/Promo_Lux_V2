-- =============================================================================
-- lusha_contacts.lc_insert: definicao deterministica (achado G14-3, etapa 025)
-- =============================================================================
-- A policy nasceu em 20260715135053 dentro de
--   IF NOT EXISTS (SELECT 1 FROM pg_policies ... policyname='lc_insert')
-- Guarda por NOME. O banco de producao ja tinha uma policy homonima com regra
-- diferente (TO authenticated + has_org_role(...,'viewer')), entao o CREATE foi
-- pulado em silencio: o arquivo do repositorio e o banco real descreviam estados
-- diferentes e nada acusava.
--
-- Medicao (pg_policies apos o replay completo das migrations):
--   arquivo 20260715135053 -> TO public, WITH CHECK (user_id = auth.uid()
--                                                   AND organization_id = default_org_for_current_user())
--   banco real             -> TO authenticated, WITH CHECK (user_id = auth.uid()
--                                                   AND has_org_role(organization_id, auth.uid(), 'viewer'))
--
-- A definicao do banco e a fonte da verdade: e mais restritiva (nao alcanca anon
-- e exige papel >= viewer na organizacao). DROP + CREATE porque e idempotente e
-- garante a definicao, ao contrario da guarda por nome.
-- =============================================================================

DROP POLICY IF EXISTS lc_insert ON public.lusha_contacts;

CREATE POLICY lc_insert ON public.lusha_contacts
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND public.has_org_role(organization_id, auth.uid(), 'viewer'::public.app_role)
  );