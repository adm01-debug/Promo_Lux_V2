-- ============================================================================
-- 1. Tabela de snapshots (histórico de checagens)
-- ============================================================================
CREATE TABLE public.vault_cookie_snapshots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  servico TEXT NOT NULL CHECK (servico IN ('lusha', 'leadcontact', 'linkedin')),
  is_healthy BOOLEAN,
  health_status TEXT,
  expires_at TIMESTAMPTZ,
  days_until_expiry INTEGER,
  vault_available BOOLEAN NOT NULL DEFAULT true,
  error_message TEXT,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.vault_cookie_snapshots TO authenticated;
GRANT ALL ON public.vault_cookie_snapshots TO service_role;
ALTER TABLE public.vault_cookie_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read vault snapshots"
  ON public.vault_cookie_snapshots FOR SELECT
  TO authenticated USING (true);

CREATE INDEX idx_vault_snapshots_servico_time
  ON public.vault_cookie_snapshots (servico, checked_at DESC);

-- ============================================================================
-- 2. Tabela de histórico de alertas
-- ============================================================================
CREATE TABLE public.vault_cookie_alert_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  servico TEXT NOT NULL CHECK (servico IN ('lusha', 'leadcontact', 'linkedin', 'vault')),
  severity TEXT NOT NULL CHECK (severity IN ('warning', 'critical')),
  reason TEXT NOT NULL,
  days_until_expiry INTEGER,
  triggered_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.vault_cookie_alert_history TO authenticated;
GRANT ALL ON public.vault_cookie_alert_history TO service_role;
ALTER TABLE public.vault_cookie_alert_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read vault alerts"
  ON public.vault_cookie_alert_history FOR SELECT
  TO authenticated USING (true);

CREATE INDEX idx_vault_alerts_servico_time
  ON public.vault_cookie_alert_history (servico, triggered_at DESC);

-- ============================================================================
-- 3. RPC: gravar snapshots (bulk)
-- payload = jsonb array [{servico, is_healthy, health_status, expires_at, vault_available, error_message}]
-- ============================================================================
CREATE OR REPLACE FUNCTION public.record_vault_cookie_snapshots(_payload jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inserted_count integer := 0;
BEGIN
  INSERT INTO public.vault_cookie_snapshots
    (servico, is_healthy, health_status, expires_at, days_until_expiry, vault_available, error_message)
  SELECT
    (item->>'servico')::text,
    NULLIF(item->>'is_healthy','')::boolean,
    NULLIF(item->>'health_status',''),
    NULLIF(item->>'expires_at','')::timestamptz,
    CASE
      WHEN NULLIF(item->>'expires_at','') IS NULL THEN NULL
      ELSE EXTRACT(day FROM (NULLIF(item->>'expires_at','')::timestamptz - now()))::integer
    END,
    COALESCE(NULLIF(item->>'vault_available','')::boolean, true),
    NULLIF(item->>'error_message','')
  FROM jsonb_array_elements(_payload) AS item;

  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  RETURN inserted_count;
END;
$$;

REVOKE ALL ON FUNCTION public.record_vault_cookie_snapshots(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_vault_cookie_snapshots(jsonb) TO service_role;

-- ============================================================================
-- 4. RPC: avaliar alertas
-- Regras:
--   - vault_available=false                        → critical, motivo "vault_unavailable"
--   - is_healthy=false                             → critical, motivo "unhealthy"
--   - expired (days_until_expiry <= 0)             → critical, motivo "expired"
--   - days_until_expiry <= 2                       → critical, motivo "expiring_critical"
--   - days_until_expiry <= 7                       → warning,  motivo "expiring_warning"
-- Cooldown: 24h por (servico, severity, reason)
-- Notifica: 1 notification por admin (has_role='admin')
-- ============================================================================
CREATE OR REPLACE FUNCTION public.evaluate_vault_cookie_alerts()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  triggered integer := 0;
  snap record;
  v_severity text;
  v_reason text;
  v_message text;
  v_cooldown interval := interval '24 hours';
BEGIN
  -- Iterar sobre o snapshot mais recente de cada serviço
  FOR snap IN
    SELECT DISTINCT ON (servico)
      servico, is_healthy, expires_at, days_until_expiry,
      vault_available, error_message, checked_at
    FROM public.vault_cookie_snapshots
    WHERE checked_at > now() - interval '2 hours'
    ORDER BY servico, checked_at DESC
  LOOP
    v_severity := NULL;
    v_reason := NULL;

    IF snap.vault_available IS FALSE THEN
      v_severity := 'critical';
      v_reason := 'vault_unavailable';
      v_message := format('Vault indisponível: %s', COALESCE(snap.error_message, 'sem detalhes'));
    ELSIF snap.is_healthy IS FALSE THEN
      v_severity := 'critical';
      v_reason := 'unhealthy';
      v_message := format('Cookie %s marcado como não saudável', snap.servico);
    ELSIF snap.days_until_expiry IS NOT NULL AND snap.days_until_expiry <= 0 THEN
      v_severity := 'critical';
      v_reason := 'expired';
      v_message := format('Cookie %s EXPIRADO', snap.servico);
    ELSIF snap.days_until_expiry IS NOT NULL AND snap.days_until_expiry <= 2 THEN
      v_severity := 'critical';
      v_reason := 'expiring_critical';
      v_message := format('Cookie %s expira em %s dia(s) — renovar imediatamente',
                          snap.servico, snap.days_until_expiry);
    ELSIF snap.days_until_expiry IS NOT NULL AND snap.days_until_expiry <= 7 THEN
      v_severity := 'warning';
      v_reason := 'expiring_warning';
      v_message := format('Cookie %s expira em %s dias', snap.servico, snap.days_until_expiry);
    END IF;

    IF v_severity IS NULL THEN
      CONTINUE;
    END IF;

    -- Cooldown: já disparou este (servico, severity, reason) nas últimas 24h?
    IF EXISTS (
      SELECT 1 FROM public.vault_cookie_alert_history
      WHERE servico = snap.servico
        AND severity = v_severity
        AND reason = v_reason
        AND triggered_at > now() - v_cooldown
    ) THEN
      CONTINUE;
    END IF;

    INSERT INTO public.vault_cookie_alert_history
      (servico, severity, reason, days_until_expiry)
    VALUES (snap.servico, v_severity, v_reason, snap.days_until_expiry);

    -- Notificar todos os admins
    INSERT INTO public.notifications (user_id, type, title, message, metadata, organization_id)
    SELECT
      ur.user_id,
      'system',
      format('[%s] Vault • %s', upper(v_severity), snap.servico),
      v_message,
      jsonb_build_object(
        'source', 'vault-cookie-health',
        'servico', snap.servico,
        'severity', v_severity,
        'reason', v_reason,
        'days_until_expiry', snap.days_until_expiry,
        'expires_at', snap.expires_at
      ),
      COALESCE(
        (SELECT om.organization_id FROM public.organization_members om
         WHERE om.user_id = ur.user_id LIMIT 1),
        public.default_org_for_current_user()
      )
    FROM public.user_roles ur
    WHERE ur.role = 'admin';

    triggered := triggered + 1;
  END LOOP;

  RETURN triggered;
END;
$$;

REVOKE ALL ON FUNCTION public.evaluate_vault_cookie_alerts() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.evaluate_vault_cookie_alerts() TO service_role;