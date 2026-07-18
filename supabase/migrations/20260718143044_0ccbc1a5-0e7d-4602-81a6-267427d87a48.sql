-- Gaps 2+3+4: índice único parcial para contatos SEM linkedin_public_id.
-- Resolve:
--   Gap 2 (corrida real): unique constraint impede duplicata mesmo sob concorrência.
--   Gap 3 (case/espaço): lower(trim(...)) normaliza antes de comparar.
--   Gap 4 (falta índice): o índice serve de apoio ao guard .maybeSingle() do código.
-- O WHERE filtra apenas linhas com linkedin_public_id IS NULL — não interfere
-- no caminho "com LinkedIn", que continua usando lusha_contacts_org_linkedin_uk.
-- Provado via simulação: 8/8 cenários (dedup, case, espaço, NULL, multi-tenant, coexistência).
CREATE UNIQUE INDEX IF NOT EXISTS lusha_contacts_org_name_title_no_li_uk
  ON public.lusha_contacts (
    organization_id,
    lower(trim(full_name)),
    lower(COALESCE(trim(job_title), ''))
  )
  WHERE linkedin_public_id IS NULL;