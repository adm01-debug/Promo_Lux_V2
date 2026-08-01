
CREATE TABLE public.intent_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  company_name text NOT NULL,
  type text NOT NULL DEFAULT 'website_visit',
  signal text NOT NULL,
  strength text NOT NULL DEFAULT 'medium',
  details text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.intent_signals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Intent signals viewable by authenticated" ON public.intent_signals FOR SELECT TO authenticated USING (true);
CREATE POLICY "Intent signals insertable by authenticated" ON public.intent_signals FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Intent signals updatable by authenticated" ON public.intent_signals FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Intent signals deletable by authenticated" ON public.intent_signals FOR DELETE TO authenticated USING (true);

-- Allow service role (edge functions) to insert signals
CREATE POLICY "Intent signals insertable by service" ON public.intent_signals FOR INSERT TO service_role WITH CHECK (true);
