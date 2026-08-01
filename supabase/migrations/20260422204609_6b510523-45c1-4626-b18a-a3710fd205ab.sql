-- Helper exposed (was dropped in previous migration); recreate as STABLE
CREATE OR REPLACE FUNCTION public.default_org_for_current_user()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT organization_id
  FROM public.organization_members
  WHERE user_id = auth.uid()
  ORDER BY created_at ASC
  LIMIT 1;
$$;

-- Apply as default to every business table that has organization_id NOT NULL.
ALTER TABLE public.companies          ALTER COLUMN organization_id SET DEFAULT public.default_org_for_current_user();
ALTER TABLE public.stakeholders       ALTER COLUMN organization_id SET DEFAULT public.default_org_for_current_user();
ALTER TABLE public.deals              ALTER COLUMN organization_id SET DEFAULT public.default_org_for_current_user();
ALTER TABLE public.deal_stages        ALTER COLUMN organization_id SET DEFAULT public.default_org_for_current_user();
ALTER TABLE public.deal_activities    ALTER COLUMN organization_id SET DEFAULT public.default_org_for_current_user();
ALTER TABLE public.deal_tasks         ALTER COLUMN organization_id SET DEFAULT public.default_org_for_current_user();
ALTER TABLE public.campaigns          ALTER COLUMN organization_id SET DEFAULT public.default_org_for_current_user();
ALTER TABLE public.workflows          ALTER COLUMN organization_id SET DEFAULT public.default_org_for_current_user();
ALTER TABLE public.workflow_runs      ALTER COLUMN organization_id SET DEFAULT public.default_org_for_current_user();
ALTER TABLE public.scrape_jobs        ALTER COLUMN organization_id SET DEFAULT public.default_org_for_current_user();
ALTER TABLE public.scrape_results     ALTER COLUMN organization_id SET DEFAULT public.default_org_for_current_user();
ALTER TABLE public.intent_signals     ALTER COLUMN organization_id SET DEFAULT public.default_org_for_current_user();
ALTER TABLE public.ipc_config         ALTER COLUMN organization_id SET DEFAULT public.default_org_for_current_user();
ALTER TABLE public.notifications      ALTER COLUMN organization_id SET DEFAULT public.default_org_for_current_user();
ALTER TABLE public.api_keys           ALTER COLUMN organization_id SET DEFAULT public.default_org_for_current_user();
ALTER TABLE public.webhooks           ALTER COLUMN organization_id SET DEFAULT public.default_org_for_current_user();
ALTER TABLE public.webhook_deliveries ALTER COLUMN organization_id SET DEFAULT public.default_org_for_current_user();
ALTER TABLE public.agent_chat_messages ALTER COLUMN organization_id SET DEFAULT public.default_org_for_current_user();
