-- Add missing columns to companies
ALTER TABLE public.companies 
ADD COLUMN cnpj TEXT,
ADD COLUMN linkedin_url TEXT,
ADD COLUMN instagram_url TEXT,
ADD COLUMN description TEXT,
ADD COLUMN logo_url TEXT;

-- Add indexes for performance (standard for multi-tenant apps)
CREATE INDEX IF NOT EXISTS idx_companies_org_id ON public.companies(organization_id);
CREATE INDEX IF NOT EXISTS idx_deals_org_id ON public.deals(organization_id);
CREATE INDEX IF NOT EXISTS idx_stakeholders_org_id ON public.stakeholders(organization_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_org_id ON public.campaigns(organization_id);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_org_id ON public.workflow_runs(organization_id);

-- Optional: Add a simple CNPJ check if possible (standard 14 digits)
-- ALTER TABLE public.companies ADD CONSTRAINT check_cnpj_format CHECK (cnpj ~ '^\d{14}$' OR cnpj IS NULL);
-- Actually, let's keep it flexible for now.

-- Ensure all tables have updated_at triggers
-- (Assuming they already do, but good to check or re-apply)
