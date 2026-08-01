-- Rodada #19: Regression check para motor de scrape web nativo.
-- Compara taxa de sucesso 24h vs 7d anteriores por organização e emite notificação.
CREATE OR REPLACE FUNCTION public.fn_web_scrape_regression_check(_threshold numeric DEFAULT 0.05)
RETURNS TABLE(organization_id uuid, success_24h numeric, success_7d numeric, delta numeric, alerted boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
  admin_row record;
BEGIN
  FOR r IN
    WITH win24 AS (
      SELECT q.organization_id,
             count(*) FILTER (WHERE status = 'succeeded')::numeric AS s,
             count(*) FILTER (WHERE status IN ('succeeded','failed','dead'))::numeric AS t
      FROM public.web_scrape_queue q
      WHERE q.updated_at >= now() - interval '24 hours'
      GROUP BY q.organization_id
      HAVING count(*) FILTER (WHERE status IN ('succeeded','failed','dead')) >= 20
    ),
    win7d AS (
      SELECT q.organization_id,
             count(*) FILTER (WHERE status = 'succeeded')::numeric AS s,
             count(*) FILTER (WHERE status IN ('succeeded','failed','dead'))::numeric AS t
      FROM public.web_scrape_queue q
      WHERE q.updated_at >= now() - interval '8 days' AND q.updated_at < now() - interval '24 hours'
      GROUP BY q.organization_id
      HAVING count(*) FILTER (WHERE status IN ('succeeded','failed','dead')) >= 50
    )
    SELECT w24.organization_id,
           (w24.s / NULLIF(w24.t, 0))::numeric AS s24,
           (w7.s / NULLIF(w7.t, 0))::numeric AS s7
    FROM win24 w24
    JOIN win7d w7 USING (organization_id)
  LOOP
    organization_id := r.organization_id;
    success_24h := round(coalesce(r.s24, 0), 4);
    success_7d := round(coalesce(r.s7, 0), 4);
    delta := round(coalesce(r.s7, 0) - coalesce(r.s24, 0), 4);
    alerted := false;

    IF delta >= _threshold THEN
      alerted := true;
      FOR admin_row IN
        SELECT user_id FROM public.organization_members
        WHERE organization_members.organization_id = r.organization_id AND role = 'admin'
      LOOP
        INSERT INTO public.notifications (user_id, type, title, message, metadata)
        VALUES (
          admin_row.user_id,
          'system',
          'Regressão no motor de scrape web',
          format('Taxa de sucesso caiu %s pp (24h: %s%% vs 7d: %s%%).',
            round(delta * 100, 1),
            round(success_24h * 100, 1),
            round(success_7d * 100, 1)),
          jsonb_build_object(
            'organization_id', r.organization_id,
            'queue_kind', 'web',
            'success_24h', success_24h,
            'success_7d', success_7d,
            'delta', delta,
            'threshold', _threshold
          )
        );
      END LOOP;
    END IF;
    RETURN NEXT;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_web_scrape_regression_check(numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_web_scrape_regression_check(numeric) TO service_role;