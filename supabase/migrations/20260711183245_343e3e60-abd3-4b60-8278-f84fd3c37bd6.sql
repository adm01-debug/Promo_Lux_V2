
CREATE INDEX IF NOT EXISTS idx_campaign_messages_email_account ON public.campaign_messages (email_account_id);
CREATE INDEX IF NOT EXISTS idx_campaign_recipients_company ON public.campaign_recipients (company_id);
CREATE INDEX IF NOT EXISTS idx_campaign_recipients_stakeholder ON public.campaign_recipients (stakeholder_id);
CREATE INDEX IF NOT EXISTS idx_campaign_replies_email_account ON public.campaign_replies (email_account_id);
CREATE INDEX IF NOT EXISTS idx_campaign_replies_message ON public.campaign_replies (message_id);
CREATE INDEX IF NOT EXISTS idx_deals_stage ON public.deals (stage_id);
CREATE INDEX IF NOT EXISTS idx_deals_stakeholder ON public.deals (stakeholder_id);
CREATE INDEX IF NOT EXISTS idx_automation_alerts_org ON public.automation_alerts (organization_id);
CREATE INDEX IF NOT EXISTS idx_automation_alerts_user ON public.automation_alerts (user_id);
CREATE INDEX IF NOT EXISTS idx_job_exports_job ON public.job_exports (job_id);
CREATE INDEX IF NOT EXISTS idx_job_exports_org ON public.job_exports (organization_id);
CREATE INDEX IF NOT EXISTS idx_job_exports_user ON public.job_exports (user_id);
CREATE INDEX IF NOT EXISTS idx_email_suppressions_source_campaign ON public.email_suppressions (source_campaign_id);
