-- =============================================================================
-- Reconciliar public.feature_flags com o schema REAL de produção
-- =============================================================================
-- A tabela foi criada em 20260513142941 com (name, enabled, rules), mas o
-- schema vivo de produção evoluiu para (flag_key, is_enabled, config,
-- organization_id) — evolução manual nunca commitada como migration.
-- Migrations posteriores (4941d6f0, 6cc0f3f2, 9f320c24) INSERT usando o
-- schema novo. Este arquivo re-declara o schema de produção de forma
-- idempotente para o replay (shadow) reproduzir o mesmo estado.
-- =============================================================================

-- 1. Adicionar colunas do schema novo se ainda não existirem
ALTER TABLE public.feature_flags
  ADD COLUMN IF NOT EXISTS flag_key        TEXT,
  ADD COLUMN IF NOT EXISTS is_enabled      BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS config          JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS organization_id UUID;

-- 2. Backfill flag_key a partir de name (tabela antiga)
UPDATE public.feature_flags
   SET flag_key = name
 WHERE flag_key IS NULL AND name IS NOT NULL;

-- 3. Backfill is_enabled a partir de enabled
UPDATE public.feature_flags
   SET is_enabled = enabled
 WHERE is_enabled IS NULL;

-- 4. Remover colunas antigas (novo schema de produção não as tem)
ALTER TABLE public.feature_flags
  DROP COLUMN IF EXISTS name,
  DROP COLUMN IF EXISTS enabled,
  DROP COLUMN IF EXISTS rules;

-- 5. Unique em flag_key (produção usa ON CONFLICT (flag_key)).
--    Índice completo (sem WHERE parcial) para o planner aceitar
--    ON CONFLICT (flag_key) nas migrations de INSERT posteriores.
ALTER TABLE public.feature_flags DROP CONSTRAINT IF EXISTS feature_flags_name_key;
DROP INDEX IF EXISTS feature_flags_flag_key_uk;
CREATE UNIQUE INDEX IF NOT EXISTS feature_flags_flag_key_uk
  ON public.feature_flags (flag_key);

-- 6. RLS já ativo; política de leitura por organização (padrão do repo)
DROP POLICY IF EXISTS "Feature flags are viewable by authenticated users" ON public.feature_flags;
CREATE POLICY "Feature flags are viewable by org" ON public.feature_flags
  FOR SELECT USING (organization_id IS NULL OR organization_id = public.default_org_for_current_user());

DROP POLICY IF EXISTS feature_flags_service_role ON public.feature_flags;
CREATE POLICY feature_flags_service_role ON public.feature_flags
  FOR ALL TO service_role USING (true) WITH CHECK (true);
