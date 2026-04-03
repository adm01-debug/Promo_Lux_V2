
-- Add user_id to all main tables
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.scrape_jobs ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.workflows ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.workflow_runs ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.stakeholders ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.scrape_results ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.intent_signals ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.ipc_config ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- Create indices on user_id columns
CREATE INDEX IF NOT EXISTS idx_companies_user_id ON public.companies (user_id);
CREATE INDEX IF NOT EXISTS idx_scrape_jobs_user_id ON public.scrape_jobs (user_id);
CREATE INDEX IF NOT EXISTS idx_workflows_user_id ON public.workflows (user_id);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_user_id ON public.workflow_runs (user_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_user_id ON public.campaigns (user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications (user_id);
CREATE INDEX IF NOT EXISTS idx_stakeholders_user_id ON public.stakeholders (user_id);
CREATE INDEX IF NOT EXISTS idx_scrape_results_user_id ON public.scrape_results (user_id);
CREATE INDEX IF NOT EXISTS idx_intent_signals_user_id ON public.intent_signals (user_id);
CREATE INDEX IF NOT EXISTS idx_ipc_config_user_id ON public.ipc_config (user_id);

-- Drop old permissive policies on companies
DROP POLICY IF EXISTS "Companies viewable by authenticated" ON public.companies;
DROP POLICY IF EXISTS "Companies insertable by authenticated" ON public.companies;
DROP POLICY IF EXISTS "Companies updatable by authenticated" ON public.companies;
DROP POLICY IF EXISTS "Companies deletable by authenticated" ON public.companies;

-- New user-scoped policies for companies
CREATE POLICY "Users can view own companies" ON public.companies FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can insert own companies" ON public.companies FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own companies" ON public.companies FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can delete own companies" ON public.companies FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Service can manage companies" ON public.companies FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Drop old permissive policies on scrape_jobs
DROP POLICY IF EXISTS "Scrape jobs viewable by authenticated" ON public.scrape_jobs;
DROP POLICY IF EXISTS "Scrape jobs insertable by authenticated" ON public.scrape_jobs;
DROP POLICY IF EXISTS "Scrape jobs updatable by authenticated" ON public.scrape_jobs;
DROP POLICY IF EXISTS "Scrape jobs deletable by authenticated" ON public.scrape_jobs;

CREATE POLICY "Users can view own scrape_jobs" ON public.scrape_jobs FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can insert own scrape_jobs" ON public.scrape_jobs FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own scrape_jobs" ON public.scrape_jobs FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can delete own scrape_jobs" ON public.scrape_jobs FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Service can manage scrape_jobs" ON public.scrape_jobs FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Drop old permissive policies on workflows
DROP POLICY IF EXISTS "Workflows viewable by authenticated" ON public.workflows;
DROP POLICY IF EXISTS "Workflows insertable by authenticated" ON public.workflows;
DROP POLICY IF EXISTS "Workflows updatable by authenticated" ON public.workflows;
DROP POLICY IF EXISTS "Workflows deletable by authenticated" ON public.workflows;

CREATE POLICY "Users can view own workflows" ON public.workflows FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can insert own workflows" ON public.workflows FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own workflows" ON public.workflows FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can delete own workflows" ON public.workflows FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Service can manage workflows" ON public.workflows FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Drop old permissive policies on workflow_runs
DROP POLICY IF EXISTS "Workflow runs viewable by authenticated" ON public.workflow_runs;
DROP POLICY IF EXISTS "Workflow runs insertable by authenticated" ON public.workflow_runs;
DROP POLICY IF EXISTS "Workflow runs updatable by authenticated" ON public.workflow_runs;

CREATE POLICY "Users can view own workflow_runs" ON public.workflow_runs FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can insert own workflow_runs" ON public.workflow_runs FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own workflow_runs" ON public.workflow_runs FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Service can manage workflow_runs" ON public.workflow_runs FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Drop old permissive policies on campaigns
DROP POLICY IF EXISTS "Campaigns viewable by authenticated" ON public.campaigns;
DROP POLICY IF EXISTS "Campaigns insertable by authenticated" ON public.campaigns;
DROP POLICY IF EXISTS "Campaigns updatable by authenticated" ON public.campaigns;
DROP POLICY IF EXISTS "Campaigns deletable by authenticated" ON public.campaigns;

CREATE POLICY "Users can view own campaigns" ON public.campaigns FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can insert own campaigns" ON public.campaigns FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own campaigns" ON public.campaigns FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can delete own campaigns" ON public.campaigns FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Service can manage campaigns" ON public.campaigns FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Drop old permissive policies on notifications
DROP POLICY IF EXISTS "Notifications viewable by authenticated" ON public.notifications;
DROP POLICY IF EXISTS "Notifications insertable by authenticated" ON public.notifications;
DROP POLICY IF EXISTS "Notifications updatable by authenticated" ON public.notifications;
DROP POLICY IF EXISTS "Notifications deletable by authenticated" ON public.notifications;

CREATE POLICY "Users can view own notifications" ON public.notifications FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can insert own notifications" ON public.notifications FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own notifications" ON public.notifications FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can delete own notifications" ON public.notifications FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Service can manage notifications" ON public.notifications FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Drop old permissive policies on stakeholders
DROP POLICY IF EXISTS "Stakeholders viewable by authenticated" ON public.stakeholders;
DROP POLICY IF EXISTS "Stakeholders insertable by authenticated" ON public.stakeholders;
DROP POLICY IF EXISTS "Stakeholders updatable by authenticated" ON public.stakeholders;
DROP POLICY IF EXISTS "Stakeholders deletable by authenticated" ON public.stakeholders;

CREATE POLICY "Users can view own stakeholders" ON public.stakeholders FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can insert own stakeholders" ON public.stakeholders FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own stakeholders" ON public.stakeholders FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can delete own stakeholders" ON public.stakeholders FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Service can manage stakeholders" ON public.stakeholders FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Drop old permissive policies on scrape_results
DROP POLICY IF EXISTS "Scrape results viewable by authenticated" ON public.scrape_results;
DROP POLICY IF EXISTS "Scrape results insertable by authenticated" ON public.scrape_results;
DROP POLICY IF EXISTS "Scrape results updatable by authenticated" ON public.scrape_results;

CREATE POLICY "Users can view own scrape_results" ON public.scrape_results FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can insert own scrape_results" ON public.scrape_results FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own scrape_results" ON public.scrape_results FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Service can manage scrape_results" ON public.scrape_results FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Drop old permissive policies on intent_signals
DROP POLICY IF EXISTS "Intent signals viewable by authenticated" ON public.intent_signals;
DROP POLICY IF EXISTS "Intent signals insertable by authenticated" ON public.intent_signals;
DROP POLICY IF EXISTS "Intent signals updatable by authenticated" ON public.intent_signals;
DROP POLICY IF EXISTS "Intent signals deletable by authenticated" ON public.intent_signals;
DROP POLICY IF EXISTS "Intent signals insertable by service" ON public.intent_signals;

CREATE POLICY "Users can view own intent_signals" ON public.intent_signals FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can insert own intent_signals" ON public.intent_signals FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own intent_signals" ON public.intent_signals FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can delete own intent_signals" ON public.intent_signals FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Service can manage intent_signals" ON public.intent_signals FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Drop old permissive policies on ipc_config
DROP POLICY IF EXISTS "IPC config viewable by authenticated" ON public.ipc_config;
DROP POLICY IF EXISTS "IPC config insertable by authenticated" ON public.ipc_config;
DROP POLICY IF EXISTS "IPC config updatable by authenticated" ON public.ipc_config;

CREATE POLICY "Users can view own ipc_config" ON public.ipc_config FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can insert own ipc_config" ON public.ipc_config FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own ipc_config" ON public.ipc_config FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Service can manage ipc_config" ON public.ipc_config FOR ALL TO service_role USING (true) WITH CHECK (true);
