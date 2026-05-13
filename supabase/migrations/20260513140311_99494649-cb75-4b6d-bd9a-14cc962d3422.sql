-- Add version column to critical tables for optimistic locking
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 1;

-- Trigger to increment version automatically on update
CREATE OR REPLACE FUNCTION public.increment_version()
RETURNS TRIGGER AS $$
BEGIN
    NEW.version = OLD.version + 1;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers
DROP TRIGGER IF EXISTS increment_companies_version ON public.companies;
CREATE TRIGGER increment_companies_version
BEFORE UPDATE ON public.companies
FOR EACH ROW
EXECUTE FUNCTION public.increment_version();

DROP TRIGGER IF EXISTS increment_deals_version ON public.deals;
CREATE TRIGGER increment_deals_version
BEFORE UPDATE ON public.deals
FOR EACH ROW
EXECUTE FUNCTION public.increment_version();
