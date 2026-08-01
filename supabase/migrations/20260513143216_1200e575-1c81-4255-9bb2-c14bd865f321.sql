CREATE TABLE IF NOT EXISTS public.circuit_breakers (
    service_name TEXT PRIMARY KEY,
    state TEXT NOT NULL DEFAULT 'closed', -- 'closed', 'open', 'half-open'
    failure_count INTEGER DEFAULT 0,
    last_failure_at TIMESTAMP WITH TIME ZONE,
    opened_at TIMESTAMP WITH TIME ZONE,
    threshold INTEGER DEFAULT 5,
    reset_timeout_ms INTEGER DEFAULT 60000 -- 1 minute
);

-- Ativar RLS
ALTER TABLE public.circuit_breakers ENABLE ROW LEVEL SECURITY;

-- Política de leitura
CREATE POLICY "Circuit breakers are viewable by authenticated users" 
ON public.circuit_breakers FOR SELECT USING (auth.role() = 'authenticated');
