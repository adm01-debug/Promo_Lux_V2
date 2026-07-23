
CREATE TABLE public.sla_alert_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enabled BOOLEAN NOT NULL DEFAULT true,
  window_hours INT NOT NULL DEFAULT 24 CHECK (window_hours BETWEEN 1 AND 168),
  breach_pct NUMERIC NOT NULL DEFAULT 20 CHECK (breach_pct BETWEEN 1 AND 100),
  min_sample INT NOT NULL DEFAULT 20 CHECK (min_sample BETWEEN 1 AND 10000),
  cooldown_hours INT NOT NULL DEFAULT 6 CHECK (cooldown_hours BETWEEN 1 AND 168),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sla_alert_settings TO authenticated;
GRANT ALL ON public.sla_alert_settings TO service_role;
ALTER TABLE public.sla_alert_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sla_alert_settings_admin_select" ON public.sla_alert_settings
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "sla_alert_settings_admin_insert" ON public.sla_alert_settings
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "sla_alert_settings_admin_update" ON public.sla_alert_settings
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

INSERT INTO public.sla_alert_settings (enabled) VALUES (true);

CREATE TABLE public.sla_alert_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  queue_kind TEXT NOT NULL CHECK (queue_kind IN ('scrape','web','instagram')),
  breach_rate NUMERIC NOT NULL,
  sample_size INT NOT NULL,
  window_hours INT NOT NULL,
  p95_seconds NUMERIC,
  sla_p95 NUMERIC,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  triggered_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_sla_alert_history_kind_time ON public.sla_alert_history (queue_kind, triggered_at DESC);
GRANT SELECT ON public.sla_alert_history TO authenticated;
GRANT ALL ON public.sla_alert_history TO service_role;
ALTER TABLE public.sla_alert_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sla_alert_history_admin_select" ON public.sla_alert_history
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_sla_alert_settings_updated_at BEFORE UPDATE ON public.sla_alert_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
