
-- Remove the per-row trigger that creates individual notifications
DROP TRIGGER IF EXISTS trg_notify_scrape_import ON public.companies;
DROP FUNCTION IF EXISTS public.notify_on_scrape_import();
