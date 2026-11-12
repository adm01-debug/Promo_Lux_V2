-- =============================================================================
-- Re-declaração do schema real de public.lusha_search_sessions
-- =============================================================================
-- Mesma situação documentada em 20260715135053_8bd5f8d2 (lusha_contacts):
-- a tabela já existia em produção mas nunca foi commitada como migration
-- (schema drift), e migrations posteriores (4941d6f0, fc973fc4) a
-- referenciam. Este arquivo RE-DECLARA o schema existente de forma
-- idempotente para reproduzir a estrutura correta em ambientes novos sem
-- efeito em produção. Schema extraído de src/integrations/supabase/types.ts
-- (gerado do banco vivo).
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.lusha_search_sessions (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                UUID NOT NULL DEFAULT auth.uid(),
  organization_id        UUID NOT NULL DEFAULT public.default_org_for_current_user(),
  company_id             UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  company_name           TEXT NOT NULL,
  search_type            TEXT NOT NULL DEFAULT 'company',
  domain_searched        TEXT,
  lusha_company_lid      TEXT,
  departments_requested  TEXT[] NOT NULL DEFAULT '{}'::text[],
  departments_mapped     TEXT[] NOT NULL DEFAULT '{}'::text[],
  departments_not_found  TEXT[] NOT NULL DEFAULT '{}'::text[],
  status                 TEXT NOT NULL DEFAULT 'running',
  started_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at           TIMESTAMPTZ,
  progress_pct           INTEGER NOT NULL DEFAULT 0,
  idempotency_key        TEXT,
  total_found            INTEGER NOT NULL DEFAULT 0,
  total_empty            INTEGER NOT NULL DEFAULT 0,
  total_errors           INTEGER NOT NULL DEFAULT 0,
  total_duplicates       INTEGER NOT NULL DEFAULT 0,
  total_enriched         INTEGER NOT NULL DEFAULT 0,
  total_inserted_bitrix  INTEGER NOT NULL DEFAULT 0,
  enrichment_rate        NUMERIC,
  error_message          TEXT,
  bitrix_card_id         TEXT,
  bitrix_company_id      TEXT,
  bitrix_user_id         TEXT,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lusha_search_sessions TO authenticated;
GRANT ALL ON public.lusha_search_sessions TO service_role;

ALTER TABLE public.lusha_search_sessions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='lusha_search_sessions' AND policyname='lss_select') THEN
    CREATE POLICY lss_select ON public.lusha_search_sessions
      FOR SELECT USING (organization_id = public.default_org_for_current_user());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='lusha_search_sessions' AND policyname='lss_insert') THEN
    CREATE POLICY lss_insert ON public.lusha_search_sessions
      FOR INSERT WITH CHECK (user_id = auth.uid() AND organization_id = public.default_org_for_current_user());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='lusha_search_sessions' AND policyname='lss_update') THEN
    CREATE POLICY lss_update ON public.lusha_search_sessions
      FOR UPDATE USING (organization_id = public.default_org_for_current_user());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='lusha_search_sessions' AND policyname='lss_delete') THEN
    CREATE POLICY lss_delete ON public.lusha_search_sessions
      FOR DELETE USING (organization_id = public.default_org_for_current_user());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='lusha_search_sessions' AND policyname='lss_service_role') THEN
    CREATE POLICY lss_service_role ON public.lusha_search_sessions
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_lss_org_status ON public.lusha_search_sessions (organization_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lss_org_idem ON public.lusha_search_sessions (organization_id, idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_lss_org_company ON public.lusha_search_sessions (organization_id, company_id);
CREATE INDEX IF NOT EXISTS idx_lss_user ON public.lusha_search_sessions (user_id, created_at DESC);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname='update_updated_at_column')
     AND NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='update_lusha_search_sessions_updated_at') THEN
    CREATE TRIGGER update_lusha_search_sessions_updated_at
      BEFORE UPDATE ON public.lusha_search_sessions
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END$$;
