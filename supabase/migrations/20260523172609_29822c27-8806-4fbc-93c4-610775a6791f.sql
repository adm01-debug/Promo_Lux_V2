-- Create an enum for automation status if not exists
DO $$ BEGIN
    CREATE TYPE automation_status AS ENUM ('pending', 'running', 'completed', 'failed', 'cancelled');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create automation_steps table
CREATE TABLE IF NOT EXISTS public.automation_steps (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    job_id UUID REFERENCES public.scrape_jobs(id) ON DELETE CASCADE,
    run_id UUID REFERENCES public.workflow_runs(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    status automation_status DEFAULT 'pending',
    message TEXT,
    payload JSONB,
    error_stack TEXT,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.automation_steps ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their organization's automation steps"
ON public.automation_steps
FOR SELECT
USING (
    organization_id IN (
        SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
);

CREATE POLICY "Users can insert automation steps for their organization"
ON public.automation_steps
FOR INSERT
WITH CHECK (
    organization_id IN (
        SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
);

CREATE POLICY "Users can update automation steps for their organization"
ON public.automation_steps
FOR UPDATE
USING (
    organization_id IN (
        SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
);

-- Triggers for updated_at
CREATE OR REPLACE FUNCTION public.update_automation_steps_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_automation_steps_updated_at_trigger
BEFORE UPDATE ON public.automation_steps
FOR EACH ROW
EXECUTE FUNCTION public.update_automation_steps_updated_at();

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_automation_steps_job_id ON public.automation_steps(job_id);
CREATE INDEX IF NOT EXISTS idx_automation_steps_run_id ON public.automation_steps(run_id);
CREATE INDEX IF NOT EXISTS idx_automation_steps_org_id ON public.automation_steps(organization_id);
