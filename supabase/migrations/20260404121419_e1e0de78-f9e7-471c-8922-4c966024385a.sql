CREATE OR REPLACE FUNCTION public.notify_on_enrichment()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.enriched = true AND (OLD.enriched IS NULL OR OLD.enriched = false) THEN
    INSERT INTO public.notifications (user_id, type, title, message, metadata)
    VALUES (
      NEW.user_id,
      'enrichment',
      'Empresa enriquecida',
      'A empresa "' || NEW.name || '" foi enriquecida com sucesso.',
      jsonb_build_object('company_id', NEW.id, 'company_name', NEW.name)
    );
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.notify_on_workflow_complete()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  wf_name text;
BEGIN
  IF NEW.status IN ('completed', 'failed') AND (OLD.status IS NULL OR OLD.status NOT IN ('completed', 'failed')) THEN
    SELECT name INTO wf_name FROM public.workflows WHERE id = NEW.workflow_id;
    
    INSERT INTO public.notifications (user_id, type, title, message, metadata)
    VALUES (
      NEW.user_id,
      CASE WHEN NEW.status = 'completed' THEN 'system' ELSE 'signal' END,
      CASE WHEN NEW.status = 'completed' THEN 'Workflow concluído' ELSE 'Workflow falhou' END,
      'O workflow "' || COALESCE(wf_name, 'Sem nome') || '" ' ||
        CASE WHEN NEW.status = 'completed' THEN 'foi concluído com sucesso.' ELSE 'falhou: ' || COALESCE(NEW.error_message, 'erro desconhecido.') END,
      jsonb_build_object('workflow_id', NEW.workflow_id, 'run_id', NEW.id, 'status', NEW.status)
    );
  END IF;
  RETURN NEW;
END;
$function$;