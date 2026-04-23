-- ============================================================
-- Org violation rate alerting
-- ============================================================
-- Detecta bursts de OrgMismatchError (potencialmente maliciosos) na
-- última hora e dispara alertas via webhooks. Componentes:
--   1. org_violation_alert_settings  → limites por organização
--   2. org_violation_alerts          → histórico de disparos (cooldown)
--   3. count_recent_org_violations() → agregação por org/janela
--   4. evaluate_org_violation_alerts() → produz lista de alertas a disparar
-- ============================================================

-- ---------- 1. Configurações por organização ----------
CREATE TABLE IF NOT EXISTS public.org_violation_alert_settings (
  organization_id uuid PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT true,
  -- Limite de eventos OrgMismatchError dentro da janela para acionar.
  threshold integer NOT NULL DEFAULT 10 CHECK (threshold >= 1),
  -- Janela de avaliação (em minutos). Default = 60 (última hora).
  window_minutes integer NOT NULL DEFAULT 60 CHECK (window_minutes BETWEEN 5 AND 1440),
  -- Cooldown entre alertas para a mesma org (evita spam quando o burst persiste).
  cooldown_minutes integer NOT NULL DEFAULT 30 CHECK (cooldown_minutes BETWEEN 1 AND 1440),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

ALTER TABLE public.org_violation_alert_settings ENABLE ROW LEVEL SECURITY;

-- Apenas admins da org podem ver/editar; service role (edge function) tem acesso total.
CREATE POLICY "Admins can read settings"
  ON public.org_violation_alert_settings FOR SELECT TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), 'admin'));

CREATE POLICY "Admins can upsert settings"
  ON public.org_violation_alert_settings FOR INSERT TO authenticated
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), 'admin'));

CREATE POLICY "Admins can update settings"
  ON public.org_violation_alert_settings FOR UPDATE TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), 'admin'))
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), 'admin'));

CREATE TRIGGER trg_org_violation_alert_settings_updated_at
  BEFORE UPDATE ON public.org_violation_alert_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------- 2. Histórico de alertas disparados ----------
CREATE TABLE IF NOT EXISTS public.org_violation_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  triggered_at timestamptz NOT NULL DEFAULT now(),
  window_minutes integer NOT NULL,
  threshold integer NOT NULL,
  violation_count integer NOT NULL,
  -- Quantos atores distintos contribuíram (heurística de multi-conta/scan).
  distinct_actors integer NOT NULL DEFAULT 0,
  -- Quantos correlation_ids distintos (heurística de multi-fluxo).
  distinct_correlations integer NOT NULL DEFAULT 0,
  -- Tabelas mais atingidas no burst (top 5).
  top_tables jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- Status de despacho aos webhooks (resumo).
  webhook_dispatch jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes text
);

CREATE INDEX IF NOT EXISTS idx_org_violation_alerts_org_time
  ON public.org_violation_alerts (organization_id, triggered_at DESC);

ALTER TABLE public.org_violation_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view alerts"
  ON public.org_violation_alerts FOR SELECT TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), 'admin'));

-- ---------- 3. Agregação ----------
-- Conta OrgMismatchError por organização dentro de uma janela em minutos.
-- Retorna estatísticas usadas pelo avaliador.
CREATE OR REPLACE FUNCTION public.count_recent_org_violations(_window_minutes integer DEFAULT 60)
RETURNS TABLE(
  organization_id uuid,
  violation_count bigint,
  distinct_actors bigint,
  distinct_correlations bigint,
  top_tables jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH base AS (
    SELECT
      al.organization_id,
      al.actor_id,
      (al.new_data ->> 'kind') AS kind,
      (al.new_data ->> 'table') AS tbl,
      (al.new_data ->> 'correlation_id') AS correlation_id
    FROM public.audit_logs al
    WHERE al.table_name = '__org_violation'
      AND al.created_at >= now() - make_interval(mins => _window_minutes)
      AND (al.new_data ->> 'kind') = 'OrgMismatchError'
      AND al.organization_id IS NOT NULL
  ),
  table_counts AS (
    SELECT organization_id, tbl, count(*) AS c
    FROM base WHERE tbl IS NOT NULL
    GROUP BY organization_id, tbl
  ),
  top_per_org AS (
    SELECT organization_id,
           jsonb_agg(jsonb_build_object('table', tbl, 'count', c) ORDER BY c DESC)
             FILTER (WHERE rn <= 5) AS top_tables
    FROM (
      SELECT organization_id, tbl, c,
             row_number() OVER (PARTITION BY organization_id ORDER BY c DESC) AS rn
      FROM table_counts
    ) t
    GROUP BY organization_id
  )
  SELECT
    b.organization_id,
    count(*)::bigint AS violation_count,
    count(DISTINCT b.actor_id)::bigint AS distinct_actors,
    count(DISTINCT b.correlation_id)::bigint AS distinct_correlations,
    COALESCE(tp.top_tables, '[]'::jsonb) AS top_tables
  FROM base b
  LEFT JOIN top_per_org tp ON tp.organization_id = b.organization_id
  GROUP BY b.organization_id, tp.top_tables;
$$;

-- ---------- 4. Avaliador ----------
-- Cruza contagens com settings + cooldown e devolve o que deve disparar.
-- A edge function consome este resultado e faz o despacho aos webhooks.
CREATE OR REPLACE FUNCTION public.evaluate_org_violation_alerts()
RETURNS TABLE(
  organization_id uuid,
  threshold integer,
  window_minutes integer,
  cooldown_minutes integer,
  violation_count bigint,
  distinct_actors bigint,
  distinct_correlations bigint,
  top_tables jsonb,
  last_alert_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH settings AS (
    -- Toda organização tem settings (default se não houver linha).
    SELECT
      o.id AS organization_id,
      COALESCE(s.threshold, 10) AS threshold,
      COALESCE(s.window_minutes, 60) AS window_minutes,
      COALESCE(s.cooldown_minutes, 30) AS cooldown_minutes,
      COALESCE(s.enabled, true) AS enabled
    FROM public.organizations o
    LEFT JOIN public.org_violation_alert_settings s ON s.organization_id = o.id
  ),
  -- Usa janela de 60 (consistente com alerts hora-a-hora). Para janelas
  -- distintas por org, a edge function pode chamar count_recent_... em
  -- modo per-org; aqui mantemos uma única passagem para eficiência.
  counts AS (
    SELECT * FROM public.count_recent_org_violations(60)
  ),
  last_alerts AS (
    SELECT organization_id, max(triggered_at) AS last_alert_at
    FROM public.org_violation_alerts
    GROUP BY organization_id
  )
  SELECT
    s.organization_id,
    s.threshold,
    s.window_minutes,
    s.cooldown_minutes,
    c.violation_count,
    c.distinct_actors,
    c.distinct_correlations,
    c.top_tables,
    la.last_alert_at
  FROM settings s
  JOIN counts c ON c.organization_id = s.organization_id
  LEFT JOIN last_alerts la ON la.organization_id = s.organization_id
  WHERE s.enabled = true
    AND c.violation_count >= s.threshold
    AND (
      la.last_alert_at IS NULL
      OR la.last_alert_at < now() - make_interval(mins => s.cooldown_minutes)
    );
$$;

-- ---------- Adiciona evento ao registro de webhooks ----------
COMMENT ON TABLE public.org_violation_alerts IS
  'Histórico de alertas de taxa de OrgMismatchError. Evento webhook: security.org_violation_threshold';