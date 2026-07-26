ALTER TABLE public.lusha_contacts
  ADD COLUMN IF NOT EXISTS contact_source text NOT NULL DEFAULT 'lusha';

ALTER TABLE public.lusha_contacts
  DROP CONSTRAINT IF EXISTS lusha_contacts_contact_source_check;

ALTER TABLE public.lusha_contacts
  ADD CONSTRAINT lusha_contacts_contact_source_check
  CHECK (contact_source IN ('lusha', 'apollo'));

CREATE INDEX IF NOT EXISTS idx_lusha_contacts_source_apollo
  ON public.lusha_contacts (organization_id, created_at DESC)
  WHERE contact_source = 'apollo';