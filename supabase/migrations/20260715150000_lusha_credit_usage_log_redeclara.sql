-- =============================================================================
-- Re-declaração do schema real de public.lusha_credit_usage_log
-- =============================================================================
-- Mesmo padrão dos drifts anteriores (lusha_contacts, lusha_search_sessions):
-- a tabela existe em produção mas nunca foi commitada como migration, e
-- migrations/functions posteriores (GRANT/POLICY em 637d3fdc) a referenciam.
-- Schema extraído de src/integrations/supabase/types.ts (gerado do banco vivo).
-- Idempotente: não tem efeito em produção.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.lusha_credit_usage_log (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID NOT NULL,
  user_id           UUID,
  session_id        UUID,
  bitrix_card_id    TEXT,
  company_name      TEXT,
  domain            TEXT,
  endpoint          TEXT NOT NULL,
  operation         TEXT NOT NULL,
  api_version       TEXT,
  success           BOOLEAN NOT NULL DEFAULT false,
  credits_charged   INTEGER NOT NULL DEFAULT 0,
  records_returned  INTEGER NOT NULL DEFAULT 0,
  request_id        TEXT,
  error_code        TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.lusha_credit_usage_log TO authenticated;
GRANT ALL ON public.lusha_credit_usage_log TO service_role;

ALTER TABLE public.lusha_credit_usage_log ENABLE ROW LEVEL SECURITY;

-- Políticas criadas pela migration 20260715170247_637d3fdc logo em seguida;
-- esta re-declaração não as duplica (evita 42710).

CREATE INDEX IF NOT EXISTS idx_lcul_org_created ON public.lusha_credit_usage_log (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lcul_operation ON public.lusha_credit_usage_log (operation);
