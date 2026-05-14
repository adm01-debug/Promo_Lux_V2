DO $$ 
DECLARE 
    func_record RECORD;
BEGIN 
    FOR func_record IN 
        SELECT n.nspname as schema, p.proname as name, pg_get_function_identity_arguments(p.oid) as args
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE p.prosecdef = true 
        AND n.nspname = 'public'
    LOOP
        -- Revoke from everyone specifically
        EXECUTE format('REVOKE EXECUTE ON FUNCTION %I.%I(%s) FROM PUBLIC, anon, authenticated', func_record.schema, func_record.name, func_record.args);
        
        -- Grant back only to authenticated for standard app functions
        -- excluding highly sensitive ones
        IF func_record.name NOT IN ('pg_columns_for_insert', 'pg_catalog_rls_tables', 'evaluate_org_violation_alerts', 'process_audit_log') THEN
            EXECUTE format('GRANT EXECUTE ON FUNCTION %I.%I(%s) TO authenticated', func_record.schema, func_record.name, func_record.args);
        END IF;
        
        -- Always grant to service_role
        EXECUTE format('GRANT EXECUTE ON FUNCTION %I.%I(%s) TO service_role', func_record.schema, func_record.name, func_record.args);
    END LOOP;
END $$;
