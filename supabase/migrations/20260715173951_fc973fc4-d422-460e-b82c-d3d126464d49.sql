CREATE INDEX IF NOT EXISTS idx_lusha_contacts_org_pending
  ON public.lusha_contacts (organization_id)
  WHERE enrichment_status = 'pending_enrichment';

CREATE INDEX IF NOT EXISTS idx_lusha_search_sessions_org_idem
  ON public.lusha_search_sessions (organization_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;