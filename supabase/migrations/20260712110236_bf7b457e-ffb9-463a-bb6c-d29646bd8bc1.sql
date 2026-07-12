CREATE INDEX IF NOT EXISTS idx_email_sync_log_created
  ON public.email_sync_log (created_at);