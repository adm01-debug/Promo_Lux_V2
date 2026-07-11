-- =====================================================================
-- Lista de supressão de e-mail (suppression list) por organização.
-- Gap de deliverability: um contato que descadastrou (unsubscribe) ou sofreu
-- hard bounce em UMA campanha jamais deve ser contatado novamente em QUALQUER
-- outra campanha da mesma organização. Compliance (LGPD/CAN-SPAM) + reputação.
-- =====================================================================

-- 1. Tabela
CREATE TABLE public.email_suppressions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  reason TEXT NOT NULL CHECK (reason IN ('unsubscribe', 'bounce', 'complaint', 'manual')),
  source_campaign_id UUID REFERENCES public.campaigns(id) ON DELETE SET NULL,
  source_recipient_id UUID,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Endereço suprimido é único por organização (normalizado em lowercase).
  UNIQUE (organization_id, email)
);

CREATE INDEX idx_email_suppressions_org_email
  ON public.email_suppressions (organization_id, email);

-- 2. GRANTs (necessário no schema public para a Data API)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_suppressions TO authenticated;
GRANT ALL ON public.email_suppressions TO service_role;

-- 3. RLS
ALTER TABLE public.email_suppressions ENABLE ROW LEVEL SECURITY;

-- 4. Policies — isolamento multi-tenant por membership da organização.
CREATE POLICY "Membros veem supressões da sua organização"
  ON public.email_suppressions FOR SELECT
  TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));

CREATE POLICY "Membros podem adicionar supressões manualmente"
  ON public.email_suppressions FOR INSERT
  TO authenticated
  WITH CHECK (public.is_org_member(organization_id, auth.uid()));

CREATE POLICY "Membros podem atualizar supressões da sua organização"
  ON public.email_suppressions FOR UPDATE
  TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()))
  WITH CHECK (public.is_org_member(organization_id, auth.uid()));

CREATE POLICY "Membros podem remover supressões da sua organização"
  ON public.email_suppressions FOR DELETE
  TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));

-- 5. Trigger updated_at
CREATE TRIGGER update_email_suppressions_updated_at
  BEFORE UPDATE ON public.email_suppressions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6. Normalização de e-mail (lowercase + trim) na escrita.
CREATE OR REPLACE FUNCTION public.normalize_suppression_email()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.email := lower(trim(NEW.email));
  RETURN NEW;
END;
$$;

CREATE TRIGGER normalize_email_suppressions
  BEFORE INSERT OR UPDATE ON public.email_suppressions
  FOR EACH ROW EXECUTE FUNCTION public.normalize_suppression_email();

-- 7. Preenchimento automático: quando um destinatário passa a
-- 'unsubscribed' ou 'bounced', registra o e-mail na suppression list da org.
CREATE OR REPLACE FUNCTION public.sync_suppression_from_recipient()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reason TEXT;
BEGIN
  IF NEW.status = 'unsubscribed' AND NEW.status IS DISTINCT FROM OLD.status THEN
    v_reason := 'unsubscribe';
  ELSIF NEW.status = 'bounced' AND NEW.status IS DISTINCT FROM OLD.status THEN
    v_reason := 'bounce';
  ELSE
    RETURN NEW;
  END IF;

  IF NEW.email IS NULL OR NEW.organization_id IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.email_suppressions (
    organization_id, email, reason, source_campaign_id, source_recipient_id
  ) VALUES (
    NEW.organization_id, lower(trim(NEW.email)), v_reason, NEW.campaign_id, NEW.id
  )
  ON CONFLICT (organization_id, email) DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE TRIGGER sync_suppression_on_recipient_status
  AFTER UPDATE OF status ON public.campaign_recipients
  FOR EACH ROW EXECUTE FUNCTION public.sync_suppression_from_recipient();

-- 8. Backfill: popula supressões a partir de destinatários já finalizados.
INSERT INTO public.email_suppressions (organization_id, email, reason, source_campaign_id, source_recipient_id)
SELECT DISTINCT ON (r.organization_id, lower(trim(r.email)))
  r.organization_id,
  lower(trim(r.email)),
  CASE WHEN r.status = 'unsubscribed' THEN 'unsubscribe' ELSE 'bounce' END,
  r.campaign_id,
  r.id
FROM public.campaign_recipients r
WHERE r.status IN ('unsubscribed', 'bounced')
  AND r.email IS NOT NULL
  AND r.organization_id IS NOT NULL
ORDER BY r.organization_id, lower(trim(r.email)), r.updated_at DESC
ON CONFLICT (organization_id, email) DO NOTHING;