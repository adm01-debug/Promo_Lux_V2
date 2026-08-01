
-- G2: enrichment columns for Google Maps parity
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS latitude          double precision,
  ADD COLUMN IF NOT EXISTS longitude         double precision,
  ADD COLUMN IF NOT EXISTS place_id          text,
  ADD COLUMN IF NOT EXISTS cid               text,
  ADD COLUMN IF NOT EXISTS plus_code         text,
  ADD COLUMN IF NOT EXISTS google_maps_url   text,
  ADD COLUMN IF NOT EXISTS street_view_url   text,
  ADD COLUMN IF NOT EXISTS rating            numeric(3,2),
  ADD COLUMN IF NOT EXISTS review_count      integer,
  ADD COLUMN IF NOT EXISTS price_range       text,
  ADD COLUMN IF NOT EXISTS business_status   text,
  ADD COLUMN IF NOT EXISTS thumbnail_url     text,
  ADD COLUMN IF NOT EXISTS images            text[],
  ADD COLUMN IF NOT EXISTS open_hours        jsonb,
  ADD COLUMN IF NOT EXISTS popular_times     jsonb,
  ADD COLUMN IF NOT EXISTS timezone          text,
  ADD COLUMN IF NOT EXISTS descriptions      text,
  ADD COLUMN IF NOT EXISTS owner_claimed     boolean,
  ADD COLUMN IF NOT EXISTS reservations_url  text,
  ADD COLUMN IF NOT EXISTS order_online_url  text,
  ADD COLUMN IF NOT EXISTS menu_url          text;

-- Rating bounds via trigger (não via CHECK, que dificulta migrações)
CREATE OR REPLACE FUNCTION public.validate_company_rating()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.rating IS NOT NULL AND (NEW.rating < 0 OR NEW.rating > 5) THEN
    RAISE EXCEPTION 'rating must be between 0 and 5, got %', NEW.rating;
  END IF;
  IF NEW.review_count IS NOT NULL AND NEW.review_count < 0 THEN
    RAISE EXCEPTION 'review_count must be >= 0, got %', NEW.review_count;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_company_rating_trg ON public.companies;
CREATE TRIGGER validate_company_rating_trg
BEFORE INSERT OR UPDATE ON public.companies
FOR EACH ROW EXECUTE FUNCTION public.validate_company_rating();

-- G9: dedupe forte por place_id (parcial: só quando o Google devolveu place_id)
CREATE UNIQUE INDEX IF NOT EXISTS companies_org_place_id_uk
  ON public.companies (organization_id, place_id)
  WHERE place_id IS NOT NULL AND deleted_at IS NULL;

-- Índices auxiliares para filtro/ordenação no CRM
CREATE INDEX IF NOT EXISTS companies_rating_idx        ON public.companies (rating DESC NULLS LAST) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS companies_review_count_idx  ON public.companies (review_count DESC NULLS LAST) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS companies_latlon_idx        ON public.companies (latitude, longitude) WHERE latitude IS NOT NULL AND longitude IS NOT NULL;
