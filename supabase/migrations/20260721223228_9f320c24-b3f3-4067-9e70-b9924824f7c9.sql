
-- =============================================================================
-- Motor Nativo de Scrape Web — Migration base (Opção C, Dia 1)
-- =============================================================================

DO $$ BEGIN
  CREATE TYPE public.web_scrape_status AS ENUM ('queued','processing','succeeded','failed','dead');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 1. web_scrape_queue ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.web_scrape_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  url TEXT NOT NULL,
  formats TEXT[] NOT NULL DEFAULT ARRAY['markdown']::TEXT[],
  extract_schema JSONB,
  extract_schema_hash TEXT,
  wait_for_ms INTEGER NOT NULL DEFAULT 0,
  max_bytes INTEGER NOT NULL DEFAULT 2097152,
  config_hash TEXT NOT NULL,
  trace_id UUID NOT NULL DEFAULT gen_random_uuid(),
  status public.web_scrape_status NOT NULL DEFAULT 'queued',
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 5,
  priority INTEGER NOT NULL DEFAULT 0,
  next_run_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  locked_at TIMESTAMPTZ,
  locked_by TEXT,
  last_error TEXT,
  result_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT web_scrape_queue_url_http CHECK (url ~* '^https?://'),
  CONSTRAINT web_scrape_queue_max_bytes_range CHECK (max_bytes BETWEEN 1024 AND 10485760),
  CONSTRAINT web_scrape_queue_wait_range CHECK (wait_for_ms BETWEEN 0 AND 15000)
);

CREATE INDEX IF NOT EXISTS idx_web_scrape_queue_due
  ON public.web_scrape_queue (status, next_run_at) WHERE status = 'queued';
CREATE INDEX IF NOT EXISTS idx_web_scrape_queue_org
  ON public.web_scrape_queue (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_web_scrape_queue_trace
  ON public.web_scrape_queue (trace_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_web_scrape_queue_idempotent
  ON public.web_scrape_queue (organization_id, config_hash)
  WHERE status IN ('queued','processing');

GRANT SELECT ON public.web_scrape_queue TO authenticated;
GRANT ALL ON public.web_scrape_queue TO service_role;
ALTER TABLE public.web_scrape_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "web_scrape_queue_org_select" ON public.web_scrape_queue
  FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));

CREATE TRIGGER trg_web_scrape_queue_updated_at
  BEFORE UPDATE ON public.web_scrape_queue
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. web_scrape_results -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.web_scrape_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  queue_task_id UUID REFERENCES public.web_scrape_queue(id) ON DELETE SET NULL,
  trace_id UUID,
  url TEXT NOT NULL,
  final_url TEXT,
  http_status INTEGER,
  content_type TEXT,
  title TEXT,
  description TEXT,
  markdown TEXT,
  links JSONB NOT NULL DEFAULT '[]'::JSONB,
  extracted_json JSONB,
  extract_schema_hash TEXT,
  partial_content BOOLEAN NOT NULL DEFAULT false,
  bytes INTEGER,
  duration_ms INTEGER,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_web_scrape_results_org
  ON public.web_scrape_results (organization_id, fetched_at DESC);
CREATE INDEX IF NOT EXISTS idx_web_scrape_results_task
  ON public.web_scrape_results (queue_task_id);
CREATE INDEX IF NOT EXISTS idx_web_scrape_results_trace
  ON public.web_scrape_results (trace_id);

GRANT SELECT ON public.web_scrape_results TO authenticated;
GRANT ALL ON public.web_scrape_results TO service_role;
ALTER TABLE public.web_scrape_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "web_scrape_results_org_select" ON public.web_scrape_results
  FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));

-- 3. web_scrape_dead_letter ---------------------------------------------------
CREATE TABLE IF NOT EXISTS public.web_scrape_dead_letter (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  original_task_id UUID,
  url TEXT NOT NULL,
  payload JSONB NOT NULL,
  attempts INTEGER NOT NULL,
  last_error TEXT,
  failure_reason TEXT,
  trace_id UUID,
  failed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  replayed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_web_scrape_dl_org
  ON public.web_scrape_dead_letter (organization_id, failed_at DESC);
CREATE INDEX IF NOT EXISTS idx_web_scrape_dl_pending
  ON public.web_scrape_dead_letter (failed_at) WHERE replayed_at IS NULL;

GRANT SELECT ON public.web_scrape_dead_letter TO authenticated;
GRANT ALL ON public.web_scrape_dead_letter TO service_role;
ALTER TABLE public.web_scrape_dead_letter ENABLE ROW LEVEL SECURITY;

CREATE POLICY "web_scrape_dl_org_select" ON public.web_scrape_dead_letter
  FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));

-- 4. robots_cache -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.robots_cache (
  host TEXT PRIMARY KEY,
  robots_txt TEXT NOT NULL,
  http_status INTEGER,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '24 hours')
);

CREATE INDEX IF NOT EXISTS idx_robots_cache_expires ON public.robots_cache (expires_at);
GRANT SELECT ON public.robots_cache TO authenticated;
GRANT ALL ON public.robots_cache TO service_role;
ALTER TABLE public.robots_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "robots_cache_read_all" ON public.robots_cache
  FOR SELECT TO authenticated USING (true);

-- 5. RPCs do worker -----------------------------------------------------------
CREATE OR REPLACE FUNCTION public.claim_web_scrape_tasks(
  _limit INTEGER DEFAULT 8, _worker TEXT DEFAULT 'web-worker'
) RETURNS SETOF public.web_scrape_queue
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION 'Somente o worker do sistema pode reservar tarefas';
  END IF;
  RETURN QUERY
  WITH due AS (
    SELECT q.id FROM public.web_scrape_queue q
    WHERE q.status = 'queued' AND q.next_run_at <= now()
    ORDER BY q.priority DESC, q.next_run_at ASC
    LIMIT GREATEST(_limit, 1) FOR UPDATE SKIP LOCKED
  )
  UPDATE public.web_scrape_queue q
  SET status = 'processing', locked_at = now(), locked_by = _worker,
      attempts = q.attempts + 1, updated_at = now()
  FROM due WHERE q.id = due.id
  RETURNING q.*;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_web_scrape_task(
  _id UUID, _result_id UUID DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION 'Somente o worker do sistema pode concluir tarefas';
  END IF;
  UPDATE public.web_scrape_queue
  SET status = 'succeeded', locked_at = NULL, locked_by = NULL,
      last_error = NULL, result_id = COALESCE(_result_id, result_id), updated_at = now()
  WHERE id = _id;
END;
$$;

CREATE OR REPLACE FUNCTION public.fail_web_scrape_task(
  _id UUID, _error TEXT, _transient BOOLEAN DEFAULT true, _failure_reason TEXT DEFAULT NULL
) RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_task public.web_scrape_queue;
  v_delay INTEGER;
BEGIN
  IF auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION 'Somente o worker do sistema pode falhar tarefas';
  END IF;
  SELECT * INTO v_task FROM public.web_scrape_queue WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Tarefa não encontrada'; END IF;

  IF NOT _transient OR v_task.attempts >= v_task.max_attempts THEN
    INSERT INTO public.web_scrape_dead_letter (
      organization_id, user_id, original_task_id, url, payload,
      attempts, last_error, failure_reason, trace_id
    ) VALUES (
      v_task.organization_id, v_task.user_id, v_task.id, v_task.url,
      jsonb_build_object(
        'formats', v_task.formats, 'extract_schema', v_task.extract_schema,
        'wait_for_ms', v_task.wait_for_ms, 'max_bytes', v_task.max_bytes
      ),
      v_task.attempts, _error, _failure_reason, v_task.trace_id
    );
    UPDATE public.web_scrape_queue
    SET status = 'dead', locked_at = NULL, locked_by = NULL,
        last_error = _error, updated_at = now()
    WHERE id = _id;
    RETURN 'dead';
  END IF;

  v_delay := LEAST(30 * (3 ^ GREATEST(v_task.attempts - 1, 0)), 3600)::INTEGER;
  UPDATE public.web_scrape_queue
  SET status = 'queued', locked_at = NULL, locked_by = NULL, last_error = _error,
      next_run_at = now() + make_interval(secs => v_delay), updated_at = now()
  WHERE id = _id;
  RETURN 'retrying';
END;
$$;

CREATE OR REPLACE FUNCTION public.defer_web_scrape_task(
  _id UUID, _delay_secs INTEGER DEFAULT 60, _reason TEXT DEFAULT 'circuit_open'
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION 'Somente o worker do sistema pode adiar tarefas';
  END IF;
  UPDATE public.web_scrape_queue
  SET status = 'queued', attempts = GREATEST(attempts - 1, 0),
      last_error = concat('deferred: ', _reason),
      next_run_at = now() + make_interval(secs => GREATEST(_delay_secs, 1)),
      locked_at = NULL, locked_by = NULL, updated_at = now()
  WHERE id = _id;
END;
$$;

CREATE OR REPLACE FUNCTION public.replay_web_dead_letter_batch(
  _organization_id UUID DEFAULT NULL, _limit INTEGER DEFAULT 200
) RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user UUID := auth.uid();
  v_dlq public.web_scrape_dead_letter;
  v_count INTEGER := 0;
  v_payload JSONB;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  IF _organization_id IS NOT NULL AND NOT public.is_org_member(_organization_id, v_user) THEN
    RAISE EXCEPTION 'Acesso negado à organização';
  END IF;

  FOR v_dlq IN
    SELECT d.* FROM public.web_scrape_dead_letter d
    WHERE d.replayed_at IS NULL
      AND (_organization_id IS NULL OR d.organization_id = _organization_id)
      AND public.is_org_member(d.organization_id, v_user)
    ORDER BY d.failed_at ASC LIMIT GREATEST(_limit, 1) FOR UPDATE SKIP LOCKED
  LOOP
    v_payload := v_dlq.payload;
    INSERT INTO public.web_scrape_queue (
      organization_id, user_id, url, formats, extract_schema,
      wait_for_ms, max_bytes, config_hash, trace_id, next_run_at
    ) VALUES (
      v_dlq.organization_id, v_dlq.user_id, v_dlq.url,
      COALESCE(ARRAY(SELECT jsonb_array_elements_text(v_payload->'formats')), ARRAY['markdown']),
      v_payload->'extract_schema',
      COALESCE((v_payload->>'wait_for_ms')::INTEGER, 0),
      COALESCE((v_payload->>'max_bytes')::INTEGER, 2097152),
      encode(gen_random_bytes(16), 'hex'),
      COALESCE(v_dlq.trace_id, gen_random_uuid()), now()
    );
    UPDATE public.web_scrape_dead_letter SET replayed_at = now() WHERE id = v_dlq.id;
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.web_dlq_health_metrics()
RETURNS TABLE(
  total_items BIGINT, pending_items BIGINT, replayed_items BIGINT,
  oldest_pending_age_secs NUMERIC, added_last_24h BIGINT, replayed_last_24h BIGINT
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH scoped AS (
    SELECT d.* FROM public.web_scrape_dead_letter d
    WHERE auth.uid() IS NOT NULL AND public.is_org_member(d.organization_id, auth.uid())
  )
  SELECT count(*)::BIGINT,
    count(*) FILTER (WHERE replayed_at IS NULL)::BIGINT,
    count(*) FILTER (WHERE replayed_at IS NOT NULL)::BIGINT,
    COALESCE(EXTRACT(EPOCH FROM (now() - min(failed_at) FILTER (WHERE replayed_at IS NULL))), 0)::NUMERIC,
    count(*) FILTER (WHERE failed_at >= now() - interval '24 hours')::BIGINT,
    count(*) FILTER (WHERE replayed_at >= now() - interval '24 hours')::BIGINT
  FROM scoped;
$$;

REVOKE ALL ON FUNCTION public.claim_web_scrape_tasks(INTEGER, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_web_scrape_task(UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fail_web_scrape_task(UUID, TEXT, BOOLEAN, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.defer_web_scrape_task(UUID, INTEGER, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.replay_web_dead_letter_batch(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.web_dlq_health_metrics() TO authenticated;

-- 6. Feature flags ------------------------------------------------------------
INSERT INTO public.feature_flags (flag_key, is_enabled, organization_id) VALUES
  ('web_scrape_enabled', false, NULL),
  ('web_scrape_extract_enabled', false, NULL),
  ('chaos_web_enabled', false, NULL)
ON CONFLICT DO NOTHING;
