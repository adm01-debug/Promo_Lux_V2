-- Deferral: reenfileira sem consumir tentativa (usado quando o circuito abre).
CREATE OR REPLACE FUNCTION public.defer_scrape_task(
  _id uuid,
  _delay_secs integer DEFAULT 60,
  _reason text DEFAULT 'circuit_open'
)
RETURNS scrape_queue_status
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_task public.scrape_queue;
BEGIN
  IF auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION 'Somente o worker do sistema pode adiar tarefas';
  END IF;

  SELECT * INTO v_task FROM public.scrape_queue WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tarefa não encontrada';
  END IF;

  -- NÃO incrementa attempts: um deferral é uma espera pela recuperação do
  -- provedor, não uma tentativa falha. Apenas empurra next_run_at e solta o lock.
  UPDATE public.scrape_queue
  SET status = 'queued',
      last_error = concat('deferred: ', _reason),
      next_run_at = now() + make_interval(secs => GREATEST(_delay_secs, 1)),
      locked_at = NULL,
      locked_by = NULL,
      updated_at = now()
  WHERE id = _id;

  RETURN 'queued';
END;
$function$;

-- Garante a linha de controle do circuit breaker do provedor gmaps.
INSERT INTO public.circuit_breakers (service_name, state, failure_count, threshold, reset_timeout_ms)
VALUES ('gmaps', 'closed', 0, 5, 60000)
ON CONFLICT (service_name) DO NOTHING;