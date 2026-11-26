-- Auditoria: leitores corrigidos (`actor_id` no lugar de `user_id`) e trilha da tela
-- lendo pelo motor de PII.
--
-- 1) `count_audit_logs` e `read_audit_logs_safe` filtravam/retornavam `a.user_id`,
--    coluna que NAO existe em `audit_logs` (o schema real usa `actor_id`; a mesma
--    divergencia ja foi corrigida em 20261124220000 para a API publica e documentada
--    em 20260713123956). Como o corpo plpgsql nao e validado na criacao, as funcoes
--    foram criadas com sucesso e falhavam em execucao com
--    "column a.user_id does not exist" -- o painel de auditoria (contagem no rodape e
--    trilha) e o botao Exportar nunca conseguiram ler uma linha.
-- 2) `audit_log_facets` agregava o enum `public.audit_action` direto em `text[]`;
--    o cast agora e explicito para nao depender de conversao implicita de array.
-- 3) `read_audit_logs_safe` existia desde 20261122260000 e nunca era chamada por
--    ninguem: a trilha da tela (src/hooks/useAuditTrail.ts) lia `audit_logs` cru, entao
--    a regra de mascaramento configurada em Configuracoes > Mascaramento de PII valia
--    para a amostra da tela e para o arquivo exportado, mas nao para a trilha exibida.
--    A funcao passa a cobrir os filtros/paginacao da trilha (periodo, acao, conjunto de
--    tabelas, offset e total de linhas) e a UI passa a consumi-la. Sem regra ativa o
--    motor devolve o valor inalterado, portanto quem nao usa o recurso nao muda nada.

-- ---------------------------------------------------------------------------
-- 1) count_audit_logs: coluna do ator + filtro de action explicito
-- ---------------------------------------------------------------------------
-- O parametro `_user_id` vira `_actor_id`: CREATE OR REPLACE nao renomeia
-- parametro de entrada ("cannot change name of input parameter"), por isso a
-- versao antiga e removida antes.
DROP FUNCTION IF EXISTS public.count_audit_logs(uuid, timestamptz, timestamptz, text, text, uuid);

CREATE OR REPLACE FUNCTION public.count_audit_logs(
  _org_id uuid,
  _from timestamptz DEFAULT NULL,
  _to timestamptz DEFAULT NULL,
  _action text DEFAULT NULL,
  _table_name text DEFAULT NULL,
  _actor_id uuid DEFAULT NULL
)
RETURNS bigint
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _total bigint;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'nao autenticado' USING ERRCODE = '28000';
  END IF;
  IF NOT public.has_org_role(_org_id, auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'apenas admin da organizacao pode contar audit log' USING ERRCODE = '42501';
  END IF;

  SELECT count(*) INTO _total
  FROM public.audit_logs a
  WHERE a.organization_id = _org_id
    AND (_from IS NULL OR a.created_at >= _from)
    AND (_to IS NULL OR a.created_at < _to)
    AND (_action IS NULL OR a.action::text = _action)
    AND (_table_name IS NULL OR a.table_name = _table_name)
    AND (_actor_id IS NULL OR a.actor_id = _actor_id);

  RETURN COALESCE(_total, 0);
END;
$$;

REVOKE ALL ON FUNCTION public.count_audit_logs(uuid, timestamptz, timestamptz, text, text, uuid) FROM public;
REVOKE ALL ON FUNCTION public.count_audit_logs(uuid, timestamptz, timestamptz, text, text, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.count_audit_logs(uuid, timestamptz, timestamptz, text, text, uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 2) audit_log_facets: enum -> text explicito
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.audit_log_facets(_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _actions text[];
  _tables text[];
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'nao autenticado' USING ERRCODE = '28000';
  END IF;
  IF NOT public.has_org_role(_org_id, auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'apenas admin da organizacao pode listar facets' USING ERRCODE = '42501';
  END IF;

  SELECT array_agg(DISTINCT a.action::text ORDER BY a.action::text) INTO _actions
  FROM public.audit_logs a WHERE a.organization_id = _org_id;

  SELECT array_agg(DISTINCT a.table_name ORDER BY a.table_name) INTO _tables
  FROM public.audit_logs a WHERE a.organization_id = _org_id;

  RETURN jsonb_build_object(
    'actions', COALESCE(to_jsonb(_actions), '[]'::jsonb),
    'tables', COALESCE(to_jsonb(_tables), '[]'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.audit_log_facets(uuid) FROM public;
REVOKE ALL ON FUNCTION public.audit_log_facets(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.audit_log_facets(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 3) read_audit_logs_safe: leitura mascarada com os filtros da trilha
-- ---------------------------------------------------------------------------
-- A versao anterior (uuid, int, text, text) fica removida: nunca foi chamada por
-- nenhum hook/edge function (so constava nos tipos gerados) e estava quebrada.
DROP FUNCTION IF EXISTS public.read_audit_logs_safe(uuid, int, text, text);

CREATE OR REPLACE FUNCTION public.read_audit_logs_safe(
  _org_id uuid,
  _limit int DEFAULT 25,
  _offset int DEFAULT 0,
  _action text DEFAULT NULL,
  _tables text[] DEFAULT NULL,
  _from timestamptz DEFAULT NULL,
  _to timestamptz DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  organization_id uuid,
  actor_id uuid,
  action text,
  table_name text,
  record_id uuid,
  old_data jsonb,
  new_data jsonb,
  metadata jsonb,
  trace_id uuid,
  created_at timestamptz,
  total_count bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _lim int := LEAST(GREATEST(COALESCE(_limit, 25), 1), 500);
  _off int := GREATEST(COALESCE(_offset, 0), 0);
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'nao autenticado' USING ERRCODE = '28000';
  END IF;

  IF NOT public.has_org_role(_org_id, auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'apenas admin da organizacao pode ler audit log mascarado' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  WITH filtrado AS (
    SELECT a.id, a.organization_id, a.actor_id, a.action, a.table_name, a.record_id,
           a.old_data, a.new_data, a.metadata, a.trace_id, a.created_at
    FROM public.audit_logs a
    WHERE a.organization_id = _org_id
      AND (_action IS NULL OR a.action::text = _action)
      AND (_tables IS NULL OR a.table_name = ANY (_tables))
      AND (_from IS NULL OR a.created_at >= _from)
      AND (_to IS NULL OR a.created_at <= _to)
  ), total AS (
    SELECT count(*) AS n FROM filtrado
  )
  SELECT f.id,
         f.organization_id,
         f.actor_id,
         f.action::text,
         f.table_name,
         f.record_id,
         public.pii_redact_jsonb(_org_id, f.old_data) AS old_data,
         public.pii_redact_jsonb(_org_id, f.new_data) AS new_data,
         public.pii_redact_jsonb(_org_id, f.metadata) AS metadata,
         f.trace_id,
         f.created_at,
         t.n AS total_count
  FROM filtrado f
  CROSS JOIN total t
  ORDER BY f.created_at DESC, f.id DESC
  OFFSET _off
  LIMIT _lim;
END;
$$;

REVOKE ALL ON FUNCTION public.read_audit_logs_safe(uuid, int, int, text, text[], timestamptz, timestamptz) FROM public;
REVOKE ALL ON FUNCTION public.read_audit_logs_safe(uuid, int, int, text, text[], timestamptz, timestamptz) FROM anon;
GRANT EXECUTE ON FUNCTION public.read_audit_logs_safe(uuid, int, int, text, text[], timestamptz, timestamptz) TO authenticated;