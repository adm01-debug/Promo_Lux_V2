-- Create ponto_registros table
CREATE TABLE public.ponto_registros (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    tipo TEXT NOT NULL CHECK (tipo IN ('entrada', 'saida', 'intervalo_inicio', 'intervalo_fim')),
    timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
    latitude FLOAT8,
    longitude FLOAT8,
    localizacao_info TEXT,
    device_info JSONB,
    observacao TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create ponto_ajustes table
CREATE TABLE public.ponto_ajustes (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    registro_id UUID REFERENCES public.ponto_registros(id) ON DELETE SET NULL,
    data_original TIMESTAMPTZ,
    data_nova TIMESTAMPTZ NOT NULL,
    tipo TEXT NOT NULL CHECK (tipo IN ('entrada', 'saida', 'intervalo_inicio', 'intervalo_fim')),
    motivo TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'aprovado', 'rejeitado')),
    aprovado_por UUID REFERENCES auth.users(id),
    data_decisao TIMESTAMPTZ,
    observacao_admin TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create ponto_configuracoes table
CREATE TABLE public.ponto_configuracoes (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE UNIQUE,
    carga_horaria_diaria INTERVAL NOT NULL DEFAULT '8 hours',
    tolerancia_minutos INTEGER NOT NULL DEFAULT 15,
    permite_ajuste_manual BOOLEAN NOT NULL DEFAULT true,
    exige_geolocalizacao BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create ponto_banco_horas table
CREATE TABLE public.ponto_banco_horas (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    saldo INTERVAL NOT NULL DEFAULT '0 hours',
    ultima_atualizacao TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(organization_id, user_id)
);

-- Enable RLS
ALTER TABLE public.ponto_registros ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ponto_ajustes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ponto_configuracoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ponto_banco_horas ENABLE ROW LEVEL SECURITY;

-- RLS Policies for ponto_registros
CREATE POLICY "Users can view their own registros" 
ON public.ponto_registros FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own registros" 
ON public.ponto_registros FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all registros in their org" 
ON public.ponto_registros FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM public.organization_members 
        WHERE organization_id = public.ponto_registros.organization_id 
        AND user_id = auth.uid() 
        AND role = 'admin'
    )
);

-- RLS Policies for ponto_ajustes
CREATE POLICY "Users can view their own ajustes" 
ON public.ponto_ajustes FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can request adjustments" 
ON public.ponto_ajustes FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can manage adjustments" 
ON public.ponto_ajustes FOR ALL 
USING (
    EXISTS (
        SELECT 1 FROM public.organization_members 
        WHERE organization_id = public.ponto_ajustes.organization_id 
        AND user_id = auth.uid() 
        AND role = 'admin'
    )
);

-- RLS Policies for ponto_configuracoes
CREATE POLICY "Everyone in org can view configs" 
ON public.ponto_configuracoes FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM public.organization_members 
        WHERE organization_id = public.ponto_configuracoes.organization_id 
        AND user_id = auth.uid()
    )
);

CREATE POLICY "Admins can update configs" 
ON public.ponto_configuracoes FOR UPDATE 
USING (
    EXISTS (
        SELECT 1 FROM public.organization_members 
        WHERE organization_id = public.ponto_configuracoes.organization_id 
        AND user_id = auth.uid() 
        AND role = 'admin'
    )
);

-- RLS Policies for ponto_banco_horas
CREATE POLICY "Users can view their own balance" 
ON public.ponto_banco_horas FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view and update balance" 
ON public.ponto_banco_horas FOR ALL 
USING (
    EXISTS (
        SELECT 1 FROM public.organization_members 
        WHERE organization_id = public.ponto_banco_horas.organization_id 
        AND user_id = auth.uid() 
        AND role = 'admin'
    )
);

-- Functions and Triggers for updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_ponto_registros_updated_at
BEFORE UPDATE ON public.ponto_registros
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER trigger_ponto_ajustes_updated_at
BEFORE UPDATE ON public.ponto_ajustes
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER trigger_ponto_configuracoes_updated_at
BEFORE UPDATE ON public.ponto_configuracoes
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
