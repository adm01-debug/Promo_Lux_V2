-- =========================================================================
-- Multi-tenant isolation: add organization_id to all business tables and
-- switch RLS from per-user to per-organization access via is_org_member().
-- Backfill strategy: for each user with rows, ensure a personal organization
-- exists (owner = user) and assign their existing rows to that org.
-- =========================================================================

-- ---- 1. Backfill helper: ensure every owner has at least one org ----------
DO $$
DECLARE u record; new_org uuid;
BEGIN
  FOR u IN
    SELECT DISTINCT user_id FROM (
      SELECT user_id FROM public.companies
      UNION SELECT user_id FROM public.stakeholders
      UNION SELECT user_id FROM public.deals
      UNION SELECT user_id FROM public.deal_stages
      UNION SELECT user_id FROM public.deal_activities
      UNION SELECT user_id FROM public.deal_tasks
      UNION SELECT user_id FROM public.campaigns
      UNION SELECT user_id FROM public.workflows
      UNION SELECT user_id FROM public.workflow_runs
      UNION SELECT user_id FROM public.scrape_jobs
      UNION SELECT user_id FROM public.scrape_results
      UNION SELECT user_id FROM public.intent_signals
      UNION SELECT user_id FROM public.ipc_config
      UNION SELECT user_id FROM public.notifications
      UNION SELECT user_id FROM public.api_keys
      UNION SELECT user_id FROM public.webhooks
      UNION SELECT user_id FROM public.webhook_deliveries
      UNION SELECT user_id FROM public.agent_chat_messages
    ) s
    WHERE user_id IS NOT NULL
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.organization_members WHERE user_id = u.user_id
    ) THEN
      INSERT INTO public.organizations (name, slug, owner_id)
      VALUES ('Workspace pessoal', 'ws-' || substr(u.user_id::text, 1, 8) || '-' || substr(md5(random()::text), 1, 5), u.user_id)
      RETURNING id INTO new_org;
      -- handle_new_organization trigger creates the admin membership
    END IF;
  END LOOP;
END $$;

-- Helper: pick a default org for a user (oldest membership)
CREATE OR REPLACE FUNCTION public._default_org_for_user(_user uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT organization_id FROM public.organization_members
  WHERE user_id = _user ORDER BY created_at ASC LIMIT 1;
$$;

-- ---- 2. Generic per-table migration -------------------------------------
-- For each business table:
--   a) add organization_id column (nullable)
--   b) backfill from default org of user_id
--   c) set NOT NULL
--   d) add index
--   e) drop old user_id-based policies
--   f) create new org-based policies (member can read; sdr+ can write; admin delete)

-- We'll define a procedure to apply policies uniformly per access tier.
-- Tiers:
--   "all_member"  -> view all, write all (member of org)         (used for notifications, agent_chat_messages, ipc_config, intent_signals, scrape_results)
--   "sdr_write"   -> view: member; insert/update: sdr+; delete: admin (used for companies, stakeholders, deals, deal_stages, deal_activities, deal_tasks, campaigns, workflows, workflow_runs, scrape_jobs)
--   "admin_only"  -> view/write/delete: admin only               (used for api_keys, webhooks, webhook_deliveries)

-- =========== companies ===========
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS organization_id uuid;
UPDATE public.companies SET organization_id = public._default_org_for_user(user_id) WHERE organization_id IS NULL;
ALTER TABLE public.companies ALTER COLUMN organization_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_companies_org ON public.companies(organization_id);

DROP POLICY IF EXISTS "Users can view own companies" ON public.companies;
DROP POLICY IF EXISTS "Users can insert own companies" ON public.companies;
DROP POLICY IF EXISTS "Users can update own companies" ON public.companies;
DROP POLICY IF EXISTS "Users can delete own companies" ON public.companies;

CREATE POLICY "Members view companies" ON public.companies FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "SDR+ insert companies" ON public.companies FOR INSERT TO authenticated
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), 'sdr'));
CREATE POLICY "SDR+ update companies" ON public.companies FOR UPDATE TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), 'sdr'))
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), 'sdr'));
CREATE POLICY "Admins delete companies" ON public.companies FOR DELETE TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), 'admin'));

-- =========== stakeholders ===========
ALTER TABLE public.stakeholders ADD COLUMN IF NOT EXISTS organization_id uuid;
UPDATE public.stakeholders SET organization_id = public._default_org_for_user(user_id) WHERE organization_id IS NULL;
ALTER TABLE public.stakeholders ALTER COLUMN organization_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_stakeholders_org ON public.stakeholders(organization_id);

DROP POLICY IF EXISTS "Users can view own stakeholders" ON public.stakeholders;
DROP POLICY IF EXISTS "Users can insert own stakeholders" ON public.stakeholders;
DROP POLICY IF EXISTS "Users can update own stakeholders" ON public.stakeholders;
DROP POLICY IF EXISTS "Users can delete own stakeholders" ON public.stakeholders;

CREATE POLICY "Members view stakeholders" ON public.stakeholders FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "SDR+ insert stakeholders" ON public.stakeholders FOR INSERT TO authenticated
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), 'sdr'));
CREATE POLICY "SDR+ update stakeholders" ON public.stakeholders FOR UPDATE TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), 'sdr'))
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), 'sdr'));
CREATE POLICY "Admins delete stakeholders" ON public.stakeholders FOR DELETE TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), 'admin'));

-- =========== deals ===========
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS organization_id uuid;
UPDATE public.deals SET organization_id = public._default_org_for_user(user_id) WHERE organization_id IS NULL;
ALTER TABLE public.deals ALTER COLUMN organization_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_deals_org ON public.deals(organization_id);

DROP POLICY IF EXISTS "Users view own deals" ON public.deals;
DROP POLICY IF EXISTS "Users insert own deals" ON public.deals;
DROP POLICY IF EXISTS "Users update own deals" ON public.deals;
DROP POLICY IF EXISTS "Users delete own deals" ON public.deals;

CREATE POLICY "Members view deals" ON public.deals FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "SDR+ insert deals" ON public.deals FOR INSERT TO authenticated
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), 'sdr'));
CREATE POLICY "SDR+ update deals" ON public.deals FOR UPDATE TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), 'sdr'))
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), 'sdr'));
CREATE POLICY "Admins delete deals" ON public.deals FOR DELETE TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), 'admin'));

-- =========== deal_stages ===========
ALTER TABLE public.deal_stages ADD COLUMN IF NOT EXISTS organization_id uuid;
UPDATE public.deal_stages SET organization_id = public._default_org_for_user(user_id) WHERE organization_id IS NULL;
ALTER TABLE public.deal_stages ALTER COLUMN organization_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_deal_stages_org ON public.deal_stages(organization_id);

DROP POLICY IF EXISTS "Users view own deal_stages" ON public.deal_stages;
DROP POLICY IF EXISTS "Users insert own deal_stages" ON public.deal_stages;
DROP POLICY IF EXISTS "Users update own deal_stages" ON public.deal_stages;
DROP POLICY IF EXISTS "Users delete own deal_stages" ON public.deal_stages;

CREATE POLICY "Members view deal_stages" ON public.deal_stages FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "Admins manage deal_stages insert" ON public.deal_stages FOR INSERT TO authenticated
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), 'admin'));
CREATE POLICY "Admins manage deal_stages update" ON public.deal_stages FOR UPDATE TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), 'admin'))
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), 'admin'));
CREATE POLICY "Admins delete deal_stages" ON public.deal_stages FOR DELETE TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), 'admin'));

-- =========== deal_activities ===========
ALTER TABLE public.deal_activities ADD COLUMN IF NOT EXISTS organization_id uuid;
UPDATE public.deal_activities SET organization_id = public._default_org_for_user(user_id) WHERE organization_id IS NULL;
ALTER TABLE public.deal_activities ALTER COLUMN organization_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_deal_activities_org ON public.deal_activities(organization_id);

DROP POLICY IF EXISTS "Users view own deal_activities" ON public.deal_activities;
DROP POLICY IF EXISTS "Users insert own deal_activities" ON public.deal_activities;
DROP POLICY IF EXISTS "Users update own deal_activities" ON public.deal_activities;
DROP POLICY IF EXISTS "Users delete own deal_activities" ON public.deal_activities;

CREATE POLICY "Members view deal_activities" ON public.deal_activities FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "SDR+ insert deal_activities" ON public.deal_activities FOR INSERT TO authenticated
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), 'sdr'));
CREATE POLICY "SDR+ update deal_activities" ON public.deal_activities FOR UPDATE TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), 'sdr'))
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), 'sdr'));
CREATE POLICY "Admins delete deal_activities" ON public.deal_activities FOR DELETE TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), 'admin'));

-- =========== deal_tasks ===========
ALTER TABLE public.deal_tasks ADD COLUMN IF NOT EXISTS organization_id uuid;
UPDATE public.deal_tasks SET organization_id = public._default_org_for_user(user_id) WHERE organization_id IS NULL;
ALTER TABLE public.deal_tasks ALTER COLUMN organization_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_deal_tasks_org ON public.deal_tasks(organization_id);

DROP POLICY IF EXISTS "Users view own deal_tasks" ON public.deal_tasks;
DROP POLICY IF EXISTS "Users insert own deal_tasks" ON public.deal_tasks;
DROP POLICY IF EXISTS "Users update own deal_tasks" ON public.deal_tasks;
DROP POLICY IF EXISTS "Users delete own deal_tasks" ON public.deal_tasks;

CREATE POLICY "Members view deal_tasks" ON public.deal_tasks FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "SDR+ insert deal_tasks" ON public.deal_tasks FOR INSERT TO authenticated
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), 'sdr'));
CREATE POLICY "SDR+ update deal_tasks" ON public.deal_tasks FOR UPDATE TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), 'sdr'))
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), 'sdr'));
CREATE POLICY "Admins delete deal_tasks" ON public.deal_tasks FOR DELETE TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), 'admin'));

-- =========== campaigns ===========
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS organization_id uuid;
UPDATE public.campaigns SET organization_id = public._default_org_for_user(user_id) WHERE organization_id IS NULL;
ALTER TABLE public.campaigns ALTER COLUMN organization_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_campaigns_org ON public.campaigns(organization_id);

DROP POLICY IF EXISTS "Users can view own campaigns" ON public.campaigns;
DROP POLICY IF EXISTS "Users can insert own campaigns" ON public.campaigns;
DROP POLICY IF EXISTS "Users can update own campaigns" ON public.campaigns;
DROP POLICY IF EXISTS "Users can delete own campaigns" ON public.campaigns;

CREATE POLICY "Members view campaigns" ON public.campaigns FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "SDR+ insert campaigns" ON public.campaigns FOR INSERT TO authenticated
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), 'sdr'));
CREATE POLICY "SDR+ update campaigns" ON public.campaigns FOR UPDATE TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), 'sdr'))
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), 'sdr'));
CREATE POLICY "Admins delete campaigns" ON public.campaigns FOR DELETE TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), 'admin'));

-- =========== workflows ===========
ALTER TABLE public.workflows ADD COLUMN IF NOT EXISTS organization_id uuid;
UPDATE public.workflows SET organization_id = public._default_org_for_user(user_id) WHERE organization_id IS NULL;
ALTER TABLE public.workflows ALTER COLUMN organization_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_workflows_org ON public.workflows(organization_id);

DROP POLICY IF EXISTS "Users can view own workflows" ON public.workflows;
DROP POLICY IF EXISTS "Users can insert own workflows" ON public.workflows;
DROP POLICY IF EXISTS "Users can update own workflows" ON public.workflows;
DROP POLICY IF EXISTS "Users can delete own workflows" ON public.workflows;

CREATE POLICY "Members view workflows" ON public.workflows FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "SDR+ insert workflows" ON public.workflows FOR INSERT TO authenticated
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), 'sdr'));
CREATE POLICY "SDR+ update workflows" ON public.workflows FOR UPDATE TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), 'sdr'))
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), 'sdr'));
CREATE POLICY "Admins delete workflows" ON public.workflows FOR DELETE TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), 'admin'));

-- =========== workflow_runs ===========
ALTER TABLE public.workflow_runs ADD COLUMN IF NOT EXISTS organization_id uuid;
UPDATE public.workflow_runs SET organization_id = public._default_org_for_user(user_id) WHERE organization_id IS NULL;
ALTER TABLE public.workflow_runs ALTER COLUMN organization_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_workflow_runs_org ON public.workflow_runs(organization_id);

DROP POLICY IF EXISTS "Users can view own workflow_runs" ON public.workflow_runs;
DROP POLICY IF EXISTS "Users can insert own workflow_runs" ON public.workflow_runs;
DROP POLICY IF EXISTS "Users can update own workflow_runs" ON public.workflow_runs;
DROP POLICY IF EXISTS "Users can delete own workflow_runs" ON public.workflow_runs;

CREATE POLICY "Members view workflow_runs" ON public.workflow_runs FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "SDR+ insert workflow_runs" ON public.workflow_runs FOR INSERT TO authenticated
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), 'sdr'));
CREATE POLICY "SDR+ update workflow_runs" ON public.workflow_runs FOR UPDATE TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), 'sdr'))
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), 'sdr'));
CREATE POLICY "Admins delete workflow_runs" ON public.workflow_runs FOR DELETE TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), 'admin'));

-- =========== scrape_jobs ===========
ALTER TABLE public.scrape_jobs ADD COLUMN IF NOT EXISTS organization_id uuid;
UPDATE public.scrape_jobs SET organization_id = public._default_org_for_user(user_id) WHERE organization_id IS NULL;
ALTER TABLE public.scrape_jobs ALTER COLUMN organization_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_scrape_jobs_org ON public.scrape_jobs(organization_id);

DROP POLICY IF EXISTS "Users can view own scrape_jobs" ON public.scrape_jobs;
DROP POLICY IF EXISTS "Users can insert own scrape_jobs" ON public.scrape_jobs;
DROP POLICY IF EXISTS "Users can update own scrape_jobs" ON public.scrape_jobs;
DROP POLICY IF EXISTS "Users can delete own scrape_jobs" ON public.scrape_jobs;

CREATE POLICY "Members view scrape_jobs" ON public.scrape_jobs FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "SDR+ insert scrape_jobs" ON public.scrape_jobs FOR INSERT TO authenticated
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), 'sdr'));
CREATE POLICY "SDR+ update scrape_jobs" ON public.scrape_jobs FOR UPDATE TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), 'sdr'))
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), 'sdr'));
CREATE POLICY "Admins delete scrape_jobs" ON public.scrape_jobs FOR DELETE TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), 'admin'));

-- =========== scrape_results ===========
ALTER TABLE public.scrape_results ADD COLUMN IF NOT EXISTS organization_id uuid;
UPDATE public.scrape_results SET organization_id = public._default_org_for_user(user_id) WHERE organization_id IS NULL;
ALTER TABLE public.scrape_results ALTER COLUMN organization_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_scrape_results_org ON public.scrape_results(organization_id);

DROP POLICY IF EXISTS "Users can view own scrape_results" ON public.scrape_results;
DROP POLICY IF EXISTS "Users can insert own scrape_results" ON public.scrape_results;
DROP POLICY IF EXISTS "Users can update own scrape_results" ON public.scrape_results;
DROP POLICY IF EXISTS "Users can delete own scrape_results" ON public.scrape_results;

CREATE POLICY "Members view scrape_results" ON public.scrape_results FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "Members insert scrape_results" ON public.scrape_results FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "SDR+ update scrape_results" ON public.scrape_results FOR UPDATE TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), 'sdr'))
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), 'sdr'));
CREATE POLICY "Admins delete scrape_results" ON public.scrape_results FOR DELETE TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), 'admin'));

-- =========== intent_signals ===========
ALTER TABLE public.intent_signals ADD COLUMN IF NOT EXISTS organization_id uuid;
UPDATE public.intent_signals SET organization_id = public._default_org_for_user(user_id) WHERE organization_id IS NULL;
ALTER TABLE public.intent_signals ALTER COLUMN organization_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_intent_signals_org ON public.intent_signals(organization_id);

DROP POLICY IF EXISTS "Users can view own intent_signals" ON public.intent_signals;
DROP POLICY IF EXISTS "Users can insert own intent_signals" ON public.intent_signals;
DROP POLICY IF EXISTS "Users can update own intent_signals" ON public.intent_signals;
DROP POLICY IF EXISTS "Users can delete own intent_signals" ON public.intent_signals;

CREATE POLICY "Members view intent_signals" ON public.intent_signals FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "SDR+ insert intent_signals" ON public.intent_signals FOR INSERT TO authenticated
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), 'sdr'));
CREATE POLICY "SDR+ update intent_signals" ON public.intent_signals FOR UPDATE TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), 'sdr'))
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), 'sdr'));
CREATE POLICY "Admins delete intent_signals" ON public.intent_signals FOR DELETE TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), 'admin'));

-- =========== ipc_config ===========
ALTER TABLE public.ipc_config ADD COLUMN IF NOT EXISTS organization_id uuid;
UPDATE public.ipc_config SET organization_id = public._default_org_for_user(user_id) WHERE organization_id IS NULL;
ALTER TABLE public.ipc_config ALTER COLUMN organization_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ipc_config_org ON public.ipc_config(organization_id);

DROP POLICY IF EXISTS "Users can view own ipc_config" ON public.ipc_config;
DROP POLICY IF EXISTS "Users can insert own ipc_config" ON public.ipc_config;
DROP POLICY IF EXISTS "Users can update own ipc_config" ON public.ipc_config;
DROP POLICY IF EXISTS "Users can delete own ipc_config" ON public.ipc_config;

CREATE POLICY "Members view ipc_config" ON public.ipc_config FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "Admins manage ipc_config insert" ON public.ipc_config FOR INSERT TO authenticated
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), 'admin'));
CREATE POLICY "Admins manage ipc_config update" ON public.ipc_config FOR UPDATE TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), 'admin'))
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), 'admin'));
CREATE POLICY "Admins delete ipc_config" ON public.ipc_config FOR DELETE TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), 'admin'));

-- =========== notifications ===========
-- Notifications stay user-scoped (each user sees only their own), but tied to an org context.
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS organization_id uuid;
UPDATE public.notifications SET organization_id = public._default_org_for_user(user_id) WHERE organization_id IS NULL;
ALTER TABLE public.notifications ALTER COLUMN organization_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_org ON public.notifications(organization_id);
-- existing user-scoped policies remain valid

-- =========== api_keys (admin only) ===========
ALTER TABLE public.api_keys ADD COLUMN IF NOT EXISTS organization_id uuid;
UPDATE public.api_keys SET organization_id = public._default_org_for_user(user_id) WHERE organization_id IS NULL;
ALTER TABLE public.api_keys ALTER COLUMN organization_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_api_keys_org ON public.api_keys(organization_id);

DROP POLICY IF EXISTS "Users view own api_keys" ON public.api_keys;
DROP POLICY IF EXISTS "Users insert own api_keys" ON public.api_keys;
DROP POLICY IF EXISTS "Users update own api_keys" ON public.api_keys;
DROP POLICY IF EXISTS "Users delete own api_keys" ON public.api_keys;

CREATE POLICY "Admins view api_keys" ON public.api_keys FOR SELECT TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), 'admin'));
CREATE POLICY "Admins insert api_keys" ON public.api_keys FOR INSERT TO authenticated
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), 'admin'));
CREATE POLICY "Admins update api_keys" ON public.api_keys FOR UPDATE TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), 'admin'))
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), 'admin'));
CREATE POLICY "Admins delete api_keys" ON public.api_keys FOR DELETE TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), 'admin'));

-- =========== webhooks (admin only) ===========
ALTER TABLE public.webhooks ADD COLUMN IF NOT EXISTS organization_id uuid;
UPDATE public.webhooks SET organization_id = public._default_org_for_user(user_id) WHERE organization_id IS NULL;
ALTER TABLE public.webhooks ALTER COLUMN organization_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_webhooks_org ON public.webhooks(organization_id);

DROP POLICY IF EXISTS "Users view own webhooks" ON public.webhooks;
DROP POLICY IF EXISTS "Users insert own webhooks" ON public.webhooks;
DROP POLICY IF EXISTS "Users update own webhooks" ON public.webhooks;
DROP POLICY IF EXISTS "Users delete own webhooks" ON public.webhooks;

CREATE POLICY "Admins view webhooks" ON public.webhooks FOR SELECT TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), 'admin'));
CREATE POLICY "Admins insert webhooks" ON public.webhooks FOR INSERT TO authenticated
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), 'admin'));
CREATE POLICY "Admins update webhooks" ON public.webhooks FOR UPDATE TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), 'admin'))
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), 'admin'));
CREATE POLICY "Admins delete webhooks" ON public.webhooks FOR DELETE TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), 'admin'));

-- =========== webhook_deliveries (admin only) ===========
ALTER TABLE public.webhook_deliveries ADD COLUMN IF NOT EXISTS organization_id uuid;
UPDATE public.webhook_deliveries SET organization_id = public._default_org_for_user(user_id) WHERE organization_id IS NULL;
ALTER TABLE public.webhook_deliveries ALTER COLUMN organization_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_org ON public.webhook_deliveries(organization_id);

DROP POLICY IF EXISTS "Users view own deliveries" ON public.webhook_deliveries;
CREATE POLICY "Admins view deliveries" ON public.webhook_deliveries FOR SELECT TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), 'admin'));

-- =========== agent_chat_messages (per user but tagged with org) ===========
ALTER TABLE public.agent_chat_messages ADD COLUMN IF NOT EXISTS organization_id uuid;
UPDATE public.agent_chat_messages SET organization_id = public._default_org_for_user(user_id) WHERE organization_id IS NULL;
ALTER TABLE public.agent_chat_messages ALTER COLUMN organization_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_agent_chat_org ON public.agent_chat_messages(organization_id);
-- existing user-scoped policies remain valid

-- =========== audit_logs ===========
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS organization_id uuid;
-- Backfill via actor_id default org (best effort)
UPDATE public.audit_logs SET organization_id = public._default_org_for_user(actor_id) WHERE organization_id IS NULL AND actor_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_audit_logs_org ON public.audit_logs(organization_id);

DROP POLICY IF EXISTS "Users can view own audit logs" ON public.audit_logs;
CREATE POLICY "Admins view org audit logs" ON public.audit_logs FOR SELECT TO authenticated
  USING (
    organization_id IS NOT NULL
    AND public.has_org_role(organization_id, auth.uid(), 'admin')
  );

-- ---- 3. Update audit trigger to capture organization_id ------------------
CREATE OR REPLACE FUNCTION public.log_audit_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_record_id uuid;
  v_action public.audit_action;
  v_old jsonb;
  v_new jsonb;
  v_org uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_action := 'create'; v_record_id := NEW.id; v_old := NULL; v_new := to_jsonb(NEW);
    BEGIN v_org := (to_jsonb(NEW) ->> 'organization_id')::uuid; EXCEPTION WHEN OTHERS THEN v_org := NULL; END;
  ELSIF TG_OP = 'UPDATE' THEN
    v_action := 'update'; v_record_id := NEW.id; v_old := to_jsonb(OLD); v_new := to_jsonb(NEW);
    IF v_old = v_new THEN RETURN NEW; END IF;
    BEGIN v_org := (to_jsonb(NEW) ->> 'organization_id')::uuid; EXCEPTION WHEN OTHERS THEN v_org := NULL; END;
  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'delete'; v_record_id := OLD.id; v_old := to_jsonb(OLD); v_new := NULL;
    BEGIN v_org := (to_jsonb(OLD) ->> 'organization_id')::uuid; EXCEPTION WHEN OTHERS THEN v_org := NULL; END;
  END IF;

  INSERT INTO public.audit_logs (actor_id, table_name, record_id, action, old_data, new_data, organization_id)
  VALUES (
    COALESCE(v_actor, CASE WHEN TG_OP = 'DELETE' THEN OLD.user_id ELSE NEW.user_id END),
    TG_TABLE_NAME, v_record_id, v_action, v_old, v_new, v_org
  );

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END $$;

-- ---- 4. Drop helper -----------------------------------------------------
DROP FUNCTION IF EXISTS public._default_org_for_user(uuid);
