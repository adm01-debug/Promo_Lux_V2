-- Fix search_path for remaining utility functions
ALTER FUNCTION public.update_updated_at_column() SET search_path = public;
ALTER FUNCTION public.cleanup_old_idempotency_keys() SET search_path = public;
ALTER FUNCTION public.increment_version() SET search_path = public;
ALTER FUNCTION public.handle_updated_at() SET search_path = public;

-- Address "RLS Policy Always True" - checking which policies are permissive
-- Usually these are intended for SELECT on public tables, but let's be careful.
-- I'll list them first in the next step if linter still complains.

-- Address "Extension in Public"
-- Note: Moving extensions can be tricky if they are in use. 
-- We'll check which ones are in public.
