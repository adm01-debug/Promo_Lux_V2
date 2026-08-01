REVOKE ALL ON FUNCTION public.defer_scrape_task(uuid, integer, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.defer_scrape_task(uuid, integer, text) TO service_role;