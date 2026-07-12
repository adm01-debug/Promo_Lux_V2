-- Melhoria #13: Histórico persistido de alertas da DLQ por organização.

CREATE TABLE public.dlq_alert_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  triggered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  pending_items BIGINT NOT NULL,
  pending_critical INTEGER NOT NULL,
  consecutive INTEGER NOT NULL,
  admins_notified INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_dlq_alert_history_org_time
  ON public.dlq_alert_history (organization_id, triggered_at DESC);

GRANT SELECT ON public.dlq_alert_history TO authenticated;
GRANT ALL ON public.dlq_alert_history TO service_role;

ALTER TABLE public.dlq_alert_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can read DLQ alert history"
  ON public.dlq_alert_history FOR SELECT
  TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));

-- Registra o histórico a cada disparo de alerta.
CREATE OR REPLACE FUNCTION public.evaluate_dlq_alerts(
  _pending_critical integer DEFAULT 100,
  _consecutive integer DEFAULT 3,
  _cooldown_hours integer DEFAULT 6
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_org       uuid;
  v_pc        integer;
  v_cons      integer;
  v_cd        integer;
  v_enabled   boolean;
  v_recent    integer;
  v_pending   bigint;
  v_last      timestamptz;
  v_admin     uuid;
  v_notified  integer;
  v_alerts    integer := 0;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Acesso negado: requer papel de administrador';
  END IF;

  FOR v_org IN
    SELECT DISTINCT organization_id
    FROM public.dlq_health_snapshots
    WHERE captured_at >= now() - interval '24 hours'
  LOOP
    SELECT s.pending_critical, s.consecutive, s.cooldown_hours, s.enabled
      INTO v_pc, v_cons, v_cd, v_enabled
    FROM public.dlq_alert_settings s
    WHERE s.organization_id = v_org;

    v_pc      := COALESCE(v_pc, _pending_critical);
    v_cons    := COALESCE(v_cons, _consecutive);
    v_cd      := COALESCE(v_cd, _cooldown_hours);
    v_enabled := COALESCE(v_enabled, true);

    IF NOT v_enabled THEN
      CONTINUE;
    END IF;

    SELECT count(*) FILTER (WHERE pending_items >= GREATEST(v_pc, 1)),
           max(pending_items)
      INTO v_recent, v_pending
    FROM (
      SELECT pending_items
      FROM public.dlq_health_snapshots
      WHERE organization_id = v_org
      ORDER BY captured_at DESC
      LIMIT GREATEST(v_cons, 1)
    ) s;

    IF v_recent < GREATEST(v_cons, 1) THEN
      CONTINUE;
    END IF;

    SELECT max(created_at) INTO v_last
    FROM public.notifications
    WHERE type = 'system'
      AND metadata ->> 'kind' = 'dlq_critical'
      AND (metadata ->> 'organization_id')::uuid = v_org;

    IF v_last IS NOT NULL AND v_last > now() - make_interval(hours => GREATEST(v_cd, 1)) THEN
      CONTINUE;
    END IF;

    v_notified := 0;
    FOR v_admin IN
      SELECT om.user_id
      FROM public.organization_members om
      WHERE om.organization_id = v_org AND om.role = 'admin'
    LOOP
      INSERT INTO public.notifications (user_id, type, title, message, metadata)
      VALUES (
        v_admin,
        'system',
        'DLQ em nível crítico',
        format('A fila de falhas definitivas está com %s itens pendentes há vários ciclos. Reprocessamento ou investigação recomendados.', v_pending),
        jsonb_build_object(
          'kind', 'dlq_critical',
          'organization_id', v_org,
          'pending_items', v_pending,
          'consecutive', GREATEST(v_cons, 1)
        )
      );
      v_notified := v_notified + 1;
      v_alerts := v_alerts + 1;
    END LOOP;

    -- Grava o histórico do disparo (mesmo sem admins, para auditoria).
    INSERT INTO public.dlq_alert_history (
      organization_id, pending_items, pending_critical, consecutive, admins_notified
    ) VALUES (
      v_org, v_pending, v_pc, GREATEST(v_cons, 1), v_notified
    );
  END LOOP;

  RETURN v_alerts;
END;
$$;