-- ============================================================
-- SCRAPING QUEUE with exponential retries + dead-letter queue
-- ============================================================

DO $$ BEGIN
  CREATE TYPE public.scrape_queue_status AS ENUM ('queued','processing','succeeded','dead');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------- Queue table ----------
CREATE TABLE IF NOT EXISTS public.scrape_queue (
  id               UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id  UUID NOT NULL,
  user_id          UUID NOT NULL,
  scrape_job_id    UUID REFERENCES public.scrape_jobs(id) ON DELETE SET NULL,
  source           TEXT NOT NULL DEFAULT 'gmaps',
  payload          JSONB NOT NULL DEFAULT '{}'::jsonb,
  status           public.scrape_queue_status NOT NULL DEFAULT 'queued',
  attempts         INTEGER NOT NULL DEFAULT 0,
  max_attempts     INTEGER NOT NULL DEFAULT 5,
  priority         INTEGER NOT NULL DEFAULT 0,
  base_delay_secs  INTEGER NOT NULL DEFAULT 30,
  max_delay_secs   INTEGER NOT NULL DEFAULT 3600,
  next_run_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  locked_at        TIMESTAMPTZ,
  locked_by        TEXT,
  last_error       TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Polling index: due tasks first, honoring priority.
CREATE INDEX IF NOT EXISTS idx_scrape_queue_due
  ON public.scrape_queue (status, next_run_at, priority DESC)
  WHERE status = 'queued';
CREATE INDEX IF NOT EXISTS idx_scrape_queue_org ON public.scrape_queue (organization_id);

GRANT SELECT ON public.scrape_queue TO authenticated;
GRANT ALL ON public.scrape_queue TO service_role;

ALTER TABLE public.scrape_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members view scrape queue"
  ON public.scrape_queue FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));

CREATE TRIGGER trg_scrape_queue_updated_at
  BEFORE UPDATE ON public.scrape_queue
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------- Dead-letter table ----------
CREATE TABLE IF NOT EXISTS public.scrape_dead_letter (
  id               UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  queue_id         UUID,
  organization_id  UUID NOT NULL,
  user_id          UUID NOT NULL,
  scrape_job_id    UUID,
  source           TEXT NOT NULL DEFAULT 'gmaps',
  payload          JSONB NOT NULL DEFAULT '{}'::jsonb,
  attempts         INTEGER NOT NULL DEFAULT 0,
  last_error       TEXT,
  failed_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  replayed_at      TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scrape_dlq_org ON public.scrape_dead_letter (organization_id, failed_at DESC);

GRANT SELECT ON public.scrape_dead_letter TO authenticated;
GRANT ALL ON public.scrape_dead_letter TO service_role;

ALTER TABLE public.scrape_dead_letter ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members view dead letter"
  ON public.scrape_dead_letter FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));

-- ============================================================
-- RPCs
-- ============================================================

-- Enqueue a task (authenticated org member).
CREATE OR REPLACE FUNCTION public.enqueue_scrape_task(
  _scrape_job_id UUID,
  _source TEXT DEFAULT 'gmaps',
  _payload JSONB DEFAULT '{}'::jsonb,
  _max_attempts INTEGER DEFAULT 5,
  _priority INTEGER DEFAULT 0
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_org  UUID;
  v_id   UUID;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  IF _scrape_job_id IS NOT NULL THEN
    SELECT organization_id INTO v_org FROM public.scrape_jobs WHERE id = _scrape_job_id;
  END IF;
  v_org := COALESCE(v_org, public.default_org_for_current_user());

  IF v_org IS NULL OR NOT public.is_org_member(v_org, v_user) THEN
    RAISE EXCEPTION 'Acesso negado à organização';
  END IF;

  INSERT INTO public.scrape_queue (
    organization_id, user_id, scrape_job_id, source, payload,
    max_attempts, priority, next_run_at
  ) VALUES (
    v_org, v_user, _scrape_job_id, _source, COALESCE(_payload, '{}'::jsonb),
    GREATEST(_max_attempts, 1), _priority, now()
  ) RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.enqueue_scrape_task(UUID, TEXT, JSONB, INTEGER, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enqueue_scrape_task(UUID, TEXT, JSONB, INTEGER, INTEGER) TO authenticated, service_role;

-- Claim due tasks atomically (service_role / worker only).
CREATE OR REPLACE FUNCTION public.claim_scrape_tasks(_limit INTEGER DEFAULT 5, _worker TEXT DEFAULT 'worker')
RETURNS SETOF public.scrape_queue
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only the backend worker (no JWT) may claim tasks.
  IF auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION 'Somente o worker do sistema pode reservar tarefas';
  END IF;

  RETURN QUERY
  WITH due AS (
    SELECT q.id
    FROM public.scrape_queue q
    WHERE q.status = 'queued' AND q.next_run_at <= now()
    ORDER BY q.priority DESC, q.next_run_at ASC
    LIMIT GREATEST(_limit, 1)
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.scrape_queue q
  SET status = 'processing', locked_at = now(), locked_by = _worker, updated_at = now()
  FROM due
  WHERE q.id = due.id
  RETURNING q.*;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_scrape_tasks(INTEGER, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_scrape_tasks(INTEGER, TEXT) TO service_role;

-- Mark a task succeeded.
CREATE OR REPLACE FUNCTION public.complete_scrape_task(_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION 'Somente o worker do sistema pode concluir tarefas';
  END IF;
  UPDATE public.scrape_queue
  SET status = 'succeeded', locked_at = NULL, locked_by = NULL, last_error = NULL, updated_at = now()
  WHERE id = _id;
END;
$$;

REVOKE ALL ON FUNCTION public.complete_scrape_task(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_scrape_task(UUID) TO service_role;

-- Fail a task: exponential backoff retry, or move to dead-letter when exhausted.
CREATE OR REPLACE FUNCTION public.fail_scrape_task(_id UUID, _error TEXT, _transient BOOLEAN DEFAULT true)
RETURNS public.scrape_queue_status
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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

  v_task.attempts := v_task.attempts + 1;

  -- Move to dead-letter when non-retryable OR attempts exhausted.
  IF NOT _transient OR v_task.attempts >= v_task.max_attempts THEN
    INSERT INTO public.scrape_dead_letter (
      queue_id, organization_id, user_id, scrape_job_id, source, payload, attempts, last_error
    ) VALUES (
      v_task.id, v_task.organization_id, v_task.user_id, v_task.scrape_job_id,
      v_task.source, v_task.payload, v_task.attempts, _error
    );

    UPDATE public.scrape_queue
    SET status = 'dead', attempts = v_task.attempts, last_error = _error,
        locked_at = NULL, locked_by = NULL, updated_at = now()
    WHERE id = _id;

    IF v_task.scrape_job_id IS NOT NULL THEN
      UPDATE public.scrape_jobs
      SET status = 'failed', error_message = _error, updated_at = now()
      WHERE id = v_task.scrape_job_id;
    END IF;

    RETURN 'dead';
  END IF;

  -- Exponential backoff with 20% jitter, capped at max_delay_secs.
  v_delay := LEAST(
    v_task.base_delay_secs * power(2, v_task.attempts - 1),
    v_task.max_delay_secs
  );
  v_jitter := v_delay * 0.2 * random();

  UPDATE public.scrape_queue
  SET status = 'queued', attempts = v_task.attempts, last_error = _error,
      next_run_at = now() + make_interval(secs => (v_delay + v_jitter)),
      locked_at = NULL, locked_by = NULL, updated_at = now()
  WHERE id = _id;

  RETURN 'queued';
END;
$$;

REVOKE ALL ON FUNCTION public.fail_scrape_task(UUID, TEXT, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fail_scrape_task(UUID, TEXT, BOOLEAN) TO service_role;

-- Replay a dead-letter item back into the queue (authenticated org member).
CREATE OR REPLACE FUNCTION public.replay_dead_letter(_dlq_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_dlq public.scrape_dead_letter;
  v_new UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  SELECT * INTO v_dlq FROM public.scrape_dead_letter WHERE id = _dlq_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Item não encontrado';
  END IF;

  IF NOT public.is_org_member(v_dlq.organization_id, auth.uid()) THEN
    RAISE EXCEPTION 'Acesso negado à organização';
  END IF;

  IF v_dlq.replayed_at IS NOT NULL THEN
    RAISE EXCEPTION 'Item já reprocessado';
  END IF;

  INSERT INTO public.scrape_queue (
    organization_id, user_id, scrape_job_id, source, payload, next_run_at
  ) VALUES (
    v_dlq.organization_id, v_dlq.user_id, v_dlq.scrape_job_id, v_dlq.source, v_dlq.payload, now()
  ) RETURNING id INTO v_new;

  UPDATE public.scrape_dead_letter SET replayed_at = now() WHERE id = _dlq_id;

  IF v_dlq.scrape_job_id IS NOT NULL THEN
    UPDATE public.scrape_jobs SET status = 'pending', error_message = NULL, updated_at = now()
    WHERE id = v_dlq.scrape_job_id;
  END IF;

  RETURN v_new;
END;
$$;

REVOKE ALL ON FUNCTION public.replay_dead_letter(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.replay_dead_letter(UUID) TO authenticated, service_role;