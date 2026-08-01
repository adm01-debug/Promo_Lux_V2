-- ============================================================
-- 1) TABELA DE POLÍTICAS DE PARTICIONAMENTO
-- ============================================================
CREATE TABLE public.partition_policies (
  id               uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  table_name       text NOT NULL UNIQUE,
  threshold_rows   bigint NOT NULL DEFAULT 10000000,   -- 10M linhas
  threshold_bytes  bigint NOT NULL DEFAULT 5368709120, -- 5 GiB
  partition_by     text NOT NULL DEFAULT 'RANGE (created_at) — mensal',
  cooldown_hours   integer NOT NULL DEFAULT 168,       -- 7 dias entre alertas
  enabled          boolean NOT NULL DEFAULT true,
  notes            text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT partition_policies_threshold_rows_chk  CHECK (threshold_rows > 0),
  CONSTRAINT partition_policies_threshold_bytes_chk CHECK (threshold_bytes > 0),
  CONSTRAINT partition_policies_cooldown_chk        CHECK (cooldown_hours >= 1)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.partition_policies TO authenticated;
GRANT ALL ON public.partition_policies TO service_role;

ALTER TABLE public.partition_policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins gerenciam políticas de partição"
  ON public.partition_policies FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_partition_policies_updated_at
  BEFORE UPDATE ON public.partition_policies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 2) TABELA DE RECOMENDAÇÕES GERADAS
-- ============================================================
CREATE TABLE public.partition_advisories (
  id               uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  policy_id        uuid REFERENCES public.partition_policies(id) ON DELETE SET NULL,
  table_name       text NOT NULL,
  live_rows        bigint NOT NULL,
  total_bytes      bigint NOT NULL,
  threshold_rows   bigint NOT NULL,
  threshold_bytes  bigint NOT NULL,
  breached_rows    boolean NOT NULL DEFAULT false,
  breached_bytes   boolean NOT NULL DEFAULT false,
  recommendation   text NOT NULL,
  acknowledged_by  uuid,
  acknowledged_at  timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_partition_advisories_table_created
  ON public.partition_advisories (table_name, created_at DESC);
CREATE INDEX idx_partition_advisories_unacked
  ON public.partition_advisories (table_name) WHERE acknowledged_at IS NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.partition_advisories TO authenticated;
GRANT ALL ON public.partition_advisories TO service_role;

ALTER TABLE public.partition_advisories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins veem recomendações de partição"
  ON public.partition_advisories FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins reconhecem recomendações de partição"
  ON public.partition_advisories FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============================================================
-- 3) FUNÇÃO DE AVALIAÇÃO (threshold-driven)
-- ============================================================
CREATE OR REPLACE FUNCTION public.evaluate_partition_policies()
RETURNS TABLE(
  table_name text,
  live_rows bigint,
  total_bytes bigint,
  breached boolean,
  advisory_created boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $$
DECLARE
  v_pol            public.partition_policies;
  v_rows           bigint;
  v_bytes          bigint;
  v_breach_rows    boolean;
  v_breach_bytes   boolean;
  v_breach         boolean;
  v_recent         timestamptz;
  v_created        boolean;
  v_reco           text;
  v_admin          uuid;
BEGIN
  -- Somente admin autenticado OU worker do sistema (service_role, auth.uid() NULL).
  IF auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Acesso negado: requer papel de administrador';
  END IF;

  FOR v_pol IN
    SELECT * FROM public.partition_policies WHERE enabled = true
  LOOP
    -- Ignora política cuja tabela não exista mais.
    IF to_regclass('public.' || v_pol.table_name) IS NULL THEN
      CONTINUE;
    END IF;

    SELECT COALESCE(s.n_live_tup, 0)
      INTO v_rows
    FROM pg_stat_user_tables s
    WHERE s.schemaname = 'public' AND s.relname = v_pol.table_name;

    v_rows  := COALESCE(v_rows, 0);
    v_bytes := pg_total_relation_size(('public.' || v_pol.table_name)::regclass);

    v_breach_rows  := v_rows  >= v_pol.threshold_rows;
    v_breach_bytes := v_bytes >= v_pol.threshold_bytes;
    v_breach       := v_breach_rows OR v_breach_bytes;
    v_created      := false;

    IF v_breach THEN
      -- Respeita o cooldown: só cria nova recomendação se a última passou do silêncio.
      SELECT max(a.created_at) INTO v_recent
      FROM public.partition_advisories a
      WHERE a.table_name = v_pol.table_name;

      IF v_recent IS NULL
         OR v_recent < now() - make_interval(hours => v_pol.cooldown_hours) THEN

        v_reco := format(
          'A tabela "%s" atingiu %s linhas (%.2f GiB). Recomenda-se migrar para partição %s: '
          || '1) criar tabela particionada nova; 2) copiar dados por faixa; 3) trocar nomes em janela de manutenção; '
          || '4) criar partições futuras automaticamente. Limites: %s linhas / %.2f GiB.',
          v_pol.table_name, v_rows, v_bytes / 1073741824.0, v_pol.partition_by,
          v_pol.threshold_rows, v_pol.threshold_bytes / 1073741824.0
        );

        INSERT INTO public.partition_advisories (
          policy_id, table_name, live_rows, total_bytes,
          threshold_rows, threshold_bytes, breached_rows, breached_bytes, recommendation
        ) VALUES (
          v_pol.id, v_pol.table_name, v_rows, v_bytes,
          v_pol.threshold_rows, v_pol.threshold_bytes, v_breach_rows, v_breach_bytes, v_reco
        );

        -- Notifica todos os administradores.
        FOR v_admin IN SELECT ur.user_id FROM public.user_roles ur WHERE ur.role = 'admin'
        LOOP
          INSERT INTO public.notifications (user_id, type, title, message, metadata)
          VALUES (
            v_admin, 'system',
            'Particionamento recomendado',
            format('A tabela "%s" ultrapassou o limite de volume e deve ser particionada.', v_pol.table_name),
            jsonb_build_object('table', v_pol.table_name, 'live_rows', v_rows, 'total_bytes', v_bytes)
          );
        END LOOP;

        v_created := true;
      END IF;
    END IF;

    table_name       := v_pol.table_name;
    live_rows        := v_rows;
    total_bytes      := v_bytes;
    breached         := v_breach;
    advisory_created := v_created;
    RETURN NEXT;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.evaluate_partition_policies() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.evaluate_partition_policies() TO authenticated;

-- ============================================================
-- 4) SEED DAS POLÍTICAS PADRÃO
-- ============================================================
INSERT INTO public.partition_policies (table_name, threshold_rows, threshold_bytes, partition_by, notes)
VALUES
  ('audit_logs',      10000000, 5368709120, 'RANGE (created_at) — mensal',
    'Auditoria: alto volume de escrita; particionar por mês facilita expurgo/retensão.'),
  ('campaign_events', 20000000, 5368709120, 'RANGE (created_at) — mensal',
    'Eventos de campanha: crescem com envios; particionar por mês melhora writes e analytics.')
ON CONFLICT (table_name) DO NOTHING;

-- ============================================================
-- 5) AGENDAMENTO DIÁRIO (pg_cron, SQL puro, sem segredos)
-- ============================================================
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

SELECT cron.schedule(
  'evaluate-partition-policies-daily',
  '17 3 * * *',
  $cron$ SELECT public.evaluate_partition_policies(); $cron$
);
