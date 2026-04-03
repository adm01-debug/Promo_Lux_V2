
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS notification_prefs jsonb NOT NULL DEFAULT '{"email_notifs": true, "signal_notifs": true, "scrape_notifs": true, "weekly_report": false}'::jsonb;
