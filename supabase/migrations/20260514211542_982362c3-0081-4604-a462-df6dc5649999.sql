-- Fix permissive RLS on auth_rate_limits
DROP POLICY "System can manage auth rate limits" ON public.auth_rate_limits;
CREATE POLICY "System can manage auth rate limits" ON public.auth_rate_limits
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Fix user_roles table (RLS enabled but no policy)
-- Users should be able to view their own roles
CREATE POLICY "Users can view their own roles" ON public.user_roles
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

-- Admins (service_role or specialized functions) manage roles
CREATE POLICY "Service role can manage user roles" ON public.user_roles
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Move pg_net extension if possible (ignoring if it fails due to dependencies)
-- Note: Some environments don't allow moving extensions easily via migration.
-- We'll try to move it to 'extensions' schema which is standard.
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'extensions') THEN
        ALTER EXTENSION pg_net SET SCHEMA extensions;
    END IF;
EXCEPTION WHEN OTHERS THEN
    -- Ignore if we can't move it
END $$;
