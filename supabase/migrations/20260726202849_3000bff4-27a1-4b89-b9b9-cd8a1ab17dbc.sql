CREATE OR REPLACE FUNCTION public.source_quality_report(
  p_start timestamptz,
  p_end timestamptz,
  p_bucket text DEFAULT 'day',
  p_queue text DEFAULT NULL
)
RETURNS TABLE (
  bucket_start timestamptz,
  queue text,
  source text,
  total bigint,
  with_email bigint,
  email_rate numeric,
  br_count bigint,
  br_rate numeric,
  suppressed bigint,
  suppression_rate numeric
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH base AS (
    SELECT
      date_trunc(
        CASE lower(coalesce(p_bucket, 'day'))
          WHEN 'hour' THEN 'hour'
          WHEN 'week' THEN 'week'
          WHEN 'month' THEN 'month'
          ELSE 'day'
        END,
        c.created_at
      ) AS bucket_start,
      coalesce(nullif(trim(c.department_pt), ''), 'Sem fila') AS queue,
      lower(coalesce(nullif(trim(c.contact_source), ''), 'lusha')) AS source,
      (c.email IS NOT NULL AND c.email <> '') AS has_confirmed_email,
      (
        coalesce(c.phone_formatted, '') LIKE '+55%'
        OR coalesce(c.company_email_domain, '') ILIKE '%.br'
        OR coalesce(c.company_locations::text, '') ~* '(brasil|brazil|, br\y)'
      ) AS is_br,
      (
        c.email IS NOT NULL AND c.email <> '' AND EXISTS (
          SELECT 1 FROM public.email_suppressions s
          WHERE lower(s.email) = lower(c.email)
            AND s.organization_id = c.organization_id
        )
      ) AS is_suppressed
    FROM public.lusha_contacts c
    WHERE c.created_at >= p_start
      AND c.created_at < p_end
      AND (p_queue IS NULL OR coalesce(nullif(trim(c.department_pt), ''), 'Sem fila') = p_queue)
  )
  SELECT
    b.bucket_start,
    b.queue,
    b.source,
    count(*)::bigint AS total,
    count(*) FILTER (WHERE b.has_confirmed_email)::bigint AS with_email,
    round(100.0 * count(*) FILTER (WHERE b.has_confirmed_email) / nullif(count(*), 0), 2) AS email_rate,
    count(*) FILTER (WHERE b.is_br)::bigint AS br_count,
    round(100.0 * count(*) FILTER (WHERE b.is_br) / nullif(count(*), 0), 2) AS br_rate,
    count(*) FILTER (WHERE b.is_suppressed)::bigint AS suppressed,
    round(100.0 * count(*) FILTER (WHERE b.is_suppressed) / nullif(count(*) FILTER (WHERE b.has_confirmed_email), 0), 2) AS suppression_rate
  FROM base b
  GROUP BY b.bucket_start, b.queue, b.source
  ORDER BY b.bucket_start DESC, b.queue ASC, b.source ASC
$$;

REVOKE ALL ON FUNCTION public.source_quality_report(timestamptz, timestamptz, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.source_quality_report(timestamptz, timestamptz, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.source_quality_report(timestamptz, timestamptz, text, text) TO service_role;