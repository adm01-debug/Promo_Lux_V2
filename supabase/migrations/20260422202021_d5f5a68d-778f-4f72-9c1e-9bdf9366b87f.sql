
-- Enum de ações
CREATE TYPE public.audit_action AS ENUM ('create', 'update', 'delete');

-- Tabela imutável de audit
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid,
  table_name text NOT NULL,
  record_id uuid NOT NULL,
  action public.audit_action NOT NULL,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_actor ON public.audit_logs(actor_id, created_at DESC);
CREATE INDEX idx_audit_record ON public.audit_logs(table_name, record_id, created_at DESC);
CREATE INDEX idx_audit_created ON public.audit_logs(created_at DESC);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS: usuário vê só seus próprios logs (onde ele é o ator)
CREATE POLICY "Users can view own audit logs"
  ON public.audit_logs FOR SELECT TO authenticated
  USING (actor_id = auth.uid());

-- Service role gerencia tudo (para triggers e investigações)
CREATE POLICY "Service can manage audit logs"
  ON public.audit_logs FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- NÃO existem políticas de INSERT/UPDATE/DELETE para `authenticated` ⇒ imutável do ponto de vista do usuário.
-- Os triggers rodam como SECURITY DEFINER, então conseguem inserir.

-- Função genérica de auditoria
CREATE OR REPLACE FUNCTION public.log_audit_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_record_id uuid;
  v_action public.audit_action;
  v_old jsonb;
  v_new jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_action := 'create';
    v_record_id := NEW.id;
    v_old := NULL;
    v_new := to_jsonb(NEW);
  ELSIF TG_OP = 'UPDATE' THEN
    v_action := 'update';
    v_record_id := NEW.id;
    v_old := to_jsonb(OLD);
    v_new := to_jsonb(NEW);
    -- Skip se nada mudou
    IF v_old = v_new THEN
      RETURN NEW;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'delete';
    v_record_id := OLD.id;
    v_old := to_jsonb(OLD);
    v_new := NULL;
  END IF;

  INSERT INTO public.audit_logs (actor_id, table_name, record_id, action, old_data, new_data)
  VALUES (
    COALESCE(v_actor, CASE WHEN TG_OP = 'DELETE' THEN OLD.user_id ELSE NEW.user_id END),
    TG_TABLE_NAME,
    v_record_id,
    v_action,
    v_old,
    v_new
  );

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

-- Triggers em companies
CREATE TRIGGER audit_companies
AFTER INSERT OR UPDATE OR DELETE ON public.companies
FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

-- Triggers em campaigns
CREATE TRIGGER audit_campaigns
AFTER INSERT OR UPDATE OR DELETE ON public.campaigns
FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

-- Triggers em workflows
CREATE TRIGGER audit_workflows
AFTER INSERT OR UPDATE OR DELETE ON public.workflows
FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();
