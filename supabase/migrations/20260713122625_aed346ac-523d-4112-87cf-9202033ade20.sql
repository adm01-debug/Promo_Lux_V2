DO $$
DECLARE
  t text;
  tables text[] := ARRAY['companies','scrape_jobs','scrape_queue','automation_execution_logs','scrape_dead_letter'];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    -- Emite payloads completos (inclui valores antigos em UPDATE/DELETE).
    EXECUTE format('ALTER TABLE public.%I REPLICA IDENTITY FULL', t);
    -- Adiciona à publicação de realtime apenas se ainda não estiver.
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;