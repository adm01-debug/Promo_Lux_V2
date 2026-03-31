
-- Function to create a notification when companies are imported via scraping
CREATE OR REPLACE FUNCTION public.notify_on_scrape_import()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.source IS NOT NULL AND NEW.source <> 'manual' THEN
    INSERT INTO public.notifications (type, title, message, metadata)
    VALUES (
      'scrape',
      'Nova empresa importada',
      'A empresa "' || NEW.name || '" foi importada via ' || NEW.source || '.',
      jsonb_build_object('company_id', NEW.id, 'company_name', NEW.name, 'source', NEW.source)
    );
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger on companies insert
DROP TRIGGER IF EXISTS trg_notify_scrape_import ON public.companies;
CREATE TRIGGER trg_notify_scrape_import
  AFTER INSERT ON public.companies
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_scrape_import();
