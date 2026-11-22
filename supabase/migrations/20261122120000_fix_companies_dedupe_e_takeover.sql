-- ============================================================================
-- Restaura o dedupe de `companies` e fecha o takeover cross-tenant.
--
-- Sintoma reportado: `gmaps-proxy?action=sync-results` respondia
-- `{companies_created: 0, total_results: 20}` — 20 resultados baixados da Places
-- API e NENHUMA empresa gravada, sem erro visivel ao usuario.
--
-- Causa raiz (medida no banco de producao, nao deduzida):
--   gmaps-proxy faz upsert com `onConflict: "organization_id,place_id"`
--   (place_id presente) ou `"organization_id,name,source"` (sem place_id).
--   PostgREST rejeita os dois com 42P10 "there is no unique or exclusion
--   constraint matching the ON CONFLICT specification":
--     - `companies_org_place_id_uk` e um indice UNIQUE PARCIAL
--       (WHERE place_id IS NOT NULL AND deleted_at IS NULL) e o PostgREST nao
--       consegue expressar o predicado no ON CONFLICT -> nunca casa;
--     - `uq_companies_org_name_source` NAO existe no banco. A migration
--       20260718140000 depende de 20260403184048 ter criado
--       `uq_companies_name_source`, mas o indice sobrevivente e o legado
--       UNIQUE(name, source) SEM escopo de tenant.
--
-- Impacto em producao (verificado): `uq_companies_name_source` sendo UNIQUE
-- (name, source) global, dois tenants que raspam a mesma empresa colidem e o
-- segundo upsert reescreve a linha do primeiro, inclusive organization_id e
-- user_id — sequestro de posse cross-tenant, exatamente o bug que a migration
-- 20260718140000 existia para corrigir.
--
-- Correcao:
--   1. Remove o indice legado global (name, source).
--   2. Cria `uq_companies_org_name_source` (organization_id, name, source) —
--      escopado por tenant, sem predicado, portanto utilizavel pelo PostgREST.
--   3. Substitui o indice UNIQUE PARCIAL por um UNIQUE TOTAL em
--      (organization_id, place_id). Postgres ja trata NULLs como distintos,
--      entao empresas sem place_id nao colidem entre si.
--
-- Idempotente: segura para rerun.
-- ============================================================================

-- 1. Fora o legado global. Era ele que permitia o takeover entre tenants.
DROP INDEX IF EXISTS public.uq_companies_name_source;

-- 2. Dedupe escopado por tenant. UNIQUE TOTAL (sem WHERE) para que o
--    ON CONFLICT (organization_id, name, source) do PostgREST case de fato.
CREATE UNIQUE INDEX IF NOT EXISTS uq_companies_org_name_source
  ON public.companies (organization_id, name, source);

-- 3. place_id: UNIQUE total no lugar do parcial. O parcial existente nao serve
--    para ON CONFLICT. `deleted_at` sai do indice: soft-delete nao pode abrir
--    buraco de dedupe, senao reimportar apos excluir cria duplicata silenciosa.
DROP INDEX IF EXISTS public.companies_org_place_id_uk;

CREATE UNIQUE INDEX IF NOT EXISTS companies_org_place_id_uk
  ON public.companies (organization_id, place_id);

COMMENT ON INDEX public.uq_companies_org_name_source IS
  'Dedupe de companies escopado por tenant. Sem escopo de org dois tenants que raspam a mesma empresa colidiam e o segundo sobrescrevia dono (takeover).';
COMMENT ON INDEX public.companies_org_place_id_uk IS
  'Dedupe forte por place_id do Google. UNIQUE total (nao parcial) para ser utilizavel em ON CONFLICT pelo PostgREST.';
