-- Adicionar auto_sync aos jobs de raspagem
ALTER TABLE public.scrape_jobs ADD COLUMN IF NOT EXISTS auto_sync BOOLEAN DEFAULT false;

-- Criar tabela de Feature Flags
CREATE TABLE IF NOT EXISTS public.feature_flags (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    enabled BOOLEAN DEFAULT false,
    rules JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Ativar RLS
ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso para Feature Flags (leitura pública para usuários autenticados, escrita apenas para admin)
CREATE POLICY "Feature flags are viewable by authenticated users" 
ON public.feature_flags FOR SELECT USING (auth.role() = 'authenticated');

-- Criar tabela de Health Checks
CREATE TABLE IF NOT EXISTS public.health_checks (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    service_name TEXT NOT NULL,
    status TEXT NOT NULL, -- 'healthy', 'degraded', 'unhealthy'
    latency_ms INTEGER,
    last_check TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Ativar RLS
ALTER TABLE public.health_checks ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso para Health Checks
CREATE POLICY "Health checks are viewable by authenticated users" 
ON public.health_checks FOR SELECT USING (auth.role() = 'authenticated');

-- Trigger para updated_at em feature_flags
CREATE TRIGGER update_feature_flags_updated_at
BEFORE UPDATE ON public.feature_flags
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
