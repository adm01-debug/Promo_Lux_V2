
REVOKE EXECUTE ON FUNCTION public.replay_web_dead_letter_batch(uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.web_dlq_health_metrics() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.replay_web_dead_letter_batch(uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.web_dlq_health_metrics() TO service_role;

COMMENT ON FUNCTION public.replay_web_dead_letter_batch(uuid, integer) IS
  'ADR-009: SECURITY DEFINER, service_role only. Reprocessa DLQ do motor web-scrape.';
COMMENT ON FUNCTION public.web_dlq_health_metrics() IS
  'ADR-009: SECURITY DEFINER, service_role only. Métricas agregadas da DLQ web-scrape.';
