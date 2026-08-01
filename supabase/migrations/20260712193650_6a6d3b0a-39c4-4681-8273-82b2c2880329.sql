-- Reset manual seguro de circuit breaker (apenas admin autenticado ou service_role)
CREATE OR REPLACE FUNCTION public.reset_circuit_breaker(_service_name text)
RETURNS public.circuit_breakers
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_row public.circuit_breakers;
BEGIN
  -- service_role (auth.uid() NULL) passa; caso contrário exige papel admin.
  IF auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Acesso negado: requer papel de administrador';
  END IF;

  IF _service_name IS NULL OR length(trim(_service_name)) = 0 THEN
    RAISE EXCEPTION 'service_name é obrigatório';
  END IF;

  UPDATE public.circuit_breakers
  SET state = 'closed',
      failure_count = 0,
      last_failure_at = NULL,
      opened_at = NULL
  WHERE service_name = _service_name
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Circuit breaker não encontrado: %', _service_name;
  END IF;

  RETURN v_row;
END;
$function$;

REVOKE ALL ON FUNCTION public.reset_circuit_breaker(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reset_circuit_breaker(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reset_circuit_breaker(text) TO service_role;