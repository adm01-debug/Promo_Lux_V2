REVOKE EXECUTE ON FUNCTION public.purge_soft_deleted() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_soft_deleted() TO service_role;