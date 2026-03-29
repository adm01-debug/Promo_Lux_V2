
CREATE TABLE public.stakeholders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  role text,
  department text,
  seniority text DEFAULT 'unknown',
  email text,
  phone text,
  linkedin_url text,
  avatar_url text,
  confidence_score integer DEFAULT 50,
  source text DEFAULT 'manual',
  tags text[] DEFAULT '{}',
  notes text,
  last_contacted_at timestamptz,
  raw_data jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_stakeholders_company ON public.stakeholders(company_id);
CREATE INDEX idx_stakeholders_role ON public.stakeholders(role);
CREATE INDEX idx_stakeholders_department ON public.stakeholders(department);
CREATE INDEX idx_stakeholders_seniority ON public.stakeholders(seniority);

ALTER TABLE public.stakeholders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Stakeholders are viewable by everyone" ON public.stakeholders FOR SELECT TO public USING (true);
CREATE POLICY "Stakeholders can be inserted by anyone" ON public.stakeholders FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Stakeholders can be updated by anyone" ON public.stakeholders FOR UPDATE TO public USING (true);
CREATE POLICY "Stakeholders can be deleted by anyone" ON public.stakeholders FOR DELETE TO public USING (true);

CREATE TRIGGER update_stakeholders_updated_at
  BEFORE UPDATE ON public.stakeholders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER PUBLICATION supabase_realtime ADD TABLE public.stakeholders;
