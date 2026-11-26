-- ---------------------------------------------------------------------------
-- A listagem da API publica deixa de devolver registro na lixeira
-- ---------------------------------------------------------------------------
-- Etapa 044 (achado G31-3). A public_api_list criada na 20261124230000 filtra
-- so por `t.user_id`, sem `deleted_at`. Como o produto exclui por lixeira
-- (ADR-008: `deleted_at` + expurgo de 30 dias em purge_soft_deleted), qualquer
-- empresa ou negociacao que o usuario apagou no app continuava sendo devolvida
-- pela API publica -- e a API ainda aceitava DELETE fisico, que apagava em
-- definitivo com a chave mestra (service_role), por cima da regra do produto.
--
-- Esta migration fecha a leitura; o DELETE fisico saiu no handler da edge
-- function (passou a gravar `deleted_at`, como `workflow-engine:944` e o
-- `withOrg` do front ja faziam).
--
-- Contrato preservado: o resto da funcao e' identico ao da 20261124230000
-- (escopo por user_id, ILIKE em name/sector, ORDER BY created_at DESC,
-- LIMIT/OFFSET, total = count(*), json em vez de jsonb, TimeZone UTC,
-- execute so para service_role). O unico acrescimo e' `deleted_at IS NULL`
-- para as tabelas que tem a coluna.
--
-- `stakeholders` NAO tem deleted_at (confirmado em information_schema: apenas
-- companies, deals, campaigns e workflows tem), entao ela nao entra no filtro.
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

  -- Lixeira (ADR-008): so as tabelas que tem a coluna.
  IF _table_name IN ('companies', 'deals') THEN
    v_where := v_where || ' AND t.deleted_at IS NULL';
  END IF;

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