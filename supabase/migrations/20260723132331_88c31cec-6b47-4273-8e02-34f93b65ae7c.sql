CREATE TABLE IF NOT EXISTS public.qa_test_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  round INTEGER,
  kind TEXT NOT NULL,
  suite TEXT,
  tests_total INTEGER NOT NULL DEFAULT 0,
  tests_passed INTEGER NOT NULL DEFAULT 0,
  tests_failed INTEGER NOT NULL DEFAULT 0,
  tests_skipped INTEGER NOT NULL DEFAULT 0,
  duration_ms INTEGER NOT NULL DEFAULT 0,
  coverage_pct NUMERIC(5,2),
  commit_sha TEXT,
  branch TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT qa_test_runs_kind_check CHECK (kind IN ('unit','edge','e2e','integration','lint','typecheck')),
  CONSTRAINT qa_test_runs_totals_check CHECK (
    tests_total >= 0
    AND tests_passed >= 0
    AND tests_failed >= 0
    AND tests_skipped >= 0
    AND tests_passed + tests_failed + tests_skipped <= tests_total
  ),
  CONSTRAINT qa_test_runs_coverage_check CHECK (coverage_pct IS NULL OR (coverage_pct >= 0 AND coverage_pct <= 100))
);

CREATE INDEX IF NOT EXISTS idx_qa_test_runs_created_at ON public.qa_test_runs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_qa_test_runs_kind_created ON public.qa_test_runs (kind, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_qa_test_runs_round ON public.qa_test_runs (round DESC NULLS LAST);

GRANT SELECT ON public.qa_test_runs TO authenticated;
GRANT ALL ON public.qa_test_runs TO service_role;

ALTER TABLE public.qa_test_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "qa_runs_read_authenticated"
  ON public.qa_test_runs FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "qa_runs_service_role_all"
  ON public.qa_test_runs FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);