-- Melhoria #9: Configuração de thresholds de alerta da DLQ por organização.

CREATE TABLE public.dlq_alert_settings (
  organization_id UUID NOT NULL PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  pending_critical INTEGER NOT NULL DEFAULT 100,
  consecutive INTEGER NOT NULL DEFAULT 3,
  cooldown_hours INTEGER NOT NULL DEFAULT 6,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Guarda-corpos de sanidade dos limites via trigger (evita CHECK imutável).
CREATE OR REPLACE FUNCTION public.validate_dlq_alert_settings()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.pending_critical < 1 THEN
    RAISE EXCEPTION 'pending_critical deve ser >= 1';
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
$$;

CREATE TRIGGER trg_validate_dlq_alert_settings
  BEFORE INSERT OR UPDATE ON public.dlq_alert_settings
  FOR EACH ROW EXECUTE FUNCTION public.validate_dlq_alert_settings();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.dlq_alert_settings TO authenticated;
GRANT ALL ON public.dlq_alert_settings TO service_role;

ALTER TABLE public.dlq_alert_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can read DLQ alert settings"
  ON public.dlq_alert_settings FOR SELECT
  TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));

CREATE POLICY "Org admins can insert DLQ alert settings"
  ON public.dlq_alert_settings FOR INSERT
  TO authenticated
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), 'admin'));

CREATE POLICY "Org admins can update DLQ alert settings"
  ON public.dlq_alert_settings FOR UPDATE
  TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), 'admin'))
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), 'admin'));

CREATE POLICY "Org admins can delete DLQ alert settings"
  ON public.dlq_alert_settings FOR DELETE
  TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), 'admin'));

-- A avaliação de alertas passa a respeitar a configuração por organização.
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
    -- Configuração por org (fallback para os parâmetros/padrões).
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
      v_alerts := v_alerts + 1;
    END LOOP;
  END LOOP;

  RETURN v_alerts;
END;
$$;