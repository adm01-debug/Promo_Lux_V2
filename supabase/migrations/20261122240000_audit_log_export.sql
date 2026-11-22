-- Exportacao de audit log para SIEM (gap 2.8 do GAPS-ENTERPRISE:
-- "Audit log exportavel - Inexistente. Padrao: immutable, retention 1+ ano, export SIEM").
--
-- Entrega exportacao paginada por cursor (id + created_at) em JSON, com filtros
-- de periodo/acao/tabela/usuario, restrita a admins da organizacao. O cliente
-- converte em NDJSON para ingestao em Splunk/Datadog/Elastic/S3.

CREATE OR REPLACE FUNCTION public.export_audit_logs(
  _org_id uuid,
  _from timestamptz DEFAULT NULL,
  _to timestamptz DEFAULT NULL,
  _action text DEFAULT NULL,
  _table_name text DEFAULT NULL,
  _user_id uuid DEFAULT NULL,
  _after_created_at timestamptz DEFAULT NULL,
  _after_id uuid DEFAULT NULL,
  _limit int DEFAULT 1000
)
RETURNS TABLE (
  id uuid,
  organization_id uuid,
  user_id uuid,
  action text,
  table_name text,
  record_id uuid,
  old_data jsonb,
  new_data jsonb,
  metadata jsonb,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _lim int := LEAST(GREATEST(COALESCE(_limit, 1000), 1), 5000);
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'nao autenticado' USING ERRCODE = '28000';
  END IF;

  IF NOT public.has_org_role(_org_id, auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'apenas admin da organizacao pode exportar audit log' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT a.id,
         a.organization_id,
         a.user_id,
         a.action,
         a.table_name,
         a.record_id,
         a.old_data,
         a.new_data,
         a.metadata,
         a.created_at
  FROM public.audit_logs a
  WHERE a.organization_id = _org_id
    AND (_from IS NULL OR a.created_at >= _from)
    AND (_to IS NULL OR a.created_at < _to)
    AND (_action IS NULL OR a.action = _action)
    AND (_table_name IS NULL OR a.table_name = _table_name)
    AND (_user_id IS NULL OR a.user_id = _user_id)
    -- cursor: (created_at, id) estritamente posterior ao ultimo item exportado
    AND (
      _after_created_at IS NULL
      OR a.created_at > _after_created_at
      OR (a.created_at = _after_created_at AND (_after_id IS NULL OR a.id > _after_id))
    )
  ORDER BY a.created_at ASC, a.id ASC
  LIMIT _lim;
END;
$$;

-- Contagem previa: permite a UI mostrar o volume antes de exportar.
CREATE OR REPLACE FUNCTION public.count_audit_logs(
  _org_id uuid,
  _from timestamptz DEFAULT NULL,
  _to timestamptz DEFAULT NULL,
  _action text DEFAULT NULL,
  _table_name text DEFAULT NULL,
  _user_id uuid DEFAULT NULL
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
    AND (_action IS NULL OR a.action = _action)
    AND (_table_name IS NULL OR a.table_name = _table_name)
    AND (_user_id IS NULL OR a.user_id = _user_id);

  RETURN COALESCE(_total, 0);
END;
$$;

-- Valores distintos para os filtros da UI (acoes e tabelas realmente presentes).
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

  SELECT array_agg(DISTINCT a.action ORDER BY a.action) INTO _actions
  FROM public.audit_logs a WHERE a.organization_id = _org_id;

  SELECT array_agg(DISTINCT a.table_name ORDER BY a.table_name) INTO _tables
  FROM public.audit_logs a WHERE a.organization_id = _org_id;

  RETURN jsonb_build_object(
    'actions', COALESCE(to_jsonb(_actions), '[]'::jsonb),
    'tables', COALESCE(to_jsonb(_tables), '[]'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.export_audit_logs(uuid, timestamptz, timestamptz, text, text, uuid, timestamptz, uuid, int) FROM public;
REVOKE ALL ON FUNCTION public.count_audit_logs(uuid, timestamptz, timestamptz, text, text, uuid) FROM public;
REVOKE ALL ON FUNCTION public.audit_log_facets(uuid) FROM public;

GRANT EXECUTE ON FUNCTION public.export_audit_logs(uuid, timestamptz, timestamptz, text, text, uuid, timestamptz, uuid, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.count_audit_logs(uuid, timestamptz, timestamptz, text, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.audit_log_facets(uuid) TO authenticated;