-- Etapas 027/029 — canal de consulta MCP passa a ser somente leitura e as
-- funções de execução de SQL arbitrário saem do banco.
--
-- `supabase/functions/mcp-query/index.ts:81` envia SQL arbitrário para a RPC
-- `exec_sql` com a service_role key. A única defesa era uma blacklist por
-- regex (DROP|TRUNCATE|ALTER SYSTEM|RESET ALL), que não cobre ALTER TABLE,
-- DELETE, GRANT, CREATE FUNCTION nem SELECT de exfiltração. `exec_sql(text)`,
-- `mcp_exec`, `mcp_exec_many` e `_qa_run_test` foram criadas fora do
-- versionamento e não têm chamador no repositório além dessa edge. A migration
-- 20261113185209 revogou EXECUTE de PUBLIC/anon/authenticated, mas a
-- service_role permanecia com poder total sobre elas.

-- 1) Canal de consulta somente leitura, com teto de tempo de execução.
CREATE OR REPLACE FUNCTION public.mcp_query(_sql text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sql  text := btrim(coalesce(_sql, ''));
  v_rows jsonb;
BEGIN
  v_sql := rtrim(v_sql, ';');
  v_sql := btrim(v_sql);

  IF v_sql = '' THEN
    RAISE EXCEPTION 'mcp_query: sql vazio' USING ERRCODE = '22023';
  END IF;

  -- Portão positivo: a statement precisa começar por consulta.
  IF v_sql !~* '^(select|with)\s' THEN
    RAISE EXCEPTION 'mcp_query: apenas SELECT e WITH sao aceitos'
      USING ERRCODE = '42501';
  END IF;

  -- Portão negativo: escrita/DDL em qualquer posição, inclusive dentro de CTE,
  -- no caso de a transação corrente já ter rodado alguma query (situação em que
  -- o GUC abaixo é ignorado pelo Postgres).
  IF v_sql ~* '\m(insert|update|delete|merge|drop|truncate|alter|create|grant|revoke|copy|call|vacuum|analyze|reindex|refresh|comment|prepare|execute|lock|listen|notify|import|security)\M' THEN
    RAISE EXCEPTION 'mcp_query: comando de escrita ou DDL nao permitido'
      USING ERRCODE = '42501';
  END IF;

  -- Defesa principal: em transação read-only o Postgres recusa qualquer
  -- escrita, inclusive as que passarem pelos portões acima.
  PERFORM set_config('default_transaction_read_only', 'on', true);
  PERFORM set_config('transaction_read_only', 'on', true);
  PERFORM set_config('statement_timeout', '10000', true);

  EXECUTE format(
    'SELECT coalesce(jsonb_agg(x), ''[]''::jsonb) FROM (%s) x',
    v_sql
  ) INTO v_rows;

  RETURN coalesce(v_rows, '[]'::jsonb);
END;
$$;

COMMENT ON FUNCTION public.mcp_query(text) IS
  'Consulta somente leitura usada pela edge mcp-query. Substitui exec_sql.';

REVOKE ALL ON FUNCTION public.mcp_query(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_query(text) TO service_role;

-- 2) Remoção definitiva das funções de SQL arbitrário. Em banco limpo elas
-- nunca existiram (nasceram fora do versionamento), então o bloco é condicional.
-- Se alguma tiver dependente e o DROP falhar, o EXECUTE é revogado de todos os
-- papéis: a função deixa de ser alcançável em vez de ficar exposta.
DO $$
DECLARE
  alvo record;
BEGIN
  FOR alvo IN
    SELECT p.oid::regprocedure AS assinatura
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('exec_sql', 'mcp_exec', 'mcp_exec_many', '_qa_run_test')
  LOOP
    BEGIN
      EXECUTE format('DROP FUNCTION %s', alvo.assinatura);
      RAISE NOTICE 'removida: %', alvo.assinatura;
    EXCEPTION WHEN dependent_objects_still_exist THEN
      EXECUTE format(
        'REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated, service_role',
        alvo.assinatura
      );
      RAISE WARNING 'nao removida por dependentes, EXECUTE revogado de todos: %', alvo.assinatura;
    END;
  END LOOP;
END $$;