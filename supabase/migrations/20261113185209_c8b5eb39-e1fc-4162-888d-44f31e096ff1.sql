-- x security: remove EXECUTE public de funções-orfãs SECURITY DEFINER em produção.
-- Estas funções (exec_sql, _qa_run_test, mcp_exec) NÃO existem em nenhuma migration:
-- foram criadas fora de versão em produção. Nenhum chamador em src/ ou supabase/functions/.
-- exec_sql(text) era executável por anon/authenticated via REST RPC -> RCE em produção
-- (comprovado: select 1 como anon retornou {"x":1}). REVOKE abaixo fecha a exposição.
-- Guarda condicional: em ambientes onde a função não existe (dev/db reset), não falha.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
             WHERE n.nspname='public' AND p.proname='exec_sql') THEN
    EXECUTE 'REVOKE ALL ON FUNCTION public.exec_sql(text) FROM PUBLIC, anon, authenticated';
    RAISE NOTICE 'exec_sql: revogado de PUBLIC/anon/authenticated';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
             WHERE n.nspname='public' AND p.proname='_qa_run_test') THEN
    EXECUTE 'REVOKE ALL ON FUNCTION public._qa_run_test(text,text,boolean) FROM PUBLIC, anon, authenticated';
    RAISE NOTICE '_qa_run_test: revogado de PUBLIC/anon/authenticated';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
             WHERE n.nspname='public' AND p.proname='mcp_exec') THEN
    EXECUTE 'REVOKE ALL ON FUNCTION public.mcp_exec(text,integer) FROM PUBLIC, anon, authenticated';
    RAISE NOTICE 'mcp_exec: revogado de PUBLIC/anon/authenticated';
  END IF;
END $$;