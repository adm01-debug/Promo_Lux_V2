-- Melhoria #7: Tendência histórica da Dead-Letter Queue (snapshots + leitura)

CREATE TABLE public.dlq_health_snapshots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  total_items BIGINT NOT NULL DEFAULT 0,
  pending_items BIGINT NOT NULL DEFAULT 0,
  replayed_items BIGINT NOT NULL DEFAULT 0,
  oldest_pending_age_secs NUMERIC NOT NULL DEFAULT 0
);

CREATE INDEX idx_dlq_snapshots_org_time
  ON public.dlq_health_snapshots (organization_id, captured_at DESC);

GRANT SELECT ON public.dlq_health_snapshots TO authenticated;
GRANT ALL ON public.dlq_health_snapshots TO service_role;

ALTER TABLE public.dlq_health_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can read DLQ snapshots"
  ON public.dlq_health_snapshots FOR SELECT
  TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));

-- Captura um snapshot por organização (chamada pelo cron / service_role).
CREATE OR REPLACE FUNCTION public.capture_dlq_health_snapshots()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_count integer := 0;
BEGIN
  -- service_role (auth.uid() NULL) passa; caso contrário exige papel admin.
  IF auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Acesso negado: requer papel de administrador';
  END IF;

  INSERT INTO public.dlq_health_snapshots (
    organization_id, total_items, pending_items, replayed_items, oldest_pending_age_secs
  )
  SELECT
    d.organization_id,
    count(*)::bigint,
    count(*) FILTER (WHERE d.replayed_at IS NULL)::bigint,
    count(*) FILTER (WHERE d.replayed_at IS NOT NULL)::bigint,
    COALESCE(
      EXTRACT(EPOCH FROM (now() - min(d.failed_at) FILTER (WHERE d.replayed_at IS NULL))),
      0
    )::numeric
  FROM public.scrape_dead_letter d
  GROUP BY d.organization_id;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- Retenção: mantém apenas 30 dias de tendência.
CREATE OR REPLACE FUNCTION public.prune_dlq_health_snapshots()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_count integer := 0;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Acesso negado: requer papel de administrador';
  END IF;

  WITH del AS (
    DELETE FROM public.dlq_health_snapshots
    WHERE captured_at < now() - interval '30 days'
    RETURNING 1
  )
  SELECT count(*) INTO v_count FROM del;
  RETURN v_count;
END;
$$;

-- Leitura da tendência escopada por organização do usuário autenticado.
CREATE OR REPLACE FUNCTION public.dlq_health_trend(_hours integer DEFAULT 48)
RETURNS TABLE(
  captured_at timestamptz,
  pending_items bigint,
  total_items bigint,
  replayed_items bigint,
  oldest_pending_age_secs numeric
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT s.captured_at, s.pending_items, s.total_items, s.replayed_items, s.oldest_pending_age_secs
  FROM public.dlq_health_snapshots s
  WHERE auth.uid() IS NOT NULL
    AND public.is_org_member(s.organization_id, auth.uid())
    AND s.captured_at >= now() - make_interval(hours => GREATEST(_hours, 1))
  ORDER BY s.captured_at ASC;
$$;