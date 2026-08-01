CREATE OR REPLACE FUNCTION public.auto_tune_queue_slas(p_hours integer DEFAULT 168, p_min_drift_pct numeric DEFAULT 20)
RETURNS TABLE (queue_kind text, old_sla_seconds integer, new_sla_seconds integer, applied boolean, reason text)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  d record;
  r record;
  v_drift numeric;
BEGIN
  FOR d IN SELECT * FROM public.queue_sla_defaults ORDER BY public.queue_sla_defaults.queue_kind LOOP
    queue_kind := d.queue_kind;
    old_sla_seconds := d.sla_seconds;
    new_sla_seconds := d.sla_seconds;
    applied := false;
    reason := NULL;

    IF NOT d.auto_tune THEN
      reason := 'auto_tune_disabled';
      RETURN NEXT;
      CONTINUE;
    END IF;

    SELECT rec.recommended_sla_seconds AS recommended_sla_seconds, rec.verdict AS verdict
      INTO r
      FROM public.sla_recommendations(GREATEST(1, LEAST(720, COALESCE(p_hours, 168)))) AS rec
     WHERE rec.queue_kind = d.queue_kind;

    IF r IS NULL OR r.recommended_sla_seconds IS NULL OR r.verdict = 'insufficient_data' THEN
      reason := 'insufficient_data';
      RETURN NEXT;
      CONTINUE;
    END IF;

    v_drift := ABS(r.recommended_sla_seconds - d.sla_seconds)::numeric
               / GREATEST(1, d.sla_seconds)::numeric * 100;

    IF v_drift < COALESCE(p_min_drift_pct, 20) THEN
      reason := 'within_tolerance';
      RETURN NEXT;
      CONTINUE;
    END IF;

    UPDATE public.queue_sla_defaults q
       SET sla_seconds = r.recommended_sla_seconds,
           source = 'recommendation',
           last_applied_at = now()
     WHERE q.queue_kind = d.queue_kind;

    new_sla_seconds := r.recommended_sla_seconds;
    applied := true;
    reason := 'drift_' || ROUND(v_drift, 1)::text || '_pct';
    RETURN NEXT;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.auto_tune_queue_slas(integer, numeric) FROM public;
GRANT EXECUTE ON FUNCTION public.auto_tune_queue_slas(integer, numeric) TO service_role;