-- Login + dado da API publica num UNICO round-trip ao PostgREST.
--
-- Complemento da 20261124180000, que ja consolidou verify/touch/rate-limit/select
-- numa authenticate_api_key so. Mesmo assim cada request ainda pagava um SEGUNDO
-- round-trip para buscar o dado em si, e o custo medido em producao em 24/11/2026
-- e ~130-150 ms por chamada HTTP dentro da edge function. Medido pelo pg_net
-- (de dentro do Supabase, mesma janela): /events p50 287 ms e /companies p50
-- 284 ms - identicos, o piso de dois round-trips, contra 356 ms de /me, que
-- abre DUAS conexoes em paralelo (o Promise.all custa 2 handshakes, nao 1).
--
-- As duas funcoes abaixo fazem auth + leitura no mesmo statement. As regras
-- ficam exatamente como estao hoje:
--   * authenticate_api_key continua sendo a unica autoridade de 401/429 e quem
--     consome a quota (estas funcoes apenas repassam o resultado)
--   * /events: mesma ordenacao (created_at desc, id desc), mesmo escopo por
--     organization_id com fallback para actor_id, mesmos filtros after/table/action
--     e mesma regra de next_cursor (so quando a pagina vem cheia)
--   * /me: exatamente os 9 campos da linha de api_keys + user_id. key_hash NUNCA
--     e devolvido.
--   * TimeZone fixado em UTC para os timestamps sairem no mesmo formato ISO do
--     PostgREST (o jsonb usa o TimeZone da sessao, que nao e UTC por padrao)
--   * execute revogado de PUBLIC/anon/authenticated e concedido so a service_role,
--     como na 20261124180000: a edge function e a unica chamadora.

CREATE OR REPLACE FUNCTION public.public_api_me(_key_hash TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auth RECORD;
  v_key  RECORD;
BEGIN
  PERFORM set_config('TimeZone', 'UTC', true);

  SELECT * INTO v_auth FROM public.authenticate_api_key(_key_hash, 600);

  IF v_auth.key_id IS NULL THEN
    RETURN jsonb_build_object('status', 401);
  END IF;

  IF v_auth.allowed IS NOT TRUE THEN
    RETURN jsonb_build_object(
      'status', 429,
      'current_count', v_auth.current_count,
      'reset_at', v_auth.reset_at
    );
  END IF;

  SELECT k.id, k.name, k.prefix, k.scopes, k.active, k.expires_at,
         k.last_used_at, k.created_at, k.organization_id
    INTO v_key
    FROM public.api_keys k
   WHERE k.id = v_auth.key_id;

  IF v_key.id IS NULL THEN
    RETURN jsonb_build_object('status', 404);
  END IF;

  RETURN jsonb_build_object(
    'status', 200,
    'key', jsonb_build_object(
      'id', v_key.id,
      'name', v_key.name,
      'prefix', v_key.prefix,
      'scopes', v_key.scopes,
      'active', v_key.active,
      'expires_at', v_key.expires_at,
      'last_used_at', v_key.last_used_at,
      'created_at', v_key.created_at,
      'organization_id', v_key.organization_id
    ),
    'key_id', v_auth.key_id,
    'user_id', v_auth.user_id,
    'prefix', v_auth.prefix,
    'organization_id', v_auth.organization_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.public_api_events(
  _key_hash TEXT,
  _limit INTEGER DEFAULT 25,
  _after UUID DEFAULT NULL,
  _table_name TEXT DEFAULT NULL,
  _action TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auth   RECORD;
  v_limit  INTEGER := least(greatest(coalesce(_limit, 25), 1), 100);
  v_events JSONB;
  v_last   UUID;
  v_count  INTEGER;
BEGIN
  PERFORM set_config('TimeZone', 'UTC', true);

  SELECT * INTO v_auth FROM public.authenticate_api_key(_key_hash, 600);

  IF v_auth.key_id IS NULL THEN
    RETURN jsonb_build_object('status', 401);
  END IF;

  IF v_auth.allowed IS NOT TRUE THEN
    RETURN jsonb_build_object(
      'status', 429,
      'current_count', v_auth.current_count,
      'reset_at', v_auth.reset_at
    );
  END IF;

  WITH page AS MATERIALIZED (
    SELECT a.id, a.action, a.table_name, a.record_id, a.new_data, a.metadata, a.created_at
      FROM public.audit_logs a
     WHERE CASE WHEN v_auth.organization_id IS NOT NULL
                THEN a.organization_id = v_auth.organization_id
                ELSE a.actor_id = v_auth.user_id
           END
       AND (_after IS NULL OR a.id < _after)
       AND (_table_name IS NULL OR a.table_name = _table_name)
       -- audit_logs.action e o enum public.audit_action, com rotulos MINUSCULOS
       -- (create/update/delete/execute). O codigo antigo mandava action.toUpperCase()
       -- para o PostgREST, entao ?action=UPDATE virava
       -- 500 invalid input value for enum audit_action: "UPDATE" em 100% das chamadas.
       -- Aqui os valores documentados na API (INSERT/UPDATE/DELETE) sao mapeados para
       -- os rotulos do enum; um valor desconhecido continua virando erro, como antes.
       AND (
         _action IS NULL
         OR a.action = (
           CASE lower(_action)
             WHEN 'insert'  THEN 'create'
             WHEN 'create'  THEN 'create'
             WHEN 'update'  THEN 'update'
             WHEN 'delete'  THEN 'delete'
             WHEN 'execute' THEN 'execute'
             ELSE _action
           END
         )::public.audit_action
       )
     ORDER BY a.created_at DESC, a.id DESC
     LIMIT v_limit
  )
  SELECT
    coalesce(jsonb_agg(
      jsonb_build_object(
        'id', p.id,
        'action', p.action,
        'table', p.table_name,
        'record_id', p.record_id,
        'payload', p.new_data,
        'metadata', p.metadata,
        'occurred_at', p.created_at
      ) ORDER BY p.created_at DESC, p.id DESC
    ), '[]'::jsonb),
    count(*)::INTEGER,
    (array_agg(p.id ORDER BY p.created_at DESC, p.id DESC))[v_limit]
    INTO v_events, v_count, v_last
    FROM page p;

  RETURN jsonb_build_object(
    'status', 200,
    'events', v_events,
    'next_cursor', CASE WHEN v_count = v_limit THEN v_last ELSE NULL END,
    'key_id', v_auth.key_id,
    'user_id', v_auth.user_id,
    'prefix', v_auth.prefix,
    'organization_id', v_auth.organization_id
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.public_api_me(TEXT) FROM PUBLIC, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.public_api_me(TEXT) TO service_role;

REVOKE EXECUTE ON FUNCTION public.public_api_events(TEXT, INTEGER, UUID, TEXT, TEXT) FROM PUBLIC, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.public_api_events(TEXT, INTEGER, UUID, TEXT, TEXT) TO service_role;