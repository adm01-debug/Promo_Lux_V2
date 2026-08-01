
-- Companies table — stores scraped + enriched companies
CREATE TABLE public.companies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  sector TEXT,
  location TEXT,
  website TEXT,
  phone TEXT,
  email TEXT,
  employees TEXT,
  revenue TEXT,
  source TEXT NOT NULL DEFAULT 'manual',
  ipc_score INTEGER DEFAULT 0,
  enriched BOOLEAN DEFAULT false,
  starred BOOLEAN DEFAULT false,
  raw_data JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

-- Public read for now (no auth required yet)
CREATE POLICY "Companies are viewable by everyone" ON public.companies FOR SELECT USING (true);
CREATE POLICY "Companies can be inserted by anyone" ON public.companies FOR INSERT WITH CHECK (true);
CREATE POLICY "Companies can be updated by anyone" ON public.companies FOR UPDATE USING (true);

-- Scrape jobs table — tracks gmaps scraping jobs
CREATE TABLE public.scrape_jobs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  external_id TEXT,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  source TEXT NOT NULL DEFAULT 'gmaps',
  config JSONB NOT NULL DEFAULT '{}',
  results_count INTEGER DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.scrape_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Scrape jobs are viewable by everyone" ON public.scrape_jobs FOR SELECT USING (true);
CREATE POLICY "Scrape jobs can be inserted by anyone" ON public.scrape_jobs FOR INSERT WITH CHECK (true);
CREATE POLICY "Scrape jobs can be updated by anyone" ON public.scrape_jobs FOR UPDATE USING (true);
CREATE POLICY "Scrape jobs can be deleted by anyone" ON public.scrape_jobs FOR DELETE USING (true);

-- Scrape results — raw results from scraping linked to jobs and optionally to companies
CREATE TABLE public.scrape_results (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id UUID REFERENCES public.scrape_jobs(id) ON DELETE CASCADE NOT NULL,
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  raw_data JSONB NOT NULL DEFAULT '{}',
  processed BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.scrape_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Scrape results are viewable by everyone" ON public.scrape_results FOR SELECT USING (true);
CREATE POLICY "Scrape results can be inserted by anyone" ON public.scrape_results FOR INSERT WITH CHECK (true);
CREATE POLICY "Scrape results can be updated by anyone" ON public.scrape_results FOR UPDATE USING (true);

-- IPC config table — stores IPC criteria and weights
CREATE TABLE public.ipc_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL DEFAULT 'default',
  criteria JSONB NOT NULL DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.ipc_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "IPC config is viewable by everyone" ON public.ipc_config FOR SELECT USING (true);
CREATE POLICY "IPC config can be inserted by anyone" ON public.ipc_config FOR INSERT WITH CHECK (true);
CREATE POLICY "IPC config can be updated by anyone" ON public.ipc_config FOR UPDATE USING (true);

-- Indexes
CREATE INDEX idx_companies_sector ON public.companies(sector);
CREATE INDEX idx_companies_ipc_score ON public.companies(ipc_score);
CREATE INDEX idx_companies_source ON public.companies(source);
CREATE INDEX idx_scrape_jobs_status ON public.scrape_jobs(status);
CREATE INDEX idx_scrape_results_job_id ON public.scrape_results(job_id);
CREATE INDEX idx_scrape_results_company_id ON public.scrape_results(company_id);

-- Timestamp trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON public.companies FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_scrape_jobs_updated_at BEFORE UPDATE ON public.scrape_jobs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_ipc_config_updated_at BEFORE UPDATE ON public.ipc_config FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
