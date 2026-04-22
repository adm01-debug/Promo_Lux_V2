
-- Recipients por campanha
CREATE TABLE public.campaign_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL DEFAULT public.default_org_for_current_user(),
  user_id UUID NOT NULL DEFAULT auth.uid(),
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  stakeholder_id UUID REFERENCES public.stakeholders(id) ON DELETE SET NULL,
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  email TEXT NOT NULL,
  full_name TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  sent_at TIMESTAMPTZ,
  first_opened_at TIMESTAMPTZ,
  last_opened_at TIMESTAMPTZ,
  open_count INTEGER NOT NULL DEFAULT 0,
  first_clicked_at TIMESTAMPTZ,
  last_clicked_at TIMESTAMPTZ,
  click_count INTEGER NOT NULL DEFAULT 0,
  replied_at TIMESTAMPTZ,
  bounced_at TIMESTAMPTZ,
  unsubscribed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_campaign_recipients_campaign ON public.campaign_recipients(campaign_id);
CREATE INDEX idx_campaign_recipients_org ON public.campaign_recipients(organization_id);
CREATE UNIQUE INDEX idx_campaign_recipients_unique ON public.campaign_recipients(campaign_id, email);

ALTER TABLE public.campaign_recipients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members view recipients" ON public.campaign_recipients
  FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));

CREATE POLICY "SDR+ insert recipients" ON public.campaign_recipients
  FOR INSERT TO authenticated
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), 'sdr'));

CREATE POLICY "SDR+ update recipients" ON public.campaign_recipients
  FOR UPDATE TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), 'sdr'))
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), 'sdr'));

CREATE POLICY "Admin delete recipients" ON public.campaign_recipients
  FOR DELETE TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), 'admin'));

CREATE TRIGGER trg_campaign_recipients_updated
  BEFORE UPDATE ON public.campaign_recipients
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Eventos de tracking
CREATE TABLE public.campaign_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES public.campaign_recipients(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('open','click','bounce','unsubscribe','reply','sent')),
  url TEXT,
  ip_address TEXT,
  user_agent TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_campaign_events_campaign ON public.campaign_events(campaign_id);
CREATE INDEX idx_campaign_events_recipient ON public.campaign_events(recipient_id);
CREATE INDEX idx_campaign_events_type_time ON public.campaign_events(event_type, occurred_at DESC);

ALTER TABLE public.campaign_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members view events" ON public.campaign_events
  FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));

-- Inserts são feitos pela edge function via service role (bypass RLS); sem policy de insert pública.

-- Função para registrar evento e atualizar agregados no recipient
CREATE OR REPLACE FUNCTION public.record_campaign_event(
  _recipient_id UUID,
  _event_type TEXT,
  _url TEXT,
  _ip TEXT,
  _ua TEXT
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_recipient public.campaign_recipients;
  v_event_id UUID;
BEGIN
  SELECT * INTO v_recipient FROM public.campaign_recipients WHERE id = _recipient_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Recipient not found';
  END IF;

  INSERT INTO public.campaign_events (organization_id, campaign_id, recipient_id, event_type, url, ip_address, user_agent)
  VALUES (v_recipient.organization_id, v_recipient.campaign_id, _recipient_id, _event_type, _url, _ip, _ua)
  RETURNING id INTO v_event_id;

  IF _event_type = 'open' THEN
    UPDATE public.campaign_recipients
    SET open_count = open_count + 1,
        first_opened_at = COALESCE(first_opened_at, now()),
        last_opened_at = now()
    WHERE id = _recipient_id;

    UPDATE public.campaigns SET opened = opened + 1 WHERE id = v_recipient.campaign_id;
  ELSIF _event_type = 'click' THEN
    UPDATE public.campaign_recipients
    SET click_count = click_count + 1,
        first_clicked_at = COALESCE(first_clicked_at, now()),
        last_clicked_at = now(),
        first_opened_at = COALESCE(first_opened_at, now()),
        last_opened_at = COALESCE(last_opened_at, now())
    WHERE id = _recipient_id;
  ELSIF _event_type = 'bounce' THEN
    UPDATE public.campaign_recipients SET bounced_at = now(), status = 'bounced' WHERE id = _recipient_id;
  ELSIF _event_type = 'unsubscribe' THEN
    UPDATE public.campaign_recipients SET unsubscribed_at = now(), status = 'unsubscribed' WHERE id = _recipient_id;
  ELSIF _event_type = 'reply' THEN
    UPDATE public.campaign_recipients SET replied_at = now(), status = 'replied' WHERE id = _recipient_id;
    UPDATE public.campaigns SET replied = replied + 1 WHERE id = v_recipient.campaign_id;
  END IF;

  RETURN v_event_id;
END;
$$;
