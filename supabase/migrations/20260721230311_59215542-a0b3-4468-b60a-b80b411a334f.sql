
REVOKE ALL ON FUNCTION public.worker_report_batch(text, int) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.worker_should_run(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.worker_report_batch(text, int) TO service_role;
GRANT EXECUTE ON FUNCTION public.worker_should_run(text) TO service_role;
