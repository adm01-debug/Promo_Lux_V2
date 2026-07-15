
CREATE TABLE public.oracle_rate_limits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  window_start TIMESTAMPTZ NOT NULL DEFAULT date_trunc('hour', now()),
  action TEXT NOT NULL DEFAULT 'search_decisors',
  count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, action, window_start)
);

GRANT SELECT ON public.oracle_rate_limits TO authenticated;
GRANT ALL ON public.oracle_rate_limits TO service_role;

ALTER TABLE public.oracle_rate_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_members_view_rate_limits"
ON public.oracle_rate_limits FOR SELECT TO authenticated
USING (public.is_org_member(organization_id, auth.uid()));

CREATE POLICY "service_role_full_rate_limits"
ON public.oracle_rate_limits FOR ALL TO service_role
USING (true) WITH CHECK (true);

CREATE INDEX idx_oracle_rate_limits_window ON public.oracle_rate_limits(organization_id, window_start DESC);

CREATE OR REPLACE FUNCTION public.check_oracle_rate_limit(
  _organization_id UUID,
  _action TEXT DEFAULT 'search_decisors',
  _limit INTEGER DEFAULT 30
) RETURNS TABLE(allowed BOOLEAN, current_count INTEGER, reset_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_window TIMESTAMPTZ := date_trunc('hour', now());
  v_count INTEGER;
BEGIN
  IF _organization_id IS NULL THEN
    RAISE EXCEPTION 'organization_id é obrigatório';
  END IF;

  INSERT INTO public.oracle_rate_limits (organization_id, action, window_start, count)
  VALUES (_organization_id, _action, v_window, 1)
  ON CONFLICT (organization_id, action, window_start)
  DO UPDATE SET count = public.oracle_rate_limits.count + 1, updated_at = now()
  RETURNING count INTO v_count;

  RETURN QUERY SELECT (v_count <= _limit)::boolean, v_count, (v_window + interval '1 hour');
END;
$$;

REVOKE EXECUTE ON FUNCTION public.check_oracle_rate_limit(UUID, TEXT, INTEGER) FROM PUBLIC, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.check_oracle_rate_limit(UUID, TEXT, INTEGER) TO service_role;

CREATE TRIGGER trg_oracle_rate_limits_updated_at
BEFORE UPDATE ON public.oracle_rate_limits
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
