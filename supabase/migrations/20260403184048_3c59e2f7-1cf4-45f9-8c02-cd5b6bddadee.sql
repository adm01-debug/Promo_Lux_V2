
-- Deduplicate companies: keep the row with latest updated_at per (name, source)
DELETE FROM public.companies
WHERE id NOT IN (
  SELECT DISTINCT ON (name, source) id
  FROM public.companies
  ORDER BY name, source, updated_at DESC
);

-- Now create the unique index
CREATE UNIQUE INDEX IF NOT EXISTS uq_companies_name_source ON public.companies (name, source);

-- Indices (re-run since previous migration failed atomically)
CREATE INDEX IF NOT EXISTS idx_companies_ipc_score ON public.companies (ipc_score DESC);
CREATE INDEX IF NOT EXISTS idx_companies_source ON public.companies (source);
CREATE INDEX IF NOT EXISTS idx_companies_sector ON public.companies (sector);
CREATE INDEX IF NOT EXISTS idx_companies_enriched ON public.companies (enriched);
CREATE INDEX IF NOT EXISTS idx_companies_starred ON public.companies (starred);
CREATE INDEX IF NOT EXISTS idx_companies_created_at ON public.companies (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_scrape_jobs_status ON public.scrape_jobs (status);
CREATE INDEX IF NOT EXISTS idx_scrape_jobs_source ON public.scrape_jobs (source);
CREATE INDEX IF NOT EXISTS idx_scrape_jobs_external_id ON public.scrape_jobs (external_id);

CREATE INDEX IF NOT EXISTS idx_workflows_status ON public.workflows (status);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_workflow_id ON public.workflow_runs (workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_status ON public.workflow_runs (status);

CREATE INDEX IF NOT EXISTS idx_notifications_read ON public.notifications (read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_stakeholders_company_id ON public.stakeholders (company_id);
CREATE INDEX IF NOT EXISTS idx_scrape_results_job_id ON public.scrape_results (job_id);
CREATE INDEX IF NOT EXISTS idx_scrape_results_processed ON public.scrape_results (processed);

CREATE INDEX IF NOT EXISTS idx_intent_signals_company_id ON public.intent_signals (company_id);

-- IPC score validation trigger
CREATE OR REPLACE FUNCTION public.validate_ipc_score()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = 'public'
AS $$
BEGIN
  IF NEW.ipc_score IS NOT NULL AND (NEW.ipc_score < 0 OR NEW.ipc_score > 100) THEN
    RAISE EXCEPTION 'ipc_score must be between 0 and 100, got %', NEW.ipc_score;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_ipc_score ON public.companies;
CREATE TRIGGER trg_validate_ipc_score
  BEFORE INSERT OR UPDATE ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.validate_ipc_score();
