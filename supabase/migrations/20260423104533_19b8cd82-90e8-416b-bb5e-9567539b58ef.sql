
-- Contas de email conectadas (OAuth por usuário)
CREATE TABLE public.email_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL DEFAULT public.default_org_for_current_user(),
  user_id UUID NOT NULL DEFAULT auth.uid(),
  provider TEXT NOT NULL CHECK (provider IN ('gmail','outlook')),
  email TEXT NOT NULL,
  display_name TEXT,
  access_token TEXT,
  refresh_token TEXT,
  expires_at TIMESTAMPTZ,
  scope TEXT,
  history_id TEXT,             -- Gmail historyId
  delta_link TEXT,             -- Outlook delta token
  last_polled_at TIMESTAMPTZ,
  last_error TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_email_accounts_unique ON public.email_accounts(user_id, provider, email);
CREATE INDEX idx_email_accounts_org ON public.email_accounts(organization_id);
CREATE INDEX idx_email_accounts_active ON public.email_accounts(active) WHERE active = true;

ALTER TABLE public.email_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner views own accounts" ON public.email_accounts
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Owner inserts own accounts" ON public.email_accounts
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Owner updates own accounts" ON public.email_accounts
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Owner deletes own accounts" ON public.email_accounts
  FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE TRIGGER trg_email_accounts_updated
  BEFORE UPDATE ON public.email_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Mensagens enviadas pela campanha (necessário para casar replies)
CREATE TABLE public.campaign_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL DEFAULT public.default_org_for_current_user(),
  user_id UUID NOT NULL DEFAULT auth.uid(),
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES public.campaign_recipients(id) ON DELETE CASCADE,
  email_account_id UUID REFERENCES public.email_accounts(id) ON DELETE SET NULL,
  step_index INTEGER NOT NULL DEFAULT 0,
  provider TEXT,                -- gmail | outlook
  provider_message_id TEXT,     -- Gmail/Outlook ID interno
  rfc822_message_id TEXT,       -- Message-ID header (RFC 5322) — chave de threading
  thread_id TEXT,               -- Gmail threadId / Outlook conversationId
  subject TEXT,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_campaign_messages_recipient ON public.campaign_messages(recipient_id);
CREATE INDEX idx_campaign_messages_thread ON public.campaign_messages(thread_id);
CREATE INDEX idx_campaign_messages_rfc ON public.campaign_messages(rfc822_message_id);
CREATE INDEX idx_campaign_messages_campaign ON public.campaign_messages(campaign_id);

ALTER TABLE public.campaign_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members view messages" ON public.campaign_messages
  FOR SELECT TO authenticated USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "SDR+ insert messages" ON public.campaign_messages
  FOR INSERT TO authenticated WITH CHECK (public.has_org_role(organization_id, auth.uid(), 'sdr'));
CREATE POLICY "Admin delete messages" ON public.campaign_messages
  FOR DELETE TO authenticated USING (public.has_org_role(organization_id, auth.uid(), 'admin'));

-- Replies detectadas
CREATE TABLE public.campaign_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES public.campaign_recipients(id) ON DELETE CASCADE,
  message_id UUID REFERENCES public.campaign_messages(id) ON DELETE SET NULL,
  email_account_id UUID REFERENCES public.email_accounts(id) ON DELETE SET NULL,
  provider TEXT NOT NULL,
  provider_message_id TEXT NOT NULL,
  thread_id TEXT,
  in_reply_to TEXT,
  from_email TEXT,
  from_name TEXT,
  subject TEXT,
  snippet TEXT,
  body_text TEXT,
  received_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_campaign_replies_provider_msg ON public.campaign_replies(provider, provider_message_id);
CREATE INDEX idx_campaign_replies_recipient ON public.campaign_replies(recipient_id);
CREATE INDEX idx_campaign_replies_campaign ON public.campaign_replies(campaign_id);

ALTER TABLE public.campaign_replies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members view replies" ON public.campaign_replies
  FOR SELECT TO authenticated USING (public.is_org_member(organization_id, auth.uid()));

-- Função idempotente: registra reply, vincula à mensagem original e dispara evento
CREATE OR REPLACE FUNCTION public.record_campaign_reply(
  _provider TEXT,
  _provider_message_id TEXT,
  _thread_id TEXT,
  _in_reply_to TEXT,
  _from_email TEXT,
  _from_name TEXT,
  _subject TEXT,
  _snippet TEXT,
  _body TEXT,
  _received_at TIMESTAMPTZ,
  _email_account_id UUID
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_msg public.campaign_messages;
  v_reply_id UUID;
BEGIN
  -- Idempotência
  SELECT id INTO v_reply_id FROM public.campaign_replies
   WHERE provider = _provider AND provider_message_id = _provider_message_id;
  IF FOUND THEN RETURN v_reply_id; END IF;

  -- Casa por In-Reply-To (RFC) primeiro, depois por thread_id
  IF _in_reply_to IS NOT NULL THEN
    SELECT * INTO v_msg FROM public.campaign_messages
     WHERE rfc822_message_id = _in_reply_to LIMIT 1;
  END IF;

  IF NOT FOUND AND _thread_id IS NOT NULL THEN
    SELECT * INTO v_msg FROM public.campaign_messages
     WHERE thread_id = _thread_id ORDER BY sent_at DESC LIMIT 1;
  END IF;

  IF NOT FOUND THEN
    -- Não pertence a nenhuma campanha conhecida; ignora
    RETURN NULL;
  END IF;

  INSERT INTO public.campaign_replies (
    organization_id, campaign_id, recipient_id, message_id, email_account_id,
    provider, provider_message_id, thread_id, in_reply_to,
    from_email, from_name, subject, snippet, body_text, received_at
  ) VALUES (
    v_msg.organization_id, v_msg.campaign_id, v_msg.recipient_id, v_msg.id, _email_account_id,
    _provider, _provider_message_id, _thread_id, _in_reply_to,
    _from_email, _from_name, _subject, _snippet, _body, _received_at
  ) RETURNING id INTO v_reply_id;

  -- Dispara evento de reply nos agregados existentes
  PERFORM public.record_campaign_event(v_msg.recipient_id, 'reply', NULL, NULL, NULL);

  RETURN v_reply_id;
END;
$$;
