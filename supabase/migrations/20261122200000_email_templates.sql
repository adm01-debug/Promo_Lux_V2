-- Biblioteca de templates de email compartilhados por organizacao.
-- Gap 2.3 do GAPS-ENTERPRISE: hoje cada campanha reescreve o texto do zero,
-- sem historico, sem reaproveitamento entre SDRs e sem versionamento.
--
-- `sequence` guarda as etapas no mesmo formato de campaigns.sequence
-- (SequenceStep[] de src/components/lux/campaigns/CampaignFormFields.tsx), para
-- que "Aplicar template" copie direto para o editor de campanha.

create table if not exists public.email_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null default auth.uid(),
  name text not null,
  description text,
  category text not null default 'geral',
  subject text,
  body text,
  -- etapas completas: [{id,type,label,subject,body,variants}]
  sequence jsonb,
  variables text[] not null default '{}',
  tags text[] not null default '{}',
  usage_count integer not null default 0,
  last_used_at timestamptz,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (organization_id, name)
);

create index if not exists idx_email_templates_org
  on public.email_templates(organization_id, updated_at desc) where deleted_at is null;

alter table public.email_templates enable row level security;

create policy "Members view email_templates" on public.email_templates
  for select to authenticated
  using (public.is_org_member(organization_id, auth.uid()) and deleted_at is null);
create policy "Members insert email_templates" on public.email_templates
  for insert to authenticated
  with check (public.is_org_member(organization_id, auth.uid()));
create policy "Members update email_templates" on public.email_templates
  for update to authenticated
  using (public.is_org_member(organization_id, auth.uid()))
  with check (public.is_org_member(organization_id, auth.uid()));
create policy "Admins delete email_templates" on public.email_templates
  for delete to authenticated
  using (public.has_org_role(organization_id, auth.uid(), 'admin'));
create policy "Service manage email_templates" on public.email_templates
  for all to service_role using (true) with check (true);

create trigger trg_email_templates_updated before update on public.email_templates
  for each row execute function public.update_updated_at_column();

-- Contador de uso: chamado quando o SDR aplica o template numa campanha.
-- SECURITY DEFINER porque quem aplica pode ser sdr (sem UPDATE em
-- usage_count pela policy) e o incremento nao deve exigir permissao ampla.
create or replace function public.mark_email_template_used(_template_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
BEGIN
  UPDATE public.email_templates
     SET usage_count = usage_count + 1,
         last_used_at = now()
   WHERE id = _template_id
     AND deleted_at IS NULL
     AND public.is_org_member(organization_id, auth.uid());
  IF NOT FOUND THEN
    RAISE EXCEPTION 'template inexistente ou sem permissao';
  END IF;
END;
$$;

-- Clona o template (versionamento): o original fica intacto e a copia nasce
-- como "Nome (v2)" para preservar o texto que ja deu certo.
create or replace function public.duplicate_email_template(_template_id uuid, _name text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
DECLARE
  v_src public.email_templates%ROWTYPE;
  v_new_id uuid;
  v_name text;
BEGIN
  SELECT * INTO v_src FROM public.email_templates WHERE id = _template_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'template inexistente';
  END IF;
  IF NOT public.is_org_member(v_src.organization_id, auth.uid()) THEN
    RAISE EXCEPTION 'sem permissao na organizacao';
  END IF;

  v_name := COALESCE(NULLIF(trim(_name), ''), v_src.name || ' (v' || (v_src.version + 1) || ')');

  INSERT INTO public.email_templates (
    organization_id, user_id, name, description, category, subject, body,
    sequence, variables, tags, version
  ) VALUES (
    v_src.organization_id, auth.uid(), v_name, v_src.description, v_src.category,
    v_src.subject, v_src.body, v_src.sequence, v_src.variables, v_src.tags,
    v_src.version + 1
  )
  RETURNING id INTO v_new_id;

  RETURN v_new_id;
END;
$$;

-- Estatistica de reaproveitamento: quais templates realmente sao usados e
-- quais categorias dominam a operacao.
create or replace view public.email_template_stats
with (security_invoker = true) as
select
  t.organization_id,
  t.category,
  count(*)::integer                                  as templates,
  count(*) filter (where t.usage_count > 0)::integer  as usados,
  coalesce(sum(t.usage_count), 0)::integer            as usos_totais,
  max(t.last_used_at)                                 as ultimo_uso
from public.email_templates t
where t.deleted_at is null
group by t.organization_id, t.category;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_templates TO authenticated;
GRANT ALL ON public.email_templates TO service_role;
GRANT SELECT ON public.email_template_stats TO authenticated;
GRANT SELECT ON public.email_template_stats TO service_role;
REVOKE EXECUTE ON FUNCTION public.mark_email_template_used(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.duplicate_email_template(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.mark_email_template_used(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.duplicate_email_template(uuid, text) TO authenticated;