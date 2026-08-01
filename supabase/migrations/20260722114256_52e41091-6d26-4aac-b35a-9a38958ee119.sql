REVOKE EXECUTE ON FUNCTION public.api_latency_percentiles(text, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.dlq_top_reasons(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.api_latency_percentiles(text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.dlq_top_reasons(integer) TO service_role;