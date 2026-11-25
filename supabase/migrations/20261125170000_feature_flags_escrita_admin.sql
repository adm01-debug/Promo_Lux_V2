-- ---------------------------------------------------------------------------
-- feature_flags: escrita para administrador global.
--
-- Medido em 25/11/2026 (producao, pttzwlbidamibjssqiqb):
--   feature_flags tem RLS habilitado e apenas 2 policies, ambas SELECT:
--     "Authenticated users view global feature flags" e
--     "Users can view their org feature flags".
--   Nenhuma policy de INSERT/UPDATE/DELETE.
--
-- Efeito real hoje: `PlacesApiNewToggle`
-- (src/components/lux/PlacesApiNewToggle.tsx, renderizado em
-- GmapsScraperView.tsx:263) faz UPDATE em feature_flags. Sem policy de
-- escrita o PostgREST responde sucesso com 0 linhas alteradas, o componente
-- mostra "Places API (New) ativada" e o banco nao muda. E um controle de
-- custo de API que parece funcionar e nao funciona
-- (docs/qa/03-ACHADOS.md:469 e docs/qa/04-PLANO.md:2171).
--
-- Decisao: as flags sao globais (organization_id IS NULL). Quem altera e o
-- administrador global — `has_role(auth.uid(),'admin')`, o mesmo idioma de 22
-- policies do banco. Membro administrador de uma organizacao NAO entra aqui:
-- ele mudaria recurso que vale para todos os tenants.
-- Sem DELETE: a UI liga/desliga, ninguem apaga flag.
-- ---------------------------------------------------------------------------

drop policy if exists "Admins insert feature flags" on public.feature_flags;
create policy "Admins insert feature flags"
  on public.feature_flags
  for insert
  to authenticated
  with check (public.has_role(auth.uid(), 'admin'::public.app_role));

drop policy if exists "Admins update feature flags" on public.feature_flags;
create policy "Admins update feature flags"
  on public.feature_flags
  for update
  to authenticated
  using (public.has_role(auth.uid(), 'admin'::public.app_role))
  with check (public.has_role(auth.uid(), 'admin'::public.app_role));