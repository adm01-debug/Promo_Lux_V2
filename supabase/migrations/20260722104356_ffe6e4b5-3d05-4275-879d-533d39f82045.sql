
-- Guarda dos ALTERs de search_path: todas as funções fn_lux_*/fn_lusha_*/fn_mark_*
-- existem apenas no banco de produção (schema drift — criadas via painel Lovable,
-- nunca entregues em migration). Aplica search_path somente se a função existir;
-- caso contrário (replay/shadow), pula sem erro — evita 42883 sem inventar corpo.
DO $$
BEGIN
  IF to_regprocedure('public.fn_lusha_contact_cache_lookup(text, uuid)') IS NOT NULL THEN
    ALTER FUNCTION public.fn_lusha_contact_cache_lookup(text, uuid) SET search_path = public;
  END IF;
  IF to_regprocedure('public.fn_lusha_contact_mark_cache_hit(uuid)') IS NOT NULL THEN
    ALTER FUNCTION public.fn_lusha_contact_mark_cache_hit(uuid) SET search_path = public;
  END IF;
  IF to_regprocedure('public.fn_lux_cache_gate(text, uuid)') IS NOT NULL THEN
    ALTER FUNCTION public.fn_lux_cache_gate(text, uuid) SET search_path = public;
  END IF;
  IF to_regprocedure('public.fn_lux_cache_stats(uuid)') IS NOT NULL THEN
    ALTER FUNCTION public.fn_lux_cache_stats(uuid) SET search_path = public;
  END IF;
  IF to_regprocedure('public.fn_lux_enrichment_gate(text, uuid)') IS NOT NULL THEN
    ALTER FUNCTION public.fn_lux_enrichment_gate(text, uuid) SET search_path = public;
  END IF;
  IF to_regprocedure('public.fn_lux_save_enriched_contact(uuid, uuid, text, text, text, text, jsonb, boolean, boolean, text, text)') IS NOT NULL THEN
    ALTER FUNCTION public.fn_lux_save_enriched_contact(uuid, uuid, text, text, text, text, jsonb, boolean, boolean, text, text) SET search_path = public;
  END IF;
  IF to_regprocedure('public.fn_mark_contact_rechecked(uuid, text)') IS NOT NULL THEN
    ALTER FUNCTION public.fn_mark_contact_rechecked(uuid, text) SET search_path = public;
  END IF;
END $$;
