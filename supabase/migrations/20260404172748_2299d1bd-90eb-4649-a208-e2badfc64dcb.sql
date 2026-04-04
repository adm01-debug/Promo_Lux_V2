-- Attach prevent_user_id_change trigger to all user-owned tables
CREATE TRIGGER prevent_user_id_change_companies
  BEFORE UPDATE ON public.companies
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_user_id_change();

CREATE TRIGGER prevent_user_id_change_campaigns
  BEFORE UPDATE ON public.campaigns
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_user_id_change();

CREATE TRIGGER prevent_user_id_change_workflows
  BEFORE UPDATE ON public.workflows
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_user_id_change();

CREATE TRIGGER prevent_user_id_change_workflow_runs
  BEFORE UPDATE ON public.workflow_runs
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_user_id_change();

CREATE TRIGGER prevent_user_id_change_scrape_jobs
  BEFORE UPDATE ON public.scrape_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_user_id_change();

CREATE TRIGGER prevent_user_id_change_scrape_results
  BEFORE UPDATE ON public.scrape_results
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_user_id_change();

CREATE TRIGGER prevent_user_id_change_notifications
  BEFORE UPDATE ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_user_id_change();

CREATE TRIGGER prevent_user_id_change_ipc_config
  BEFORE UPDATE ON public.ipc_config
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_user_id_change();

CREATE TRIGGER prevent_user_id_change_intent_signals
  BEFORE UPDATE ON public.intent_signals
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_user_id_change();

CREATE TRIGGER prevent_user_id_change_stakeholders
  BEFORE UPDATE ON public.stakeholders
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_user_id_change();