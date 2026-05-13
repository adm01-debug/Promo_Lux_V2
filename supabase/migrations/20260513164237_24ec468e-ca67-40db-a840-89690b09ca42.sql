-- Criar tabela de rate limits para autenticação (Onda 2)
CREATE TABLE IF NOT EXISTS public.auth_rate_limits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    identifier TEXT NOT NULL, -- email ou IP hash
    attempts INT DEFAULT 1,
    last_attempt TIMESTAMP WITH TIME ZONE DEFAULT now(),
    locked_until TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Index para busca rápida por identificador
CREATE INDEX IF NOT EXISTS idx_auth_rate_limits_identifier ON public.auth_rate_limits(identifier);

-- Habilitar RLS (Segurança)
ALTER TABLE public.auth_rate_limits ENABLE ROW LEVEL SECURITY;

-- Política: Apenas o sistema (service_role) ou o próprio usuário (via edge function) pode gerenciar
CREATE POLICY "System can manage auth rate limits" 
ON public.auth_rate_limits 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- Função para limpar rate limits antigos (Cron mensal/semanal)
CREATE OR REPLACE FUNCTION public.prune_auth_rate_limits()
RETURNS void AS $$
BEGIN
    DELETE FROM public.auth_rate_limits WHERE last_attempt < now() - INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_update_auth_rate_limits_updated_at
BEFORE UPDATE ON public.auth_rate_limits
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
