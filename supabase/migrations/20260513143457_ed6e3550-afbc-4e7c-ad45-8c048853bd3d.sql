-- Índices compostos para tabelas de alto volume (Performance)
CREATE INDEX IF NOT EXISTS idx_audit_logs_org_created ON public.audit_logs (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scrape_results_org_created ON public.scrape_results (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_campaign_events_org_occurred ON public.campaign_events (organization_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_request_logs_created ON public.api_request_logs (created_at DESC);

-- Índice para busca de empresas por IPC score e setor
CREATE INDEX IF NOT EXISTS idx_companies_ipc_sector ON public.companies (ipc_score DESC, sector);
