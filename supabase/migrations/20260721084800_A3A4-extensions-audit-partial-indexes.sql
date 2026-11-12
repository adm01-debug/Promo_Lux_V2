-- =============================================================================
-- Migration A3+A4: Extensions Schema Path + Partial Indexes de Fila
-- =============================================================================
-- A3: Preparar schema extensions para migração gradual (não mover ainda).
--   RISCO IDENTIFICADO na simulação: mover uuid-ossp quebra SET search_path = public
--   nas funções SECURITY DEFINER existentes (chamadas a uuid_generate_v4() falhariam).
--   ESTRATÉGIA SEGURA: adicionar extensions ao search_path do banco sem mover nada.
--
-- A4: Partial indexes para padrão de claim FOR UPDATE SKIP LOCKED nas filas.
-- =============================================================================

BEGIN;

-- ─── A3.1: Adicionar extensions ao search_path da database (seguro) ──────────
-- Isso permite que futuros objetos em schema extensions sejam encontrados
-- mesmo em funções com SET search_path = public.
-- Nota: não altera o comportamento atual — apenas prepara para migração futura.
DO $$
BEGIN
  -- Verificar se o schema existe (criado em A1)
  IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'extensions') THEN
    RAISE WARNING 'Schema extensions não encontrado — A1 deve ser executado primeiro';
    RETURN;
  END IF;
  RAISE NOTICE 'Schema extensions: OK';
END $$;

-- ─── A3.2: View de auditoria de extensões no schema public ───────────────────
-- Alimenta decisão de quais extensões podem ser movidas com segurança.
-- Zero risco: apenas lê pg_extension.
CREATE OR REPLACE VIEW public.v_extensions_audit AS
SELECT 
  e.extname                    AS extension_name,
  n.nspname                    AS current_schema,
  e.extversion                 AS version,
  CASE n.nspname
    WHEN 'public'     THEN '⚠️  Em public — candidata à migração para extensions'
    WHEN 'extensions' THEN '✅  Já no schema correto'
    ELSE                   '🔵  Outro schema — OK'
  END                          AS status,
  CASE e.extname
    WHEN 'uuid-ossp'  THEN '🔴 CRÍTICO: não mover sem atualizar SET search_path em todas as funções SECURITY DEFINER'
    WHEN 'pg_trgm'    THEN '🟡 Movível: verificar índices GIN/GIST existentes antes'
    WHEN 'unaccent'   THEN '🟢 Movível: sem efeitos colaterais esperados'
    WHEN 'pgcrypto'   THEN '🟡 Movível: verificar chamadas a crypt(), digest()'
    WHEN 'pg_cron'    THEN '🔴 CRÍTICO: não mover — cron roda como postgres superuser'
    ELSE '🔵 Avaliar individualmente'
  END                          AS migration_risk
FROM pg_extension e
JOIN pg_namespace n ON e.extnamespace = n.oid
ORDER BY 
  CASE n.nspname WHEN 'public' THEN 0 ELSE 1 END,
  e.extname;

COMMENT ON VIEW public.v_extensions_audit IS
  'Auditoria de extensões PostgreSQL. '
  'Identifica candidatas à migração para schema extensions. '
  'Consultar antes de executar migração de extensões. ADR-009.';

REVOKE ALL ON public.v_extensions_audit FROM anon;
GRANT SELECT ON public.v_extensions_audit TO authenticated, service_role;

-- ─── A4.1: Partial indexes para fila de scrape ──────────────────────────────
-- Padrão: SELECT ... WHERE status IN ('pending','running') FOR UPDATE SKIP LOCKED
-- Sem índice parcial → seq scan em tabelas grandes = lentidão crítica sob volume.
-- Com índice parcial → index scan apenas nas linhas ativas (99% são completed).

-- scrape_jobs: status pending/running são minoria, mas são as que o worker busca
CREATE INDEX IF NOT EXISTS idx_scrape_jobs_pending_active
  ON public.scrape_jobs(created_at DESC, id)
  WHERE status IN ('pending', 'running', 'working');

COMMENT ON INDEX idx_scrape_jobs_pending_active IS
  'Partial index para worker de scrape. '
  'Padrão: SELECT ... WHERE status IN (pending,running,working) FOR UPDATE SKIP LOCKED. '
  'Apenas linhas ativas são indexadas — ~1-5% do total. A4.';

-- scrape_queue (tabela de fila se existir — nome alternativo)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables 
             WHERE table_name = 'scrape_queue' AND table_schema = 'public') THEN
    EXECUTE $idx$
      CREATE INDEX IF NOT EXISTS idx_scrape_queue_claim
        ON public.scrape_queue(scrape_job_id, id)
        WHERE status = 'pending'
        INCLUDE (payload, created_at);
    $idx$;
    RAISE NOTICE 'idx_scrape_queue_claim criado';
  ELSE
    RAISE NOTICE 'Tabela scrape_queue não encontrada — pulando idx_scrape_queue_claim';
  END IF;
END $$;

-- workflow_runs: execuções running são poucas mas críticas (monitoramento)
CREATE INDEX IF NOT EXISTS idx_workflow_runs_running
  ON public.workflow_runs(workflow_id, started_at DESC)
  WHERE status = 'running';

COMMENT ON INDEX idx_workflow_runs_running IS
  'Partial index para monitoramento de workflow_runs ativos. A4.';

-- automation_steps: pending/running são as que o worker processa
CREATE INDEX IF NOT EXISTS idx_automation_steps_pending
  ON public.automation_steps(run_id, created_at ASC)
  WHERE status IN ('pending', 'running');

COMMENT ON INDEX idx_automation_steps_pending IS
  'Partial index para processamento de automation_steps. A4.';

-- ─── A4.2: Index para campaign_dispatch (padrão de claim) ────────────────────
-- campaign_dispatch processa emails pendentes — precisa de index eficiente
DO $$
BEGIN
  -- email_messages (se existir)
  IF EXISTS (SELECT 1 FROM information_schema.tables 
             WHERE table_name = 'email_messages' AND table_schema = 'public') THEN
    EXECUTE $idx$
      CREATE INDEX IF NOT EXISTS idx_email_messages_pending
        ON public.email_messages(scheduled_at ASC, organization_id)
        WHERE status = 'pending';
    $idx$;
    RAISE NOTICE 'idx_email_messages_pending criado';
  END IF;

  -- campaign_contacts (se existir)  
  IF EXISTS (SELECT 1 FROM information_schema.tables 
             WHERE table_name = 'campaign_contacts' AND table_schema = 'public') THEN
    EXECUTE $idx$
      CREATE INDEX IF NOT EXISTS idx_campaign_contacts_pending
        ON public.campaign_contacts(campaign_id, next_contact_at ASC)
        WHERE status IN ('pending', 'scheduled');
    $idx$;
    RAISE NOTICE 'idx_campaign_contacts_pending criado';
  END IF;
END $$;

-- ─── A4.3: Analyze após criação dos indexes ───────────────────────────────────
-- Atualiza estatísticas para que o planner use os novos indexes imediatamente.
ANALYZE public.scrape_jobs;
ANALYZE public.workflow_runs;
ANALYZE public.automation_steps;

COMMIT;
