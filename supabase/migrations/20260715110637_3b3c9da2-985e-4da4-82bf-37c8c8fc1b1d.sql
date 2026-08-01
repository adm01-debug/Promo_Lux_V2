CREATE TABLE public.lusha_dm_search_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID,
  domain TEXT NOT NULL,
  linkedin_url TEXT,
  status TEXT NOT NULL CHECK (status IN ('done','failed','cancelled','processing','queued')),
  decision_makers_count INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  duration_ms INTEGER,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_lusha_dm_hist_user_created ON public.lusha_dm_search_history(user_id, created_at DESC);
CREATE INDEX idx_lusha_dm_hist_user_domain ON public.lusha_dm_search_history(user_id, domain);
CREATE INDEX idx_lusha_dm_hist_user_status ON public.lusha_dm_search_history(user_id, status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lusha_dm_search_history TO authenticated;
GRANT ALL ON public.lusha_dm_search_history TO service_role;

ALTER TABLE public.lusha_dm_search_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own dm history"
  ON public.lusha_dm_search_history
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER trg_lusha_dm_hist_updated
  BEFORE UPDATE ON public.lusha_dm_search_history
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER PUBLICATION supabase_realtime ADD TABLE public.lusha_dm_search_history;