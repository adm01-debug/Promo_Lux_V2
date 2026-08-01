-- =============================================================================
-- Documentação em versão: schema real da tabela public.lusha_contacts
-- =============================================================================
-- Esta tabela já existia em produção mas nunca foi commitada como migração
-- (schema drift). Este arquivo apenas RE-DECLARA o schema existente de forma
-- idempotente, para que:
--   1. Novos ambientes (staging/CI) reproduzam a estrutura correta.
--   2. Auditorias de RLS/GRANTS consigam ler o histórico completo do repo.
--   3. Alterações futuras tenham base declarada.
--
-- Todas as instruções usam IF NOT EXISTS / OR REPLACE — seguro para prod.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.lusha_contacts (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id                  UUID,
  company_id                  UUID,
  stakeholder_id              UUID,
  lusha_company_name          TEXT NOT NULL,
  lusha_company_lid           TEXT,
  full_name                   TEXT NOT NULL,
  first_name                  TEXT,
  job_title                   TEXT,
  department_pt               TEXT,
  department_en               TEXT,
  seniority                   TEXT,
  linkedin_url                TEXT,
  linkedin_public_id          TEXT,
  email                       TEXT,
  email_source                TEXT,
  phone_raw                   TEXT,
  phone_formatted             TEXT,
  phone_source                TEXT,
  enrichment_status           TEXT NOT NULL DEFAULT 'pending',
  bitrix_contact_id           TEXT,
  bitrix_card_id              TEXT,
  is_duplicate                BOOLEAN NOT NULL DEFAULT false,
  has_email                   BOOLEAN,
  has_phone                   BOOLEAN,
  confidence_score            INTEGER DEFAULT 50,
  raw_lusha_payload           JSONB NOT NULL DEFAULT '{}'::jsonb,
  raw_leadcontact_email       JSONB NOT NULL DEFAULT '{}'::jsonb,
  raw_leadcontact_phone       JSONB NOT NULL DEFAULT '{}'::jsonb,
  n8n_workflow_id             TEXT,
  n8n_execution_id            TEXT,
  linkedin_followers_count    INTEGER,
  linkedin_connections_count  INTEGER,
  linkedin_skills             TEXT[],
  linkedin_certifications     TEXT[],
  linkedin_courses            TEXT[],
  linkedin_awards             TEXT[],
  x_url                       TEXT,
  company_locations           JSONB,
  company_type                TEXT,
  company_linkedin_followers  INTEGER,
  company_email_domain        TEXT,
  lusha_popularity_tier       TEXT,
  company_linkedin_url        TEXT,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_id                     UUID NOT NULL DEFAULT auth.uid(),
  organization_id             UUID NOT NULL DEFAULT public.default_org_for_current_user()
);

-- Grants (obrigatórios para PostgREST enxergar a tabela via anon/authenticated)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lusha_contacts TO authenticated;
GRANT ALL ON public.lusha_contacts TO service_role;

-- Row Level Security
ALTER TABLE public.lusha_contacts ENABLE ROW LEVEL SECURITY;

-- Policies (idempotentes: só cria se ainda não existir)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='lusha_contacts' AND policyname='lc_select') THEN
    CREATE POLICY lc_select ON public.lusha_contacts
      FOR SELECT USING (organization_id = public.default_org_for_current_user());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='lusha_contacts' AND policyname='lc_insert') THEN
    CREATE POLICY lc_insert ON public.lusha_contacts
      FOR INSERT WITH CHECK (user_id = auth.uid() AND organization_id = public.default_org_for_current_user());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='lusha_contacts' AND policyname='lc_update') THEN
    CREATE POLICY lc_update ON public.lusha_contacts
      FOR UPDATE USING (organization_id = public.default_org_for_current_user());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='lusha_contacts' AND policyname='lc_delete') THEN
    CREATE POLICY lc_delete ON public.lusha_contacts
      FOR DELETE USING (organization_id = public.default_org_for_current_user());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='lusha_contacts' AND policyname='lc_service_role') THEN
    CREATE POLICY lc_service_role ON public.lusha_contacts
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END$$;

-- Índices de performance e dedup
CREATE UNIQUE INDEX IF NOT EXISTS idx_lc_unique_linkedin_org
  ON public.lusha_contacts (organization_id, linkedin_url)
  WHERE linkedin_url IS NOT NULL AND is_duplicate = false;

CREATE INDEX IF NOT EXISTS idx_lc_company_org
  ON public.lusha_contacts (organization_id, company_id, enrichment_status);

CREATE INDEX IF NOT EXISTS idx_lc_dept_org
  ON public.lusha_contacts (organization_id, department_en, enrichment_status);

CREATE INDEX IF NOT EXISTS idx_lc_email
  ON public.lusha_contacts (organization_id, email)
  WHERE email IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_lc_bitrix_card
  ON public.lusha_contacts (bitrix_card_id)
  WHERE bitrix_card_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_lc_session
  ON public.lusha_contacts (session_id)
  WHERE session_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_lc_user
  ON public.lusha_contacts (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_lc_status_created
  ON public.lusha_contacts (enrichment_status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_lc_raw_payload_gin
  ON public.lusha_contacts USING GIN (raw_lusha_payload)
  WHERE raw_lusha_payload IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_lc_skills
  ON public.lusha_contacts USING GIN (linkedin_skills)
  WHERE linkedin_skills IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_lc_linkedin_followers
  ON public.lusha_contacts (linkedin_followers_count DESC)
  WHERE linkedin_followers_count IS NOT NULL;

CREATE INDEX IF NOT EXISTS lusha_contacts_company_linkedin_url_idx
  ON public.lusha_contacts (company_linkedin_url)
  WHERE company_linkedin_url IS NOT NULL;

-- Trigger updated_at (só cria se a função existir e o trigger ainda não)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname='update_updated_at_column')
     AND NOT EXISTS (
       SELECT 1 FROM pg_trigger WHERE tgname='update_lusha_contacts_updated_at'
     ) THEN
    CREATE TRIGGER update_lusha_contacts_updated_at
      BEFORE UPDATE ON public.lusha_contacts
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END$$;