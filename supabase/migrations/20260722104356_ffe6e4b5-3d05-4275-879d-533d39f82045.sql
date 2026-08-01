
ALTER FUNCTION public.fn_lusha_contact_cache_lookup(text, uuid) SET search_path = public;
ALTER FUNCTION public.fn_lusha_contact_mark_cache_hit(uuid) SET search_path = public;
ALTER FUNCTION public.fn_lux_cache_gate(text, uuid) SET search_path = public;
ALTER FUNCTION public.fn_lux_cache_stats(uuid) SET search_path = public;
ALTER FUNCTION public.fn_lux_enrichment_gate(text, uuid) SET search_path = public;
ALTER FUNCTION public.fn_lux_save_enriched_contact(uuid, uuid, text, text, text, text, jsonb, boolean, boolean, text, text) SET search_path = public;
ALTER FUNCTION public.fn_mark_contact_rechecked(uuid, text) SET search_path = public;
