CREATE TABLE IF NOT EXISTS public.apollo_search_cache (
  cache_key text PRIMARY KEY,
  domain text NOT NULL,
  status text NOT NULL CHECK (status IN ('hit','empty')),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  contact_count integer NOT NULL DEFAULT 0,
  hit_count integer NOT NULL DEFAULT 0,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS apollo_search_cache_expires_idx ON public.apollo_search_cache (expires_at);
CREATE INDEX IF NOT EXISTS apollo_search_cache_domain_idx ON public.apollo_search_cache (domain);

GRANT SELECT ON public.apollo_search_cache TO authenticated;
GRANT ALL ON public.apollo_search_cache TO service_role;
ALTER TABLE public.apollo_search_cache ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS apollo_cache_read_authenticated ON public.apollo_search_cache;
CREATE POLICY apollo_cache_read_authenticated ON public.apollo_search_cache
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS apollo_cache_service_all ON public.apollo_search_cache;
CREATE POLICY apollo_cache_service_all ON public.apollo_search_cache
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.apollo_rate_state (
  bucket text PRIMARY KEY DEFAULT 'global',
  window_start timestamptz NOT NULL DEFAULT date_trunc('minute', now()),
  request_count integer NOT NULL DEFAULT 0,
  limit_per_minute integer NOT NULL DEFAULT 20,
  day_start date NOT NULL DEFAULT (now() AT TIME ZONE 'UTC')::date,
  day_count integer NOT NULL DEFAULT 0,
  limit_per_day integer NOT NULL DEFAULT 400,
  disabled_until timestamptz,
  last_error text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.apollo_rate_state (bucket) VALUES ('global') ON CONFLICT (bucket) DO NOTHING;

GRANT SELECT ON public.apollo_rate_state TO authenticated;
GRANT ALL ON public.apollo_rate_state TO service_role;
ALTER TABLE public.apollo_rate_state ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS apollo_rate_read_authenticated ON public.apollo_rate_state;
CREATE POLICY apollo_rate_read_authenticated ON public.apollo_rate_state
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS apollo_rate_service_all ON public.apollo_rate_state;
CREATE POLICY apollo_rate_service_all ON public.apollo_rate_state
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.apollo_cache_get(p_key text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_row public.apollo_search_cache;
BEGIN
  UPDATE public.apollo_search_cache
     SET hit_count = hit_count + 1
   WHERE cache_key = p_key AND expires_at > now()
  RETURNING * INTO v_row;
  IF NOT FOUND THEN RETURN NULL; END IF;
  RETURN jsonb_build_object(
    'status', v_row.status,
    'payload', v_row.payload,
    'contact_count', v_row.contact_count,
    'fetched_at', v_row.fetched_at,
    'hit_count', v_row.hit_count
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.apollo_cache_put(
  p_key text, p_domain text, p_status text, p_payload jsonb,
  p_contact_count integer, p_ttl_seconds integer
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.apollo_search_cache
    (cache_key, domain, status, payload, contact_count, fetched_at, expires_at)
  VALUES
    (p_key, p_domain, p_status, COALESCE(p_payload, '{}'::jsonb), GREATEST(p_contact_count, 0),
     now(), now() + make_interval(secs => GREATEST(p_ttl_seconds, 60)))
  ON CONFLICT (cache_key) DO UPDATE SET
    domain = EXCLUDED.domain,
    status = EXCLUDED.status,
    payload = EXCLUDED.payload,
    contact_count = EXCLUDED.contact_count,
    fetched_at = EXCLUDED.fetched_at,
    expires_at = EXCLUDED.expires_at;

  DELETE FROM public.apollo_search_cache WHERE expires_at < now() - interval '7 days';
END;
$$;

CREATE OR REPLACE FUNCTION public.apollo_rate_consume()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v public.apollo_rate_state;
BEGIN
  INSERT INTO public.apollo_rate_state (bucket) VALUES ('global') ON CONFLICT (bucket) DO NOTHING;
  SELECT * INTO v FROM public.apollo_rate_state WHERE bucket = 'global' FOR UPDATE;

  IF v.disabled_until IS NOT NULL AND v.disabled_until > now() THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'cooldown',
      'retry_after_seconds', CEIL(EXTRACT(EPOCH FROM (v.disabled_until - now())))::int);
  END IF;

  IF v.window_start < date_trunc('minute', now()) THEN
    v.window_start := date_trunc('minute', now());
    v.request_count := 0;
  END IF;
  IF v.day_start < (now() AT TIME ZONE 'UTC')::date THEN
    v.day_start := (now() AT TIME ZONE 'UTC')::date;
    v.day_count := 0;
  END IF;

  IF v.day_count >= v.limit_per_day THEN
    UPDATE public.apollo_rate_state SET window_start = v.window_start, request_count = v.request_count,
      day_start = v.day_start, day_count = v.day_count, updated_at = now() WHERE bucket = 'global';
    RETURN jsonb_build_object('allowed', false, 'reason', 'daily_limit', 'retry_after_seconds', 3600);
  END IF;

  IF v.request_count >= v.limit_per_minute THEN
    UPDATE public.apollo_rate_state SET window_start = v.window_start, request_count = v.request_count,
      day_start = v.day_start, day_count = v.day_count, updated_at = now() WHERE bucket = 'global';
    RETURN jsonb_build_object('allowed', false, 'reason', 'minute_limit',
      'retry_after_seconds', GREATEST(1, 60 - EXTRACT(SECOND FROM now())::int));
  END IF;

  UPDATE public.apollo_rate_state
     SET window_start = v.window_start,
         request_count = v.request_count + 1,
         day_start = v.day_start,
         day_count = v.day_count + 1,
         disabled_until = NULL,
         updated_at = now()
   WHERE bucket = 'global';

  RETURN jsonb_build_object('allowed', true, 'reason', 'ok',
    'minute_remaining', v.limit_per_minute - v.request_count - 1,
    'daily_remaining', v.limit_per_day - v.day_count - 1);
END;
$$;

CREATE OR REPLACE FUNCTION public.apollo_rate_disable(p_seconds integer, p_reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.apollo_rate_state (bucket) VALUES ('global') ON CONFLICT (bucket) DO NOTHING;
  UPDATE public.apollo_rate_state
     SET disabled_until = now() + make_interval(secs => GREATEST(p_seconds, 60)),
         last_error = LEFT(COALESCE(p_reason, 'unknown'), 500),
         updated_at = now()
   WHERE bucket = 'global';
END;
$$;

REVOKE ALL ON FUNCTION public.apollo_cache_get(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.apollo_cache_put(text, text, text, jsonb, integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.apollo_rate_consume() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.apollo_rate_disable(integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apollo_cache_get(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.apollo_cache_put(text, text, text, jsonb, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.apollo_rate_consume() TO service_role;
GRANT EXECUTE ON FUNCTION public.apollo_rate_disable(integer, text) TO service_role;