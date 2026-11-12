-- =============================================================================
-- Migration A1: assert_service_or_admin() — Guard Centralizado
-- =============================================================================
-- PROBLEMA: Padrão frágil "auth.uid() IS NULL = worker confiável" em funções
-- SECURITY DEFINER dependia de REVOKE/GRANT para segurança. Se um grant
-- regredir (ex: deploy de Lovable), a proteção é silenciosamente perdida.
--
-- SOLUÇÃO: Helper explícito que verifica o contexto real de execução:
-- ┌─────────────────────────────────────────────────────────────────────┐
-- │  Chamador            │ current_user         │ jwt.role             │
-- ├─────────────────────────────────────────────────────────────────────┘
-- │  pg_cron             │ postgres             │ '' (vazio)           │
-- │  Migrations          │ postgres/supa_admin  │ '' (vazio)           │
-- │  Edge Function (svc) │ authenticator        │ 'service_role'       │
-- │  Usuário admin       │ authenticator        │ 'authenticated'      │
-- │  Usuário comum       │ authenticator        │ 'authenticated'      │
-- │  Anon (sem JWT)      │ anon                 │ 'anon'               │
-- └─────────────────────────────────────────────────────────────────────┘
--
-- REFERÊNCIAS: OWASP A01, Supabase DB Linter 0028/0029, princípio menor privilégio
-- =============================================================================

BEGIN;

-- ─── 1. Criar schema extensions (se não existir) ─────────────────────────────
-- Usado por melhorias subsequentes (A3)
CREATE SCHEMA IF NOT EXISTS extensions;
COMMENT ON SCHEMA extensions IS 'Namespace para extensões PostgreSQL (separa do schema public)';

-- Garantir que authenticator (PostgREST) e service_role têm acesso
GRANT USAGE ON SCHEMA extensions TO authenticator;
GRANT USAGE ON SCHEMA extensions TO service_role;
GRANT USAGE ON SCHEMA extensions TO anon;
GRANT USAGE ON SCHEMA extensions TO authenticated;

-- ─── 2. Função assert_service_or_admin() ─────────────────────────────────────
-- SECURITY DEFINER necessário para acessar auth.uid() no contexto correto.
-- SET search_path = public previne search_path injection.
CREATE OR REPLACE FUNCTION public.assert_service_or_admin()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _jwt_role  text;
  _db_user   text;
  _caller_id uuid;
BEGIN
  -- Ler contexto de execução
  _jwt_role  := current_setting('request.jwt.role', true);   -- '' quando não há JWT
  _db_user   := current_user;                                  -- 'postgres' em cron
  _caller_id := auth.uid();                                    -- NULL sem JWT

  -- ── Permitir: superusers do sistema (pg_cron, migrations, restore) ────────
  IF _db_user IN ('postgres', 'supabase_admin', 'supabase_auth_admin',
                   'supabase_storage_admin', 'supabase_realtime_admin') THEN
    RETURN;
  END IF;

  -- ── Permitir: Edge Functions com service_role key ─────────────────────────
  IF _jwt_role = 'service_role' THEN
    RETURN;
  END IF;

  -- ── Permitir: usuários autenticados com papel admin em qualquer org ───────
  -- has_org_role(org_id, user_id, min_role) verifica hierarquia de papel.
  -- Aqui usamos a função existente has_role() que verifica papel global se existir,
  -- ou fallback para verificação direta na tabela organization_members.
  IF _caller_id IS NOT NULL THEN
    -- Verificar se o usuário é admin em pelo menos uma organização
    IF EXISTS (
      SELECT 1 
      FROM public.organization_members om
      WHERE om.user_id = _caller_id
        AND om.role::text = 'admin'
        AND om.deleted_at IS NULL
    ) THEN
      RETURN;
    END IF;
  END IF;

  -- ── Negar tudo o mais ────────────────────────────────────────────────────
  RAISE EXCEPTION 'Proibido: requer service_role ou papel admin na organização (jwt.role=%, db_user=%, uid=%)',
    COALESCE(_jwt_role, 'NULL'),
    _db_user,
    COALESCE(_caller_id::text, 'NULL')
    USING ERRCODE = '42501';  -- insufficient_privilege
END;
$$;

COMMENT ON FUNCTION public.assert_service_or_admin() IS
  'Guard centralizado para funções SECURITY DEFINER de manutenção. '
  'Permite: pg_cron (postgres), Edge Functions (service_role), admins autenticados. '
  'Lança 42501 para qualquer outro chamador. '
  'SUBSTITUI o padrão frágil: IF auth.uid() IS NOT NULL AND NOT has_role() THEN RAISE. '
  'ADR-009: Este helper não depende de GRANT/REVOKE para garantir segurança.';

-- Revogar acesso ao helper de roles não privilegiadas
REVOKE EXECUTE ON FUNCTION public.assert_service_or_admin() FROM anon;
REVOKE EXECUTE ON FUNCTION public.assert_service_or_admin() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.assert_service_or_admin() TO service_role;

CREATE OR REPLACE FUNCTION public.is_service_role()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN (
    current_setting('request.jwt.role', true) = 'service_role'
    OR current_user IN ('postgres', 'supabase_admin', 'supabase_auth_admin')
  );
END;
$$;

COMMENT ON FUNCTION public.is_service_role() IS
  'Retorna true se o chamador atual é service_role ou superuser do sistema. '
  'útil em políticas RLS e condicionais de segurança. '
  'Parte do padrão ADR-009 de guards explícitos.';

REVOKE EXECUTE ON FUNCTION public.is_service_role() FROM anon;
GRANT EXECUTE ON FUNCTION public.is_service_role() TO authenticated, service_role;

CREATE OR REPLACE VIEW public.v_sec_definer_anon_grants AS
SELECT 
  n.nspname                          AS schema_name,
  p.proname                          AS function_name,
  pg_get_function_identity_arguments(p.oid) AS function_args,
  r.rolname                          AS grantee_role,
  'EXECUTE'                          AS privilege_type,
  CASE 
    WHEN r.rolname = 'anon' THEN '🔴 CRÍTICO'
    WHEN r.rolname = 'authenticated' AND p.prosecdef THEN '🟡 REVISAR'
    ELSE '🟢 OK'
  END                                AS risk_level,
  NOW()                              AS checked_at
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
JOIN pg_auth_members am ON am.roleid = (
  SELECT oid FROM pg_roles WHERE rolname = 'anon'
)
JOIN pg_roles r ON r.oid = am.roleid
WHERE p.prosecdef = true
  AND n.nspname = 'public'
  AND has_function_privilege('anon', p.oid, 'execute')
ORDER BY risk_level, schema_name, function_name;

COMMENT ON VIEW public.v_sec_definer_anon_grants IS
  'Detecta funções SECURITY DEFINER com grant EXECUTE para anon. '
  'Zero linhas = postura segura. Usado pelo CI (check-function-grants.sh). ADR-009';

REVOKE ALL ON public.v_sec_definer_anon_grants FROM anon;
GRANT SELECT ON public.v_sec_definer_anon_grants TO authenticated, service_role;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'organization_members'
      AND column_name  = 'deleted_at'
  ) THEN
    ALTER TABLE public.organization_members ADD COLUMN deleted_at timestamptz;
    COMMENT ON COLUMN public.organization_members.deleted_at IS 
      'Soft delete: preenchido ao remover membro. NULL = ativo.';
    CREATE INDEX IF NOT EXISTS idx_org_members_active
      ON public.organization_members(organization_id, user_id)
      WHERE deleted_at IS NULL;
  END IF;
END $$;

COMMIT;
