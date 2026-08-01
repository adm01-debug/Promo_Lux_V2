-- Remove índices exatamente duplicados; preserva o índice de constraint UNIQUE quando existir.
DROP INDEX IF EXISTS public.idx_api_keys_hash;                 -- dup de api_keys_key_hash_key (UNIQUE)
DROP INDEX IF EXISTS public.idx_invites_token;                 -- dup de organization_invites_token_key (UNIQUE)
DROP INDEX IF EXISTS public.idx_email_suppressions_org_email;  -- dup de email_suppressions_organization_id_email_key (UNIQUE)
DROP INDEX IF EXISTS public.idx_campaigns_org_id;              -- dup de idx_campaigns_org
DROP INDEX IF EXISTS public.idx_stakeholders_org_id;           -- dup de idx_stakeholders_org
DROP INDEX IF EXISTS public.idx_stakeholders_company_id;       -- dup de idx_stakeholders_company
DROP INDEX IF EXISTS public.idx_scrape_results_job_id;         -- dup de idx_scrape_results_job
DROP INDEX IF EXISTS public.idx_scrape_jobs_status_org;        -- dup de idx_scrape_jobs_org_status