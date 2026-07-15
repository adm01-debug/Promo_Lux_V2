
ALTER TABLE public.lusha_contacts
  ADD COLUMN IF NOT EXISTS dedup_hash        text,
  ADD COLUMN IF NOT EXISTS last_enriched_at  timestamptz,
  ADD COLUMN IF NOT EXISTS enrichment_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_error        text;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='lusha_contacts_enrichment_status_chk') THEN
    ALTER TABLE public.lusha_contacts
      ADD CONSTRAINT lusha_contacts_enrichment_status_chk
      CHECK (enrichment_status IS NULL OR enrichment_status IN (
        'pending_enrichment','enriching','enriched','not_found',
        'error_auth','error_rate_limit','error_other','same_session_dedup',
        'pending','revealed','failed','duplicate','empty'
      ));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS lusha_contacts_org_linkedin_uk
  ON public.lusha_contacts (organization_id, linkedin_public_id)
  WHERE linkedin_public_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS lusha_contacts_status_org_idx
  ON public.lusha_contacts (organization_id, enrichment_status);

CREATE INDEX IF NOT EXISTS lusha_contacts_dedup_hash_idx
  ON public.lusha_contacts (dedup_hash)
  WHERE dedup_hash IS NOT NULL;

ALTER TABLE public.lusha_search_sessions
  ADD COLUMN IF NOT EXISTS progress_pct     integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS idempotency_key  text;

CREATE UNIQUE INDEX IF NOT EXISTS lusha_search_sessions_idem_uk
  ON public.lusha_search_sessions (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- Uniques necessárias para os upserts
CREATE UNIQUE INDEX IF NOT EXISTS circuit_breakers_service_name_uk
  ON public.circuit_breakers (service_name);

CREATE UNIQUE INDEX IF NOT EXISTS feature_flags_flag_key_uk
  ON public.feature_flags (flag_key);

INSERT INTO public.circuit_breakers (service_name, state, failure_count, threshold, reset_timeout_ms)
VALUES
  ('lusha_search',      'closed', 0, 5,  60000),
  ('lusha_company',     'closed', 0, 5,  60000),
  ('leadcontact_email', 'closed', 0, 5, 120000),
  ('leadcontact_phone', 'closed', 0, 5, 120000),
  ('cookie_vault',      'closed', 0, 3,  30000)
ON CONFLICT (service_name) DO NOTHING;

INSERT INTO public.feature_flags (flag_key, is_enabled, config)
VALUES ('oracle_v2', true, '{"description":"Nova automação Oracle v2 (LUX-only, sem crédito Lusha pago)"}'::jsonb)
ON CONFLICT (flag_key) DO NOTHING;
