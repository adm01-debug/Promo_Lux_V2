-- Create automation_alerts table for notifications
CREATE TABLE IF NOT EXISTS public.automation_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL, -- 'job_failed', 'job_completed', 'job_started'
    delivery_method TEXT NOT NULL, -- 'email', 'in_app'
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.automation_alerts ENABLE ROW LEVEL SECURITY;

-- Policies for automation_alerts
CREATE POLICY "Users can manage their own alerts"
ON public.automation_alerts
FOR ALL
USING (auth.uid() = user_id);

-- Create job_exports table
CREATE TABLE IF NOT EXISTS public.job_exports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES public.scrape_jobs(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    format TEXT NOT NULL, -- 'csv', 'pdf'
    status TEXT DEFAULT 'pending', -- 'pending', 'completed', 'failed'
    file_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.job_exports ENABLE ROW LEVEL SECURITY;

-- Policies for job_exports
CREATE POLICY "Users can manage their own exports"
ON public.job_exports
FOR ALL
USING (auth.uid() = user_id);

-- Add index for performance on filtering
CREATE INDEX IF NOT EXISTS idx_scrape_jobs_status_org ON public.scrape_jobs (organization_id, status);
CREATE INDEX IF NOT EXISTS idx_scrape_jobs_created_at ON public.scrape_jobs (created_at DESC);
