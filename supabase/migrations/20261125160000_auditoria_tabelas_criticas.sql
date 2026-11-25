-- Auditoria — 5 tabelas criticas que estavam fora da trilha.
--
-- Medido em producao (25/11/2026): apenas 8 tabelas tinham trigger de auditoria
-- (campaigns, companies, deals, email_accounts, organization_members, scrape_jobs,
-- workflow_runs, workflows). Ficaram fora, entre outras, api_keys (quem criou ou revogou
-- uma chave de API), role_permissions (quem concedeu qual permissao a quem),
-- stakeholders, deal_lost_reasons e scheduled_reports — justamente o tipo de registro
-- que a retencao de 5 anos da trilha deve proteger.
--
-- Por que uma funcao nova em vez de reusar log_audit_event():
-- aquela funcao resolve o ator com NEW.user_id/OLD.user_id como fallback de auth.uid().
-- role_permissions nao tem user_id, e em sessao sem JWT (service_role, cron, integracao
-- Supabase) a referencia derruba a transacao inteira. Provado em producao:
--   ERROR: 42703: record "old" has no field "user_id"
--   CONTEXT: INSERT INTO public.audit_logs ... PL/pgSQL function log_audit_event()
-- Ou seja, o trigger generico em role_permissions quebraria toda escrita na tabela.
--
-- log_audit_event_safe() le id/organization_id/user_id via to_jsonb (coluna ausente = NULL,
-- sem erro), ignora update que nao muda nada e remove campos de segredo do payload —
-- api_keys.key_hash nunca entra no log.
--
-- Retencao da trilha: 5 anos (1.827 dias) via job daily-log-retention / prune_audit_logs(1827).

create or replace function public.log_audit_event_safe()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_segredos constant text[] := array[
    'key_hash', 'password', 'password_hash', 'token', 'secret',
    'access_token', 'refresh_token', 'api_key', 'private_key'
  ];
  v_actor uuid := auth.uid();
  v_action public.audit_action;
  v_old jsonb;
  v_new jsonb;
  v_payload jsonb;
begin
  if TG_OP = 'INSERT' then
    v_action := 'create';
    v_new := to_jsonb(NEW);
  elsif TG_OP = 'UPDATE' then
    v_action := 'update';
    v_old := to_jsonb(OLD);
    v_new := to_jsonb(NEW);
    if v_old = v_new then
      return NEW;
    end if;
  else
    v_action := 'delete';
    v_old := to_jsonb(OLD);
  end if;

  v_payload := coalesce(v_new, v_old);
  v_actor := coalesce(v_actor, (v_payload->>'user_id')::uuid);

  insert into public.audit_logs (
    actor_id, table_name, record_id, action, old_data, new_data, organization_id
  ) values (
    v_actor,
    TG_TABLE_NAME,
    (v_payload->>'id')::uuid,
    v_action,
    case when v_old is null then null else v_old - v_segredos end,
    case when v_new is null then null else v_new - v_segredos end,
    (v_payload->>'organization_id')::uuid
  );

  return case when TG_OP = 'DELETE' then OLD else NEW end;
end;
$$;

comment on function public.log_audit_event_safe() is
  'Trigger de auditoria tolerante a tabelas sem user_id/organization_id e a payloads com segredo (remove key_hash, token, senha). Usado nas tabelas adicionadas em 20261125160000.';

create trigger trg_audit_api_keys
  after insert or update or delete on public.api_keys
  for each row execute function public.log_audit_event_safe();

create trigger trg_audit_role_permissions
  after insert or update or delete on public.role_permissions
  for each row execute function public.log_audit_event_safe();

create trigger trg_audit_stakeholders
  after insert or update or delete on public.stakeholders
  for each row execute function public.log_audit_event_safe();

create trigger trg_audit_scheduled_reports
  after insert or update or delete on public.scheduled_reports
  for each row execute function public.log_audit_event_safe();

create trigger trg_audit_deal_lost_reasons
  after insert or update or delete on public.deal_lost_reasons
  for each row execute function public.log_audit_event_safe();