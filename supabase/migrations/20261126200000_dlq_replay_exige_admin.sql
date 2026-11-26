-- Etapa 045 (G32-4) -- reprocessar fila morta exige papel de administrador.
--
-- Antes: `replay_web_dead_letter_batch(uuid, uuid[], integer, uuid, text)` era
-- SECURITY DEFINER, com EXECUTE para `authenticated`, e validava apenas
-- membership. Um `viewer` chamava POST /rest/v1/rpc/replay_web_dead_letter_batch
-- direto e reenfileirava scraping (custo externo) sem passar pela edge function.
-- `replay_instagram_dead_letter_batch` era restrita a service_role, mas tambem
-- nao validava papel nenhum.
--
-- Agora as duas exigem `has_org_role(org, ator, 'admin')` -- que ja cobre o
-- membership -- e a versao web perdeu o grant para `authenticated`: quem
-- reprocessa pela UI usa as edge functions `web-dlq-replay` /
-- `instagram-dlq-replay`, que chamam com service_role e ja checam o papel.
-- O contrato de retorno foi preservado. Duas falhas de runtime dessas funcoes
-- tambem foram corrigidas, porque tornavam o replay inoperante:
--   1) `gen_random_bytes` e `digest` (pgcrypto) vivem em `extensions`, mas as
--      funcoes tem `SET search_path TO 'public'` -- toda chamada que encontrava
--      uma entrada de DLQ morria com 42883 e o item nunca era reprocessado;
--   2) o INSERT de auditoria usava colunas inexistentes em `audit_logs`
--      (`user_id`, `resource_type`, `resource_id`); o schema real e
--      `actor_id`, `table_name`, `record_id`. O erro era engolido por
--      `EXCEPTION WHEN OTHERS`, entao nenhum replay ficava registrado.

CREATE OR REPLACE FUNCTION public.replay_web_dead_letter_batch(
  p_organization_id UUID DEFAULT NULL,
  p_dlq_ids UUID[] DEFAULT NULL,
  p_limit INTEGER DEFAULT 50,
  p_actor UUID DEFAULT NULL,
  p_reason TEXT DEFAULT 'manual_replay'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user UUID := COALESCE(p_actor, auth.uid());
  v_dlq public.web_scrape_dead_letter;
  v_count INTEGER := 0;
  v_ids UUID[] := ARRAY[]::UUID[];
  v_payload JSONB;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  IF p_organization_id IS NOT NULL AND NOT public.has_org_role(p_organization_id, v_user, 'admin') THEN
    RAISE EXCEPTION 'Somente administradores da organização podem reprocessar a fila morta'
      USING ERRCODE = '42501';
  END IF;

  FOR v_dlq IN
    SELECT d.* FROM public.web_scrape_dead_letter d
    WHERE d.replayed_at IS NULL
      AND (p_organization_id IS NULL OR d.organization_id = p_organization_id)
      AND (p_dlq_ids IS NULL OR d.id = ANY(p_dlq_ids))
      AND public.has_org_role(d.organization_id, v_user, 'admin')
    ORDER BY d.failed_at ASC
    LIMIT GREATEST(COALESCE(p_limit, 50), 1)
    FOR UPDATE SKIP LOCKED
  LOOP
    v_payload := v_dlq.payload;
    INSERT INTO public.web_scrape_queue (
      organization_id, user_id, url, formats, extract_schema,
      wait_for_ms, max_bytes, config_hash, trace_id, next_run_at
    ) VALUES (
      v_dlq.organization_id, v_dlq.user_id, v_dlq.url,
      COALESCE(ARRAY(SELECT jsonb_array_elements_text(v_payload->'formats')), ARRAY['markdown']),
      v_payload->'extract_schema',
      COALESCE((v_payload->>'wait_for_ms')::INTEGER, 0),
      COALESCE((v_payload->>'max_bytes')::INTEGER, 2097152),
      encode(extensions.gen_random_bytes(16), 'hex'),
      COALESCE(v_dlq.trace_id, gen_random_uuid()),
      now()
    );
    UPDATE public.web_scrape_dead_letter SET replayed_at = now() WHERE id = v_dlq.id;
    v_count := v_count + 1;
    v_ids := array_append(v_ids, v_dlq.id);
  END LOOP;

  IF v_count > 0 THEN
    BEGIN
      INSERT INTO public.audit_logs (
        actor_id, table_name, record_id, action, organization_id, metadata
      ) VALUES (
        v_user, 'web_scrape_dead_letter', v_ids[1], 'execute'::audit_action,
        p_organization_id,
        jsonb_build_object(
          'operation', 'replay_web_dead_letter_batch',
          'reason', COALESCE(p_reason, 'manual_replay'),
          'replayed_count', v_count,
          'dlq_ids', to_jsonb(v_ids)
        )
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'audit_log_failed: %', SQLERRM;
    END;
  END IF;

  RETURN jsonb_build_object('replayed_count', v_count, 'dlq_ids', to_jsonb(v_ids));
END;
$$;

REVOKE ALL ON FUNCTION public.replay_web_dead_letter_batch(UUID, UUID[], INTEGER, UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.replay_web_dead_letter_batch(UUID, UUID[], INTEGER, UUID, TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.replay_web_dead_letter_batch(UUID, UUID[], INTEGER, UUID, TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.replay_web_dead_letter_batch(UUID, UUID[], INTEGER, UUID, TEXT) TO service_role;

COMMENT ON FUNCTION public.replay_web_dead_letter_batch(UUID, UUID[], INTEGER, UUID, TEXT) IS
  'Reenfileira o DLQ web. Exige papel admin na organização. Restrito a service_role (edge function web-dlq-replay). Registra audit_logs com action=execute.';

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
  v_user uuid := COALESCE(p_actor, auth.uid());
  v_cap integer := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 500);
  v_replayed uuid[] := ARRAY[]::uuid[];
  v_skipped_active uuid[] := ARRAY[]::uuid[];
  v_orgs uuid[] := ARRAY[]::uuid[];
  v_row record;
  v_new_queue_id uuid;
  v_config_hash text;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  IF p_organization_id IS NOT NULL AND NOT public.has_org_role(p_organization_id, v_user, 'admin') THEN
    RAISE EXCEPTION 'Somente administradores da organização podem reprocessar a fila morta'
      USING ERRCODE = '42501';
  END IF;

  -- Seleciona candidatos com lock para evitar corrida entre operadores.
  FOR v_row IN
    SELECT dl.*
    FROM public.instagram_scrape_dead_letter dl
    WHERE (p_dlq_ids IS NULL OR dl.id = ANY(p_dlq_ids))
      AND (p_organization_id IS NULL OR dl.organization_id = p_organization_id)
      AND public.has_org_role(dl.organization_id, v_user, 'admin')
    ORDER BY dl.last_seen_at DESC
    LIMIT v_cap
    FOR UPDATE SKIP LOCKED
  LOOP
    -- Recomputa config_hash canônico (org|type|value|params_ordenado)
    v_config_hash := encode(
      extensions.digest(
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
      v_user
    )
    RETURNING id INTO v_new_queue_id;

    DELETE FROM public.instagram_scrape_dead_letter WHERE id = v_row.id;

    v_replayed := array_append(v_replayed, v_row.id);
    IF NOT (v_row.organization_id = ANY(v_orgs)) THEN
      v_orgs := array_append(v_orgs, v_row.organization_id);
    END IF;
  END LOOP;

  -- Auditoria (best-effort -- não bloqueia replay se falhar)
  BEGIN
    INSERT INTO public.audit_logs(
      action, table_name, record_id, actor_id, organization_id, metadata
    )
    SELECT
      'execute'::audit_action,
      'instagram_scrape_dead_letter',
      v_replayed[1],
      v_user,
      unnest_orgs,
      jsonb_build_object(
        'reason', p_reason,
        'replayed_count', array_length(v_replayed, 1),
        'skipped_active_count', array_length(v_skipped_active, 1),
        'replayed_ids', to_jsonb(v_replayed),
        'skipped_ids', to_jsonb(v_skipped_active)
      )
    FROM unnest(CASE WHEN array_length(v_orgs,1) IS NULL THEN ARRAY[NULL]::uuid[] ELSE v_orgs END) AS unnest_orgs
    WHERE array_length(v_replayed, 1) IS NOT NULL;
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
  'Promove entradas do DLQ Instagram para a fila principal. Idempotente via config_hash. Exige papel admin na organização. Restrito a service_role. Registra audit_logs com action=execute.';