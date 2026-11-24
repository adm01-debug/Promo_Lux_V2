-- ---------------------------------------------------------------------------
-- GET lista de companies/deals/stakeholders em UM round-trip
-- ---------------------------------------------------------------------------
-- Mesma causa raiz da 20261124220000 (que resolveu /me e /events): cada request
-- pagava DOIS round-trips ao PostgREST - um para authenticate_api_key e outro
-- para o select em si - a ~130-150 ms cada (medido em producao em 24/11/2026).
-- /me e /events ja fecham em um; estes tres endpoints ficaram para tras, e sao
-- justamente os que mais estouram o limite de 1500 ms do alerta de p95:
--
--   resource      requests    p50    p95
--   companies           50    406   1555
--   deals               31    705   1582
--   stakeholders        20    408   1268
--   (api_request_logs, 24h ate 24/11/2026 17:20 UTC)
--
-- Depois da 20261124220000, medido no mesmo minuto com 18 requisicoes reais:
-- /me 190-195 ms e /events 186-215 ms contra 389-397 ms de /companies, que
-- continuou em dois round-trips. Esta funcao fecha essa diferenca.
--
-- Contrato preservado, identico ao do handler GET lista de hoje:
--   * authenticate_api_key continua sendo a unica autoridade de 401/429 e de
--     quota (esta funcao so repassa o status que ela devolveu)
--   * escopo por user_id (nao por organization_id) - e o que o endpoint faz
--   * ILIKE '%valor%' em name e sector, aplicados SO quando o parametro vem na
--     query string: deals e stakeholders nao tem essas colunas, e passar o
--     filtro nelas continua sendo erro, como era no PostgREST
--   * ORDER BY created_at DESC com a mesma janela de LIMIT/OFFSET que o header
--     Range do PostgREST usava, e total = count(*) do conjunto filtrado (o
--     mesmo numero do count=exact)
--   * retorno em json (e nao jsonb): json preserva a ordem das chaves, a mesma
--     que o select * do PostgREST devolve; jsonb reordenaria as chaves de cada
--     linha, como ja acontece nas RPCs da 20261124220000
--   * TimeZone fixado em UTC pelo mesmo motivo da 20261124220000 - json_agg
--     serializa timestamptz com o TimeZone da sessao
--   * execute revogado de PUBLIC/anon/authenticated e concedido so para
--     service_role: a edge function e a unica chamadora
--
-- O nome da tabela so entra depois de validado contra a allowlist e e
-- interpolado com format('%I'); os valores entram com format('%L').
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.public_api_list(
  _key_hash TEXT,
  _table_name TEXT,
  _limit INTEGER DEFAULT 50,
  _offset INTEGER DEFAULT 0,
  _name TEXT DEFAULT NULL,
  _sector TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auth   RECORD;
  v_limit  INTEGER := greatest(coalesce(_limit, 50), 1);
  v_offset INTEGER := greatest(coalesce(_offset, 0), 0);
  v_where  TEXT;
  v_items  JSON;
  v_total  BIGINT;
BEGIN
  PERFORM set_config('TimeZone', 'UTC', true);

  IF _table_name IS NULL
     OR _table_name NOT IN ('companies', 'deals', 'stakeholders') THEN
    RAISE EXCEPTION 'recurso nao permitido na API publica: %', _table_name;
  END IF;

  SELECT * INTO v_auth FROM public.authenticate_api_key(_key_hash, 600);

  IF v_auth.key_id IS NULL THEN
    RETURN json_build_object('status', 401);
  END IF;

  IF v_auth.allowed IS NOT TRUE THEN
    RETURN json_build_object(
      'status', 429,
      'current_count', v_auth.current_count,
      'reset_at', v_auth.reset_at
    );
  END IF;

  v_where := format('t.user_id = %L', v_auth.user_id);

  IF _name IS NOT NULL THEN
    v_where := v_where || format(' AND t.name ILIKE %L', '%' || _name || '%');
  END IF;

  IF _sector IS NOT NULL THEN
    v_where := v_where || format(' AND t.sector ILIKE %L', '%' || _sector || '%');
  END IF;

  EXECUTE format('SELECT count(*) FROM public.%I t WHERE %s', _table_name, v_where)
     INTO v_total;

  EXECUTE format(
    'SELECT coalesce(json_agg(t), ''[]''::json) FROM ('
    || ' SELECT * FROM public.%I t WHERE %s'
    || ' ORDER BY t.created_at DESC LIMIT %s OFFSET %s'
    || ') t',
    _table_name, v_where, v_limit, v_offset
  ) INTO v_items;

  RETURN json_build_object(
    'status', 200,
    'items', v_items,
    'total', v_total,
    'key_id', v_auth.key_id,
    'user_id', v_auth.user_id,
    'prefix', v_auth.prefix,
    'organization_id', v_auth.organization_id
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.public_api_list(TEXT, TEXT, INTEGER, INTEGER, TEXT, TEXT) FROM PUBLIC, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.public_api_list(TEXT, TEXT, INTEGER, INTEGER, TEXT, TEXT) TO service_role;