
-- Passo 1: contador de consumo Places API (New) por organização/mês
CREATE TABLE IF NOT EXISTS public.places_api_usage (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  month DATE NOT NULL, -- primeiro dia do mês (YYYY-MM-01)
  calls_essentials INTEGER NOT NULL DEFAULT 0,
  calls_pro INTEGER NOT NULL DEFAULT 0,
  calls_enterprise INTEGER NOT NULL DEFAULT 0,
  estimated_cost_usd NUMERIC(10,4) NOT NULL DEFAULT 0,
  last_call_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, month)
);

CREATE INDEX IF NOT EXISTS places_api_usage_org_month_idx
  ON public.places_api_usage (organization_id, month DESC);

GRANT SELECT ON public.places_api_usage TO authenticated;
GRANT ALL ON public.places_api_usage TO service_role;

ALTER TABLE public.places_api_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can read org places usage"
  ON public.places_api_usage FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));

CREATE TRIGGER trg_places_api_usage_updated_at
  BEFORE UPDATE ON public.places_api_usage
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Função para incrementar consumo (chamada pelo edge function via service_role)
CREATE OR REPLACE FUNCTION public.record_places_api_call(
  _organization_id UUID,
  _tier TEXT,               -- 'essentials' | 'pro' | 'enterprise'
  _calls INTEGER DEFAULT 1
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_month DATE := date_trunc('month', now())::date;
  v_cost_per_1k NUMERIC;
BEGIN
  IF _organization_id IS NULL OR _tier NOT IN ('essentials','pro','enterprise') THEN
    RAISE EXCEPTION 'params inválidos';
  END IF;

  v_cost_per_1k := CASE _tier
    WHEN 'essentials' THEN 32.0
    WHEN 'pro'        THEN 40.0
    WHEN 'enterprise' THEN 50.0
  END;

  INSERT INTO public.places_api_usage AS u
    (organization_id, month, calls_essentials, calls_pro, calls_enterprise, estimated_cost_usd, last_call_at)
  VALUES (
    _organization_id, v_month,
    CASE WHEN _tier = 'essentials' THEN _calls ELSE 0 END,
    CASE WHEN _tier = 'pro'        THEN _calls ELSE 0 END,
    CASE WHEN _tier = 'enterprise' THEN _calls ELSE 0 END,
    (_calls::numeric / 1000.0) * v_cost_per_1k,
    now()
  )
  ON CONFLICT (organization_id, month) DO UPDATE
    SET calls_essentials  = u.calls_essentials + EXCLUDED.calls_essentials,
        calls_pro         = u.calls_pro + EXCLUDED.calls_pro,
        calls_enterprise  = u.calls_enterprise + EXCLUDED.calls_enterprise,
        estimated_cost_usd = u.estimated_cost_usd + EXCLUDED.estimated_cost_usd,
        last_call_at      = now(),
        updated_at        = now();
END;
$$;

REVOKE ALL ON FUNCTION public.record_places_api_call(UUID, TEXT, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_places_api_call(UUID, TEXT, INTEGER) TO service_role;
