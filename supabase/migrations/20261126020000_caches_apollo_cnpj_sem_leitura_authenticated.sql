-- ---------------------------------------------------------------------------
-- Etapas 021 e 022: caches de enriquecimento nao sao mais legiveis por
-- qualquer usuario autenticado.
--
-- Medido no replay completo das migrations (Postgres 17):
--   apollo_search_cache   "apollo_cache_read_authenticated"  FOR SELECT TO authenticated USING (true)
--   apollo_rate_state     "apollo_rate_read_authenticated"   FOR SELECT TO authenticated USING (true)
--   cnpj_enrich_cache     "cnpj_cache_read_authenticated"    FOR SELECT TO authenticated USING (true)
--   cnpj_enrich_rate_state"cnpj_rate_read_authenticated"     FOR SELECT TO authenticated USING (true)
--
-- Nenhuma dessas tabelas tem organization_id, entao `USING (true)` significa
-- que qualquer usuario logado de qualquer organizacao le o cache inteiro:
-- consultas de CNPJ e de Apollo feitas por outros clientes, com o payload
-- retornado pelas APIs pagas.
--
-- Quem le essas tabelas e apenas edge function com client administrativo
-- (service_role), que nao depende de policy:
--   supabase/functions/cnpj-enrich/index.ts:162
--   supabase/functions/cnpj-enrich-worker/index.ts:141
--   supabase/functions/cnpj-settings-status/index.ts:41-42
-- Nenhum arquivo em `src/` consulta essas tabelas (o grep so encontra
-- `src/integrations/supabase/types.ts`, que e tipo gerado).
--
-- Sem coluna de organizacao e sem leitor autenticado, o correto e remover a
-- policy de leitura: o acesso fica fechado para anon/authenticated e segue
-- igual para service_role. Nao ha coluna nova, backfill nem mudanca de edge.
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "apollo_cache_read_authenticated" ON public.apollo_search_cache;
DROP POLICY IF EXISTS "apollo_rate_read_authenticated" ON public.apollo_rate_state;
DROP POLICY IF EXISTS "cnpj_cache_read_authenticated" ON public.cnpj_enrich_cache;
DROP POLICY IF EXISTS "cnpj_rate_read_authenticated" ON public.cnpj_enrich_rate_state;