-- Fix de RLS: dashboard_layouts aceitava organization_id de qualquer organizacao.
--
-- Causa raiz: a policy "Users insert own dashboard_layouts" (criada em
-- 20261121193000_lead_scores_dashboard_layouts_deal_predictions_changelog.sql:94)
-- valida apenas user_id = auth.uid(). A coluna organization_id e nullable e nao
-- havia nenhuma checagem de vinculo, entao um usuario autenticado podia gravar
-- layout apontando para uma organizacao da qual nao e membro.
--
-- Evidencia (producao, role authenticated, c223bc70-... membro apenas de
-- 5812f8c5-...): insert em dashboard_layouts com organization_id
-- ed34f25b-04d9-4060-ac37-028fdfe177e2 foi aceito.
--
-- Correcao: exigir que organization_id seja nulo (layout pessoal global) ou
-- que o usuario seja membro da organizacao. Idempotente.

drop policy if exists "Users insert own dashboard_layouts" on public.dashboard_layouts;
create policy "Users insert own dashboard_layouts" on public.dashboard_layouts
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and (organization_id is null or public.is_org_member(organization_id, auth.uid()))
  );

drop policy if exists "Users update own dashboard_layouts" on public.dashboard_layouts;
create policy "Users update own dashboard_layouts" on public.dashboard_layouts
  for update to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and (organization_id is null or public.is_org_member(organization_id, auth.uid()))
  );