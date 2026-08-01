
-- ============ CACHE ============
CREATE TABLE public.cnpj_enrich_cache (
  cnpj text PRIMARY KEY CHECK (cnpj ~ '^[0-9]{14}$'),
  source text NOT NULL,
  status text NOT NULL CHECK (status IN ('success','not_found')),
  payload jsonb,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  hit_count integer NOT NULL DEFAULT 0
);
GRANT SELECT ON public.cnpj_enrich_cache TO authenticated;
GRANT ALL ON public.cnpj_enrich_cache TO service_role;
ALTER TABLE public.cnpj_enrich_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cnpj_cache_read_authenticated" ON public.cnpj_enrich_cache
  FOR SELECT TO authenticated USING (true);
CREATE INDEX cnpj_enrich_cache_expires_idx ON public.cnpj_enrich_cache(expires_at);

-- ============ RATE STATE ============
CREATE TABLE public.cnpj_enrich_rate_state (
  source text PRIMARY KEY,
  window_start timestamptz NOT NULL DEFAULT date_trunc('minute', now()),
  request_count integer NOT NULL DEFAULT 0,
  limit_per_minute integer NOT NULL DEFAULT 5,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.cnpj_enrich_rate_state TO authenticated;
GRANT ALL ON public.cnpj_enrich_rate_state TO service_role;
ALTER TABLE public.cnpj_enrich_rate_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cnpj_rate_read_authenticated" ON public.cnpj_enrich_rate_state
  FOR SELECT TO authenticated USING (true);

-- ============ QUEUE ============
CREATE TABLE public.cnpj_enrich_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cnpj text NOT NULL CHECK (cnpj ~ '^[0-9]{14}$'),
  requested_by uuid,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','processing','completed','failed','not_found')),
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 5,
  next_retry_at timestamptz NOT NULL DEFAULT now(),
  last_error text,
  result jsonb,
  source text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.cnpj_enrich_queue TO authenticated;
GRANT ALL ON public.cnpj_enrich_queue TO service_role;
ALTER TABLE public.cnpj_enrich_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cnpj_queue_read_own" ON public.cnpj_enrich_queue
  FOR SELECT TO authenticated USING (requested_by = auth.uid());
CREATE POLICY "cnpj_queue_insert_own" ON public.cnpj_enrich_queue
  FOR INSERT TO authenticated WITH CHECK (requested_by = auth.uid());
CREATE INDEX cnpj_enrich_queue_due_idx
  ON public.cnpj_enrich_queue(status, next_retry_at)
  WHERE status = 'pending';
CREATE INDEX cnpj_enrich_queue_cnpj_idx ON public.cnpj_enrich_queue(cnpj);

CREATE TRIGGER trg_cnpj_enrich_queue_updated
  BEFORE UPDATE ON public.cnpj_enrich_queue
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ RATE RESERVE (atomic) ============
CREATE OR REPLACE FUNCTION public.cnpj_reserve_rate_slot(_source text, _limit_per_minute integer)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_window timestamptz := date_trunc('minute', now());
  v_count integer;
BEGIN
  INSERT INTO public.cnpj_enrich_rate_state(source, window_start, request_count, limit_per_minute)
  VALUES (_source, v_window, 0, _limit_per_minute)
  ON CONFLICT (source) DO NOTHING;

  UPDATE public.cnpj_enrich_rate_state
     SET window_start = v_window,
         request_count = 0,
         limit_per_minute = _limit_per_minute,
         updated_at = now()
   WHERE source = _source AND window_start < v_window;

  UPDATE public.cnpj_enrich_rate_state
     SET request_count = request_count + 1,
         updated_at = now()
   WHERE source = _source
     AND request_count < _limit_per_minute
  RETURNING request_count INTO v_count;

  RETURN v_count IS NOT NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.cnpj_reserve_rate_slot(text, integer) FROM public;
GRANT EXECUTE ON FUNCTION public.cnpj_reserve_rate_slot(text, integer) TO service_role;

-- ============ CLAIM JOBS (worker) ============
CREATE OR REPLACE FUNCTION public.cnpj_claim_enrich_jobs(_limit integer DEFAULT 10)
RETURNS SETOF public.cnpj_enrich_queue
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH picked AS (
    SELECT id
      FROM public.cnpj_enrich_queue
     WHERE status = 'pending'
       AND next_retry_at <= now()
     ORDER BY next_retry_at
     LIMIT _limit
     FOR UPDATE SKIP LOCKED
  )
  UPDATE public.cnpj_enrich_queue q
     SET status = 'processing',
         attempts = q.attempts + 1,
         updated_at = now()
    FROM picked
   WHERE q.id = picked.id
  RETURNING q.*;
END;
$$;
REVOKE ALL ON FUNCTION public.cnpj_claim_enrich_jobs(integer) FROM public;
GRANT EXECUTE ON FUNCTION public.cnpj_claim_enrich_jobs(integer) TO service_role;
