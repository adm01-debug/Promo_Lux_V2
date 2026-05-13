-- Create app_role enum if it doesn't exist
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
        CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'sdr', 'viewer');
    END IF;
END $$;

-- Create user_roles table
CREATE TABLE IF NOT EXISTS public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role public.app_role NOT NULL,
    UNIQUE (user_id, role)
);

-- Enable RLS
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- SECURITY DEFINER function to check roles (avoids recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Create audit_logs table
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES public.organizations(id),
    user_id UUID REFERENCES auth.users(id),
    action TEXT NOT NULL,
    table_name TEXT NOT NULL,
    record_id UUID NOT NULL,
    old_data JSONB,
    new_data JSONB,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- SDR+ can view logs
CREATE POLICY "Admins view audit logs" ON public.audit_logs
    FOR SELECT TO authenticated
    USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Function to handle audit triggers
CREATE OR REPLACE FUNCTION public.process_audit_log()
RETURNS TRIGGER AS $$
DECLARE
    org_id UUID;
BEGIN
    IF (TG_OP = 'DELETE') THEN
        org_id := OLD.organization_id;
    ELSE
        org_id := NEW.organization_id;
    END IF;

    INSERT INTO public.audit_logs (
        organization_id,
        user_id,
        action,
        table_name,
        record_id,
        old_data,
        new_data
    ) VALUES (
        org_id,
        auth.uid(),
        TG_OP,
        TG_TABLE_NAME,
        COALESCE(NEW.id, OLD.id),
        CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE row_to_json(OLD)::jsonb END,
        CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE row_to_json(NEW)::jsonb END
    );
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply to critical tables
DROP TRIGGER IF EXISTS audit_companies_trigger ON public.companies;
CREATE TRIGGER audit_companies_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.companies
FOR EACH ROW EXECUTE FUNCTION public.process_audit_log();

DROP TRIGGER IF EXISTS audit_deals_trigger ON public.deals;
CREATE TRIGGER audit_deals_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.deals
FOR EACH ROW EXECUTE FUNCTION public.process_audit_log();
