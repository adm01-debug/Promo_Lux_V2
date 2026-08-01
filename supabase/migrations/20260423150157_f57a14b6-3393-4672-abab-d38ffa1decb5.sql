CREATE OR REPLACE FUNCTION public.pg_columns_for_insert(_table_name text)
RETURNS TABLE(column_name text, data_type text, udt_name text, is_nullable boolean, has_default boolean, column_default text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
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
$$;

GRANT EXECUTE ON FUNCTION public.pg_columns_for_insert(text) TO authenticated, service_role;