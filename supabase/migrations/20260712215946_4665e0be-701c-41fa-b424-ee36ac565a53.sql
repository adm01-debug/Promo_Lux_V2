-- S-1 Hardening: REVOKE EXECUTE de funções exclusivas do worker do sistema.
-- Estas RPCs já falham-fechado internamente (RAISE EXCEPTION quando auth.uid() IS NOT NULL),
-- mas remover o grant a anon/authenticated adiciona defesa em profundidade,
-- padronizando com defer_scrape_task (que já não concede EXECUTE a esses papéis).
-- service_role (worker sem JWT) mantém a permissão.

REVOKE EXECUTE ON FUNCTION public.claim_scrape_tasks(integer, text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.complete_scrape_task(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fail_scrape_task(uuid, text, boolean) FROM anon, authenticated;