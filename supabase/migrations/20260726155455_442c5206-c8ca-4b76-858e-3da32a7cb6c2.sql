CREATE TABLE public.queue_sla_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  queue_kind text NOT NULL,
  old_sla_seconds integer,
  new_sla_seconds integer NOT NULL,
  source text NOT NULL,
  changed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.queue_sla_history TO authenticated;
GRANT ALL ON public.queue_sla_history TO service_role;

ALTER TABLE public.queue_sla_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "queue_sla_history_admin_select" ON public.queue_sla_history
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_queue_sla_history_kind_created
  ON public.queue_sla_history (queue_kind, created_at DESC);

CREATE OR REPLACE FUNCTION public.log_queue_sla_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.queue_sla_history (queue_kind, old_sla_seconds, new_sla_seconds, source, changed_by)
    VALUES (NEW.queue_kind, NULL, NEW.sla_seconds, NEW.source, auth.uid());
    RETURN NEW;
  END IF;

  IF NEW.sla_seconds IS DISTINCT FROM OLD.sla_seconds THEN
    INSERT INTO public.queue_sla_history (queue_kind, old_sla_seconds, new_sla_seconds, source, changed_by)
    VALUES (NEW.queue_kind, OLD.sla_seconds, NEW.sla_seconds, NEW.source, auth.uid());
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_log_queue_sla_change
  AFTER INSERT OR UPDATE ON public.queue_sla_defaults
  FOR EACH ROW EXECUTE FUNCTION public.log_queue_sla_change();

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
  FOR d IN SELECT * FROM public.queue_sla_defaults ORDER BY queue_kind LOOP
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

    SELECT * INTO r
      FROM public.sla_recommendations(GREATEST(1, LEAST(720, COALESCE(p_hours, 168))))
     WHERE public.sla_recommendations.queue_kind = d.queue_kind;

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

    UPDATE public.queue_sla_defaults
       SET sla_seconds = r.recommended_sla_seconds,
           source = 'recommendation',
           last_applied_at = now()
     WHERE public.queue_sla_defaults.queue_kind = d.queue_kind;

    new_sla_seconds := r.recommended_sla_seconds;
    applied := true;
    reason := 'drift_' || ROUND(v_drift, 1)::text || '_pct';
    RETURN NEXT;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.auto_tune_queue_slas(integer, numeric) FROM public;
GRANT EXECUTE ON FUNCTION public.auto_tune_queue_slas(integer, numeric) TO service_role;
REVOKE ALL ON FUNCTION public.log_queue_sla_change() FROM public;