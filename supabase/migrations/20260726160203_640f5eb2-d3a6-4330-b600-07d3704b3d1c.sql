CREATE TABLE IF NOT EXISTS public.sla_autotune_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  queue_kind text NOT NULL,
  old_sla_seconds integer,
  new_sla_seconds integer,
  applied boolean NOT NULL DEFAULT false,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.sla_autotune_runs TO authenticated;
GRANT ALL ON public.sla_autotune_runs TO service_role;

ALTER TABLE public.sla_autotune_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sla_autotune_runs_admin_select" ON public.sla_autotune_runs
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_sla_autotune_runs_kind_created
  ON public.sla_autotune_runs (queue_kind, created_at DESC);

CREATE OR REPLACE FUNCTION public.sla_autotune_blocked_streaks()
RETURNS TABLE (
  queue_kind text,
  blocked_runs integer,
  blocked_days numeric,
  first_blocked_at timestamptz,
  last_reason text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
  WITH ordered AS (
    SELECT r.queue_kind, r.reason, r.created_at,
           ROW_NUMBER() OVER (PARTITION BY r.queue_kind ORDER BY r.created_at DESC) AS rn
      FROM public.sla_autotune_runs r
  ),
  streak AS (
    SELECT o.queue_kind, o.reason, o.created_at, o.rn
      FROM ordered o
     WHERE o.rn <= COALESCE((
             SELECT MIN(x.rn) - 1
               FROM ordered x
              WHERE x.queue_kind = o.queue_kind
                AND x.reason IS DISTINCT FROM 'insufficient_data'
           ), (SELECT MAX(y.rn) FROM ordered y WHERE y.queue_kind = o.queue_kind))
       AND o.reason = 'insufficient_data'
  )
  SELECT s.queue_kind,
         COUNT(*)::integer AS blocked_runs,
         ROUND(EXTRACT(EPOCH FROM (now() - MIN(s.created_at))) / 86400.0, 2) AS blocked_days,
         MIN(s.created_at) AS first_blocked_at,
         'insufficient_data'::text AS last_reason
    FROM streak s
   GROUP BY s.queue_kind
   ORDER BY blocked_runs DESC;
END;
$$;