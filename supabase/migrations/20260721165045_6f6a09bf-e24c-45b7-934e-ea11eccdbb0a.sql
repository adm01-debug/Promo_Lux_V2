
-- G3: reviews individuais
CREATE TABLE IF NOT EXISTS public.company_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  external_id text,
  author_name text,
  author_avatar text,
  rating numeric(2,1),
  comment text,
  owner_response text,
  reviewed_at timestamptz,
  raw_data jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_reviews TO authenticated;
GRANT ALL ON public.company_reviews TO service_role;

ALTER TABLE public.company_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members read company_reviews"
ON public.company_reviews FOR SELECT TO authenticated
USING (public.is_org_member(organization_id, auth.uid()));

CREATE POLICY "org members write company_reviews"
ON public.company_reviews FOR INSERT TO authenticated
WITH CHECK (public.is_org_member(organization_id, auth.uid()));

CREATE POLICY "org members update company_reviews"
ON public.company_reviews FOR UPDATE TO authenticated
USING (public.is_org_member(organization_id, auth.uid()))
WITH CHECK (public.is_org_member(organization_id, auth.uid()));

CREATE POLICY "org members delete company_reviews"
ON public.company_reviews FOR DELETE TO authenticated
USING (public.is_org_member(organization_id, auth.uid()));

CREATE INDEX IF NOT EXISTS company_reviews_company_idx ON public.company_reviews (company_id, reviewed_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS company_reviews_ext_uk ON public.company_reviews (company_id, external_id) WHERE external_id IS NOT NULL;

-- G4: proxies por organização
CREATE TABLE IF NOT EXISTS public.org_proxies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  label text NOT NULL,
  proxy_type text NOT NULL DEFAULT 'http',
  url text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  usage_count integer NOT NULL DEFAULT 0,
  last_used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_proxies TO authenticated;
GRANT ALL ON public.org_proxies TO service_role;

ALTER TABLE public.org_proxies ENABLE ROW LEVEL SECURITY;

-- Somente admins da organização gerenciam proxies (é credencial sensível).
CREATE POLICY "org admins read org_proxies"
ON public.org_proxies FOR SELECT TO authenticated
USING (public.has_org_role(organization_id, auth.uid(), 'admin'));

CREATE POLICY "org admins insert org_proxies"
ON public.org_proxies FOR INSERT TO authenticated
WITH CHECK (public.has_org_role(organization_id, auth.uid(), 'admin'));

CREATE POLICY "org admins update org_proxies"
ON public.org_proxies FOR UPDATE TO authenticated
USING (public.has_org_role(organization_id, auth.uid(), 'admin'))
WITH CHECK (public.has_org_role(organization_id, auth.uid(), 'admin'));

CREATE POLICY "org admins delete org_proxies"
ON public.org_proxies FOR DELETE TO authenticated
USING (public.has_org_role(organization_id, auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS org_proxies_active_idx ON public.org_proxies (organization_id, is_active);

DROP TRIGGER IF EXISTS org_proxies_updated_at ON public.org_proxies;
CREATE TRIGGER org_proxies_updated_at BEFORE UPDATE ON public.org_proxies
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Extra reviews flag no job
ALTER TABLE public.scrape_jobs ADD COLUMN IF NOT EXISTS extra_reviews boolean DEFAULT false;
