
-- ============================================================
-- 1. circuit_breaker_snapshots — histórico de estado
-- ============================================================
CREATE TABLE IF NOT EXISTS public.circuit_breaker_snapshots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  service_name TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('closed','open','half-open')),
  failure_count INTEGER NOT NULL DEFAULT 0,
  threshold INTEGER NOT NULL,
  opened_at TIMESTAMPTZ,
  last_failure_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_cb_snapshots_captured
  ON public.circuit_breaker_snapshots (captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_cb_snapshots_service_captured
  ON public.circuit_breaker_snapshots (service_name, captured_at DESC);

GRANT SELECT ON public.circuit_breaker_snapshots TO authenticated;
GRANT ALL ON public.circuit_breaker_snapshots TO service_role;

ALTER TABLE public.circuit_breaker_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Snapshots visíveis a autenticados"
  ON public.circuit_breaker_snapshots FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service role gerencia snapshots"
  ON public.circuit_breaker_snapshots FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

-- ============================================================
-- 2. circuit_breaker_alert_settings — singleton global
-- ============================================================
CREATE TABLE IF NOT EXISTS public.circuit_breaker_alert_settings (
  id BOOLEAN NOT NULL DEFAULT true PRIMARY KEY, -- forces single row (only 'true' allowed)
  enabled BOOLEAN NOT NULL DEFAULT true,
  alert_on_open BOOLEAN NOT NULL DEFAULT true,
  failure_count_threshold INTEGER NOT NULL DEFAULT 3 CHECK (failure_count_threshold >= 1),
  cooldown_minutes INTEGER NOT NULL DEFAULT 30 CHECK (cooldown_minutes >= 1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (id = true)
);

GRANT SELECT ON public.circuit_breaker_alert_settings TO authenticated;
GRANT ALL ON public.circuit_breaker_alert_settings TO service_role;

ALTER TABLE public.circuit_breaker_alert_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins leem settings"
  ON public.circuit_breaker_alert_settings FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins alteram settings"
  ON public.circuit_breaker_alert_settings FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role gerencia settings"
  ON public.circuit_breaker_alert_settings FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

INSERT INTO public.circuit_breaker_alert_settings (id)
VALUES (true)
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.circuit_breaker_settings_touch()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cb_settings_touch ON public.circuit_breaker_alert_settings;
CREATE TRIGGER trg_cb_settings_touch
  BEFORE UPDATE ON public.circuit_breaker_alert_settings
  FOR EACH ROW EXECUTE FUNCTION public.circuit_breaker_settings_touch();

-- ============================================================
-- 3. circuit_breaker_alert_history
-- ============================================================
CREATE TABLE IF NOT EXISTS public.circuit_breaker_alert_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  triggered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  service_name TEXT NOT NULL,
  state TEXT NOT NULL,
  failure_count INTEGER NOT NULL,
  reason TEXT NOT NULL, -- 'opened' | 'threshold'
  admins_notified INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_cb_alert_history_triggered
  ON public.circuit_breaker_alert_history (triggered_at DESC);
CREATE INDEX IF NOT EXISTS idx_cb_alert_history_service
  ON public.circuit_breaker_alert_history (service_name, triggered_at DESC);

GRANT SELECT ON public.circuit_breaker_alert_history TO authenticated;
GRANT ALL ON public.circuit_breaker_alert_history TO service_role;

ALTER TABLE public.circuit_breaker_alert_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins leem histórico"
  ON public.circuit_breaker_alert_history FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role gerencia histórico"
  ON public.circuit_breaker_alert_history FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

-- ============================================================
-- 4. RPC: capture snapshots (chamada pela edge function)
-- ============================================================
CREATE OR REPLACE FUNCTION public.capture_circuit_breaker_snapshots()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Acesso negado: requer papel de administrador';
  END IF;

  INSERT INTO public.circuit_breaker_snapshots
    (service_name, state, failure_count, threshold, opened_at, last_failure_at)
  SELECT service_name, state, COALESCE(failure_count, 0), COALESCE(threshold, 5),
         opened_at, last_failure_at
  FROM public.circuit_breakers;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.capture_circuit_breaker_snapshots() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.capture_circuit_breaker_snapshots() TO authenticated, service_role;

-- ============================================================
-- 5. RPC: evaluate alerts + notify admins
-- ============================================================
CREATE OR REPLACE FUNCTION public.evaluate_circuit_breaker_alerts()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_enabled       boolean;
  v_alert_open    boolean;
  v_fc_threshold  integer;
  v_cooldown      integer;
  v_breaker       record;
  v_last_alert    timestamptz;
  v_reason        text;
  v_admin         record;
  v_alerts        integer := 0;
  v_notified      integer;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Acesso negado: requer papel de administrador';
  END IF;

  SELECT enabled, alert_on_open, failure_count_threshold, cooldown_minutes
    INTO v_enabled, v_alert_open, v_fc_threshold, v_cooldown
  FROM public.circuit_breaker_alert_settings
  WHERE id = true;

  IF NOT COALESCE(v_enabled, true) THEN
    RETURN 0;
  END IF;

  v_alert_open   := COALESCE(v_alert_open, true);
  v_fc_threshold := COALESCE(v_fc_threshold, 3);
  v_cooldown     := COALESCE(v_cooldown, 30);

  FOR v_breaker IN
    SELECT service_name, state, COALESCE(failure_count, 0) AS failure_count
    FROM public.circuit_breakers
  LOOP
    v_reason := NULL;

    IF v_alert_open AND v_breaker.state IN ('open', 'half-open') THEN
      v_reason := CASE v_breaker.state
        WHEN 'open' THEN 'opened'
        ELSE 'half-open'
      END;
    ELSIF v_breaker.failure_count >= v_fc_threshold THEN
      v_reason := 'threshold';
    END IF;

    IF v_reason IS NULL THEN CONTINUE; END IF;

    -- Cooldown por serviço
    SELECT max(triggered_at) INTO v_last_alert
    FROM public.circuit_breaker_alert_history
    WHERE service_name = v_breaker.service_name;

    IF v_last_alert IS NOT NULL
       AND v_last_alert > now() - make_interval(mins => v_cooldown) THEN
      CONTINUE;
    END IF;

    v_notified := 0;
    FOR v_admin IN
      SELECT ur.user_id
      FROM public.user_roles ur
      WHERE ur.role = 'admin'
    LOOP
      INSERT INTO public.notifications (type, title, message, metadata, user_id)
      VALUES (
        'system',
        'Disjuntor: ' || v_breaker.service_name,
        CASE v_reason
          WHEN 'opened'    THEN 'O disjuntor do serviço ' || v_breaker.service_name || ' foi ABERTO após ' || v_breaker.failure_count || ' falhas consecutivas.'
          WHEN 'half-open' THEN 'O disjuntor do serviço ' || v_breaker.service_name || ' está em MEIO-ABERTO (sonda de recuperação em curso).'
          ELSE                  'O serviço ' || v_breaker.service_name || ' acumulou ' || v_breaker.failure_count || ' falhas (limiar: ' || v_fc_threshold || ').'
        END,
        jsonb_build_object(
          'service_name', v_breaker.service_name,
          'state', v_breaker.state,
          'failure_count', v_breaker.failure_count,
          'reason', v_reason
        ),
        v_admin.user_id
      );
      v_notified := v_notified + 1;
    END LOOP;

    INSERT INTO public.circuit_breaker_alert_history
      (service_name, state, failure_count, reason, admins_notified)
    VALUES
      (v_breaker.service_name, v_breaker.state, v_breaker.failure_count, v_reason, v_notified);

    v_alerts := v_alerts + 1;
  END LOOP;

  RETURN v_alerts;
END;
$$;

REVOKE ALL ON FUNCTION public.evaluate_circuit_breaker_alerts() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.evaluate_circuit_breaker_alerts() TO authenticated, service_role;
