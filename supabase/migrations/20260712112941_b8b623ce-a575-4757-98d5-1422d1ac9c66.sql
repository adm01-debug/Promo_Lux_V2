CREATE OR REPLACE FUNCTION public.pg_catalog_rls_tables()
 RETURNS TABLE(table_name text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
BEGIN
  -- service_role (auth.uid() NULL) passa; caso contrário exige papel admin.
  IF auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Acesso negado: requer papel de administrador';
  END IF;

  RETURN QUERY
  SELECT c.relname::text AS table_name
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relkind = 'r'
    AND c.relrowsecurity = true
  ORDER BY c.relname;
END;
$function$;

CREATE OR REPLACE FUNCTION public.pg_columns_for_insert(_table_name text)
 RETURNS TABLE(column_name text, data_type text, udt_name text, is_nullable boolean, has_default boolean, column_default text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Acesso negado: requer papel de administrador';
  END IF;

  RETURN QUERY
  SELECT
    c.column_name::text,
    c.data_type::text,
    c.udt_name::text,
    (c.is_nullable = 'YES') AS is_nullable,
    (c.column_default IS NOT NULL) AS has_default,
    c.column_default::text
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.table_name = _table_name
  ORDER BY c.ordinal_position;
END;
$function$;