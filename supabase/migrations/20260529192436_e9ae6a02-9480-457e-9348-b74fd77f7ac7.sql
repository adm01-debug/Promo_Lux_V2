-- 1. Segurança: Definir search_path em todas as funções SECURITY DEFINER
ALTER FUNCTION public.update_updated_at_column() SET search_path = public;
ALTER FUNCTION public.increment_version() SET search_path = public;
ALTER FUNCTION public.validate_ipc_score() SET search_path = public;
ALTER FUNCTION public.update_automation_steps_updated_at() SET search_path = public;
ALTER FUNCTION public.handle_updated_at() SET search_path = public;

-- 2. Performance: Índices para filtros frequentes no monitoramento
CREATE INDEX IF NOT EXISTS idx_scrape_jobs_org_status ON public.scrape_jobs(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_scrape_jobs_created_at ON public.scrape_jobs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_automation_steps_job_id ON public.automation_steps(job_id);
CREATE INDEX IF NOT EXISTS idx_scrape_results_job_id ON public.scrape_results(job_id);

-- 3. Segurança: Garantir que RLS está habilitado em tabelas críticas (caso tenha passado algum)
ALTER TABLE public.scrape_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scrape_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_alerts ENABLE ROW LEVEL SECURITY;

-- 4. Melhoria de Tipagem: Garantir enums corretos
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'automation_status') THEN
        CREATE TYPE public.automation_status AS ENUM ('pending', 'running', 'completed', 'failed', 'cancelled');
    END IF;
END $$;
