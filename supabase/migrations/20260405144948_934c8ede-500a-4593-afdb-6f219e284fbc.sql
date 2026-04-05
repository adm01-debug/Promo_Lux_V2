
-- Attach triggers for update_updated_at_column
CREATE TRIGGER trg_companies_updated_at BEFORE UPDATE ON public.companies FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_campaigns_updated_at BEFORE UPDATE ON public.campaigns FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_workflows_updated_at BEFORE UPDATE ON public.workflows FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_scrape_jobs_updated_at BEFORE UPDATE ON public.scrape_jobs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_ipc_config_updated_at BEFORE UPDATE ON public.ipc_config FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_stakeholders_updated_at BEFORE UPDATE ON public.stakeholders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Attach trigger for IPC score validation
CREATE TRIGGER trg_companies_validate_ipc BEFORE INSERT OR UPDATE ON public.companies FOR EACH ROW EXECUTE FUNCTION public.validate_ipc_score();

-- Attach trigger to prevent user_id changes
CREATE TRIGGER trg_companies_prevent_uid_change BEFORE UPDATE ON public.companies FOR EACH ROW EXECUTE FUNCTION public.prevent_user_id_change();
CREATE TRIGGER trg_campaigns_prevent_uid_change BEFORE UPDATE ON public.campaigns FOR EACH ROW EXECUTE FUNCTION public.prevent_user_id_change();
CREATE TRIGGER trg_workflows_prevent_uid_change BEFORE UPDATE ON public.workflows FOR EACH ROW EXECUTE FUNCTION public.prevent_user_id_change();
CREATE TRIGGER trg_scrape_jobs_prevent_uid_change BEFORE UPDATE ON public.scrape_jobs FOR EACH ROW EXECUTE FUNCTION public.prevent_user_id_change();
CREATE TRIGGER trg_notifications_prevent_uid_change BEFORE UPDATE ON public.notifications FOR EACH ROW EXECUTE FUNCTION public.prevent_user_id_change();
CREATE TRIGGER trg_stakeholders_prevent_uid_change BEFORE UPDATE ON public.stakeholders FOR EACH ROW EXECUTE FUNCTION public.prevent_user_id_change();

-- Attach enrichment notification trigger
CREATE TRIGGER trg_companies_enrichment_notify AFTER UPDATE ON public.companies FOR EACH ROW EXECUTE FUNCTION public.notify_on_enrichment();

-- Attach workflow completion notification trigger
CREATE TRIGGER trg_workflow_runs_notify AFTER UPDATE ON public.workflow_runs FOR EACH ROW EXECUTE FUNCTION public.notify_on_workflow_complete();
