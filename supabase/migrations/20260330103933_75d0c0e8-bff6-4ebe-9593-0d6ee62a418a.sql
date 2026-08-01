
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL DEFAULT 'system',
  title text NOT NULL,
  message text NOT NULL,
  read boolean NOT NULL DEFAULT false,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Notifications are viewable by everyone"
  ON public.notifications FOR SELECT TO public
  USING (true);

CREATE POLICY "Notifications can be inserted by anyone"
  ON public.notifications FOR INSERT TO public
  WITH CHECK (true);

CREATE POLICY "Notifications can be updated by anyone"
  ON public.notifications FOR UPDATE TO public
  USING (true);

CREATE POLICY "Notifications can be deleted by anyone"
  ON public.notifications FOR DELETE TO public
  USING (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
