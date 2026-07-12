-- ============================================================
-- TABELA DE LOGS DE EXECUÇÃO DE AUTOMAÇÃO
-- ============================================================
CREATE TABLE public.automation_execution_logs (
  id               uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id  uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id          uuid,
  workflow_id      uuid,
  run_id           uuid,
  scrape_job_id    uuid,
  queue_task_id    uuid,
  source           text NOT NULL DEFAULT 'system',
  step_name        text,
  step_index       integer,
  phase            text NOT NULL DEFAULT 'execute'
                     CHECK (phase IN ('claim','execute','complete','fail','retry','dead_letter','cancel')),
  status           text NOT NULL DEFAULT 'started'
                     CHECK (status IN ('started','succeeded','failed','retrying','dead','cancelled')),
  level            text NOT NULL DEFAULT 'info'
                     CHECK (level IN ('info','warn','error')),
  message          text,
  failure_reason   text,
  error_detail     text,
  http_status      integer,
  transient        boolean,
  duration_ms      integer,
  attempt          integer,
  max_attempts     integer,
  correlation_id   uuid,
  worker_id        text,
  metadata         jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- Índices para diagnóstico e rastreabilidade.
CREATE INDEX idx_autoexec_org_created    ON public.automation_execution_logs (organization_id, created_at DESC);
CREATE INDEX idx_autoexec_scrape_job     ON public.automation_execution_logs (scrape_job_id);
CREATE INDEX idx_autoexec_run            ON public.automation_execution_logs (run_id);
CREATE INDEX idx_autoexec_queue_task     ON public.automation_execution_logs (queue_task_id);
CREATE INDEX idx_autoexec_correlation    ON public.automation_execution_logs (correlation_id);
CREATE INDEX idx_autoexec_errors         ON public.automation_execution_logs (organization_id, created_at DESC)
                                          WHERE level = 'error';

GRANT SELECT, INSERT ON public.automation_execution_logs TO authenticated;
GRANT ALL ON public.automation_execution_logs TO service_role;

ALTER TABLE public.automation_execution_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Membros veem logs de automação da sua organização"
  ON public.automation_execution_logs FOR SELECT
  TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));

CREATE POLICY "Membros registram logs na sua organização"
  ON public.automation_execution_logs FOR INSERT
  TO authenticated
  WITH CHECK (public.is_org_member(organization_id, auth.uid()));

CREATE POLICY "Admins removem logs de automação"
  ON public.automation_execution_logs FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- ============================================================
-- RPC DE REGISTRO (worker do sistema + membros da organização)
-- ============================================================
CREATE OR REPLACE FUNCTION public.log_automation_event(
  _organization_id uuid,
  _phase           text,
  _status          text,
  _level           text DEFAULT 'info',
  _message         text DEFAULT NULL,
  _failure_reason  text DEFAULT NULL,
  _error_detail    text DEFAULT NULL,
  _source          text DEFAULT 'system',
  _workflow_id     uuid DEFAULT NULL,
  _run_id          uuid DEFAULT NULL,
  _scrape_job_id   uuid DEFAULT NULL,
  _queue_task_id   uuid DEFAULT NULL,
  _step_name       text DEFAULT NULL,
  _step_index      integer DEFAULT NULL,
  _http_status     integer DEFAULT NULL,
  _transient       boolean DEFAULT NULL,
  _duration_ms     integer DEFAULT NULL,
  _attempt         integer DEFAULT NULL,
  _max_attempts    integer DEFAULT NULL,
  _correlation_id  uuid DEFAULT NULL,
  _worker_id       text DEFAULT NULL,
  _metadata        jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF _organization_id IS NULL THEN
    RAISE EXCEPTION 'organization_id é obrigatório';
  END IF;

  -- Usuário autenticado só registra na própria organização;
  -- o worker do sistema (service_role, auth.uid() NULL) registra em qualquer uma.
  IF auth.uid() IS NOT NULL AND NOT public.is_org_member(_organization_id, auth.uid()) THEN
    RAISE EXCEPTION 'Acesso negado à organização';
  END IF;

  INSERT INTO public.automation_execution_logs (
    organization_id, user_id, workflow_id, run_id, scrape_job_id, queue_task_id,
    source, step_name, step_index, phase, status, level, message,
    failure_reason, error_detail, http_status, transient, duration_ms,
    attempt, max_attempts, correlation_id, worker_id, metadata
  ) VALUES (
    _organization_id, auth.uid(), _workflow_id, _run_id, _scrape_job_id, _queue_task_id,
    COALESCE(_source, 'system'), _step_name, _step_index, _phase, _status, COALESCE(_level,'info'), _message,
    _failure_reason, _error_detail, _http_status, _transient, _duration_ms,
    _attempt, _max_attempts, _correlation_id, _worker_id, COALESCE(_metadata, '{}'::jsonb)
  ) RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.log_automation_event(
  uuid, text, text, text, text, text, text, text, uuid, uuid, uuid, uuid,
  text, integer, integer, boolean, integer, integer, integer, uuid, text, jsonb
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_automation_event(
  uuid, text, text, text, text, text, text, text, uuid, uuid, uuid, uuid,
  text, integer, integer, boolean, integer, integer, integer, uuid, text, jsonb
) TO authenticated;
