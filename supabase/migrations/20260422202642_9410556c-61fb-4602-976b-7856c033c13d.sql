
-- Stages customizáveis do pipeline
CREATE TABLE public.deal_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  name text NOT NULL,
  color text NOT NULL DEFAULT '#D4A520',
  position integer NOT NULL DEFAULT 0,
  probability integer NOT NULL DEFAULT 0 CHECK (probability >= 0 AND probability <= 100),
  type text NOT NULL DEFAULT 'open' CHECK (type IN ('open','won','lost')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_deal_stages_user_pos ON public.deal_stages(user_id, position);
ALTER TABLE public.deal_stages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own deal_stages" ON public.deal_stages FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users insert own deal_stages" ON public.deal_stages FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users update own deal_stages" ON public.deal_stages FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users delete own deal_stages" ON public.deal_stages FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Deals
CREATE TABLE public.deals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  stage_id uuid NOT NULL REFERENCES public.deal_stages(id) ON DELETE RESTRICT,
  title text NOT NULL,
  description text,
  value numeric DEFAULT 0,
  currency text NOT NULL DEFAULT 'BRL',
  company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  stakeholder_id uuid REFERENCES public.stakeholders(id) ON DELETE SET NULL,
  expected_close_date date,
  closed_at timestamptz,
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high')),
  tags text[] DEFAULT '{}',
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_deals_user_stage ON public.deals(user_id, stage_id, position);
CREATE INDEX idx_deals_company ON public.deals(company_id);
ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own deals" ON public.deals FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users insert own deals" ON public.deals FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users update own deals" ON public.deals FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users delete own deals" ON public.deals FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Service manage deals" ON public.deals FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Atividades (timeline)
CREATE TABLE public.deal_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  deal_id uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'note' CHECK (type IN ('note','call','email','meeting','stage_change','system')),
  title text NOT NULL,
  content text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_deal_activities_deal ON public.deal_activities(deal_id, created_at DESC);
ALTER TABLE public.deal_activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own deal_activities" ON public.deal_activities FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users insert own deal_activities" ON public.deal_activities FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users update own deal_activities" ON public.deal_activities FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users delete own deal_activities" ON public.deal_activities FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Tarefas com lembrete
CREATE TABLE public.deal_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  deal_id uuid REFERENCES public.deals(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  due_at timestamptz,
  remind_at timestamptz,
  reminded boolean NOT NULL DEFAULT false,
  completed boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_deal_tasks_user_due ON public.deal_tasks(user_id, due_at);
CREATE INDEX idx_deal_tasks_deal ON public.deal_tasks(deal_id);
ALTER TABLE public.deal_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own deal_tasks" ON public.deal_tasks FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users insert own deal_tasks" ON public.deal_tasks FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users update own deal_tasks" ON public.deal_tasks FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users delete own deal_tasks" ON public.deal_tasks FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Triggers de updated_at
CREATE TRIGGER trg_deal_stages_updated BEFORE UPDATE ON public.deal_stages FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_deals_updated BEFORE UPDATE ON public.deals FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_deal_tasks_updated BEFORE UPDATE ON public.deal_tasks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Audit nos deals
CREATE TRIGGER trg_audit_deals AFTER INSERT OR UPDATE OR DELETE ON public.deals FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

-- Trigger: registra mudança de stage como activity
CREATE OR REPLACE FUNCTION public.log_deal_stage_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE old_name text; new_name text;
BEGIN
  IF NEW.stage_id IS DISTINCT FROM OLD.stage_id THEN
    SELECT name INTO old_name FROM public.deal_stages WHERE id = OLD.stage_id;
    SELECT name INTO new_name FROM public.deal_stages WHERE id = NEW.stage_id;
    INSERT INTO public.deal_activities (user_id, deal_id, type, title, content, metadata)
    VALUES (NEW.user_id, NEW.id, 'stage_change', 'Estágio alterado',
      COALESCE(old_name,'?') || ' → ' || COALESCE(new_name,'?'),
      jsonb_build_object('from', OLD.stage_id, 'to', NEW.stage_id));
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_deal_stage_change AFTER UPDATE ON public.deals FOR EACH ROW EXECUTE FUNCTION public.log_deal_stage_change();

-- Função para criar stages padrão de um usuário
CREATE OR REPLACE FUNCTION public.create_default_deal_stages(_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.deal_stages WHERE user_id = _user_id) THEN
    RETURN;
  END IF;
  INSERT INTO public.deal_stages (user_id, name, color, position, probability, type) VALUES
    (_user_id, 'Lead', '#94A3B8', 0, 10, 'open'),
    (_user_id, 'Qualificado', '#3B82F6', 1, 25, 'open'),
    (_user_id, 'Proposta', '#A855F7', 2, 50, 'open'),
    (_user_id, 'Negociação', '#F59E0B', 3, 75, 'open'),
    (_user_id, 'Ganho', '#10B981', 4, 100, 'won'),
    (_user_id, 'Perdido', '#EF4444', 5, 0, 'lost');
END $$;
