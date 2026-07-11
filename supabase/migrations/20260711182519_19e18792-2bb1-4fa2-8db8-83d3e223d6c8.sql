-- Nenhuma dessas funções deve ser executável por visitantes anônimos.
REVOKE EXECUTE ON FUNCTION public.accept_org_invite(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_dashboard_stats(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_sector_summary(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.campaign_ab_stats(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.decide_ab_winner(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon;
REVOKE EXECUTE ON FUNCTION public.has_org_role(uuid, uuid, app_role) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_org_member(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.default_org_for_current_user() FROM anon;