-- 1) Snapshots de latência por rota/organização
CREATE TABLE public.api_latency_snapshots (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  path text NOT NULL,
  requests bigint NOT NULL DEFAULT 0,
  errors bigint NOT NULL DEFAULT 0,
  error_rate numeric NOT NULL DEFAULT 0,
  p50_ms numeric NOT NULL DEFAULT 0,
  p95_ms numeric NOT NULL DEFAULT 0,
  p99_ms numeric NOT NULL DEFAULT 0,
  captured_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_api_latency_snapshots_org_time ON public.api_latency_snapshots (organization_id, captured_at DESC);
CREATE INDEX idx_api_latency_snapshots_org_path_time ON public.api_latency_snapshots (organization_id, path, captured_at DESC);

GRANT SELECT ON public.api_latency_snapshots TO authenticated;
GRANT ALL ON public.api_latency_snapshots TO service_role;

ALTER TABLE public.api_latency_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Membros veem snapshots de latência da sua organização"
ON public.api_latency_snapshots FOR SELECT TO authenticated
USING (public.is_org_member(organization_id, auth.uid()));

-- 2) Configurações de alerta de latência por organização
CREATE TABLE public.api_latency_alert_settings (
  organization_id uuid NOT NULL PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  p95_critical_ms integer NOT NULL DEFAULT 1500,
  consecutive integer NOT NULL DEFAULT 3,
  cooldown_hours integer NOT NULL DEFAULT 6,
  enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.api_latency_alert_settings TO authenticated;
GRANT ALL ON public.api_latency_alert_settings TO service_role;

ALTER TABLE public.api_latency_alert_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Membros veem config de alerta de latência"
ON public.api_latency_alert_settings FOR SELECT TO authenticated
USING (public.is_org_member(organization_id, auth.uid()));

CREATE POLICY "Admins inserem config de alerta de latência"
ON public.api_latency_alert_settings FOR INSERT TO authenticated
WITH CHECK (public.has_org_role(organization_id, auth.uid(), 'admin'));

CREATE POLICY "Admins atualizam config de alerta de latência"
ON public.api_latency_alert_settings FOR UPDATE TO authenticated
USING (public.has_org_role(organization_id, auth.uid(), 'admin'))
WITH CHECK (public.has_org_role(organization_id, auth.uid(), 'admin'));

CREATE POLICY "Admins removem config de alerta de latência"
ON public.api_latency_alert_settings FOR DELETE TO authenticated
USING (public.has_org_role(organization_id, auth.uid(), 'admin'));

-- Validação de settings (análogo ao DLQ)
CREATE OR REPLACE FUNCTION public.validate_api_latency_alert_settings()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.p95_critical_ms < 1 THEN
    RAISE EXCEPTION 'p95_critical_ms deve ser >= 1';
  END IF;
  IF NEW.consecutive < 1 OR NEW.consecutive > 24 THEN
    RAISE EXCEPTION 'consecutive deve estar entre 1 e 24';
  END IF;
  IF NEW.cooldown_hours < 1 OR NEW.cooldown_hours > 168 THEN
    RAISE EXCEPTION 'cooldown_hours deve estar entre 1 e 168';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$function$;

CREATE TRIGGER trg_validate_api_latency_alert_settings
BEFORE INSERT OR UPDATE ON public.api_latency_alert_settings
FOR EACH ROW EXECUTE FUNCTION public.validate_api_latency_alert_settings();

-- 3) Histórico de disparos de alerta de latência
CREATE TABLE public.api_latency_alert_history (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  path text NOT NULL,
  p95_ms numeric NOT NULL,
  p95_critical_ms integer NOT NULL,
  consecutive integer NOT NULL,
  admins_notified integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_api_latency_alert_history_org_time ON public.api_latency_alert_history (organization_id, created_at DESC);

GRANT SELECT ON public.api_latency_alert_history TO authenticated;
GRANT ALL ON public.api_latency_alert_history TO service_role;

ALTER TABLE public.api_latency_alert_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Membros veem histórico de alerta de latência"
ON public.api_latency_alert_history FOR SELECT TO authenticated
USING (public.is_org_member(organization_id, auth.uid()));

-- 4) Captura de snapshots de latência (últimas 1h por rota/org)
CREATE OR REPLACE FUNCTION public.capture_api_latency_snapshots(_hours integer DEFAULT 1)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_count integer := 0;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Acesso negado: requer papel de administrador';
  END IF;

  INSERT INTO public.api_latency_snapshots (
    organization_id, path, requests, errors, error_rate, p50_ms, p95_ms, p99_ms
  )
  SELECT
    l.organization_id,
    l.path,
    count(*)::bigint,
    count(*) FILTER (WHERE l.status_code >= 400)::bigint,
    ROUND(100.0 * count(*) FILTER (WHERE l.status_code >= 400) / NULLIF(count(*), 0), 2),
    ROUND(percentile_cont(0.5) WITHIN GROUP (ORDER BY l.duration_ms)::numeric, 0),
    ROUND(percentile_cont(0.95) WITHIN GROUP (ORDER BY l.duration_ms)::numeric, 0),
    ROUND(percentile_cont(0.99) WITHIN GROUP (ORDER BY l.duration_ms)::numeric, 0)
  FROM public.api_request_logs l
  WHERE l.created_at >= now() - make_interval(hours => GREATEST(_hours, 1))
    AND l.organization_id IS NOT NULL
  GROUP BY l.organization_id, l.path;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$function$;

REVOKE ALL ON FUNCTION public.capture_api_latency_snapshots(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.capture_api_latency_snapshots(integer) TO service_role;

-- 5) Avaliação de alertas de latência p95
CREATE OR REPLACE FUNCTION public.evaluate_api_latency_alerts(
  _p95_critical_ms integer DEFAULT 1500,
  _consecutive integer DEFAULT 3,
  _cooldown_hours integer DEFAULT 6
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_rec       record;
  v_pc        integer;
  v_cons      integer;
  v_cd        integer;
  v_enabled   boolean;
  v_recent    integer;
  v_peak      numeric;
  v_last      timestamptz;
  v_admin     uuid;
  v_notified  integer;
  v_alerts    integer := 0;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Acesso negado: requer papel de administrador';
  END IF;

  -- Para cada par (org, rota) com snapshots recentes
  FOR v_rec IN
    SELECT DISTINCT organization_id, path
    FROM public.api_latency_snapshots
    WHERE captured_at >= now() - interval '24 hours'
  LOOP
    SELECT s.p95_critical_ms, s.consecutive, s.cooldown_hours, s.enabled
      INTO v_pc, v_cons, v_cd, v_enabled
    FROM public.api_latency_alert_settings s
    WHERE s.organization_id = v_rec.organization_id;

    v_pc      := COALESCE(v_pc, _p95_critical_ms);
    v_cons    := COALESCE(v_cons, _consecutive);
    v_cd      := COALESCE(v_cd, _cooldown_hours);
    v_enabled := COALESCE(v_enabled, true);

    IF NOT v_enabled THEN
      CONTINUE;
    END IF;

    -- Últimos N ciclos desta rota; todos precisam estar acima do limite
    SELECT count(*) FILTER (WHERE p95_ms >= GREATEST(v_pc, 1)),
           max(p95_ms)
      INTO v_recent, v_peak
    FROM (
      SELECT p95_ms
      FROM public.api_latency_snapshots
      WHERE organization_id = v_rec.organization_id AND path = v_rec.path
      ORDER BY captured_at DESC
      LIMIT GREATEST(v_cons, 1)
    ) s;

    IF v_recent < GREATEST(v_cons, 1) THEN
      CONTINUE;
    END IF;

    -- Respeita cooldown por rota
    SELECT max(created_at) INTO v_last
    FROM public.api_latency_alert_history
    WHERE organization_id = v_rec.organization_id AND path = v_rec.path;

    IF v_last IS NOT NULL AND v_last > now() - make_interval(hours => GREATEST(v_cd, 1)) THEN
      CONTINUE;
    END IF;

    v_notified := 0;
    FOR v_admin IN
      SELECT om.user_id
      FROM public.organization_members om
      WHERE om.organization_id = v_rec.organization_id AND om.role = 'admin'
    LOOP
      INSERT INTO public.notifications (user_id, type, title, message, metadata)
      VALUES (
        v_admin,
        'system',
        'Latência crítica de API',
        format('A rota "%s" está com p95 de %s ms há %s ciclos consecutivos (limite: %s ms). Investigação recomendada.',
               v_rec.path, round(v_peak), GREATEST(v_cons, 1), v_pc),
        jsonb_build_object(
          'kind', 'api_latency_critical',
          'organization_id', v_rec.organization_id,
          'path', v_rec.path,
          'p95_ms', v_peak,
          'p95_critical_ms', v_pc,
          'consecutive', GREATEST(v_cons, 1)
        )
      );
      v_notified := v_notified + 1;
      v_alerts := v_alerts + 1;
    END LOOP;

    INSERT INTO public.api_latency_alert_history (
      organization_id, path, p95_ms, p95_critical_ms, consecutive, admins_notified
    ) VALUES (
      v_rec.organization_id, v_rec.path, v_peak, v_pc, GREATEST(v_cons, 1), v_notified
    );
  END LOOP;

  RETURN v_alerts;
END;
$function$;

REVOKE ALL ON FUNCTION public.evaluate_api_latency_alerts(integer, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.evaluate_api_latency_alerts(integer, integer, integer) TO service_role;

-- 6) Poda de snapshots antigos (retenção 30 dias)
CREATE OR REPLACE FUNCTION public.prune_api_latency_snapshots()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_count integer := 0;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Acesso negado: requer papel de administrador';
  END IF;

  WITH del AS (
    DELETE FROM public.api_latency_snapshots
    WHERE captured_at < now() - interval '30 days'
    RETURNING 1
  )
  SELECT count(*) INTO v_count FROM del;
  RETURN v_count;
END;
$function$;

REVOKE ALL ON FUNCTION public.prune_api_latency_snapshots() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.prune_api_latency_snapshots() TO service_role;