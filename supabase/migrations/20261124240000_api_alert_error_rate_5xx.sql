-- Alerta de saude da API passa a olhar a taxa de erro 5xx, nao so o p95.
--
-- Antes: `evaluate_api_latency_alerts()` (cron evaluate-api-latency-15min) so
-- comparava p95_ms dos ultimos ciclos. Um 500 generalizado que responde rapido
-- nunca aparece no p95, entao nenhum admin era avisado. Efeito real medido em
-- 24/11: o filtro `?action=` do GET /events respondeu 500 em 100% das chamadas
-- por horas e ninguem recebeu alerta - a falha so apareceu porque alguem olhou.
--
-- Depois: a funcao avalia tambem errors/error_rate dos snapshots (que desde a
-- 20261124150000 contam apenas 5xx, logo 401 de scanner nao gera alerta). A
-- condicao e a mesma do p95: os ultimos `consecutive` ciclos da rota precisam
-- estar acima do limite, o que evita alarme por um unico blip.
--
-- Configuracao: nova coluna error_rate_critical_pct (default 5%, alinhado ao
-- errorRateCritical do painel em src/hooks/useApiLatency.ts). Organizacao sem
-- linha em api_latency_alert_settings usa o mesmo fallback 5 na funcao.
--
-- Historico: api_latency_alert_history ganha error_rate, error_rate_critical_pct
-- e requests, e o silencio (cooldown) passa a ser contado por tipo - alerta de
-- p95 nao abafa alerta de erro 5xx da mesma rota, e vice-versa. As linhas ja
-- gravadas ficam com error_rate NULL e continuam contando so para o p95.

ALTER TABLE public.api_latency_alert_settings
  ADD COLUMN IF NOT EXISTS error_rate_critical_pct numeric NOT NULL DEFAULT 5;

ALTER TABLE public.api_latency_alert_history
  ADD COLUMN IF NOT EXISTS error_rate numeric,
  ADD COLUMN IF NOT EXISTS error_rate_critical_pct numeric,
  ADD COLUMN IF NOT EXISTS requests bigint;

CREATE OR REPLACE FUNCTION public.evaluate_api_latency_alerts(_p95_critical_ms integer DEFAULT 1500, _consecutive integer DEFAULT 3, _cooldown_hours integer DEFAULT 6)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_rec record; v_pc integer; v_cons integer; v_cd integer; v_enabled boolean;
  v_recent integer; v_peak numeric; v_last timestamptz; v_admin uuid; v_notified integer; v_alerts integer := 0;
  v_er_crit numeric; v_er_recent integer; v_er_peak numeric; v_er_requests bigint;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Acesso negado'; END IF;
  FOR v_rec IN SELECT DISTINCT organization_id, path FROM public.api_latency_snapshots WHERE captured_at >= now() - interval '24 hours' LOOP
    SELECT s.p95_critical_ms, s.consecutive, s.cooldown_hours, s.enabled, s.error_rate_critical_pct INTO v_pc, v_cons, v_cd, v_enabled, v_er_crit FROM public.api_latency_alert_settings s WHERE s.organization_id = v_rec.organization_id;
    v_pc := COALESCE(v_pc, _p95_critical_ms); v_cons := COALESCE(v_cons, _consecutive); v_cd := COALESCE(v_cd, _cooldown_hours); v_enabled := COALESCE(v_enabled, true); v_er_crit := COALESCE(v_er_crit, 5);
    IF NOT v_enabled THEN CONTINUE; END IF;

    -- 1) p95 acima do limite critico em todos os ultimos ciclos.
    SELECT count(*) FILTER (WHERE p95_ms >= GREATEST(v_pc, 1)), max(p95_ms) INTO v_recent, v_peak FROM (SELECT p95_ms FROM public.api_latency_snapshots WHERE organization_id = v_rec.organization_id AND path = v_rec.path ORDER BY captured_at DESC LIMIT GREATEST(v_cons, 1)) s;
    IF v_recent >= GREATEST(v_cons, 1) THEN
      SELECT max(created_at) INTO v_last FROM public.api_latency_alert_history WHERE organization_id = v_rec.organization_id AND path = v_rec.path AND error_rate IS NULL;
      IF v_last IS NULL OR v_last <= now() - make_interval(hours => GREATEST(v_cd, 1)) THEN
        v_notified := 0;
        FOR v_admin IN SELECT om.user_id FROM public.organization_members om WHERE om.organization_id = v_rec.organization_id AND om.role = 'admin' LOOP
          INSERT INTO public.notifications (user_id, organization_id, type, title, message, metadata) VALUES (v_admin, v_rec.organization_id, 'system', 'Latência crítica de API', format('Rota "%s" com p95 %s ms por %s ciclos consecutivos.', v_rec.path, round(v_peak), GREATEST(v_cons, 1)), jsonb_build_object('kind','api_latency_critical','path', v_rec.path, 'p95_ms', v_peak));
          v_notified := v_notified + 1; v_alerts := v_alerts + 1;
        END LOOP;
        INSERT INTO public.api_latency_alert_history (organization_id, path, p95_ms, p95_critical_ms, consecutive, admins_notified) VALUES (v_rec.organization_id, v_rec.path, COALESCE(v_peak, 0), v_pc, GREATEST(v_cons, 1), v_notified);
      END IF;
    END IF;

    -- 2) taxa de erro 5xx acima do limite em todos os ultimos ciclos. Cobre a
    -- falha que nao aparece no p95 (500 rapido) e a rota que responde rapido
    -- enquanto erra tudo.
    SELECT count(*) FILTER (WHERE s.errors > 0 AND s.error_rate >= GREATEST(v_er_crit, 0)),
           COALESCE(max(s.error_rate) FILTER (WHERE s.errors > 0), 0),
           COALESCE(sum(s.requests), 0)::bigint
      INTO v_er_recent, v_er_peak, v_er_requests
      FROM (SELECT errors, error_rate, requests FROM public.api_latency_snapshots WHERE organization_id = v_rec.organization_id AND path = v_rec.path ORDER BY captured_at DESC LIMIT GREATEST(v_cons, 1)) s;
    IF v_er_recent >= GREATEST(v_cons, 1) THEN
      SELECT max(created_at) INTO v_last FROM public.api_latency_alert_history WHERE organization_id = v_rec.organization_id AND path = v_rec.path AND error_rate IS NOT NULL;
      IF v_last IS NULL OR v_last <= now() - make_interval(hours => GREATEST(v_cd, 1)) THEN
        v_notified := 0;
        FOR v_admin IN SELECT om.user_id FROM public.organization_members om WHERE om.organization_id = v_rec.organization_id AND om.role = 'admin' LOOP
          INSERT INTO public.notifications (user_id, organization_id, type, title, message, metadata) VALUES (v_admin, v_rec.organization_id, 'system', 'Erro 5xx na API', format('Rota "%s" com %s%% de erro 5xx por %s ciclos consecutivos.', v_rec.path, round(v_er_peak, 2), GREATEST(v_cons, 1)), jsonb_build_object('kind','api_error_rate_critical','path', v_rec.path, 'error_rate', v_er_peak, 'error_rate_critical_pct', v_er_crit));
          v_notified := v_notified + 1; v_alerts := v_alerts + 1;
        END LOOP;
        INSERT INTO public.api_latency_alert_history (organization_id, path, p95_ms, p95_critical_ms, consecutive, admins_notified, error_rate, error_rate_critical_pct, requests) VALUES (v_rec.organization_id, v_rec.path, COALESCE(v_peak, 0), v_pc, GREATEST(v_cons, 1), v_notified, v_er_peak, v_er_crit, v_er_requests);
      END IF;
    END IF;
  END LOOP;
  RETURN v_alerts;
END;
$function$;