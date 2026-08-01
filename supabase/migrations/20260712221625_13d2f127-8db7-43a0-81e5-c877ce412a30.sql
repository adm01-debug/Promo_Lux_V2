-- 1) Funções puramente de manutenção/cron: somente service_role/postgres.
REVOKE EXECUTE ON FUNCTION public.capture_db_health_snapshot() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.capture_dlq_health_snapshots() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.evaluate_dlq_alerts(integer, integer, integer) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.prune_dlq_health_snapshots() FROM anon, authenticated;

-- 2) Funções admin (frontend autenticado OU cron): remover apenas anon.
REVOKE EXECUTE ON FUNCTION public.reset_circuit_breaker(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.evaluate_partition_policies() FROM anon;

-- 3) Funções de usuário autenticado que já bloqueiam anon internamente: defesa em profundidade.
REVOKE EXECUTE ON FUNCTION public.enqueue_scrape_task(uuid, text, jsonb, integer, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.replay_dead_letter(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.api_latency_stats(integer, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.dlq_health_trend(integer) FROM anon;

-- Mantém o backend/agendador com acesso.
GRANT EXECUTE ON FUNCTION public.capture_db_health_snapshot() TO service_role;
GRANT EXECUTE ON FUNCTION public.capture_dlq_health_snapshots() TO service_role;
GRANT EXECUTE ON FUNCTION public.evaluate_dlq_alerts(integer, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.prune_dlq_health_snapshots() TO service_role;
GRANT EXECUTE ON FUNCTION public.reset_circuit_breaker(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.evaluate_partition_policies() TO service_role;

-- 4) log_automation_event: revoga de anon/authenticated via loop (assinatura longa).
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname='log_automation_event'
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon, authenticated', r.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', r.sig);
  END LOOP;
END$$;