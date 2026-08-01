-- Índices para queries frequentes por user_id + created_at
CREATE INDEX IF NOT EXISTS idx_companies_user_created ON public.companies (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_workflows_user_created ON public.workflows (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scrape_jobs_user_created ON public.scrape_jobs (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_intent_signals_user_created ON public.intent_signals (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_campaigns_user_created ON public.campaigns (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON public.notifications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stakeholders_user_created ON public.stakeholders (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scrape_results_job ON public.scrape_results (job_id);
CREATE INDEX IF NOT EXISTS idx_companies_user_source ON public.companies (user_id, source);
CREATE INDEX IF NOT EXISTS idx_companies_user_score ON public.companies (user_id, ipc_score DESC);