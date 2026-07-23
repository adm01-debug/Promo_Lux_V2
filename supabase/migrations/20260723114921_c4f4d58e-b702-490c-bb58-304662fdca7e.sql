
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
  IF p_organization_id IS NOT NULL AND NOT public.is_org_member(p_organization_id, v_user) THEN
    RAISE EXCEPTION 'Acesso negado à organização';
  END IF;

  FOR v_dlq IN
    SELECT d.* FROM public.web_scrape_dead_letter d
    WHERE d.replayed_at IS NULL
      AND (p_organization_id IS NULL OR d.organization_id = p_organization_id)
      AND (p_dlq_ids IS NULL OR d.id = ANY(p_dlq_ids))
      AND public.is_org_member(d.organization_id, v_user)
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
      encode(gen_random_bytes(16), 'hex'),
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
        organization_id, user_id, action, resource_type, resource_id, metadata
      ) VALUES (
        p_organization_id, v_user, 'execute'::audit_action,
        'web_scrape_dead_letter', NULL,
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
GRANT EXECUTE ON FUNCTION public.replay_web_dead_letter_batch(UUID, UUID[], INTEGER, UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.replay_web_dead_letter_batch(UUID, UUID[], INTEGER, UUID, TEXT) TO authenticated;
