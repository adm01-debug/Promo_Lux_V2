
CREATE TABLE public.reaper_alert_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  singleton BOOLEAN NOT NULL DEFAULT TRUE UNIQUE,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  consecutive INTEGER NOT NULL DEFAULT 1 CHECK (consecutive BETWEEN 1 AND 20),
  min_dead_per_run INTEGER NOT NULL DEFAULT 1 CHECK (min_dead_per_run >= 0),
  no_run_hours INTEGER NOT NULL DEFAULT 2 CHECK (no_run_hours BETWEEN 1 AND 168),
  cooldown_hours INTEGER NOT NULL DEFAULT 6 CHECK (cooldown_hours BETWEEN 1 AND 168),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (singleton = TRUE)
);
GRANT SELECT, UPDATE ON public.reaper_alert_settings TO authenticated;
GRANT ALL ON public.reaper_alert_settings TO service_role;
ALTER TABLE public.reaper_alert_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins read reaper settings" ON public.reaper_alert_settings
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins update reaper settings" ON public.reaper_alert_settings
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "service_role manages reaper settings" ON public.reaper_alert_settings
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TABLE public.reaper_alert_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  triggered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reason TEXT NOT NULL CHECK (reason IN ('dead_detected','no_recent_run')),
  instagram_dead INTEGER NOT NULL DEFAULT 0,
  scrape_dead INTEGER NOT NULL DEFAULT 0,
  web_dead INTEGER NOT NULL DEFAULT 0,
  consecutive INTEGER NOT NULL DEFAULT 1,
  last_run_at TIMESTAMPTZ,
  details JSONB NOT NULL DEFAULT '{}'::jsonb
);
GRANT SELECT ON public.reaper_alert_history TO authenticated;
GRANT ALL ON public.reaper_alert_history TO service_role;
CREATE INDEX idx_reaper_alert_history_triggered_at
  ON public.reaper_alert_history (triggered_at DESC);
ALTER TABLE public.reaper_alert_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated read reaper history" ON public.reaper_alert_history
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "service_role manages reaper history" ON public.reaper_alert_history
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TRIGGER trg_reaper_alert_settings_updated_at
  BEFORE UPDATE ON public.reaper_alert_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.reaper_alert_settings (singleton) VALUES (TRUE)
  ON CONFLICT (singleton) DO NOTHING;
