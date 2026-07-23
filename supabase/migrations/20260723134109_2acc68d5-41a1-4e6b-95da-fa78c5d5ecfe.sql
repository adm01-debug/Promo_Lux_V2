
-- ============================================================================
-- Rodada #39 · G5 — Idempotência em scrape_queue (legada)
-- ============================================================================
ALTER TABLE public.scrape_queue
  ADD COLUMN IF NOT EXISTS payload_hash TEXT
  GENERATED ALWAYS AS (
    md5(coalesce(source,'') || '|' || coalesce(payload::text, ''))
  ) STORED;

CREATE UNIQUE INDEX IF NOT EXISTS uq_scrape_queue_idempotent
  ON public.scrape_queue (organization_id, payload_hash)
  WHERE status IN ('queued'::scrape_queue_status, 'processing'::scrape_queue_status);
