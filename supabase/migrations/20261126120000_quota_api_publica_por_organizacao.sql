-- Etapa 039: a quota da API publica passa a ser da ORGANIZACAO, nao da chave.
--
-- Antes, public.authenticate_api_key contava em api_rate_limits por api_key_id,
-- entao um cliente com tres chaves ativas tinha 3 x 600 = 1800 req/h. O teto
-- comercial e 600 req/h por conta.
--
-- api_rate_limits continua sendo o contador POR CHAVE (historico e a policy de
-- leitura do dono da chave seguem valendo) e nao muda; a nova
-- api_org_rate_limits e a que decide liberacao/recusa. O caminho legado
-- check_api_key_rate_limit tambem fica intacto: ele so roda quando
-- authenticate_api_key nao existe no banco (instancia ainda sem esta migration).
--
-- api_keys.organization_id e NOT NULL nesta base, entao toda chave tem org e
-- nao existe caso "sem organizacao" para tratar.

CREATE TABLE IF NOT EXISTS public.api_org_rate_limits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  window_start TIMESTAMPTZ NOT NULL DEFAULT date_trunc('hour', now()),
  count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT api_org_rate_limits_window_key UNIQUE (organization_id, window_start)
);

-- O Supabase concede privilegios a anon/authenticated por default privileges em toda
-- tabela nova em public; sem policy eles nao veem linha, mas a tabela fica fechada de fato.
REVOKE ALL ON public.api_org_rate_limits FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.api_org_rate_limits TO service_role;

ALTER TABLE public.api_org_rate_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_full_api_org_rate_limits"
ON public.api_org_rate_limits FOR ALL TO service_role
USING (true) WITH CHECK (true);

CREATE TRIGGER trg_api_org_rate_limits_updated_at
BEFORE UPDATE ON public.api_org_rate_limits
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.authenticate_api_key(
  _key_hash TEXT,
  _limit INTEGER DEFAULT 600
) RETURNS TABLE(
  key_id UUID,
  user_id UUID,
  scopes TEXT[],
  prefix TEXT,
  organization_id UUID,
  allowed BOOLEAN,
  current_count INTEGER,
  reset_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_key RECORD;
  v_window TIMESTAMPTZ := date_trunc('hour', now());
  v_org_count INTEGER;
BEGIN
  SELECT k.id, k.user_id, k.scopes, k.prefix, k.organization_id
    INTO v_key
    FROM public.api_keys k
   WHERE k.key_hash = _key_hash
     AND k.active = true
     AND (k.expires_at IS NULL OR k.expires_at > now())
   LIMIT 1;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  UPDATE public.api_keys SET last_used_at = now() WHERE id = v_key.id;

  -- Contador por chave: mantido apenas como historico/telemetria por chave.
  INSERT INTO public.api_rate_limits (api_key_id, window_start, count)
  VALUES (v_key.id, v_window, 1)
  ON CONFLICT (api_key_id, window_start)
  DO UPDATE SET count = public.api_rate_limits.count + 1, updated_at = now();

  -- Contador que decide liberacao: a conta inteira, somando todas as chaves.
  INSERT INTO public.api_org_rate_limits (organization_id, window_start, count)
  VALUES (v_key.organization_id, v_window, 1)
  ON CONFLICT ON CONSTRAINT api_org_rate_limits_window_key
  DO UPDATE SET count = public.api_org_rate_limits.count + 1, updated_at = now()
  RETURNING count INTO v_org_count;

  RETURN QUERY SELECT
    v_key.id,
    v_key.user_id,
    v_key.scopes,
    v_key.prefix,
    v_key.organization_id,
    (v_org_count <= _limit)::boolean,
    v_org_count,
    (v_window + interval '1 hour');
END;
$$;

REVOKE EXECUTE ON FUNCTION public.authenticate_api_key(TEXT, INTEGER) FROM PUBLIC, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.authenticate_api_key(TEXT, INTEGER) TO service_role;