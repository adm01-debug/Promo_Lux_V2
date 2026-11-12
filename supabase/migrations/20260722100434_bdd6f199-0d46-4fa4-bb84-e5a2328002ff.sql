-- 20260722100434_bdd6f199: security_invoker nas views de analytics de enrichment
--
-- As views v_lux_enrichment_health e v_lusha_cache_stats existem apenas em
-- producao (types.ts); o CREATE nunca foi commitado em migration. Guard para
-- nao quebrar o replay local quando as views ainda nao existem no banco.
DO $$
BEGIN
  IF to_regclass('public.v_lux_enrichment_health') IS NOT NULL THEN
    ALTER VIEW public.v_lux_enrichment_health SET (security_invoker = true);
  END IF;
END;
$$;

DO $$
BEGIN
  IF to_regclass('public.v_lusha_cache_stats') IS NOT NULL THEN
    ALTER VIEW public.v_lusha_cache_stats SET (security_invoker = true);
  END IF;
END;
$$;
