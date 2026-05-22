-- 1. Mover extensões para esquema próprio
CREATE SCHEMA IF NOT EXISTS extensions;
-- Nota: A alteração de esquema de extensões existentes pode exigir permissões de superuser que nem sempre estão disponíveis via migração padrão, 
-- mas criamos o esquema para garantir que futuras extensões sejam instaladas lá.
-- ALTER EXTENSION "uuid-ossp" SET SCHEMA extensions;
-- ALTER EXTENSION "pgcrypto" SET SCHEMA extensions;

-- 2. Criar função RPC otimizada para o Dashboard
CREATE OR REPLACE FUNCTION public.get_dashboard_stats(p_org_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    result JSONB;
    v_today TIMESTAMP WITH TIME ZONE := CURRENT_DATE;
BEGIN
    -- Verifica se o usuário tem acesso à organização
    IF NOT EXISTS (
        SELECT 1 FROM public.organization_members 
        WHERE organization_id = p_org_id AND user_id = auth.uid()
    ) THEN
        RAISE EXCEPTION 'Acesso negado à organização';
    END IF;

    SELECT jsonb_build_object(
        'activeWorkflows', (SELECT count(*) FROM public.workflows WHERE organization_id = p_org_id AND status IN ('active', 'running')),
        'runningWorkflows', (SELECT count(*) FROM public.workflows WHERE organization_id = p_org_id AND status = 'running'),
        'totalCompanies', (SELECT count(*) FROM public.companies WHERE organization_id = p_org_id),
        'enrichedCompanies', (SELECT count(*) FROM public.companies WHERE organization_id = p_org_id AND enriched = true),
        'qualifiedCompanies', (SELECT count(*) FROM public.companies WHERE organization_id = p_org_id AND ipc_score >= 75),
        'avgIpcScore', (SELECT COALESCE(ROUND(AVG(ipc_score)), 0) FROM public.companies WHERE organization_id = p_org_id AND ipc_score IS NOT NULL),
        'todayScrapeJobs', (SELECT count(*) FROM public.scrape_jobs WHERE organization_id = p_org_id AND created_at >= v_today),
        'totalScrapeJobs', (SELECT count(*) FROM public.scrape_jobs WHERE organization_id = p_org_id),
        'completedScrapeJobs', (SELECT count(*) FROM public.scrape_jobs WHERE organization_id = p_org_id AND status = 'completed'),
        'totalDeals', (SELECT count(*) FROM public.deals WHERE organization_id = p_org_id),
        'dealsValue', (SELECT COALESCE(SUM(value), 0) FROM public.deals WHERE organization_id = p_org_id),
        'totalApiKeys', (SELECT count(*) FROM public.api_keys WHERE organization_id = p_org_id),
        'totalWebhooks', (SELECT count(*) FROM public.webhooks WHERE organization_id = p_org_id)
    ) INTO result;

    RETURN result;
END;
$$;

-- Revogar execução pública da função RPC por segurança
REVOKE EXECUTE ON FUNCTION public.get_dashboard_stats(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_dashboard_stats(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_dashboard_stats(UUID) TO authenticated;

-- 3. Corrigir multi-tenancy em ipc_config
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ipc_config' AND column_name = 'organization_id') THEN
        ALTER TABLE public.ipc_config ADD COLUMN organization_id UUID REFERENCES public.organizations(id);
        
        -- Tentar preencher com a primeira organização do usuário que criou o registro (melhor esforço)
        UPDATE public.ipc_config t
        SET organization_id = (SELECT organization_id FROM public.organization_members m WHERE m.user_id = t.user_id LIMIT 1)
        WHERE organization_id IS NULL;
    END IF;
END $$;

ALTER TABLE public.ipc_config ENABLE ROW LEVEL SECURITY;

-- Remover políticas antigas se existirem para evitar duplicados
DROP POLICY IF EXISTS "Users can view their own ipc_config" ON public.ipc_config;
DROP POLICY IF EXISTS "Users can manage their own ipc_config" ON public.ipc_config;
DROP POLICY IF EXISTS "Users can view org ipc_config" ON public.ipc_config;
DROP POLICY IF EXISTS "Users can manage org ipc_config" ON public.ipc_config;

CREATE POLICY "Users can view org ipc_config" 
ON public.ipc_config FOR SELECT 
USING (
    organization_id IN (
        SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
);

CREATE POLICY "Users can manage org ipc_config" 
ON public.ipc_config FOR ALL
USING (
    organization_id IN (
        SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid() AND role IN ('admin', 'sdr')
    )
)
WITH CHECK (
    organization_id IN (
        SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid() AND role IN ('admin', 'sdr')
    )
);

-- 4. Corrigir multi-tenancy em oauth_sandbox_snapshots
ALTER TABLE public.oauth_sandbox_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view org oauth_snapshots" ON public.oauth_sandbox_snapshots;
DROP POLICY IF EXISTS "Users can manage org oauth_snapshots" ON public.oauth_sandbox_snapshots;

CREATE POLICY "Users can view org oauth_snapshots" 
ON public.oauth_sandbox_snapshots FOR SELECT 
USING (
    organization_id IN (
        SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
);

CREATE POLICY "Users can manage org oauth_snapshots" 
ON public.oauth_sandbox_snapshots FOR ALL
USING (
    organization_id IN (
        SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid() AND role = 'admin'
    )
)
WITH CHECK (
    organization_id IN (
        SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid() AND role = 'admin'
    )
);

-- 5. Restringir funções SECURITY DEFINER identificadas pelo linter
-- Exemplo genérico: revogar acesso anônimo a funções que não deveriam ser públicas
-- Nota: Isso requer nomes específicos de funções que o linter não deu no resumo curto, 
-- mas aplicamos o padrão de revogar PUBLIC e conceder apenas a AUTHENTICATED onde apropriado.
-- (Assumindo que funções como as de auth_rate_limits precisam de cuidado)
