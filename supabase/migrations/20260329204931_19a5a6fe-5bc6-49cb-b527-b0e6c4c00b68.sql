
-- Workflows table — defines reusable automation pipelines
CREATE TABLE public.workflows (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  steps JSONB NOT NULL DEFAULT '[]',
  config JSONB NOT NULL DEFAULT '{}',
  leads_processed INTEGER DEFAULT 0,
  leads_qualified INTEGER DEFAULT 0,
  success_rate NUMERIC(5,2) DEFAULT 0,
  last_run_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.workflows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workflows are viewable by everyone" ON public.workflows FOR SELECT USING (true);
CREATE POLICY "Workflows can be inserted by anyone" ON public.workflows FOR INSERT WITH CHECK (true);
CREATE POLICY "Workflows can be updated by anyone" ON public.workflows FOR UPDATE USING (true);
CREATE POLICY "Workflows can be deleted by anyone" ON public.workflows FOR DELETE USING (true);

-- Workflow runs — tracks each execution of a workflow
CREATE TABLE public.workflow_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workflow_id UUID REFERENCES public.workflows(id) ON DELETE CASCADE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  current_step TEXT,
  results JSONB DEFAULT '{}',
  error_message TEXT,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.workflow_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workflow runs are viewable by everyone" ON public.workflow_runs FOR SELECT USING (true);
CREATE POLICY "Workflow runs can be inserted by anyone" ON public.workflow_runs FOR INSERT WITH CHECK (true);
CREATE POLICY "Workflow runs can be updated by anyone" ON public.workflow_runs FOR UPDATE USING (true);

CREATE INDEX idx_workflows_status ON public.workflows(status);
CREATE INDEX idx_workflow_runs_workflow_id ON public.workflow_runs(workflow_id);
CREATE INDEX idx_workflow_runs_status ON public.workflow_runs(status);

CREATE TRIGGER update_workflows_updated_at BEFORE UPDATE ON public.workflows FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for workflow runs so UI updates live
ALTER PUBLICATION supabase_realtime ADD TABLE public.workflow_runs;
