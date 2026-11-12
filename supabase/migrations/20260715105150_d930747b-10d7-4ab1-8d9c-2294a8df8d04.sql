-- A tabela public.lusha_contacts só é criada (IF NOT EXISTS) na migration
-- 20260715135053_8bd5f8d2 (remoção de schema drift). Em ordem de replay esta
-- migration roda ANTES, então a tabela pode não existir ainda em ambientes
-- novos. Este guard torna a operação segura nos dois cenários (prod já tem a
-- tabela; ambientes novos só executam quando a tabela existir).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name = 'lusha_contacts') THEN
    ALTER TABLE public.lusha_contacts ADD COLUMN IF NOT EXISTS company_linkedin_url TEXT;
    CREATE INDEX IF NOT EXISTS lusha_contacts_company_linkedin_url_idx
      ON public.lusha_contacts (company_linkedin_url)
      WHERE company_linkedin_url IS NOT NULL;
  END IF;
END$$;
