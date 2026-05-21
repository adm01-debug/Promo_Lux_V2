ALTER FUNCTION public.get_sector_summary(p_user_id UUID) SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.get_sector_summary(p_user_id UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_sector_summary(p_user_id UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_sector_summary(p_user_id UUID) TO service_role;