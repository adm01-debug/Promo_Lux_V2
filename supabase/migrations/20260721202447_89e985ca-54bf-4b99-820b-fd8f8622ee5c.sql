
-- Passo 1: retry policy advisories
CREATE TABLE public.retry_policy_advisories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  current_policy JSONB NOT NULL,
  candidate_policy JSONB NOT NULL,
  observed_success_rate NUMERIC(5,4) NOT NULL,
  candidate_success_rate NUMERIC(5,4) NOT NULL,
  candidate_dlq_rate NUMERIC(5,4) NOT NULL,
  improvement_pp NUMERIC(6,4) NOT NULL,
  confidence NUMERIC(5,4) NOT NULL,
  sample_size INTEGER NOT NULL,
  applied_at TIMESTAMPTZ,
  applied_by UUID REFERENCES auth.users(id),
  dismissed_at TIMESTAMPTZ,
  notes TEXT
);
GRANT SELECT, UPDATE ON public.retry_policy_advisories TO authenticated;
GRANT ALL ON public.retry_policy_advisories TO service_role;
ALTER TABLE public.retry_policy_advisories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins select advisories" ON public.retry_policy_advisories FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update advisories" ON public.retry_policy_advisories FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE INDEX idx_retry_policy_advisories_pending ON public.retry_policy_advisories (created_at DESC)
  WHERE applied_at IS NULL AND dismissed_at IS NULL;

-- Passo 2: chaos flag global (organization-scoped já existe em feature_flags; adicionamos DEFAULT off implícito)
-- Passo 3: índices para queries recorrentes
CREATE INDEX IF NOT EXISTS idx_automation_logs_org_created ON public.automation_execution_logs (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_automation_logs_status_created ON public.automation_execution_logs (status, created_at DESC) WHERE status IN ('failed','timeout');
CREATE INDEX IF NOT EXISTS idx_campaign_recipients_campaign_status ON public.campaign_recipients (campaign_id, status);
CREATE INDEX IF NOT EXISTS idx_lusha_contacts_org_status ON public.lusha_contacts (organization_id, enrichment_status) WHERE enrichment_status IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_scrape_queue_org_status ON public.scrape_queue (organization_id, status, next_run_at);
