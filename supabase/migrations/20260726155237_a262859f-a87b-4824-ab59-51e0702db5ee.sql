CREATE TABLE public.queue_sla_defaults (
  queue_kind text PRIMARY KEY CHECK (queue_kind IN ('scrape','web','instagram')),
  sla_seconds integer NOT NULL CHECK (sla_seconds BETWEEN 60 AND 3600),
  auto_tune boolean NOT NULL DEFAULT true,
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','recommendation','seed')),
  last_applied_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.queue_sla_defaults TO authenticated;
GRANT ALL ON public.queue_sla_defaults TO service_role;

ALTER TABLE public.queue_sla_defaults ENABLE ROW LEVEL SECURITY;

CREATE POLICY "queue_sla_defaults_select" ON public.queue_sla_defaults
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "queue_sla_defaults_admin_insert" ON public.queue_sla_defaults
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "queue_sla_defaults_admin_update" ON public.queue_sla_defaults
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_queue_sla_defaults_updated_at
  BEFORE UPDATE ON public.queue_sla_defaults
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.queue_sla_defaults (queue_kind, sla_seconds, source)
VALUES ('scrape', 300, 'seed'), ('web', 300, 'seed'), ('instagram', 600, 'seed');

CREATE OR REPLACE FUNCTION public.default_sla_seconds(_queue_kind text)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT sla_seconds FROM public.queue_sla_defaults WHERE queue_kind = _queue_kind),
    300
  );
$$;

ALTER TABLE public.scrape_queue
  ALTER COLUMN sla_seconds SET DEFAULT public.default_sla_seconds('scrape');
ALTER TABLE public.web_scrape_queue
  ALTER COLUMN sla_seconds SET DEFAULT public.default_sla_seconds('web');
ALTER TABLE public.instagram_scrape_queue
  ALTER COLUMN sla_seconds SET DEFAULT public.default_sla_seconds('instagram');

CREATE OR REPLACE FUNCTION public.apply_sla_recommendation(p_queue_kind text, p_hours integer DEFAULT 168)
RETURNS public.queue_sla_defaults
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rec record;
  v_row public.queue_sla_defaults;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'forbidden: admin role required';
  END IF;

  IF p_queue_kind NOT IN ('scrape','web','instagram') THEN
    RAISE EXCEPTION 'invalid queue_kind: %', p_queue_kind;
  END IF;

  SELECT * INTO v_rec
    FROM public.sla_recommendations(GREATEST(1, LEAST(720, COALESCE(p_hours, 168))))
   WHERE queue_kind = p_queue_kind;

  IF v_rec IS NULL OR v_rec.recommended_sla_seconds IS NULL THEN
    RAISE EXCEPTION 'no recommendation available for queue %', p_queue_kind;
  END IF;

  IF v_rec.verdict = 'insufficient_data' THEN
    RAISE EXCEPTION 'insufficient sample for queue %', p_queue_kind;
  END IF;

  INSERT INTO public.queue_sla_defaults (queue_kind, sla_seconds, source, last_applied_at)
  VALUES (p_queue_kind, v_rec.recommended_sla_seconds, 'recommendation', now())
  ON CONFLICT (queue_kind) DO UPDATE
    SET sla_seconds = EXCLUDED.sla_seconds,
        source = 'recommendation',
        last_applied_at = now()
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_sla_recommendation(text, integer) FROM public;
GRANT EXECUTE ON FUNCTION public.apply_sla_recommendation(text, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.default_sla_seconds(text) TO authenticated, service_role, anon;