
-- Guarda do ALTER de search_path: a função public.fn_lusha_contact_cache_lookup
-- existe apenas no banco de produção (schema drift — criada via painel Lovable,
-- nunca entregue em migration). Se estiver presente, aplica o search_path; se
-- ausente (replay/shadow), pula silenciosamente — evita 42883 sem inventar corpo.
DO $$
BEGIN
  IF to_regprocedure('public.fn_lusha_contact_cache_lookup(text)') IS NOT NULL THEN
    ALTER FUNCTION public.fn_lusha_contact_cache_lookup(text) SET search_path = public;
  END IF;
END $$;
