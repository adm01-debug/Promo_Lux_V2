
-- ============ QUEUE ============
CREATE TABLE public.instagram_scrape_queue (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL CHECK (target_type IN ('profile','posts','hashtag','comments')),
  target_value TEXT NOT NULL,
  params JSONB NOT NULL DEFAULT '{}'::jsonb,
  config_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','succeeded','failed','dead')),
  attempt INT NOT NULL DEFAULT 0,
  max_attempts INT NOT NULL DEFAULT 4,
  next_run_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  locked_at TIMESTAMPTZ,
  locked_by TEXT,
  last_error TEXT,
  trace_id UUID NOT NULL DEFAULT gen_random_uuid(),
  correlation_id UUID,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.instagram_scrape_queue TO authenticated;
GRANT ALL ON public.instagram_scrape_queue TO service_role;
ALTER TABLE public.instagram_scrape_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members read ig queue" ON public.instagram_scrape_queue
  FOR SELECT TO authenticated
  USING (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()));

CREATE POLICY "org members write ig queue" ON public.instagram_scrape_queue
  FOR INSERT TO authenticated
  WITH CHECK (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()));

CREATE POLICY "org members update ig queue" ON public.instagram_scrape_queue
  FOR UPDATE TO authenticated
  USING (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()));

CREATE POLICY "org members delete ig queue" ON public.instagram_scrape_queue
  FOR DELETE TO authenticated
  USING (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()));

CREATE INDEX idx_ig_queue_status_next ON public.instagram_scrape_queue (status, next_run_at) WHERE status IN ('queued','running');
CREATE INDEX idx_ig_queue_org ON public.instagram_scrape_queue (organization_id, created_at DESC);
CREATE UNIQUE INDEX idx_ig_queue_config_hash_active ON public.instagram_scrape_queue (organization_id, config_hash)
  WHERE status IN ('queued','running');

-- ============ RESULTS ============
CREATE TABLE public.instagram_scrape_results (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  queue_id UUID NOT NULL REFERENCES public.instagram_scrape_queue(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL,
  target_value TEXT NOT NULL,
  item_type TEXT NOT NULL,
  normalized JSONB NOT NULL,
  raw JSONB,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.instagram_scrape_results TO authenticated;
GRANT ALL ON public.instagram_scrape_results TO service_role;
ALTER TABLE public.instagram_scrape_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members read ig results" ON public.instagram_scrape_results
  FOR SELECT TO authenticated
  USING (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()));

CREATE INDEX idx_ig_results_queue ON public.instagram_scrape_results (queue_id);
CREATE INDEX idx_ig_results_org_time ON public.instagram_scrape_results (organization_id, fetched_at DESC);

-- ============ DEAD LETTER ============
CREATE TABLE public.instagram_scrape_dead_letter (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  queue_id UUID NOT NULL,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL,
  target_value TEXT NOT NULL,
  params JSONB NOT NULL DEFAULT '{}'::jsonb,
  attempts INT NOT NULL,
  last_error TEXT,
  error_class TEXT,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.instagram_scrape_dead_letter TO authenticated;
GRANT ALL ON public.instagram_scrape_dead_letter TO service_role;
ALTER TABLE public.instagram_scrape_dead_letter ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members read ig dlq" ON public.instagram_scrape_dead_letter
  FOR SELECT TO authenticated
  USING (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()));

CREATE INDEX idx_ig_dlq_org_time ON public.instagram_scrape_dead_letter (organization_id, last_seen_at DESC);

-- ============ TIMESTAMPS ============
CREATE TRIGGER trg_ig_queue_updated_at BEFORE UPDATE ON public.instagram_scrape_queue
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ CLAIM RPC ============
CREATE OR REPLACE FUNCTION public.claim_instagram_job(p_worker_id TEXT, p_batch_size INT DEFAULT 1)
RETURNS SETOF public.instagram_scrape_queue
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  UPDATE public.instagram_scrape_queue q
  SET status = 'running',
      locked_at = now(),
      locked_by = p_worker_id,
      attempt = q.attempt + 1,
      updated_at = now()
  WHERE q.id IN (
    SELECT id FROM public.instagram_scrape_queue
    WHERE status = 'queued'
      AND next_run_at <= now()
    ORDER BY next_run_at ASC
    LIMIT p_batch_size
    FOR UPDATE SKIP LOCKED
  )
  RETURNING q.*;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_instagram_job(TEXT, INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_instagram_job(TEXT, INT) TO service_role;
