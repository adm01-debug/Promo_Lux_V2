-- Fix search_path for process_audit_log
ALTER FUNCTION public.process_audit_log() SET search_path = public;

-- Revoke default PUBLIC execute permissions from SECURITY DEFINER functions
-- and grant them only to the necessary roles (authenticated or service_role)

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
        -- Revoke from public
        EXECUTE format('REVOKE EXECUTE ON FUNCTION %I.%I(%s) FROM PUBLIC', func_record.schema, func_record.name, func_record.args);
        
        -- Grant to authenticated by default (most app functions)
        -- Some might need service_role only, but authenticated is a safe first step for app-facing ones.
        -- We'll be more specific for highly sensitive ones if needed.
        EXECUTE format('GRANT EXECUTE ON FUNCTION %I.%I(%s) TO authenticated', func_record.schema, func_record.name, func_record.args);
        EXECUTE format('GRANT EXECUTE ON FUNCTION %I.%I(%s) TO service_role', func_record.schema, func_record.name, func_record.args);
    END LOOP;
END $$;

-- Specific restrictions for internal/dangerous functions
REVOKE EXECUTE ON FUNCTION public.pg_columns_for_insert(text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.pg_catalog_rls_tables() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.evaluate_org_violation_alerts() FROM authenticated;
-- These stay for service_role only (used by cron or edge functions with service key)
