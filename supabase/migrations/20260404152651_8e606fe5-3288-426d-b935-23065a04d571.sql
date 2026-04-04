-- Drop and recreate UPDATE policies with WITH CHECK for all tables
DO $$
DECLARE
  tbl text;
  pol_name text;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY['companies','workflows','campaigns','notifications','scrape_jobs','scrape_results','workflow_runs','intent_signals','ipc_config','stakeholders'])
  LOOP
    -- Find existing update policy
    FOR pol_name IN 
      SELECT policyname FROM pg_policies 
      WHERE schemaname = 'public' AND tablename = tbl AND cmd = 'UPDATE'
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol_name, tbl);
    END LOOP;
    
    -- Create new policy with WITH CHECK
    EXECUTE format(
      'CREATE POLICY "Users can update own %s" ON public.%I FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid())',
      tbl, tbl
    );
  END LOOP;
END $$;