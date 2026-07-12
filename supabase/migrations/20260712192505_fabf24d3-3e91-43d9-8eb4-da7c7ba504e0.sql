CREATE OR REPLACE FUNCTION public.replay_dead_letter_batch(
  _organization_id uuid DEFAULT NULL,
  _limit integer DEFAULT 500
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user  uuid := auth.uid();
  v_dlq   public.scrape_dead_letter;
  v_count integer := 0;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  -- Se uma organização foi informada, valida associação antecipadamente.
  IF _organization_id IS NOT NULL
     AND NOT public.is_org_member(_organization_id, v_user) THEN
    RAISE EXCEPTION 'Acesso negado à organização';
  END IF;

  FOR v_dlq IN
    SELECT d.*
    FROM public.scrape_dead_letter d
    WHERE d.replayed_at IS NULL
      AND (_organization_id IS NULL OR d.organization_id = _organization_id)
      AND public.is_org_member(d.organization_id, v_user)
    ORDER BY d.failed_at ASC
    LIMIT GREATEST(_limit, 1)
    FOR UPDATE SKIP LOCKED
  LOOP
    INSERT INTO public.scrape_queue (
      organization_id, user_id, scrape_job_id, source, payload, next_run_at
    ) VALUES (
      v_dlq.organization_id, v_dlq.user_id, v_dlq.scrape_job_id, v_dlq.source, v_dlq.payload, now()
    );

    UPDATE public.scrape_dead_letter SET replayed_at = now() WHERE id = v_dlq.id;

    IF v_dlq.scrape_job_id IS NOT NULL THEN
      UPDATE public.scrape_jobs SET status = 'pending', error_message = NULL, updated_at = now()
      WHERE id = v_dlq.scrape_job_id;
    END IF;

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$function$;

REVOKE ALL ON FUNCTION public.replay_dead_letter_batch(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.replay_dead_letter_batch(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.replay_dead_letter_batch(uuid, integer) TO service_role;