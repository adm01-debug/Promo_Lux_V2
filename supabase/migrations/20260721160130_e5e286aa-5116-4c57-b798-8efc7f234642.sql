
ALTER TABLE public.scrape_jobs
  ADD COLUMN IF NOT EXISTS config_hash TEXT,
  ADD COLUMN IF NOT EXISTS trace_id UUID;

UPDATE public.scrape_jobs
   SET config_hash = md5(config::text)
 WHERE config_hash IS NULL AND config IS NOT NULL;

CREATE OR REPLACE FUNCTION public.scrape_jobs_set_config_hash()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.config IS NOT NULL THEN
    NEW.config_hash := md5(NEW.config::text);
  END IF;
  IF NEW.trace_id IS NULL THEN
    NEW.trace_id := gen_random_uuid();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS scrape_jobs_set_config_hash_trg ON public.scrape_jobs;
CREATE TRIGGER scrape_jobs_set_config_hash_trg
  BEFORE INSERT OR UPDATE OF config ON public.scrape_jobs
  FOR EACH ROW EXECUTE FUNCTION public.scrape_jobs_set_config_hash();

CREATE UNIQUE INDEX IF NOT EXISTS scrape_jobs_org_config_active_uk
  ON public.scrape_jobs (organization_id, config_hash)
  WHERE status IN ('pending', 'running', 'working') AND config_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS scrape_jobs_trace_id_idx
  ON public.scrape_jobs(trace_id) WHERE trace_id IS NOT NULL;
