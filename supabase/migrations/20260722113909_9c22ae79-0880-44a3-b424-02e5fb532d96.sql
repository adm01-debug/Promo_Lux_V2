-- Guarda dos REVOKE/GRANT: as funções fn_lux_* existem apenas no banco de
-- produção (schema drift — nunca entregues em migration). Executa cada comando
-- somente se a função existir; caso contrário (replay/shadow), pula sem erro.
DO $$
BEGIN
  IF to_regprocedure('public.fn_lusha_contact_mark_cache_hit(uuid)') IS NOT NULL THEN
    REVOKE EXECUTE ON FUNCTION public.fn_lusha_contact_mark_cache_hit(uuid) FROM PUBLIC, anon;
  END IF;
  IF to_regprocedure('public.fn_lux_cache_stats(uuid)') IS NOT NULL THEN
    REVOKE EXECUTE ON FUNCTION public.fn_lux_cache_stats(uuid) FROM PUBLIC, anon;
  END IF;
  IF to_regprocedure('public.fn_lux_enrichment_gate(text, uuid)') IS NOT NULL THEN
    REVOKE EXECUTE ON FUNCTION public.fn_lux_enrichment_gate(text, uuid) FROM PUBLIC, anon;
  END IF;
  IF to_regprocedure('public.fn_lux_save_enriched_contact(uuid, uuid, text, text, text, text, jsonb, boolean, boolean, text, text)') IS NOT NULL THEN
    REVOKE EXECUTE ON FUNCTION public.fn_lux_save_enriched_contact(uuid, uuid, text, text, text, text, jsonb, boolean, boolean, text, text) FROM PUBLIC, anon;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regprocedure('public.fn_lusha_contact_mark_cache_hit(uuid)') IS NOT NULL THEN
    GRANT EXECUTE ON FUNCTION public.fn_lusha_contact_mark_cache_hit(uuid) TO authenticated, service_role;
  END IF;
  IF to_regprocedure('public.fn_lux_cache_stats(uuid)') IS NOT NULL THEN
    GRANT EXECUTE ON FUNCTION public.fn_lux_cache_stats(uuid) TO authenticated, service_role;
  END IF;
  IF to_regprocedure('public.fn_lux_enrichment_gate(text, uuid)') IS NOT NULL THEN
    GRANT EXECUTE ON FUNCTION public.fn_lux_enrichment_gate(text, uuid) TO authenticated, service_role;
  END IF;
  IF to_regprocedure('public.fn_lux_save_enriched_contact(uuid, uuid, text, text, text, text, jsonb, boolean, boolean, text, text)') IS NOT NULL THEN
    GRANT EXECUTE ON FUNCTION public.fn_lux_save_enriched_contact(uuid, uuid, text, text, text, text, jsonb, boolean, boolean, text, text) TO authenticated, service_role;
  END IF;
END $$;