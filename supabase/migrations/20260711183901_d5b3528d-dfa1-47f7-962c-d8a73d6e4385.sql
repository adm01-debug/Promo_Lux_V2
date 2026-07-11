
DROP TRIGGER IF EXISTS update_automation_alerts_updated_at ON public.automation_alerts;
CREATE TRIGGER update_automation_alerts_updated_at
  BEFORE UPDATE ON public.automation_alerts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
