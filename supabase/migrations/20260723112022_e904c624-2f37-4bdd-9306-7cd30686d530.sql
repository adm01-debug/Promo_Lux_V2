-- RPC: replay_instagram_dead_letter_batch
-- Promove entradas da DLQ Instagram para a fila principal com idempotência e auditoria.

CREATE OR REPLACE FUNCTION public.replay_instagram_dead_letter_batch(
  p_organization_id uuid DEFAULT NULL,
  p_dlq_ids uuid[] DEFAULT NULL,
  p_limit integer DEFAULT 50,
  p_actor uuid DEFAULT NULL,
  p_reason text DEFAULT 'manual_replay'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cap integer := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 500);
  v_replayed uuid[] := ARRAY[]::uuid[];
  v_skipped_active uuid[] := ARRAY[]::uuid[];
  v_orgs uuid[] := ARRAY[]::uuid[];
  v_row record;
  v_new_queue_id uuid;
  v_config_hash text;
BEGIN
  -- Seleciona candidatos com lock para evitar corrida entre operadores.
  FOR v_row IN
    SELECT dl.*
    FROM public.instagram_scrape_dead_letter dl
    WHERE (p_dlq_ids IS NULL OR dl.id = ANY(p_dlq_ids))
      AND (p_organization_id IS NULL OR dl.organization_id = p_organization_id)
    ORDER BY dl.last_seen_at DESC
    LIMIT v_cap
    FOR UPDATE SKIP LOCKED
  LOOP
    -- Recomputa config_hash canônico (org|type|value|params_ordenado)
    v_config_hash := encode(
      digest(
        v_row.organization_id::text || '|' ||
        v_row.target_type || '|' ||
        v_row.target_value || '|' ||
        COALESCE(v_row.params::text, '{}'),
        'sha256'
      ),
      'hex'
    );

    -- Idempotência: se já existe job ativo com mesmo config_hash, pula.
    IF EXISTS (
      SELECT 1 FROM public.instagram_scrape_queue q
      WHERE q.organization_id = v_row.organization_id
        AND q.config_hash = v_config_hash
        AND q.status IN ('queued','running')
    ) THEN
      v_skipped_active := array_append(v_skipped_active, v_row.id);
      CONTINUE;
    END IF;

    INSERT INTO public.instagram_scrape_queue(
      organization_id, target_type, target_value, params,
      config_hash, status, attempt, max_attempts, next_run_at,
      created_by
    )
    VALUES (
      v_row.organization_id, v_row.target_type, v_row.target_value, v_row.params,
      v_config_hash, 'queued', 0, 4, now(),
      p_actor
    )
    RETURNING id INTO v_new_queue_id;

    DELETE FROM public.instagram_scrape_dead_letter WHERE id = v_row.id;

    v_replayed := array_append(v_replayed, v_row.id);
    IF NOT (v_row.organization_id = ANY(v_orgs)) THEN
      v_orgs := array_append(v_orgs, v_row.organization_id);
    END IF;
  END LOOP;

  -- Auditoria (best-effort — não bloqueia replay se falhar)
  BEGIN
    INSERT INTO public.audit_logs(
      action, resource_type, resource_id, user_id, organization_id, metadata
    )
    SELECT
      'execute'::audit_action,
      'instagram_scrape_dead_letter',
      NULL,
      p_actor,
      unnest_orgs,
      jsonb_build_object(
        'reason', p_reason,
        'replayed_count', array_length(v_replayed, 1),
        'skipped_active_count', array_length(v_skipped_active, 1),
        'replayed_ids', to_jsonb(v_replayed),
        'skipped_ids', to_jsonb(v_skipped_active)
      )
    FROM unnest(CASE WHEN array_length(v_orgs,1) IS NULL THEN ARRAY[NULL]::uuid[] ELSE v_orgs END) AS unnest_orgs;
  EXCEPTION WHEN OTHERS THEN
    -- não propaga falhas de auditoria
    NULL;
  END;

  RETURN jsonb_build_object(
    'replayed', COALESCE(array_length(v_replayed, 1), 0),
    'skipped_active', COALESCE(array_length(v_skipped_active, 1), 0),
    'replayed_ids', to_jsonb(v_replayed),
    'skipped_ids', to_jsonb(v_skipped_active),
    'organizations_affected', to_jsonb(v_orgs),
    'cap', v_cap
  );
END;
$$;

REVOKE ALL ON FUNCTION public.replay_instagram_dead_letter_batch(uuid, uuid[], integer, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.replay_instagram_dead_letter_batch(uuid, uuid[], integer, uuid, text) FROM anon;
REVOKE ALL ON FUNCTION public.replay_instagram_dead_letter_batch(uuid, uuid[], integer, uuid, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.replay_instagram_dead_letter_batch(uuid, uuid[], integer, uuid, text) TO service_role;

COMMENT ON FUNCTION public.replay_instagram_dead_letter_batch(uuid, uuid[], integer, uuid, text) IS
  'Promove entradas do DLQ Instagram para a fila principal. Idempotente via config_hash. Restrito a service_role. Registra audit_logs com action=execute.';
