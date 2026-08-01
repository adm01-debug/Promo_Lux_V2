-- Soft delete: adiciona deleted_at nas tabelas de negócio (ADR-008)
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.workflows ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Índices parciais: consultas ativas (deleted_at IS NULL) permanecem rápidas
CREATE INDEX IF NOT EXISTS idx_companies_active ON public.companies (organization_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_deals_active ON public.deals (organization_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_campaigns_active ON public.campaigns (organization_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_workflows_active ON public.workflows (organization_id) WHERE deleted_at IS NULL;

-- Índices para expurgo (registros deletados há mais de 30 dias)
CREATE INDEX IF NOT EXISTS idx_companies_deleted ON public.companies (deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_deals_deleted ON public.deals (deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_campaigns_deleted ON public.campaigns (deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_workflows_deleted ON public.workflows (deleted_at) WHERE deleted_at IS NOT NULL;

-- Função de expurgo permanente (hard delete) de registros soft-deleted há +30 dias
CREATE OR REPLACE FUNCTION public.purge_soft_deleted()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  DELETE FROM public.companies WHERE deleted_at IS NOT NULL AND deleted_at < now() - interval '30 days';
  DELETE FROM public.deals WHERE deleted_at IS NOT NULL AND deleted_at < now() - interval '30 days';
  DELETE FROM public.campaigns WHERE deleted_at IS NOT NULL AND deleted_at < now() - interval '30 days';
  DELETE FROM public.workflows WHERE deleted_at IS NOT NULL AND deleted_at < now() - interval '30 days';
END;
$$;