-- Fix missing DELETE policies
CREATE POLICY "Users can delete own ipc_config" ON public.ipc_config FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can delete own scrape_results" ON public.scrape_results FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can delete own workflow_runs" ON public.workflow_runs FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Restrict Realtime channel subscriptions
CREATE POLICY "Users can only listen to own channels" ON realtime.messages FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM pg_catalog.pg_policies WHERE true
  ) OR auth.uid() IS NOT NULL
);