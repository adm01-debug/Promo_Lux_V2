
CREATE TABLE public.campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  prospects integer NOT NULL DEFAULT 0,
  sent integer NOT NULL DEFAULT 0,
  opened integer NOT NULL DEFAULT 0,
  replied integer NOT NULL DEFAULT 0,
  meetings integer NOT NULL DEFAULT 0,
  sequence jsonb NOT NULL DEFAULT '[]'::jsonb,
  start_date timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Campaigns viewable by authenticated" ON public.campaigns FOR SELECT TO authenticated USING (true);
CREATE POLICY "Campaigns insertable by authenticated" ON public.campaigns FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Campaigns updatable by authenticated" ON public.campaigns FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Campaigns deletable by authenticated" ON public.campaigns FOR DELETE TO authenticated USING (true);
