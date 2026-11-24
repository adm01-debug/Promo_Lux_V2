-- Login da API publica em UM round-trip ao PostgREST.
--
-- Antes, cada request de /public-api fazia 4 chamadas HTTP separadas ao
-- PostgREST: verify_api_key (valida a chave) -> touch_api_key (UPDATE do
-- last_used_at) -> check_api_key_rate_limit (UPSERT do contador da janela) ->
-- SELECT em api_keys (prefix + organization_id para o log). Medido em producao
-- em 24/11/2026, cada round-trip custa ~130-150 ms dentro da edge function:
-- o piso de latencia observado era ~1,3 s por request, com p95 de 2,4-2,7 s
-- contra o limite critico de 1,5 s dos alertas de latencia.
--
-- Esta funcao faz as quatro coisas numa unica chamada e devolve os metadados
-- que a edge function precisa. As tres funcoes originais permanecem intactas
-- (rollback = voltar a chamar verify_api_key/touch_api_key/check_api_key_rate_limit).
--
-- Regras preservadas exatamente como estavam:
--   * chave valida = key_hash + active=true + (expires_at IS NULL OR > now())
--   * touch de last_used_at e best-effort (so a data)
--   * janela de rate limit fixa de 1 hora, UPSERT atomico em api_rate_limits
--   * zero linhas para chave invalida (mesmo contrato de verify_api_key)

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
  v_count INTEGER;
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

  INSERT INTO public.api_rate_limits (api_key_id, window_start, count)
  VALUES (v_key.id, v_window, 1)
  ON CONFLICT (api_key_id, window_start)
  DO UPDATE SET count = public.api_rate_limits.count + 1, updated_at = now()
  RETURNING count INTO v_count;

  RETURN QUERY SELECT
    v_key.id,
    v_key.user_id,
    v_key.scopes,
    v_key.prefix,
    v_key.organization_id,
    (v_count <= _limit)::boolean,
    v_count,
    (v_window + interval '1 hour');
END;
$$;

REVOKE EXECUTE ON FUNCTION public.authenticate_api_key(TEXT, INTEGER) FROM PUBLIC, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.authenticate_api_key(TEXT, INTEGER) TO service_role;