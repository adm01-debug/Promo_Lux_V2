-- ============================================================================
-- Corrige takeover cross-tenant de empresas (companies).
--
-- uq_companies_name_source era UNIQUE(name, source) SEM escopo de tenant.
-- gmaps-proxy faz upsert com onConflict:"name,source" — quando dois tenants
-- raspam a mesma empresa (mesmo nome + mesma fonte, ex.: "Padaria X"/"gmaps"),
-- o upsert do segundo tenant colide na chave única do primeiro e REESCREVE a
-- linha, inclusive reatribuindo organization_id/user_id — sequestrando a
-- posse da empresa e sobrescrevendo raw_data/contatos de outro tenant.
--
-- Como (name, source) já era único globalmente, (organization_id, name,
-- source) é automaticamente satisfeito pelos dados existentes — não há
-- necessidade de deduplicar antes de trocar a constraint.
-- ============================================================================

DROP INDEX IF EXISTS public.uq_companies_name_source;

CREATE UNIQUE INDEX IF NOT EXISTS uq_companies_org_name_source
  ON public.companies (organization_id, name, source);
