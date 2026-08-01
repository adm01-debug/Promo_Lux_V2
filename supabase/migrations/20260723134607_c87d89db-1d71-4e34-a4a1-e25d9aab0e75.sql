
-- ============================================================================
-- Rodada #39 · G4 (parte 2) — remove double-count em fail_scrape_task.
-- Agora que claim_scrape_tasks incrementa attempts, fail_scrape_task apenas
-- decide entre requeue/dead usando o valor já persistido.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.fail_scrape_task(
  _id uuid, _error text, _transient boolean DEFAULT true
)
RETURNS public.scrape_queue_status
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_task   public.scrape_queue;
  v_delay  NUMERIC;
  v_jitter NUMERIC;
BEGIN
  IF auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION 'Somente o worker do sistema pode falhar tarefas';
  END IF;

  SELECT * INTO v_task FROM public.scrape_queue WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tarefa não encontrada';
  END IF;

  -- attempts já foi incrementado por claim_scrape_tasks — NÃO incrementa aqui.

  IF NOT _transient OR v_task.attempts >= v_task.max_attempts THEN
    INSERT INTO public.scrape_dead_letter (
      queue_id, organization_id, user_id, scrape_job_id, source, payload, attempts, last_error
    ) VALUES (
      v_task.id, v_task.organization_id, v_task.user_id, v_task.scrape_job_id,
      v_task.source, v_task.payload, v_task.attempts, _error
    );

    UPDATE public.scrape_queue
       SET status = 'dead', last_error = _error,
           locked_at = NULL, locked_by = NULL, updated_at = now()
     WHERE id = _id;

    IF v_task.scrape_job_id IS NOT NULL THEN
      UPDATE public.scrape_jobs
         SET status = 'failed', error_message = _error, updated_at = now()
       WHERE id = v_task.scrape_job_id;
    END IF;

    RETURN 'dead';
  END IF;

  v_delay := LEAST(
    v_task.base_delay_secs * power(2, v_task.attempts - 1),
    v_task.max_delay_secs
  );
  v_jitter := v_delay * 0.2 * random();

  UPDATE public.scrape_queue
     SET status = 'queued', last_error = _error,
         next_run_at = now() + make_interval(secs => (v_delay + v_jitter)),
         locked_at = NULL, locked_by = NULL, updated_at = now()
   WHERE id = _id;

  RETURN 'queued';
END;
$function$;
