-- 1) Constraint de status de recipients incluindo queued/failed
ALTER TABLE public.campaign_recipients
  DROP CONSTRAINT IF EXISTS campaign_recipients_status_check;

ALTER TABLE public.campaign_recipients
  ADD CONSTRAINT campaign_recipients_status_check
  CHECK (status IN ('pending','queued','sent','failed','bounced','unsubscribed','replied'));

-- 2) Contadores adicionais na campanha
ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS failed integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bounced integer NOT NULL DEFAULT 0;

-- 3) Atualiza record_campaign_event para mexer nos novos contadores
CREATE OR REPLACE FUNCTION public.record_campaign_event(
  _recipient_id uuid,
  _event_type text,
  _url text,
  _ip text,
  _ua text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
    UPDATE public.campaigns SET bounced = bounced + 1 WHERE id = v_recipient.campaign_id;

  ELSIF _event_type = 'failed' THEN
    UPDATE public.campaign_recipients SET status = 'failed' WHERE id = _recipient_id;
    UPDATE public.campaigns SET failed = failed + 1 WHERE id = v_recipient.campaign_id;

  ELSIF _event_type = 'queued' THEN
    UPDATE public.campaign_recipients SET status = 'queued' WHERE id = _recipient_id;

  ELSIF _event_type = 'sent' THEN
    UPDATE public.campaign_recipients
      SET status = 'sent', sent_at = COALESCE(sent_at, now())
      WHERE id = _recipient_id;
    UPDATE public.campaigns SET sent = sent + 1 WHERE id = v_recipient.campaign_id;

  ELSIF _event_type = 'unsubscribe' THEN
    UPDATE public.campaign_recipients SET unsubscribed_at = now(), status = 'unsubscribed' WHERE id = _recipient_id;

  ELSIF _event_type = 'reply' THEN
    UPDATE public.campaign_recipients SET replied_at = now(), status = 'replied' WHERE id = _recipient_id;
    UPDATE public.campaigns SET replied = replied + 1 WHERE id = v_recipient.campaign_id;
  END IF;

  RETURN v_event_id;
END;
$function$;

-- 4) Índices para acelerar tracking drawer e dashboards
CREATE INDEX IF NOT EXISTS idx_campaign_events_campaign_occurred
  ON public.campaign_events (campaign_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_campaign_events_recipient
  ON public.campaign_events (recipient_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_campaign_recipients_campaign_status
  ON public.campaign_recipients (campaign_id, status);

CREATE INDEX IF NOT EXISTS idx_campaign_replies_campaign_received
  ON public.campaign_replies (campaign_id, received_at DESC);

CREATE INDEX IF NOT EXISTS idx_campaign_messages_recipient_step
  ON public.campaign_messages (recipient_id, step_index);