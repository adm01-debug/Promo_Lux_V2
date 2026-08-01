-- Histórico de sincronizações por conta de e-mail.
-- Escrito pelo edge function `email-poll-replies` a cada execução por conta,
-- permitindo auditar quando uma falha começou e o resultado de cada retry.
CREATE TABLE public.email_sync_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email_account_id uuid NOT NULL REFERENCES public.email_accounts(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL,
  scope_type text NOT NULL CHECK (scope_type IN ('user','organization')),
  provider text NOT NULL,
  status text NOT NULL CHECK (status IN ('success','error','skipped','refresh_failed')),
  scanned integer,
  inserted integer,
  attempt integer,
  max_attempts integer,
  next_retry_at timestamptz,
  reconnect_required boolean NOT NULL DEFAULT false,
  fatal boolean,
  skipped_reason text,
  error_message text,
  duration_ms integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_email_sync_log_account_created
  ON public.email_sync_log (email_account_id, created_at DESC);
CREATE INDEX idx_email_sync_log_org_created
  ON public.email_sync_log (organization_id, created_at DESC);

ALTER TABLE public.email_sync_log ENABLE ROW LEVEL SECURITY;

-- Mesma regra de visibilidade de email_accounts: dono vê pessoais,
-- membros da org veem compartilhadas. Service role faz tudo.
CREATE POLICY "View sync log by account scope"
ON public.email_sync_log
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.email_accounts ea
    WHERE ea.id = email_sync_log.email_account_id
      AND (
        (ea.scope_type = 'user' AND ea.user_id = auth.uid())
        OR (ea.scope_type = 'organization' AND public.is_org_member(ea.organization_id, auth.uid()))
      )
  )
);

CREATE POLICY "Service manage email_sync_log"
ON public.email_sync_log
FOR ALL TO service_role
USING (true) WITH CHECK (true);

COMMENT ON TABLE public.email_sync_log IS 'Histórico de tentativas de polling/sincronização por conta de e-mail';
COMMENT ON COLUMN public.email_sync_log.status IS 'success | error | skipped | refresh_failed';
COMMENT ON COLUMN public.email_sync_log.attempt IS 'Número da tentativa de reconexão no momento do registro (0 quando saudável)';
COMMENT ON COLUMN public.email_sync_log.skipped_reason IS 'Motivo quando status=skipped (ex: backoff, reconnect_required)';