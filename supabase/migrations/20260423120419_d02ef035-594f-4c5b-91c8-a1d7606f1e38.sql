CREATE TABLE public.api_request_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  api_key_id UUID,
  api_key_prefix TEXT,
  organization_id UUID,
  user_id UUID,
  method TEXT NOT NULL,
  path TEXT NOT NULL,
  resource TEXT,
  status_code INTEGER NOT NULL,
  duration_ms INTEGER NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_api_request_logs_api_key ON public.api_request_logs(api_key_id, created_at DESC);
CREATE INDEX idx_api_request_logs_org ON public.api_request_logs(organization_id, created_at DESC);
CREATE INDEX idx_api_request_logs_created ON public.api_request_logs(created_at DESC);

ALTER TABLE public.api_request_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view org api_request_logs"
ON public.api_request_logs FOR SELECT TO authenticated
USING (organization_id IS NOT NULL AND public.has_org_role(organization_id, auth.uid(), 'admin'::app_role));

CREATE POLICY "Service manage api_request_logs"
ON public.api_request_logs FOR ALL TO service_role
USING (true) WITH CHECK (true);