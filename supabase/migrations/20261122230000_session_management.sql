-- Gestao de sessoes ativas por usuario (gap 2.8 do GAPS-ENTERPRISE: "Session management")
-- Expoe as sessoes de auth.sessions do proprio usuario e permite revogar uma sessao
-- (ou todas as outras) sem depender do dashboard do Supabase.

CREATE OR REPLACE FUNCTION public.list_my_sessions()
RETURNS TABLE (
  id uuid,
  created_at timestamptz,
  updated_at timestamptz,
  user_agent text,
  ip text,
  is_current boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _current_session uuid;
BEGIN
  BEGIN
    _current_session := NULLIF(current_setting('request.jwt.claims', true)::json ->> 'session_id', '')::uuid;
  EXCEPTION WHEN others THEN
    _current_session := NULL;
  END;

  RETURN QUERY
  SELECT s.id,
         s.created_at,
         s.updated_at,
         COALESCE(s.user_agent, '')::text AS user_agent,
         COALESCE(host(s.ip), '')::text AS ip,
         (s.id = _current_session) AS is_current
  FROM auth.sessions s
  WHERE s.user_id = auth.uid()
  ORDER BY s.updated_at DESC NULLS LAST;
END;
$$;

-- Revoga uma sessao especifica do proprio usuario. Retorna true se revogou.
CREATE OR REPLACE FUNCTION public.revoke_my_session(_session_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _deleted int;
BEGIN
  IF _uid IS NULL THEN RETURN false; END IF;
  IF _session_id IS NULL THEN RETURN false; END IF;

  DELETE FROM auth.sessions WHERE id = _session_id AND user_id = _uid;
  GET DIAGNOSTICS _deleted = ROW_COUNT;
  RETURN _deleted > 0;
END;
$$;

-- Revoga todas as sessoes do usuario exceto a atual. Retorna quantas revogou.
CREATE OR REPLACE FUNCTION public.revoke_other_sessions()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _current_session uuid;
  _deleted int;
BEGIN
  IF _uid IS NULL THEN RETURN 0; END IF;
  BEGIN
    _current_session := NULLIF(current_setting('request.jwt.claims', true)::json ->> 'session_id', '')::uuid;
  EXCEPTION WHEN others THEN
    _current_session := NULL;
  END;

  DELETE FROM auth.sessions
  WHERE user_id = _uid
    AND (_current_session IS NULL OR id <> _current_session);
  GET DIAGNOSTICS _deleted = ROW_COUNT;
  RETURN _deleted;
END;
$$;

REVOKE ALL ON FUNCTION public.list_my_sessions() FROM public;
REVOKE ALL ON FUNCTION public.revoke_my_session(uuid) FROM public;
REVOKE ALL ON FUNCTION public.revoke_other_sessions() FROM public;

GRANT EXECUTE ON FUNCTION public.list_my_sessions() TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_my_session(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_other_sessions() TO authenticated;

COMMENT ON FUNCTION public.list_my_sessions() IS
  'Lista as sessoes ativas do usuario autenticado (auth.sessions), marcando a atual.';
COMMENT ON FUNCTION public.revoke_other_sessions() IS
  'Revoga todas as sessoes do usuario exceto a atual. Usado no botao "sair dos outros dispositivos".';