REVOKE EXECUTE ON FUNCTION public.fn_lusha_contact_mark_cache_hit(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.fn_lux_cache_stats(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.fn_lux_enrichment_gate(text, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.fn_lux_save_enriched_contact(uuid, uuid, text, text, text, text, jsonb, boolean, boolean, text, text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.fn_lusha_contact_mark_cache_hit(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_lux_cache_stats(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_lux_enrichment_gate(text, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_lux_save_enriched_contact(uuid, uuid, text, text, text, text, jsonb, boolean, boolean, text, text) TO authenticated, service_role;