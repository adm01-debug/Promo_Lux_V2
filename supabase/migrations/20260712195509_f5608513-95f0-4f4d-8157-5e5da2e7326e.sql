-- Melhoria #8: Alerta automático quando a DLQ fica crítica por N snapshots seguidos.

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
  v_org      uuid;
  v_recent   integer;
  v_pending  bigint;
  v_last     timestamptz;
  v_admin    uuid;
  v_alerts   integer := 0;
BEGIN
  -- service_role (auth.uid() NULL) passa; caso contrário exige papel admin.
  IF auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Acesso negado: requer papel de administrador';
  END IF;

  -- Avalia cada organização que possui snapshots recentes.
  FOR v_org IN
    SELECT DISTINCT organization_id
    FROM public.dlq_health_snapshots
    WHERE captured_at >= now() - interval '24 hours'
  LOOP
    -- Quantos dos últimos N snapshots estão em nível crítico.
    SELECT count(*) FILTER (WHERE pending_items >= GREATEST(_pending_critical, 1)),
           max(pending_items)
      INTO v_recent, v_pending
    FROM (
      SELECT pending_items
      FROM public.dlq_health_snapshots
      WHERE organization_id = v_org
      ORDER BY captured_at DESC
      LIMIT GREATEST(_consecutive, 1)
    ) s;

    -- Só alerta se TODOS os últimos N snapshots forem críticos.
    IF v_recent < GREATEST(_consecutive, 1) THEN
      CONTINUE;
    END IF;

    -- Respeita cooldown: última notificação de DLQ crítica desta org.
    SELECT max(created_at) INTO v_last
    FROM public.notifications
    WHERE type = 'system'
      AND metadata ->> 'kind' = 'dlq_critical'
      AND (metadata ->> 'organization_id')::uuid = v_org;

    IF v_last IS NOT NULL AND v_last > now() - make_interval(hours => GREATEST(_cooldown_hours, 1)) THEN
      CONTINUE;
    END IF;

    -- Notifica todos os administradores da organização.
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
          'consecutive', GREATEST(_consecutive, 1)
        )
      );
      v_alerts := v_alerts + 1;
    END LOOP;
  END LOOP;

  RETURN v_alerts;
END;
$$;