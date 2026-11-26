-- Baseline do drift de schema logico entre producao e o historico de migrations.
--
-- Causa: alteracoes foram aplicadas direto em producao (autorizadas pelo dono) e, em paralelo,
-- duas migrations do repositorio ficaram registradas em supabase_migrations.schema_migrations
-- sem terem sido executadas:
--   20260718140500_b2e1d3c4-9f6a-4b7c-8d2e-1a3f5c7b9e0f.sql  (webhook_deliveries.status com 'sending')
--   20260718141500_d4a3b5c6-1e8f-4a9b-8c2d-3f5a7b9c1d0e.sql  (circuit_breakers.half_open_at)
-- Efeito: um rebuild a partir das migrations nao reproduzia producao, e producao ficou sem
-- colunas que o codigo escreve (webhook-dispatcher e circuit-breaker).
--
-- Esta migration e idempotente e converge os dois lados:
--   * adiciona em producao colunas ausentes que o codigo usa (half_open_at,
--     feature_flags.description, webhook_deliveries com 'sending');
--   * adiciona ao rebuild colunas que so existiam em producao (audit_logs.metadata,
--     lusha_contacts.data_freshness_ttl, lusha_contacts.last_recheck_at);
--   * alinha defaults, CHECKs, enums e as views v_lusha_cache_stats /
--     v_lux_enrichment_health a definicao real de producao.
--
-- Sem migracao de dados: apenas DDL guardado por IF EXISTS / IF NOT EXISTS.

SET statement_timeout = '120s';

-- 1) Colunas presentes so em producao (o rebuild as perdia)
ALTER TABLE public.audit_logs     ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;
ALTER TABLE public.lusha_contacts ADD COLUMN IF NOT EXISTS data_freshness_ttl integer NOT NULL DEFAULT 90;
ALTER TABLE public.lusha_contacts ADD COLUMN IF NOT EXISTS last_recheck_at timestamptz;

-- 2) Colunas que o codigo escreve mas que producao nao tinha
--    (migrations registradas como aplicadas, porem nunca executadas)
ALTER TABLE public.circuit_breakers ADD COLUMN IF NOT EXISTS half_open_at timestamptz;
ALTER TABLE public.feature_flags    ADD COLUMN IF NOT EXISTS description text;

-- 3) Defaults divergentes (producao e a verdade)
ALTER TABLE public.lusha_credit_usage_log ALTER COLUMN api_version SET DEFAULT 'v3';
ALTER TABLE public.lusha_credit_usage_log ALTER COLUMN success     SET DEFAULT true;
ALTER TABLE public.lusha_search_sessions  ALTER COLUMN search_type SET DEFAULT 'department_search';

-- 4) Enums do schema publico (CREATE TYPE ausente do historico de migrations)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace ns ON ns.oid = t.typnamespace WHERE t.typname = 'app_role' AND ns.nspname = 'public') THEN
    CREATE TYPE public.app_role AS ENUM (
      'admin',
      'sdr',
      'viewer'
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace ns ON ns.oid = t.typnamespace WHERE t.typname = 'audit_action' AND ns.nspname = 'public') THEN
    CREATE TYPE public.audit_action AS ENUM (
      'create',
      'update',
      'delete',
      'execute'
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace ns ON ns.oid = t.typnamespace WHERE t.typname = 'automation_status' AND ns.nspname = 'public') THEN
    CREATE TYPE public.automation_status AS ENUM (
      'pending',
      'running',
      'completed',
      'failed',
      'cancelled'
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace ns ON ns.oid = t.typnamespace WHERE t.typname = 'campaign_status' AND ns.nspname = 'public') THEN
    CREATE TYPE public.campaign_status AS ENUM (
      'draft',
      'active',
      'paused',
      'completed',
      'archived'
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace ns ON ns.oid = t.typnamespace WHERE t.typname = 'scrape_job_status' AND ns.nspname = 'public') THEN
    CREATE TYPE public.scrape_job_status AS ENUM (
      'pending',
      'running',
      'working',
      'completed',
      'failed',
      'cancelled'
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace ns ON ns.oid = t.typnamespace WHERE t.typname = 'scrape_queue_status' AND ns.nspname = 'public') THEN
    CREATE TYPE public.scrape_queue_status AS ENUM (
      'queued',
      'processing',
      'succeeded',
      'dead'
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace ns ON ns.oid = t.typnamespace WHERE t.typname = 'web_scrape_status' AND ns.nspname = 'public') THEN
    CREATE TYPE public.web_scrape_status AS ENUM (
      'queued',
      'processing',
      'succeeded',
      'failed',
      'dead'
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace ns ON ns.oid = t.typnamespace WHERE t.typname = 'workflow_status' AND ns.nspname = 'public') THEN
    CREATE TYPE public.workflow_status AS ENUM (
      'draft',
      'active',
      'paused',
      'completed',
      'failed',
      'running',
      'archived'
    );
  END IF;
END $$;

-- 5) Colunas que producao tipa como enum (no-op em producao; converte o rebuild).
--    Os indices parciais de scrape_jobs saem antes do ALTER TYPE porque o predicado
--    antigo (comparacao com text[]) impede a reanalise com o tipo enum.

DO $$ BEGIN
  IF (SELECT c.udt_name FROM information_schema.columns c WHERE c.table_schema = 'public' AND c.table_name = 'organization_invites' AND c.column_name = 'role') IS DISTINCT FROM 'app_role' THEN
    ALTER TABLE public.organization_invites ALTER COLUMN role DROP DEFAULT;
    ALTER TABLE public.organization_invites
      ALTER COLUMN role TYPE public.app_role
      USING (role::text)::public.app_role;
  END IF;
END $$;
ALTER TABLE public.organization_invites ALTER COLUMN role SET DEFAULT 'viewer'::public.app_role;

DO $$ BEGIN
  IF (SELECT c.udt_name FROM information_schema.columns c WHERE c.table_schema = 'public' AND c.table_name = 'organization_members' AND c.column_name = 'role') IS DISTINCT FROM 'app_role' THEN
    ALTER TABLE public.organization_members ALTER COLUMN role DROP DEFAULT;
    ALTER TABLE public.organization_members
      ALTER COLUMN role TYPE public.app_role
      USING (role::text)::public.app_role;
  END IF;
END $$;
ALTER TABLE public.organization_members ALTER COLUMN role SET DEFAULT 'viewer'::public.app_role;

DO $$ BEGIN
  IF (SELECT c.udt_name FROM information_schema.columns c WHERE c.table_schema = 'public' AND c.table_name = 'role_permissions' AND c.column_name = 'role') IS DISTINCT FROM 'app_role' THEN
    ALTER TABLE public.role_permissions ALTER COLUMN role DROP DEFAULT;
    ALTER TABLE public.role_permissions
      ALTER COLUMN role TYPE public.app_role
      USING (role::text)::public.app_role;
  END IF;
END $$;

DO $$ BEGIN
  IF (SELECT c.udt_name FROM information_schema.columns c WHERE c.table_schema = 'public' AND c.table_name = 'user_roles' AND c.column_name = 'role') IS DISTINCT FROM 'app_role' THEN
    ALTER TABLE public.user_roles ALTER COLUMN role DROP DEFAULT;
    ALTER TABLE public.user_roles
      ALTER COLUMN role TYPE public.app_role
      USING (role::text)::public.app_role;
  END IF;
END $$;

DO $$ BEGIN
  IF (SELECT c.udt_name FROM information_schema.columns c WHERE c.table_schema = 'public' AND c.table_name = 'audit_logs' AND c.column_name = 'action') IS DISTINCT FROM 'audit_action' THEN
    ALTER TABLE public.audit_logs ALTER COLUMN action DROP DEFAULT;
    ALTER TABLE public.audit_logs
      ALTER COLUMN action TYPE public.audit_action
      USING (action::text)::public.audit_action;
  END IF;
END $$;

DO $$ BEGIN
  IF (SELECT c.udt_name FROM information_schema.columns c WHERE c.table_schema = 'public' AND c.table_name = 'automation_steps' AND c.column_name = 'status') IS DISTINCT FROM 'automation_status' THEN
    ALTER TABLE public.automation_steps ALTER COLUMN status DROP DEFAULT;
    ALTER TABLE public.automation_steps
      ALTER COLUMN status TYPE public.automation_status
      USING (status::text)::public.automation_status;
  END IF;
END $$;
ALTER TABLE public.automation_steps ALTER COLUMN status SET DEFAULT 'pending'::public.automation_status;

DO $$ BEGIN
  IF (SELECT c.udt_name FROM information_schema.columns c WHERE c.table_schema = 'public' AND c.table_name = 'campaigns' AND c.column_name = 'status') IS DISTINCT FROM 'campaign_status' THEN
    ALTER TABLE public.campaigns ALTER COLUMN status DROP DEFAULT;
    ALTER TABLE public.campaigns
      ALTER COLUMN status TYPE public.campaign_status
      USING (status::text)::public.campaign_status;
  END IF;
END $$;
ALTER TABLE public.campaigns ALTER COLUMN status SET DEFAULT 'draft'::public.campaign_status;

DO $$ BEGIN
  IF (SELECT c.udt_name FROM information_schema.columns c WHERE c.table_schema = 'public' AND c.table_name = 'scrape_jobs' AND c.column_name = 'status') IS DISTINCT FROM 'scrape_job_status' THEN
    DROP INDEX IF EXISTS public.idx_scrape_jobs_pending_active;
    DROP INDEX IF EXISTS public.scrape_jobs_org_config_active_uk;
  END IF;
END $$;

DO $$ BEGIN
  IF (SELECT c.udt_name FROM information_schema.columns c WHERE c.table_schema = 'public' AND c.table_name = 'scrape_jobs' AND c.column_name = 'status') IS DISTINCT FROM 'scrape_job_status' THEN
    ALTER TABLE public.scrape_jobs ALTER COLUMN status DROP DEFAULT;
    ALTER TABLE public.scrape_jobs
      ALTER COLUMN status TYPE public.scrape_job_status
      USING (status::text)::public.scrape_job_status;
  END IF;
END $$;
ALTER TABLE public.scrape_jobs ALTER COLUMN status SET DEFAULT 'pending'::public.scrape_job_status;
CREATE INDEX IF NOT EXISTS idx_scrape_jobs_pending_active ON public.scrape_jobs USING btree (created_at DESC, id) WHERE (status = ANY (ARRAY['pending'::scrape_job_status, 'running'::scrape_job_status, 'working'::scrape_job_status]));
CREATE UNIQUE INDEX IF NOT EXISTS scrape_jobs_org_config_active_uk ON public.scrape_jobs USING btree (organization_id, config_hash) WHERE ((status = ANY (ARRAY['pending'::scrape_job_status, 'running'::scrape_job_status, 'working'::scrape_job_status])) AND (config_hash IS NOT NULL));

DO $$ BEGIN
  IF (SELECT c.udt_name FROM information_schema.columns c WHERE c.table_schema = 'public' AND c.table_name = 'scrape_queue' AND c.column_name = 'status') IS DISTINCT FROM 'scrape_queue_status' THEN
    ALTER TABLE public.scrape_queue ALTER COLUMN status DROP DEFAULT;
    ALTER TABLE public.scrape_queue
      ALTER COLUMN status TYPE public.scrape_queue_status
      USING (status::text)::public.scrape_queue_status;
  END IF;
END $$;
ALTER TABLE public.scrape_queue ALTER COLUMN status SET DEFAULT 'queued'::public.scrape_queue_status;

DO $$ BEGIN
  IF (SELECT c.udt_name FROM information_schema.columns c WHERE c.table_schema = 'public' AND c.table_name = 'web_scrape_queue' AND c.column_name = 'status') IS DISTINCT FROM 'web_scrape_status' THEN
    ALTER TABLE public.web_scrape_queue ALTER COLUMN status DROP DEFAULT;
    ALTER TABLE public.web_scrape_queue
      ALTER COLUMN status TYPE public.web_scrape_status
      USING (status::text)::public.web_scrape_status;
  END IF;
END $$;
ALTER TABLE public.web_scrape_queue ALTER COLUMN status SET DEFAULT 'queued'::public.web_scrape_status;

DO $$ BEGIN
  IF (SELECT c.udt_name FROM information_schema.columns c WHERE c.table_schema = 'public' AND c.table_name = 'workflows' AND c.column_name = 'status') IS DISTINCT FROM 'workflow_status' THEN
    ALTER TABLE public.workflows ALTER COLUMN status DROP DEFAULT;
    ALTER TABLE public.workflows
      ALTER COLUMN status TYPE public.workflow_status
      USING (status::text)::public.workflow_status;
  END IF;
END $$;
ALTER TABLE public.workflows ALTER COLUMN status SET DEFAULT 'draft'::public.workflow_status;

-- 6) companies.revenue: producao e numeric
--    (src/integrations/supabase/types.ts declara revenue: number | null)
DO $$ BEGIN
  IF (SELECT c.udt_name FROM information_schema.columns c
       WHERE c.table_schema = 'public' AND c.table_name = 'companies' AND c.column_name = 'revenue')
     IS DISTINCT FROM 'numeric' THEN
    ALTER TABLE public.companies ALTER COLUMN revenue DROP DEFAULT;
    ALTER TABLE public.companies
      ALTER COLUMN revenue TYPE numeric
      USING CASE WHEN btrim(revenue) ~ '^-?[0-9]+(\.[0-9]+)?$' THEN btrim(revenue)::numeric ELSE NULL END;
  END IF;
END $$;

-- 7) CHECKs alinhados a definicao real de producao.
--    webhook_deliveries: 'sending' e obrigatorio para o claim atomico do
--    webhook-dispatcher (supabase/functions/webhook-dispatcher/index.ts:101).

ALTER TABLE public.lusha_contacts DROP CONSTRAINT IF EXISTS lusha_contacts_bitrix_exige_dado;
ALTER TABLE public.lusha_contacts ADD CONSTRAINT lusha_contacts_bitrix_exige_dado CHECK (((enrichment_status IS NULL) OR (enrichment_status <> ALL (ARRAY['pushing_bitrix'::text, 'sent_to_bitrix'::text])) OR (email IS NOT NULL) OR (phone_formatted IS NOT NULL)));

ALTER TABLE public.lusha_contacts DROP CONSTRAINT IF EXISTS lusha_contacts_bitrix_exige_id;
ALTER TABLE public.lusha_contacts ADD CONSTRAINT lusha_contacts_bitrix_exige_id CHECK (((enrichment_status IS NULL) OR (enrichment_status <> ALL (ARRAY['sent_to_bitrix'::text, 'bitrix_duplicate'::text])) OR ((bitrix_contact_id IS NOT NULL) AND (bitrix_contact_id <> ''::text))));

ALTER TABLE public.lusha_contacts DROP CONSTRAINT IF EXISTS lusha_contacts_confidence_score_check;
ALTER TABLE public.lusha_contacts ADD CONSTRAINT lusha_contacts_confidence_score_check CHECK (((confidence_score >= 0) AND (confidence_score <= 100)));

ALTER TABLE public.lusha_contacts DROP CONSTRAINT IF EXISTS lusha_contacts_contact_source_check;
ALTER TABLE public.lusha_contacts ADD CONSTRAINT lusha_contacts_contact_source_check CHECK ((contact_source = ANY (ARRAY['lusha'::text, 'apollo'::text])));

ALTER TABLE public.lusha_contacts DROP CONSTRAINT IF EXISTS lusha_contacts_email_source_chk;
ALTER TABLE public.lusha_contacts ADD CONSTRAINT lusha_contacts_email_source_chk CHECK (((email_source IS NULL) OR (email_source = ANY (ARRAY['leadcontact'::text, 'payload_emails'::text, 'previous_job'::text, 'lusha_reveal'::text]))));

ALTER TABLE public.lusha_contacts DROP CONSTRAINT IF EXISTS lusha_contacts_enrichment_status_chk;
ALTER TABLE public.lusha_contacts ADD CONSTRAINT lusha_contacts_enrichment_status_chk CHECK (((enrichment_status IS NULL) OR (enrichment_status = ANY (ARRAY['pending'::text, 'pending_enrichment'::text, 'enriching'::text, 'enriched'::text, 'not_found'::text, 'empty'::text, 'error'::text, 'error_auth'::text, 'error_rate_limit'::text, 'error_other'::text, 'error_bitrix'::text, 'same_session_dedup'::text, 'duplicate'::text, 'bitrix_duplicate'::text, 'revealed'::text, 'failed'::text, 'pushing_bitrix'::text, 'sent_to_bitrix'::text]))));

ALTER TABLE public.lusha_contacts DROP CONSTRAINT IF EXISTS lusha_contacts_phone_source_chk;
ALTER TABLE public.lusha_contacts ADD CONSTRAINT lusha_contacts_phone_source_chk CHECK (((phone_source IS NULL) OR (phone_source = ANY (ARRAY['leadcontact'::text, 'payload_phones'::text, 'lusha_reveal'::text]))));

ALTER TABLE public.lusha_credit_usage_log DROP CONSTRAINT IF EXISTS lusha_credit_usage_log_operation_check;
ALTER TABLE public.lusha_credit_usage_log ADD CONSTRAINT lusha_credit_usage_log_operation_check CHECK ((operation = ANY (ARRAY['search_contacts'::text, 'enrich_contact'::text, 'enrich_company'::text, 'decision_makers'::text, 'lookalike_contacts'::text, 'lookalike_companies'::text, 'signals_contacts'::text, 'signals_companies'::text, 'website_visits'::text])));

ALTER TABLE public.lusha_search_sessions DROP CONSTRAINT IF EXISTS lusha_search_sessions_search_type_check;
ALTER TABLE public.lusha_search_sessions ADD CONSTRAINT lusha_search_sessions_search_type_check CHECK ((search_type = ANY (ARRAY['department_search'::text, 'decision_makers_domain'::text])));

ALTER TABLE public.lusha_search_sessions DROP CONSTRAINT IF EXISTS lusha_search_sessions_status_check;
ALTER TABLE public.lusha_search_sessions ADD CONSTRAINT lusha_search_sessions_status_check CHECK ((status = ANY (ARRAY['running'::text, 'completed'::text, 'error'::text, 'cancelled'::text])));

ALTER TABLE public.webhook_deliveries DROP CONSTRAINT IF EXISTS webhook_deliveries_status_check;
ALTER TABLE public.webhook_deliveries ADD CONSTRAINT webhook_deliveries_status_check
  CHECK (status IN ('pending', 'sending', 'success', 'failed', 'retrying'));

-- 8) Views que so existiam em producao

CREATE OR REPLACE VIEW public.v_lusha_cache_stats AS
SELECT organization_id,
    count(*) AS total_contacts,
    count(*) FILTER (WHERE has_email) AS with_email,
    count(*) FILTER (WHERE has_phone) AS with_phone,
    count(*) FILTER (WHERE last_enriched_at IS NOT NULL AND last_enriched_at > (now() - ((COALESCE(data_freshness_ttl, 90) || ' days'::text)::interval)) AND (enrichment_status <> ALL (ARRAY['pending_enrichment'::text, 'pending'::text, 'error'::text, 'error_lusha'::text, 'skipped'::text, 'cancelled'::text])) AND (has_email = true OR has_phone = true)) AS cache_eligible_hits,
    count(*) FILTER (WHERE enrichment_status = 'pending_enrichment'::text) AS pending,
    count(*) FILTER (WHERE enrichment_status ~~ 'error%'::text) AS errors,
    count(*) FILTER (WHERE is_duplicate = true) AS duplicates,
    count(*) FILTER (WHERE bitrix_contact_id IS NOT NULL) AS pushed_to_bitrix,
    round(avg(data_freshness_ttl)) AS avg_ttl_days,
    max(last_enriched_at) AS most_recent_enrichment,
    min(last_enriched_at) AS oldest_enrichment
   FROM public.lusha_contacts
  GROUP BY organization_id;

CREATE OR REPLACE VIEW public.v_lux_enrichment_health AS
WITH stats AS (
         SELECT lusha_contacts.organization_id,
            count(*) AS total_contacts,
            count(*) FILTER (WHERE lusha_contacts.enrichment_status = 'enriched'::text) AS cnt_enriched,
            count(*) FILTER (WHERE lusha_contacts.enrichment_status = 'pending_enrichment'::text) AS cnt_pending,
            count(*) FILTER (WHERE lusha_contacts.enrichment_status = 'pushing_bitrix'::text) AS cnt_pushing_bitrix,
            count(*) FILTER (WHERE lusha_contacts.enrichment_status = 'error_bitrix'::text) AS cnt_error_bitrix,
            count(*) FILTER (WHERE lusha_contacts.enrichment_status <> ALL (ARRAY['enriched'::text, 'pending_enrichment'::text, 'pushing_bitrix'::text, 'error_bitrix'::text])) AS cnt_other_status,
            count(*) FILTER (WHERE lusha_contacts.is_duplicate = true) AS duplicates,
            count(*) FILTER (WHERE lusha_contacts.has_email = true) AS with_email,
            count(*) FILTER (WHERE lusha_contacts.has_phone = true) AS with_phone,
            count(*) FILTER (WHERE lusha_contacts.last_enriched_at > (now() - '90 days'::interval) AND lusha_contacts.linkedin_url IS NOT NULL AND btrim(lusha_contacts.linkedin_url) <> ''::text) AS cache_eligible_90d,
            count(*) FILTER (WHERE lusha_contacts.last_recheck_at IS NOT NULL) AS cache_hits_recorded,
            count(*) FILTER (WHERE lusha_contacts.bitrix_contact_id IS NOT NULL) AS synced_to_bitrix,
            max(lusha_contacts.created_at) AS newest_contact_at,
            max(lusha_contacts.last_enriched_at) AS last_enrichment_at,
            round(avg(lusha_contacts.enrichment_attempts), 2) AS avg_api_attempts,
            sum(lusha_contacts.enrichment_attempts) AS total_api_calls
           FROM public.lusha_contacts
          GROUP BY lusha_contacts.organization_id
        )
 SELECT organization_id,
    total_contacts,
    cnt_enriched,
    cnt_pending,
    cnt_pushing_bitrix,
    cnt_error_bitrix,
    cnt_other_status,
    duplicates,
    with_email,
    with_phone,
    cache_eligible_90d,
    cache_hits_recorded,
    synced_to_bitrix,
    newest_contact_at,
    last_enrichment_at,
    avg_api_attempts,
    total_api_calls,
        CASE
            WHEN total_contacts > 0 THEN round(100.0 * cnt_enriched::numeric / total_contacts::numeric, 1)
            ELSE 0::numeric
        END AS enrichment_rate_pct,
        CASE
            WHEN cnt_enriched > 0 THEN round(100.0 * with_email::numeric / cnt_enriched::numeric, 1)
            ELSE 0::numeric
        END AS email_fill_rate_pct,
        CASE
            WHEN cnt_enriched > 0 THEN round(100.0 * with_phone::numeric / cnt_enriched::numeric, 1)
            ELSE 0::numeric
        END AS phone_fill_rate_pct,
        CASE
            WHEN cnt_enriched > 0 THEN round(100.0 * synced_to_bitrix::numeric / cnt_enriched::numeric, 1)
            ELSE 0::numeric
        END AS bitrix_sync_rate_pct,
        CASE
            WHEN cache_eligible_90d > 0 THEN round(100.0 * cache_hits_recorded::numeric / cache_eligible_90d::numeric, 1)
            ELSE 0::numeric
        END AS cache_hit_rate_pct
   FROM stats s;

-- ============================================================================
-- DRIFT RESIDUAL 1/5: funcoes Lusha/Lux ausentes no historico de migrations.
-- Descobertas no replay limpo (251 migrations) x producao. Fonte: producao.
-- Nao versionadas de proposito: exec_sql, mcp_exec, mcp_exec_many, _qa_run_test
-- (ferramentas do agente/infra, nao do app).
-- ============================================================================

-- fn_lusha_contact_cache_lookup
CREATE OR REPLACE FUNCTION public.fn_lusha_contact_cache_lookup(p_linkedin_url text, p_organization_id uuid DEFAULT NULL::uuid)
 RETURNS SETOF lusha_contacts
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
BEGIN
  IF length(btrim(coalesce(p_linkedin_url,'')))=0 THEN RETURN; END IF;
  RETURN QUERY SELECT lc.* FROM public.lusha_contacts lc WHERE lower(rtrim(btrim(lc.linkedin_url),'/'))=lower(rtrim(btrim(p_linkedin_url),'/')) AND (p_organization_id IS NULL OR lc.organization_id=p_organization_id) AND lc.last_enriched_at IS NOT NULL AND lc.last_enriched_at>(now()-(coalesce(lc.data_freshness_ttl,90)||' days')::interval) AND lc.enrichment_status NOT IN ('pending_enrichment','pending','error','error_lusha','skipped','cancelled') AND (lc.has_email=true OR lc.has_phone=true) ORDER BY lc.last_enriched_at DESC LIMIT 1;
END;
$function$;


-- fn_lusha_contact_mark_cache_hit
CREATE OR REPLACE FUNCTION public.fn_lusha_contact_mark_cache_hit(p_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN IF p_id IS NULL THEN RETURN; END IF; UPDATE public.lusha_contacts SET last_recheck_at=now() WHERE id=p_id; END;
$function$;


-- fn_lux_cache_gate
CREATE OR REPLACE FUNCTION public.fn_lux_cache_gate(p_linkedin_url text, p_organization_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
DECLARE hit public.lusha_contacts;
BEGIN
  IF length(btrim(coalesce(p_linkedin_url,'')))=0 THEN RETURN jsonb_build_object('cache_hit',false,'should_enrich',false,'reason','no_linkedin_url'); END IF;
  SELECT * INTO hit FROM public.fn_lusha_contact_cache_lookup(p_linkedin_url,p_organization_id);
  IF FOUND THEN RETURN jsonb_build_object('cache_hit',true,'should_enrich',false,'reason','fresh_cache','contact_id',hit.id,'full_name',hit.full_name,'first_name',hit.first_name,'job_title',hit.job_title,'company',hit.lusha_company_name,'email',hit.email,'has_email',hit.has_email,'has_phone',hit.has_phone,'linkedin_url',hit.linkedin_url,'enrichment_status',hit.enrichment_status,'last_enriched_at',hit.last_enriched_at);
  ELSE RETURN jsonb_build_object('cache_hit',false,'should_enrich',true,'reason','cache_miss'); END IF;
END;
$function$;


-- fn_lux_cache_stats
CREATE OR REPLACE FUNCTION public.fn_lux_cache_stats(p_organization_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(metric text, value bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT 'total_contacts'::text, count(*) FROM public.lusha_contacts WHERE (p_organization_id IS NULL OR organization_id=p_organization_id)
  UNION ALL SELECT 'cache_eligible_90d', count(*) FROM public.lusha_contacts WHERE (p_organization_id IS NULL OR organization_id=p_organization_id) AND last_enriched_at>now()-interval'90 days' AND linkedin_url IS NOT NULL AND btrim(linkedin_url)<>''
  UNION ALL SELECT 'cache_hits_recorded', count(*) FROM public.lusha_contacts WHERE (p_organization_id IS NULL OR organization_id=p_organization_id) AND last_recheck_at IS NOT NULL
  UNION ALL SELECT 'pending_enrichment', count(*) FROM public.lusha_contacts WHERE (p_organization_id IS NULL OR organization_id=p_organization_id) AND enrichment_status='pending_enrichment'
  UNION ALL SELECT 'duplicates_flagged', count(*) FROM public.lusha_contacts WHERE (p_organization_id IS NULL OR organization_id=p_organization_id) AND is_duplicate=true;
$function$;


-- fn_lux_enrichment_gate
CREATE OR REPLACE FUNCTION public.fn_lux_enrichment_gate(p_linkedin_url text, p_organization_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_hit public.lusha_contacts;
BEGIN
  IF length(btrim(coalesce(p_linkedin_url,'')))=0 THEN RETURN jsonb_build_object('action','skip','reason','empty_linkedin_url'); END IF;
  SELECT lc.* INTO v_hit FROM public.lusha_contacts lc 
  WHERE lower(rtrim(btrim(lc.linkedin_url),'/'))=lower(rtrim(btrim(p_linkedin_url),'/'))
    AND lc.organization_id=p_organization_id AND lc.last_enriched_at IS NOT NULL
    AND lc.last_enriched_at>(now()-(coalesce(lc.data_freshness_ttl,90)||' days')::interval)
  ORDER BY lc.last_enriched_at DESC LIMIT 1;
  IF FOUND THEN
    UPDATE public.lusha_contacts SET last_recheck_at=now() WHERE id=v_hit.id;
    RETURN jsonb_build_object('action','cache_hit','contact_id',v_hit.id,'organization_id',v_hit.organization_id,'linkedin_url',v_hit.linkedin_url,'enrichment_status',v_hit.enrichment_status,'has_email',v_hit.has_email,'has_phone',v_hit.has_phone,'last_enriched_at',v_hit.last_enriched_at,'credits_saved',1);
  END IF;
  RETURN jsonb_build_object('action','enrich','linkedin_url',p_linkedin_url,'organization_id',p_organization_id,'reason','not_in_cache_or_stale');
END;
$function$;


-- fn_lux_save_enriched_contact
CREATE OR REPLACE FUNCTION public.fn_lux_save_enriched_contact(p_organization_id uuid, p_user_id uuid, p_linkedin_url text, p_lusha_company_name text, p_full_name text, p_enrichment_status text, p_raw_payload jsonb DEFAULT '{}'::jsonb, p_has_email boolean DEFAULT false, p_has_phone boolean DEFAULT false, p_dedup_hash text DEFAULT NULL::text, p_session_id text DEFAULT NULL::text)
 RETURNS TABLE(contact_id uuid, was_created boolean, enrichment_status text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_id uuid; v_was_created boolean; v_status text;
BEGIN
  IF p_organization_id IS NULL THEN RAISE EXCEPTION 'organization_id Ã© obrigatÃ³rio'; END IF;
  IF length(btrim(coalesce(p_linkedin_url,'')))=0 THEN RAISE EXCEPTION 'linkedin_url nÃ£o pode ser vazia'; END IF;
  IF length(btrim(coalesce(p_full_name,'')))=0 THEN RAISE EXCEPTION 'full_name Ã© obrigatÃ³rio'; END IF;
  INSERT INTO public.lusha_contacts (organization_id,user_id,linkedin_url,lusha_company_name,full_name,enrichment_status,raw_lusha_payload,has_email,has_phone,dedup_hash,session_id,last_enriched_at,enrichment_attempts)
  VALUES (p_organization_id,coalesce(p_user_id,auth.uid()),p_linkedin_url,coalesce(p_lusha_company_name,'N/A'),p_full_name,p_enrichment_status,coalesce(p_raw_payload,'{}'),p_has_email,p_has_phone,p_dedup_hash,
    CASE WHEN p_session_id IS NULL THEN NULL ELSE p_session_id::uuid END,
    now(),1)
  ON CONFLICT (organization_id,lower(rtrim(btrim(linkedin_url),'/')))
  WHERE linkedin_url IS NOT NULL AND btrim(linkedin_url)<>''
  DO UPDATE SET
    enrichment_status=EXCLUDED.enrichment_status,
    raw_lusha_payload=EXCLUDED.raw_lusha_payload,
    has_email=EXCLUDED.has_email,
    has_phone=EXCLUDED.has_phone,
    lusha_company_name=EXCLUDED.lusha_company_name,
    full_name=EXCLUDED.full_name,
    last_enriched_at=now(),
    updated_at=now(),
    enrichment_attempts=public.lusha_contacts.enrichment_attempts+1,
    dedup_hash=coalesce(EXCLUDED.dedup_hash,public.lusha_contacts.dedup_hash),
    session_id=coalesce(EXCLUDED.session_id,public.lusha_contacts.session_id),
    is_duplicate=CASE WHEN public.lusha_contacts.last_enriched_at IS NOT NULL THEN true ELSE false END
  RETURNING id,(xmax=0) AS was_created,public.lusha_contacts.enrichment_status INTO v_id,v_was_created,v_status;
  RETURN QUERY SELECT v_id,v_was_created,v_status;
END;
$function$;


-- fn_mark_contact_rechecked
CREATE OR REPLACE FUNCTION public.fn_mark_contact_rechecked(p_id uuid, p_enrichment_status text DEFAULT 'enriched'::text)
 RETURNS boolean
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF p_id IS NULL THEN RETURN false; END IF;
  UPDATE public.lusha_contacts SET last_recheck_at=now(),last_enriched_at=now(),enrichment_status=p_enrichment_status,updated_at=now() WHERE id=p_id;
  RETURN FOUND;
END;
$function$;

-- ============================================================================
-- DRIFT RESIDUAL 2/5: trigger de updated_at ausente em producao.
-- lusha_search_sessions.updated_at nunca era atualizado.
-- ============================================================================
DO $drift$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'lusha_search_sessions'
      AND t.tgname = 'update_lusha_search_sessions_updated_at'
  ) THEN
    CREATE TRIGGER update_lusha_search_sessions_updated_at
      BEFORE UPDATE ON public.lusha_search_sessions
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END
$drift$;

-- ============================================================================
-- DRIFT RESIDUAL 3/5: policies de DELETE/UPDATE ausentes em producao.
-- Existem no historico de migrations mas nunca foram aplicadas.
-- ============================================================================
-- Guarda por nome removida (achado G14-3): IF NOT EXISTS sobre policyname pulava
-- a criacao quando ja existia policy homonima com regra diferente, entao o estado
-- final dependia do que o banco tinha. DROP + CREATE e idempotente e determinista.
DROP POLICY IF EXISTS "Users can delete own ipc_config" ON public.ipc_config;
CREATE POLICY "Users can delete own ipc_config" ON public.ipc_config
  FOR DELETE TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete own scrape_results" ON public.scrape_results;
CREATE POLICY "Users can delete own scrape_results" ON public.scrape_results
  FOR DELETE TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete own workflow_runs" ON public.workflow_runs;
CREATE POLICY "Users can delete own workflow_runs" ON public.workflow_runs
  FOR DELETE TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins replay deliveries" ON public.webhook_deliveries;
CREATE POLICY "Admins replay deliveries" ON public.webhook_deliveries
  FOR UPDATE TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), 'admin'::public.app_role)
              AND status = 'pending' AND attempts = 0);

-- ============================================================================
-- DRIFT RESIDUAL 4/5: unicidade de linkedin_url por organizacao.
-- Existe no historico, ausente em producao. Guardado contra duplicatas
-- preexistentes: se houver conflito, emite NOTICE em vez de abortar o deploy.
-- ============================================================================
DO $drift$
DECLARE
  v_dups integer;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='idx_lc_unique_linkedin_org'
  ) THEN
    SELECT count(*) INTO v_dups FROM (
      SELECT organization_id, linkedin_url
      FROM public.lusha_contacts
      WHERE linkedin_url IS NOT NULL AND is_duplicate = false
      GROUP BY 1, 2 HAVING count(*) > 1
    ) d;

    IF v_dups = 0 THEN
      CREATE UNIQUE INDEX idx_lc_unique_linkedin_org
        ON public.lusha_contacts (organization_id, linkedin_url)
        WHERE linkedin_url IS NOT NULL AND is_duplicate = false;
    ELSE
      RAISE NOTICE 'idx_lc_unique_linkedin_org nao criado: % par(es) duplicado(s) em lusha_contacts', v_dups;
    END IF;
  END IF;
END
$drift$;

-- ============================================================================
-- DRIFT RESIDUAL 5/5: policy de leitura global de feature flags.
-- Existe em producao mas nao no historico de migrations.
-- ============================================================================
DROP POLICY IF EXISTS "Authenticated users view global feature flags" ON public.feature_flags;
CREATE POLICY "Authenticated users view global feature flags" ON public.feature_flags
  FOR SELECT TO authenticated USING (organization_id IS NULL);

-- ============================================================================
-- DRIFT RESIDUAL 6/6: grants das funcoes SECURITY DEFINER.
-- Em producao elas executam apenas como owner/service_role. Sem este bloco o
-- rebuild deixa anon/authenticated chamarem RPC que le dados de qualquer org.
-- ============================================================================
REVOKE ALL ON FUNCTION public.fn_lusha_contact_mark_cache_hit(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_lusha_contact_mark_cache_hit(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.fn_lux_cache_stats(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_lux_cache_stats(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.fn_lux_enrichment_gate(text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_lux_enrichment_gate(text, uuid) TO service_role;

REVOKE ALL ON FUNCTION public.fn_lux_save_enriched_contact(uuid, uuid, text, text, text, text, jsonb, boolean, boolean, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_lux_save_enriched_contact(uuid, uuid, text, text, text, text, jsonb, boolean, boolean, text, text) TO service_role;
