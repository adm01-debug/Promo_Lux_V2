
-- Create ENUMs covering all existing data values
CREATE TYPE public.workflow_status AS ENUM ('draft', 'active', 'paused', 'completed', 'failed', 'running', 'archived');
CREATE TYPE public.campaign_status AS ENUM ('draft', 'active', 'paused', 'completed', 'archived');
CREATE TYPE public.scrape_job_status AS ENUM ('pending', 'running', 'working', 'completed', 'failed', 'cancelled');

-- workflows
ALTER TABLE public.workflows ALTER COLUMN status DROP DEFAULT;
ALTER TABLE public.workflows ALTER COLUMN status TYPE public.workflow_status USING status::public.workflow_status;
ALTER TABLE public.workflows ALTER COLUMN status SET DEFAULT 'draft'::public.workflow_status;

-- campaigns
ALTER TABLE public.campaigns ALTER COLUMN status DROP DEFAULT;
ALTER TABLE public.campaigns ALTER COLUMN status TYPE public.campaign_status USING status::public.campaign_status;
ALTER TABLE public.campaigns ALTER COLUMN status SET DEFAULT 'draft'::public.campaign_status;

-- scrape_jobs
ALTER TABLE public.scrape_jobs ALTER COLUMN status DROP DEFAULT;
ALTER TABLE public.scrape_jobs ALTER COLUMN status TYPE public.scrape_job_status USING status::public.scrape_job_status;
ALTER TABLE public.scrape_jobs ALTER COLUMN status SET DEFAULT 'pending'::public.scrape_job_status;

-- revenue TEXT -> NUMERIC
ALTER TABLE public.companies ALTER COLUMN revenue TYPE NUMERIC USING (
  CASE
    WHEN revenue IS NULL OR revenue = '' THEN NULL
    WHEN revenue ~ '^[0-9]+(\.[0-9]+)?$' THEN revenue::NUMERIC
    ELSE NULL
  END
);

-- Indices
CREATE INDEX IF NOT EXISTS idx_companies_user_id ON public.companies (user_id);
CREATE INDEX IF NOT EXISTS idx_companies_ipc_score ON public.companies (ipc_score);
CREATE INDEX IF NOT EXISTS idx_companies_user_id_ipc_score ON public.companies (user_id, ipc_score DESC);
