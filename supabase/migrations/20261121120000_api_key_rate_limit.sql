-- Rate limit server-side por API key (public-api).
-- Espelha o padrão do oracle_rate_limits (janela fixa 1h, atomic ON CONFLICT).
CREATE TABLE public.api_rate_limits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  api_key_id UUID NOT NULL REFERENCES public.api_keys(id) ON DELETE CASCADE,
  window_start TIMESTAMPTZ NOT NULL DEFAULT date_trunc('hour', now()),
  count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (api_key_id, window_start)
);

GRANT SELECT ON public.api_rate_limits TO authenticated;
GRANT ALL ON public.api_rate_limits TO service_role;

ALTER TABLE public.api_rate_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_view_own_api_rate_limits"
ON public.api_rate_limits FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.api_keys k
  WHERE k.id = api_rate_limits.api_key_id AND k.user_id = auth.uid()
));

CREATE POLICY "service_role_full_api_rate_limits"
ON public.api_rate_limits FOR ALL TO service_role
USING (true) WITH CHECK (true);

CREATE INDEX idx_api_rate_limits_window ON public.api_rate_limits(api_key_id, window_start DESC);

CREATE OR REPLACE FUNCTION public.check_api_key_rate_limit(
  _api_key_id UUID,
  _limit INTEGER DEFAULT 100
) RETURNS TABLE(allowed BOOLEAN, current_count INTEGER, reset_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_window TIMESTAMPTZ := date_trunc('hour', now());
  v_count INTEGER;
BEGIN
  IF _api_key_id IS NULL THEN
    RAISE EXCEPTION 'api_key_id é obrigatório';
  END IF;

  INSERT INTO public.api_rate_limits (api_key_id, window_start, count)
  VALUES (_api_key_id, v_window, 1)
  ON CONFLICT (api_key_id, window_start)
  DO UPDATE SET count = public.api_rate_limits.count + 1, updated_at = now()
  RETURNING count INTO v_count;

  RETURN QUERY SELECT (v_count <= _limit)::boolean, v_count, (v_window + interval '1 hour');
END;
$$;

REVOKE EXECUTE ON FUNCTION public.check_api_key_rate_limit(UUID, INTEGER) FROM PUBLIC, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.check_api_key_rate_limit(UUID, INTEGER) TO service_role;

CREATE TRIGGER trg_api_rate_limits_updated_at
BEFORE UPDATE ON public.api_rate_limits
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
