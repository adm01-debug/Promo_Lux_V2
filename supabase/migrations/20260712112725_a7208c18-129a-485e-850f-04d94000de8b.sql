REVOKE EXECUTE ON FUNCTION public.decide_ab_winner(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.decide_ab_winner(uuid) TO service_role;