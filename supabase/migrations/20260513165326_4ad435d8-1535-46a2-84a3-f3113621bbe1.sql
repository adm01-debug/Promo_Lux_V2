-- Add trace_id for distributed tracing
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS trace_id UUID;
ALTER TABLE public.api_request_logs ADD COLUMN IF NOT EXISTS trace_id UUID;

-- Create idempotency_keys table
CREATE TABLE IF NOT EXISTS public.idempotency_keys (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  organization_id UUID REFERENCES public.organizations(id),
  key TEXT NOT NULL,
  response_body JSONB NOT NULL,
  status_code INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, key)
);

ALTER TABLE public.idempotency_keys ENABLE ROW LEVEL SECURITY;

-- Drop and recreate policies to avoid "already exists" errors
DROP POLICY IF EXISTS "Users can view their own idempotency keys" ON public.idempotency_keys;
CREATE POLICY "Users can view their own idempotency keys" 
ON public.idempotency_keys FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create their own idempotency keys" ON public.idempotency_keys;
CREATE POLICY "Users can create their own idempotency keys" 
ON public.idempotency_keys FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Add version column for optimistic locking
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;

-- Function to increment version
CREATE OR REPLACE FUNCTION public.increment_version()
RETURNS TRIGGER AS $$
BEGIN
  NEW.version = OLD.version + 1;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for versioning
DROP TRIGGER IF EXISTS tr_companies_version ON public.companies;
CREATE TRIGGER tr_companies_version
BEFORE UPDATE ON public.companies
FOR EACH ROW
EXECUTE FUNCTION public.increment_version();

DROP TRIGGER IF EXISTS tr_deals_version ON public.deals;
CREATE TRIGGER tr_deals_version
BEFORE UPDATE ON public.deals
FOR EACH ROW
EXECUTE FUNCTION public.increment_version();
