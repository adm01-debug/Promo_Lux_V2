-- IP allowlist por organizacao (gap 2.8 do GAPS-ENTERPRISE: "IP allowlist - Inexistente")
-- Bloqueia acesso de usuarios cujo ultimo IP conhecido nao esta na lista CIDR da org.
-- Enforcement: trigger em organizations.settings + funcao public.is_ip_allowed usada
-- pelas edge functions sensiveis e pelo RPC get_my_ip_status.

CREATE TABLE IF NOT EXISTS public.ip_allowlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  cidr text NOT NULL,
  label text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ip_allowlist_cidr_format CHECK (
    -- IPv4: 4 octetos 0-255 com prefixo opcional 0-32
    cidr ~ '^((25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9]?[0-9])\.){3}(25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9]?[0-9])(/(3[0-2]|[12]?[0-9]))?$'
    -- IPv6: precisa de ao menos um ':' (impede aceitar palavras hex como "abc")
    OR (position(':' in cidr) > 0 AND cidr ~ '^[0-9a-fA-F:]+(/[0-9]{1,3})?$')
  ),
  CONSTRAINT ip_allowlist_org_cidr_key UNIQUE (organization_id, cidr)
);

CREATE INDEX IF NOT EXISTS ip_allowlist_org_idx ON public.ip_allowlist (organization_id);

ALTER TABLE public.ip_allowlist ENABLE ROW LEVEL SECURITY;

-- Admins da org gerenciam a lista
DROP POLICY IF EXISTS "Admins manage ip allowlist" ON public.ip_allowlist;
CREATE POLICY "Admins manage ip allowlist" ON public.ip_allowlist
  FOR ALL TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), 'admin'::public.app_role));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ip_allowlist TO authenticated;
GRANT ALL ON public.ip_allowlist TO service_role;

-- Toggle de enforcement por org (default OFF para nao trancar ninguem fora)
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS ip_allowlist_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_known_ip text;

COMMENT ON COLUMN public.organizations.ip_allowlist_enabled IS
  'Quando true, apenas IPs em ip_allowlist (ou de orgs sem regra) acessam dados. Default false.';

-- Checa se um IP pertence a um CIDR. Suporta IPv4 e fallback textual para IPv6.
CREATE OR REPLACE FUNCTION public.ip_in_cidr(_ip text, _cidr text)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  _prefixlen int;
  _net text;
  _ip_num bigint;
  _cidr_num bigint;
  _mask bigint;
  _octets text[];
  _i int;
BEGIN
  IF _ip IS NULL OR _cidr IS NULL THEN RETURN false; END IF;
  -- IPv6: comparacao exata ou prefixo textual simples
  IF position(':' in _ip) > 0 OR position(':' in _cidr) > 0 THEN
    IF position('/' in _cidr) = 0 THEN RETURN lower(_ip) = lower(_cidr); END IF;
    RETURN starts_with(lower(_ip), split_part(lower(_cidr), '/', 1));
  END IF;
  _net := split_part(_cidr, '/', 1);
  _prefixlen := CASE WHEN position('/' in _cidr) > 0 THEN split_part(_cidr, '/', 2)::int ELSE 32 END;
  IF _prefixlen < 0 OR _prefixlen > 32 THEN RETURN false; END IF;

  BEGIN
    _octets := string_to_array(_ip, '.');
    IF array_length(_octets, 1) <> 4 THEN RETURN false; END IF;
    _ip_num := 0;
    FOR _i IN 1..4 LOOP
      IF _octets[_i]::int < 0 OR _octets[_i]::int > 255 THEN RETURN false; END IF;
      _ip_num := _ip_num * 256 + _octets[_i]::int;
    END LOOP;
    _octets := string_to_array(_net, '.');
    IF array_length(_octets, 1) <> 4 THEN RETURN false; END IF;
    _cidr_num := 0;
    FOR _i IN 1..4 LOOP
      IF _octets[_i]::int < 0 OR _octets[_i]::int > 255 THEN RETURN false; END IF;
      _cidr_num := _cidr_num * 256 + _octets[_i]::int;
    END LOOP;
  EXCEPTION WHEN others THEN
    RETURN false;
  END;

  _mask := CASE WHEN _prefixlen = 0 THEN 0 ELSE (4294967295::bigint << (32 - _prefixlen)) & 4294967295 END;
  RETURN (_ip_num & _mask) = (_cidr_num & _mask);
END;
$$;

-- Retorna true se o IP passa. Orgs sem regra habilitada ou lista vazia passam sempre.
CREATE OR REPLACE FUNCTION public.is_ip_allowed(_org_id uuid, _ip text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _enabled boolean;
  _total int;
  _allowed boolean;
BEGIN
  SELECT ip_allowlist_enabled INTO _enabled FROM public.organizations WHERE id = _org_id;
  IF NOT COALESCE(_enabled, false) THEN RETURN true; END IF;
  SELECT count(*) INTO _total FROM public.ip_allowlist WHERE organization_id = _org_id;
  IF _total = 0 THEN RETURN true; END IF;
  SELECT EXISTS (
    SELECT 1 FROM public.ip_allowlist
    WHERE organization_id = _org_id AND public.ip_in_cidr(_ip, cidr)
  ) INTO _allowed;
  RETURN COALESCE(_allowed, false);
END;
$$;

-- Status do IP do chamador (para a UI avisar antes de ligar o bloqueio)
CREATE OR REPLACE FUNCTION public.get_my_ip_status()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _org_id uuid;
  _ip text;
  _enabled boolean;
  _total int;
BEGIN
  SELECT organization_id INTO _org_id
  FROM public.organization_members WHERE user_id = auth.uid() LIMIT 1;
  IF _org_id IS NULL THEN
    RETURN jsonb_build_object('allowed', true, 'enabled', false, 'ip', null, 'rules', 0);
  END IF;

  SELECT COALESCE(last_known_ip, ''), ip_allowlist_enabled INTO _ip, _enabled
  FROM public.organizations WHERE id = _org_id;
  SELECT count(*) INTO _total FROM public.ip_allowlist WHERE organization_id = _org_id;

  RETURN jsonb_build_object(
    'allowed', public.is_ip_allowed(_org_id, NULLIF(_ip, '')),
    'enabled', COALESCE(_enabled, false),
    'ip', NULLIF(_ip, ''),
    'rules', _total
  );
END;
$$;

REVOKE ALL ON FUNCTION public.is_ip_allowed(uuid, text) FROM public;
REVOKE ALL ON FUNCTION public.get_my_ip_status() FROM public;
GRANT EXECUTE ON FUNCTION public.is_ip_allowed(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_my_ip_status() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ip_in_cidr(text, text) TO authenticated, service_role;

-- Registra o IP de origem a cada request autenticado (best-effort, nao bloqueia)
CREATE OR REPLACE FUNCTION public.touch_last_known_ip()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _ip text;
  _org_id uuid;
BEGIN
  BEGIN
    _ip := split_part(
      COALESCE(
        current_setting('request.headers', true)::json ->> 'x-forwarded-for',
        current_setting('request.headers', true)::json ->> 'x-real-ip',
        ''
      ), ',', 1);
  EXCEPTION WHEN others THEN
    _ip := NULL;
  END;
  IF _ip IS NULL OR _ip = '' THEN RETURN; END IF;

  SELECT organization_id INTO _org_id
  FROM public.organization_members WHERE user_id = auth.uid() LIMIT 1;
  IF _org_id IS NULL THEN RETURN; END IF;

  UPDATE public.organizations SET last_known_ip = trim(_ip) WHERE id = _org_id;
END;
$$;

REVOKE ALL ON FUNCTION public.touch_last_known_ip() FROM public;
GRANT EXECUTE ON FUNCTION public.touch_last_known_ip() TO authenticated;