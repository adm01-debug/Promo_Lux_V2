-- =============================================================================
-- CI Guard (Round18): queue_kind obrigatório em novas linhas de DLQ/Advisories
-- =============================================================================
-- Após a Rodada #17 introduzir o discriminador `queue_kind` ('scrape'|'web') em
-- `dlq_alert_settings`, `dlq_alert_history`, `dlq_health_snapshots` e
-- `retry_policy_advisories`, precisamos garantir que nenhuma escrita nova
-- (últimas 24h) volte a ter `queue_kind` NULL — o que aconteceria se um DEFAULT
-- fosse acidentalmente removido, se uma edge function passasse a omitir o campo,
-- ou se uma migração futura relaxasse a nulidade.
--
-- Este script FALHA (RAISE EXCEPTION → exit != 0) se qualquer linha inserida
-- nas últimas 24h nas quatro tabelas estiver com `queue_kind` NULL.
-- =============================================================================

DO $$
DECLARE
  bad_settings int;
  bad_history int;
  bad_snapshots int;
  bad_advisories int;
  msg text := '';
BEGIN
  SELECT count(*) INTO bad_settings
  FROM public.dlq_alert_settings
  WHERE updated_at >= now() - interval '24 hours' AND queue_kind IS NULL;

  SELECT count(*) INTO bad_history
  FROM public.dlq_alert_history
  WHERE triggered_at >= now() - interval '24 hours' AND queue_kind IS NULL;

  SELECT count(*) INTO bad_snapshots
  FROM public.dlq_health_snapshots
  WHERE captured_at >= now() - interval '24 hours' AND queue_kind IS NULL;

  SELECT count(*) INTO bad_advisories
  FROM public.retry_policy_advisories
  WHERE created_at >= now() - interval '24 hours' AND queue_kind IS NULL;

  IF bad_settings > 0 THEN
    msg := msg || format(E'\n  [dlq_alert_settings]     %s linha(s) recente(s) sem queue_kind', bad_settings);
  END IF;
  IF bad_history > 0 THEN
    msg := msg || format(E'\n  [dlq_alert_history]      %s linha(s) recente(s) sem queue_kind', bad_history);
  END IF;
  IF bad_snapshots > 0 THEN
    msg := msg || format(E'\n  [dlq_health_snapshots]   %s linha(s) recente(s) sem queue_kind', bad_snapshots);
  END IF;
  IF bad_advisories > 0 THEN
    msg := msg || format(E'\n  [retry_policy_advisories] %s linha(s) recente(s) sem queue_kind', bad_advisories);
  END IF;

  IF msg <> '' THEN
    RAISE EXCEPTION E'Cobertura de queue_kind FALHOU (últimas 24h):%', msg;
  END IF;

  RAISE NOTICE 'OK: 100%% das novas linhas de DLQ/Advisories têm queue_kind populado.';
END $$;
