-- ---------------------------------------------------------------------------
-- Etapa 020: corrige a ordem dos argumentos de has_org_role / is_org_member.
--
-- Assinaturas reais (20260422201601:46 e :67):
--   public.has_org_role(_org_id uuid, _user_id uuid, _min_role app_role)
--   public.is_org_member(_org_id uuid, _user_id uuid)
--
-- Tres policies passaram `auth.uid()` como primeiro argumento, que e o
-- `_org_id`. Como os dois parametros sao uuid, o Postgres aceita a chamada e
-- compara organizacao com id de usuario: o resultado e sempre falso, a policy
-- nao libera nada e a funcionalidade fica morta em silencio.
--
--   20260721160317:18-19  "Org admins manage rate limits" (FOR ALL)
--       -> useOrgRateLimit.ts:25,50 le a tabela; gravar rate limit da propria
--          organizacao e negado para todo mundo, inclusive o admin.
--   20260721204338:30     "Org members view active policy" (org_retry_policies)
--   20260721204338:38-43  "Advisories select scoped" (retry_policy_advisories)
--       -> RetryPolicyAdvisoriesPanel.tsx:62,90 lista sempre vazio para quem
--          nao e admin global; MultiQueueResilienceCard.tsx:44 idem.
--
-- A correcao apenas restaura a intencao ja documentada nas proprias policies,
-- no mesmo formato que email_accounts usa corretamente (20260423122818:32).
-- ---------------------------------------------------------------------------

-- org_scrape_rate_limits: admin da organizacao gerencia o rate limit dela
DROP POLICY IF EXISTS "Org admins manage rate limits" ON public.org_scrape_rate_limits;
CREATE POLICY "Org admins manage rate limits"
  ON public.org_scrape_rate_limits
  FOR ALL
  TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), 'admin'::public.app_role));

-- org_retry_policies: membro da organizacao ve a politica ativa dela
DROP POLICY IF EXISTS "Org members view active policy" ON public.org_retry_policies;
CREATE POLICY "Org members view active policy"
  ON public.org_retry_policies
  FOR SELECT
  TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));

-- retry_policy_advisories: admin global ve avisos globais,
-- admin da organizacao ve os avisos da organizacao dele
DROP POLICY IF EXISTS "Advisories select scoped" ON public.retry_policy_advisories;
CREATE POLICY "Advisories select scoped"
  ON public.retry_policy_advisories
  FOR SELECT
  TO authenticated
  USING (
    (organization_id IS NULL AND public.has_role(auth.uid(), 'admin'::public.app_role))
    OR (
      organization_id IS NOT NULL
      AND public.has_org_role(organization_id, auth.uid(), 'admin'::public.app_role)
    )
  );