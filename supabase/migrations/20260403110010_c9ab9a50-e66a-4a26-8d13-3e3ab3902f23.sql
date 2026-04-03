
-- ====== COMPANIES ======
DROP POLICY IF EXISTS "Companies are viewable by everyone" ON public.companies;
DROP POLICY IF EXISTS "Companies can be inserted by anyone" ON public.companies;
DROP POLICY IF EXISTS "Companies can be updated by anyone" ON public.companies;
DROP POLICY IF EXISTS "Companies can be deleted by anyone" ON public.companies;

CREATE POLICY "Companies viewable by authenticated" ON public.companies FOR SELECT TO authenticated USING (true);
CREATE POLICY "Companies insertable by authenticated" ON public.companies FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Companies updatable by authenticated" ON public.companies FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Companies deletable by authenticated" ON public.companies FOR DELETE TO authenticated USING (true);

-- ====== WORKFLOWS ======
DROP POLICY IF EXISTS "Workflows are viewable by everyone" ON public.workflows;
DROP POLICY IF EXISTS "Workflows can be inserted by anyone" ON public.workflows;
DROP POLICY IF EXISTS "Workflows can be updated by anyone" ON public.workflows;
DROP POLICY IF EXISTS "Workflows can be deleted by anyone" ON public.workflows;

CREATE POLICY "Workflows viewable by authenticated" ON public.workflows FOR SELECT TO authenticated USING (true);
CREATE POLICY "Workflows insertable by authenticated" ON public.workflows FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Workflows updatable by authenticated" ON public.workflows FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Workflows deletable by authenticated" ON public.workflows FOR DELETE TO authenticated USING (true);

-- ====== WORKFLOW_RUNS ======
DROP POLICY IF EXISTS "Workflow runs are viewable by everyone" ON public.workflow_runs;
DROP POLICY IF EXISTS "Workflow runs can be inserted by anyone" ON public.workflow_runs;
DROP POLICY IF EXISTS "Workflow runs can be updated by anyone" ON public.workflow_runs;

CREATE POLICY "Workflow runs viewable by authenticated" ON public.workflow_runs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Workflow runs insertable by authenticated" ON public.workflow_runs FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Workflow runs updatable by authenticated" ON public.workflow_runs FOR UPDATE TO authenticated USING (true);

-- ====== SCRAPE_JOBS ======
DROP POLICY IF EXISTS "Scrape jobs are viewable by everyone" ON public.scrape_jobs;
DROP POLICY IF EXISTS "Scrape jobs can be inserted by anyone" ON public.scrape_jobs;
DROP POLICY IF EXISTS "Scrape jobs can be updated by anyone" ON public.scrape_jobs;
DROP POLICY IF EXISTS "Scrape jobs can be deleted by anyone" ON public.scrape_jobs;

CREATE POLICY "Scrape jobs viewable by authenticated" ON public.scrape_jobs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Scrape jobs insertable by authenticated" ON public.scrape_jobs FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Scrape jobs updatable by authenticated" ON public.scrape_jobs FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Scrape jobs deletable by authenticated" ON public.scrape_jobs FOR DELETE TO authenticated USING (true);

-- ====== SCRAPE_RESULTS ======
DROP POLICY IF EXISTS "Scrape results are viewable by everyone" ON public.scrape_results;
DROP POLICY IF EXISTS "Scrape results can be inserted by anyone" ON public.scrape_results;
DROP POLICY IF EXISTS "Scrape results can be updated by anyone" ON public.scrape_results;

CREATE POLICY "Scrape results viewable by authenticated" ON public.scrape_results FOR SELECT TO authenticated USING (true);
CREATE POLICY "Scrape results insertable by authenticated" ON public.scrape_results FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Scrape results updatable by authenticated" ON public.scrape_results FOR UPDATE TO authenticated USING (true);

-- ====== STAKEHOLDERS ======
DROP POLICY IF EXISTS "Stakeholders are viewable by everyone" ON public.stakeholders;
DROP POLICY IF EXISTS "Stakeholders can be inserted by anyone" ON public.stakeholders;
DROP POLICY IF EXISTS "Stakeholders can be updated by anyone" ON public.stakeholders;
DROP POLICY IF EXISTS "Stakeholders can be deleted by anyone" ON public.stakeholders;

CREATE POLICY "Stakeholders viewable by authenticated" ON public.stakeholders FOR SELECT TO authenticated USING (true);
CREATE POLICY "Stakeholders insertable by authenticated" ON public.stakeholders FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Stakeholders updatable by authenticated" ON public.stakeholders FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Stakeholders deletable by authenticated" ON public.stakeholders FOR DELETE TO authenticated USING (true);

-- ====== NOTIFICATIONS ======
DROP POLICY IF EXISTS "Notifications are viewable by everyone" ON public.notifications;
DROP POLICY IF EXISTS "Notifications can be inserted by anyone" ON public.notifications;
DROP POLICY IF EXISTS "Notifications can be updated by anyone" ON public.notifications;
DROP POLICY IF EXISTS "Notifications can be deleted by anyone" ON public.notifications;

CREATE POLICY "Notifications viewable by authenticated" ON public.notifications FOR SELECT TO authenticated USING (true);
CREATE POLICY "Notifications insertable by authenticated" ON public.notifications FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Notifications updatable by authenticated" ON public.notifications FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Notifications deletable by authenticated" ON public.notifications FOR DELETE TO authenticated USING (true);

-- ====== IPC_CONFIG ======
DROP POLICY IF EXISTS "IPC config is viewable by everyone" ON public.ipc_config;
DROP POLICY IF EXISTS "IPC config can be inserted by anyone" ON public.ipc_config;
DROP POLICY IF EXISTS "IPC config can be updated by anyone" ON public.ipc_config;

CREATE POLICY "IPC config viewable by authenticated" ON public.ipc_config FOR SELECT TO authenticated USING (true);
CREATE POLICY "IPC config insertable by authenticated" ON public.ipc_config FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "IPC config updatable by authenticated" ON public.ipc_config FOR UPDATE TO authenticated USING (true);

-- Also allow service_role (edge functions) to bypass RLS — this is automatic via service_role key
-- Edge functions use SUPABASE_SERVICE_ROLE_KEY which already bypasses RLS
