-- Trilha de auditoria para automações: registra quem executou/alterou
-- tarefas de raspagem e execuções de workflow, e quais entidades mudaram.

DROP TRIGGER IF EXISTS trg_audit_scrape_jobs ON public.scrape_jobs;
CREATE TRIGGER trg_audit_scrape_jobs
  AFTER INSERT OR UPDATE OR DELETE ON public.scrape_jobs
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

DROP TRIGGER IF EXISTS trg_audit_workflow_runs ON public.workflow_runs;
CREATE TRIGGER trg_audit_workflow_runs
  AFTER INSERT OR UPDATE OR DELETE ON public.workflow_runs
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();