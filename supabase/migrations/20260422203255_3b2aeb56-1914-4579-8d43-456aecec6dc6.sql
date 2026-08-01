
-- API Keys
CREATE TABLE public.api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  name text NOT NULL,
  prefix text NOT NULL,
  key_hash text NOT NULL UNIQUE,
  scopes text[] NOT NULL DEFAULT ARRAY['read'],
  last_used_at timestamptz,
  expires_at timestamptz,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_api_keys_user ON public.api_keys(user_id);
CREATE INDEX idx_api_keys_hash ON public.api_keys(key_hash);
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own api_keys" ON public.api_keys FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users insert own api_keys" ON public.api_keys FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users update own api_keys" ON public.api_keys FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users delete own api_keys" ON public.api_keys FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Service manage api_keys" ON public.api_keys FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Webhooks
CREATE TABLE public.webhooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  name text NOT NULL,
  url text NOT NULL,
  secret text NOT NULL DEFAULT encode(gen_random_bytes(24), 'hex'),
  events text[] NOT NULL DEFAULT '{}',
  active boolean NOT NULL DEFAULT true,
  total_sent integer NOT NULL DEFAULT 0,
  total_failed integer NOT NULL DEFAULT 0,
  last_triggered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_webhooks_user ON public.webhooks(user_id);
ALTER TABLE public.webhooks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own webhooks" ON public.webhooks FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users insert own webhooks" ON public.webhooks FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users update own webhooks" ON public.webhooks FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users delete own webhooks" ON public.webhooks FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Service manage webhooks" ON public.webhooks FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TRIGGER trg_webhooks_updated BEFORE UPDATE ON public.webhooks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Webhook deliveries
CREATE TABLE public.webhook_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  webhook_id uuid NOT NULL REFERENCES public.webhooks(id) ON DELETE CASCADE,
  event text NOT NULL,
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','success','failed','retrying')),
  status_code integer,
  response_body text,
  error_message text,
  attempts integer NOT NULL DEFAULT 0,
  next_retry_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_wh_deliv_webhook ON public.webhook_deliveries(webhook_id, created_at DESC);
CREATE INDEX idx_wh_deliv_user ON public.webhook_deliveries(user_id, created_at DESC);
CREATE INDEX idx_wh_deliv_retry ON public.webhook_deliveries(next_retry_at) WHERE status = 'retrying';
ALTER TABLE public.webhook_deliveries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own deliveries" ON public.webhook_deliveries FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Service manage deliveries" ON public.webhook_deliveries FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Função para validar API key (usada pela edge function)
CREATE OR REPLACE FUNCTION public.verify_api_key(_key_hash text)
RETURNS TABLE(user_id uuid, scopes text[], key_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT user_id, scopes, id FROM public.api_keys
  WHERE key_hash = _key_hash
    AND active = true
    AND (expires_at IS NULL OR expires_at > now())
  LIMIT 1;
$$;

-- Função para registrar último uso da API key
CREATE OR REPLACE FUNCTION public.touch_api_key(_key_id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.api_keys SET last_used_at = now() WHERE id = _key_id;
$$;

-- Trigger: emite eventos de webhook ao criar/atualizar deals/companies
-- (apenas insere em webhook_deliveries; entrega real é feita pela edge function)
CREATE OR REPLACE FUNCTION public.enqueue_webhook_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_event text;
  v_payload jsonb;
  v_user_id uuid;
  wh record;
BEGIN
  v_event := TG_TABLE_NAME || '.' || lower(TG_OP);
  IF TG_OP = 'DELETE' THEN
    v_user_id := OLD.user_id;
    v_payload := jsonb_build_object('event', v_event, 'data', to_jsonb(OLD), 'timestamp', now());
  ELSE
    v_user_id := NEW.user_id;
    v_payload := jsonb_build_object('event', v_event, 'data', to_jsonb(NEW), 'timestamp', now());
  END IF;

  FOR wh IN
    SELECT id FROM public.webhooks
    WHERE user_id = v_user_id AND active = true AND v_event = ANY(events)
  LOOP
    INSERT INTO public.webhook_deliveries (user_id, webhook_id, event, payload, status, next_retry_at)
    VALUES (v_user_id, wh.id, v_event, v_payload, 'pending', now());
  END LOOP;

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END $$;

CREATE TRIGGER trg_wh_companies AFTER INSERT OR UPDATE OR DELETE ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_webhook_event();
CREATE TRIGGER trg_wh_deals AFTER INSERT OR UPDATE OR DELETE ON public.deals
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_webhook_event();
CREATE TRIGGER trg_wh_stakeholders AFTER INSERT OR UPDATE OR DELETE ON public.stakeholders
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_webhook_event();
