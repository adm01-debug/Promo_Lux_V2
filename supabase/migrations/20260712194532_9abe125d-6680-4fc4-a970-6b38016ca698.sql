CREATE OR REPLACE FUNCTION public.purge_dead_letter(
  _replayed_retention_days integer DEFAULT 30,
  _stale_retention_days integer DEFAULT 90
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_replayed integer := 0;
  v_stale    integer := 0;
BEGIN
  -- service_role (auth.uid() NULL) passa; caso contrário exige papel admin.
  IF auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Acesso negado: requer papel de administrador';
  END IF;

  -- 1) Itens já reprocessados cujo replay passou da janela de retenção.
  WITH del AS (
    DELETE FROM public.scrape_dead_letter
    WHERE replayed_at IS NOT NULL
      AND replayed_at < now() - make_interval(days => GREATEST(_replayed_retention_days, 1))
    RETURNING 1
  )
  SELECT count(*) INTO v_replayed FROM del;

  -- 2) Itens nunca reprocessados e parados há muito tempo (lixo permanente).
  WITH del AS (
    DELETE FROM public.scrape_dead_letter
    WHERE replayed_at IS NULL
      AND failed_at < now() - make_interval(days => GREATEST(_stale_retention_days, 1))
    RETURNING 1
  )
  SELECT count(*) INTO v_stale FROM del;

  RETURN v_replayed + v_stale;
END;
$function$;

REVOKE ALL ON FUNCTION public.purge_dead_letter(integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.purge_dead_letter(integer, integer) TO authenticated, service_role;