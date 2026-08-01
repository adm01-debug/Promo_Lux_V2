
-- 1) Estender retry_policy_advisories com escopo por organização + trilha de rollback
ALTER TABLE public.retry_policy_advisories
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS previous_policy jsonb,
  ADD COLUMN IF NOT EXISTS rolled_back_at timestamptz,
  ADD COLUMN IF NOT EXISTS rolled_back_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS applied_scope text CHECK (applied_scope IN ('org','global'));

CREATE INDEX IF NOT EXISTS idx_retry_advisories_org
  ON public.retry_policy_advisories(organization_id, created_at DESC);

-- 2) Política ativa por organização
CREATE TABLE IF NOT EXISTS public.org_retry_policies (
  organization_id uuid PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  policy jsonb NOT NULL,
  source_advisory_id uuid REFERENCES public.retry_policy_advisories(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);

GRANT SELECT ON public.org_retry_policies TO authenticated;
GRANT ALL ON public.org_retry_policies TO service_role;

ALTER TABLE public.org_retry_policies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org members view active policy" ON public.org_retry_policies;
CREATE POLICY "Org members view active policy" ON public.org_retry_policies
  FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id));

-- Nenhuma policy de INSERT/UPDATE/DELETE direta: mutações passam pelas funções abaixo.

-- 3) Substituir policies antigas para reconhecer escopo por organização
DROP POLICY IF EXISTS "Admins select advisories" ON public.retry_policy_advisories;
DROP POLICY IF EXISTS "Admins update advisories" ON public.retry_policy_advisories;

CREATE POLICY "Advisories select scoped" ON public.retry_policy_advisories
  FOR SELECT TO authenticated
  USING (
    (organization_id IS NULL AND public.has_role(auth.uid(), 'admin'::app_role))
    OR (organization_id IS NOT NULL AND public.has_org_role(auth.uid(), organization_id, 'admin'))
  );

-- Aprovar/reverter só via funções SECURITY DEFINER; sem UPDATE direto pelos clients.

-- 4) Função de aprovação
CREATE OR REPLACE FUNCTION public.apply_retry_advisory(_advisory_id uuid)
RETURNS public.org_retry_policies
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  adv public.retry_policy_advisories%ROWTYPE;
  prev public.org_retry_policies%ROWTYPE;
  result public.org_retry_policies%ROWTYPE;
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '28000';
  END IF;

  SELECT * INTO adv FROM public.retry_policy_advisories WHERE id = _advisory_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'advisory not found' USING ERRCODE = 'P0002';
  END IF;

  IF adv.applied_at IS NOT NULL THEN
    RAISE EXCEPTION 'advisory already applied' USING ERRCODE = '55000';
  END IF;
  IF adv.dismissed_at IS NOT NULL THEN
    RAISE EXCEPTION 'advisory dismissed' USING ERRCODE = '55000';
  END IF;

  -- Autorização: admin da org (ou admin da plataforma para escopo global)
  IF adv.organization_id IS NULL THEN
    IF NOT public.has_role(uid, 'admin'::app_role) THEN
      RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
    END IF;
    -- Advisories globais não gravam em org_retry_policies; só marcamos como aplicada.
    UPDATE public.retry_policy_advisories
       SET applied_at = now(), applied_by = uid, applied_scope = 'global'
     WHERE id = adv.id;
    RETURN NULL;
  END IF;

  IF NOT public.has_org_role(uid, adv.organization_id, 'admin') THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO prev FROM public.org_retry_policies WHERE organization_id = adv.organization_id;

  -- Grava política anterior no advisory para rollback
  UPDATE public.retry_policy_advisories
     SET applied_at = now(),
         applied_by = uid,
         applied_scope = 'org',
         previous_policy = COALESCE(prev.policy, adv.current_policy)
   WHERE id = adv.id;

  INSERT INTO public.org_retry_policies (organization_id, policy, source_advisory_id, updated_at, updated_by)
  VALUES (adv.organization_id, adv.candidate_policy, adv.id, now(), uid)
  ON CONFLICT (organization_id) DO UPDATE
    SET policy = EXCLUDED.policy,
        source_advisory_id = EXCLUDED.source_advisory_id,
        updated_at = now(),
        updated_by = uid
  RETURNING * INTO result;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_retry_advisory(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apply_retry_advisory(uuid) TO authenticated;

-- 5) Função de rollback
CREATE OR REPLACE FUNCTION public.rollback_retry_advisory(_advisory_id uuid)
RETURNS public.org_retry_policies
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  adv public.retry_policy_advisories%ROWTYPE;
  result public.org_retry_policies%ROWTYPE;
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '28000';
  END IF;

  SELECT * INTO adv FROM public.retry_policy_advisories WHERE id = _advisory_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'advisory not found' USING ERRCODE = 'P0002';
  END IF;
  IF adv.applied_at IS NULL THEN
    RAISE EXCEPTION 'advisory not applied' USING ERRCODE = '55000';
  END IF;
  IF adv.rolled_back_at IS NOT NULL THEN
    RAISE EXCEPTION 'advisory already rolled back' USING ERRCODE = '55000';
  END IF;
  IF adv.applied_scope <> 'org' OR adv.organization_id IS NULL THEN
    RAISE EXCEPTION 'only org-scoped advisories can be rolled back' USING ERRCODE = '55000';
  END IF;
  IF NOT public.has_org_role(uid, adv.organization_id, 'admin') THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF adv.previous_policy IS NULL THEN
    RAISE EXCEPTION 'no previous policy stored' USING ERRCODE = '55000';
  END IF;

  UPDATE public.retry_policy_advisories
     SET rolled_back_at = now(), rolled_back_by = uid
   WHERE id = adv.id;

  INSERT INTO public.org_retry_policies (organization_id, policy, source_advisory_id, updated_at, updated_by)
  VALUES (adv.organization_id, adv.previous_policy, NULL, now(), uid)
  ON CONFLICT (organization_id) DO UPDATE
    SET policy = EXCLUDED.policy,
        source_advisory_id = NULL,
        updated_at = now(),
        updated_by = uid
  RETURNING * INTO result;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.rollback_retry_advisory(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rollback_retry_advisory(uuid) TO authenticated;
