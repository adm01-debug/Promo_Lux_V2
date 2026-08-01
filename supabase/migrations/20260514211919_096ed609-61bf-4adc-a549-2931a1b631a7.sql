-- 1. Setup extensions schema
CREATE SCHEMA IF NOT EXISTS extensions;

-- 2. Move extensions out of public
DO $$ 
BEGIN
    ALTER EXTENSION pg_net SET SCHEMA extensions;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not move pg_net, likely due to dependencies or permission restrictions.';
END $$;

-- 3. Total Lockdown of SECURITY DEFINER functions in public schema
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
        -- Revoke from ALL roles except owner and service_role
        EXECUTE format('REVOKE EXECUTE ON FUNCTION %I.%I(%s) FROM PUBLIC, anon, authenticated', func_record.schema, func_record.name, func_record.args);
        
        -- Grant back ONLY the strictly necessary ones for the UI to function
        IF func_record.name IN (
            'accept_org_invite', 
            'default_org_for_current_user', 
            'handle_new_organization', 
            'is_org_member', 
            'has_org_role',
            'has_role',
            'verify_api_key', -- Needed for Edge Functions using auth
            'touch_api_key'
        ) THEN
            EXECUTE format('GRANT EXECUTE ON FUNCTION %I.%I(%s) TO authenticated', func_record.schema, func_record.name, func_record.args);
        END IF;
        
        -- Always grant to service_role (internal system ops)
        EXECUTE format('GRANT EXECUTE ON FUNCTION %I.%I(%s) TO service_role', func_record.schema, func_record.name, func_record.args);
    END LOOP;
END $$;
