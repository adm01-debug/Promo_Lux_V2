-- DLP & PII masking (gap 2.8 do GAPS-ENTERPRISE:
-- "DLP & PII masking - Inexistente. Padrao: mascarar PII em logs e exports").
--
-- Entrega tres camadas:
--   1. regras por organizacao (categoria + acao), com defaults seguros;
--   2. motor de mascaramento reutilizavel para texto e JSON aninhado,
--      aplicavel a logs, exports e payloads antes de sairem do banco;
--   3. varredura (scan) das colunas conhecidas com PII, para o admin saber
--      onde ha exposicao antes de ligar o mascaramento.
--
-- Decisao de design: o mascaramento e deterministico e sem salt, portanto o
-- mesmo valor produz sempre o mesmo token mascarado. Isso mantem correlacao de
-- logs (o mesmo email continua reconhecivel entre linhas) sem expor o valor.
-- A acao 'hash' usa sha256 e serve para joins/contagens sem reidentificacao.

CREATE TABLE IF NOT EXISTS public.pii_redaction_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  category text NOT NULL,
  action text NOT NULL DEFAULT 'mask',
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pii_redaction_rules_category_chk
    CHECK (category IN ('email', 'phone', 'cpf', 'cnpj', 'credit_card', 'secret')),
  CONSTRAINT pii_redaction_rules_action_chk
    CHECK (action IN ('mask', 'hash', 'redact')),
  CONSTRAINT pii_redaction_rules_unique UNIQUE (organization_id, category)
);

CREATE INDEX IF NOT EXISTS idx_pii_rules_org
  ON public.pii_redaction_rules (organization_id, enabled);

ALTER TABLE public.pii_redaction_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pii_rules_select_admin" ON public.pii_redaction_rules;
CREATE POLICY "pii_rules_select_admin" ON public.pii_redaction_rules
  FOR SELECT TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "pii_rules_write_admin" ON public.pii_redaction_rules;
CREATE POLICY "pii_rules_write_admin" ON public.pii_redaction_rules
  FOR ALL TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), 'admin'::public.app_role));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pii_redaction_rules TO authenticated;

-- Regex por categoria. Documentado no painel; qualquer mudanca altera o
-- resultado do mascaramento, portanto e versionada aqui e nao em runtime.
CREATE OR REPLACE FUNCTION public.pii_regex(_category text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE _category
    WHEN 'email' THEN '[A-Za-z0-9._%+-]+@([A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,})'
    WHEN 'cpf' THEN '\m\d{3}\.\d{3}\.\d{3}-\d{2}\M'
    WHEN 'cnpj' THEN '\m\d{2}\.\d{3}\.\d{3}/\d{4}-\d{2}\M'
    WHEN 'phone' THEN '(?<![0-9])\+?(?:55[ -]?)?\(?\d{2}\)?[ -]?9?\d{4}[ -]?\d{4}(?![0-9])'
    WHEN 'credit_card' THEN '\m(?:\d{4}[ -]?){3}\d{4}\M'
    WHEN 'secret' THEN '\m(?:sk|pk|rk|ghp|gho|ghs|ghu|xox[abprs]|eyJ)[A-Za-z0-9_\-\.]{12,}\M'
    ELSE NULL
  END
$$;

REVOKE ALL ON FUNCTION public.pii_regex(text) FROM public;
GRANT EXECUTE ON FUNCTION public.pii_regex(text) TO authenticated;

-- Hash deterministico usado pela acao 'hash'.
CREATE OR REPLACE FUNCTION public.pii_hash(_value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT 'h-' || substr(encode(sha256(convert_to(coalesce(_value, ''), 'UTF8')), 'hex'), 1, 32)
$$;

REVOKE ALL ON FUNCTION public.pii_hash(text) FROM public;
GRANT EXECUTE ON FUNCTION public.pii_hash(text) TO authenticated;

-- Aplica uma categoria isolada. Exposta para uso em testes e em scripts.
CREATE OR REPLACE FUNCTION public.pii_apply_category(_value text, _category text, _action text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  _pat text;
  _v text := coalesce(_value, '');
  _m text;
  _acc text;
  _rest text;
  _idx int;
BEGIN
  IF _v = '' OR _category IS NULL THEN
    RETURN _v;
  END IF;

  _pat := public.pii_regex(_category);
  IF _pat IS NULL THEN
    RETURN _v;
  END IF;

  -- hash: cada ocorrencia e substituida pelo hash da propria ocorrencia.
  -- regexp_replace nao aceita funcao no replacement, por isso o loop manual.
  -- O grupo externo garante que substring() devolva o match inteiro mesmo
  -- quando o padrao da categoria tem grupos internos (email tem).
  IF _action = 'hash' THEN
    _acc := '';
    _rest := _v;
    LOOP
      _m := substring(_rest from '(' || _pat || ')');
      EXIT WHEN _m IS NULL OR _m = '';
      _idx := position(_m in _rest);
      EXIT WHEN _idx = 0;
      _acc := _acc || substring(_rest from 1 for _idx - 1) || public.pii_hash(_m);
      _rest := substring(_rest from _idx + length(_m));
    END LOOP;
    RETURN _acc || _rest;
  END IF;

  IF _action = 'redact' THEN
    RETURN regexp_replace(_v, _pat, '[' || upper(_category) || '_REDACTED]', 'gi');
  END IF;

  -- mask: preserva a parte menos identificadora de cada categoria
  RETURN CASE _category
    WHEN 'email' THEN regexp_replace(_v, _pat, '***@\1', 'gi')
    WHEN 'cpf' THEN regexp_replace(_v, _pat, '***.***.***-' || '**', 'g')
    WHEN 'cnpj' THEN regexp_replace(_v, _pat, '**.***.***/****-' || '**', 'g')
    WHEN 'phone' THEN regexp_replace(_v, _pat, '(**) *****-**', 'g')
    WHEN 'credit_card' THEN regexp_replace(_v, _pat, '**** **** **** ****', 'g')
    ELSE regexp_replace(_v, _pat, '[' || upper(_category) || '_MASKED]', 'gi')
  END;
END;
$$;

REVOKE ALL ON FUNCTION public.pii_apply_category(text, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.pii_apply_category(text, text, text) TO authenticated;

-- Categorias ativas da organizacao, com a acao escolhida.
CREATE OR REPLACE FUNCTION public.pii_active_rules(_org_id uuid)
RETURNS TABLE (category text, action text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.category, r.action
  FROM public.pii_redaction_rules r
  WHERE r.organization_id = _org_id AND r.enabled
  ORDER BY r.category
$$;

REVOKE ALL ON FUNCTION public.pii_active_rules(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.pii_active_rules(uuid) TO authenticated;

-- Motor de texto: aplica todas as regras ativas da organizacao.
CREATE OR REPLACE FUNCTION public.pii_redact_text(_org_id uuid, _value text)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _v text := coalesce(_value, '');
  _r record;
BEGIN
  IF _v = '' THEN
    RETURN _v;
  END IF;

  FOR _r IN SELECT * FROM public.pii_active_rules(_org_id) LOOP
    _v := public.pii_apply_category(_v, _r.category, _r.action);
  END LOOP;

  RETURN _v;
END;
$$;

REVOKE ALL ON FUNCTION public.pii_redact_text(uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.pii_redact_text(uuid, text) TO authenticated;

-- Motor de JSON: percorre objetos e arrays, mascarando strings. Chaves de
-- metadados que declaram a categoria (ex.: "cpf") sao mascaradas por inteiro.
CREATE OR REPLACE FUNCTION public._pii_redact_jsonb(_org_id uuid, _data jsonb, _depth int)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _out jsonb;
  _k text;
  _v jsonb;
  _lower text;
BEGIN
  IF _data IS NULL OR _depth > 8 THEN
    RETURN _data;
  END IF;

  CASE jsonb_typeof(_data)
    WHEN 'string' THEN
      RETURN to_jsonb(public.pii_redact_text(_org_id, _data #>> '{}'));

    WHEN 'array' THEN
      SELECT coalesce(jsonb_agg(public._pii_redact_jsonb(_org_id, elem, _depth + 1)), '[]'::jsonb)
        INTO _out
      FROM jsonb_array_elements(_data) AS elem;
      RETURN _out;

    WHEN 'object' THEN
      _out := '{}'::jsonb;
      FOR _k, _v IN SELECT key, value FROM jsonb_each(_data) LOOP
        _lower := lower(_k);
        IF _lower IN ('cpf', 'cnpj', 'credit_card', 'card_number', 'password', 'token',
                      'access_token', 'refresh_token', 'api_key', 'secret')
           AND jsonb_typeof(_v) = 'string' THEN
          _out := _out || jsonb_build_object(
            _k,
            public.pii_apply_category(_v #>> '{}', CASE
              WHEN _lower = 'cpf' THEN 'cpf'
              WHEN _lower = 'cnpj' THEN 'cnpj'
              WHEN _lower IN ('credit_card', 'card_number') THEN 'credit_card'
              ELSE 'secret'
            END, 'redact')
          );
        ELSIF _lower = 'email' AND jsonb_typeof(_v) = 'string' THEN
          _out := _out || jsonb_build_object(_k, public.pii_apply_category(_v #>> '{}', 'email', 'mask'));
        ELSIF _lower IN ('phone', 'phone_raw', 'phone_formatted') AND jsonb_typeof(_v) = 'string' THEN
          _out := _out || jsonb_build_object(_k, public.pii_apply_category(_v #>> '{}', 'phone', 'mask'));
        ELSE
          _out := _out || jsonb_build_object(_k, public._pii_redact_jsonb(_org_id, _v, _depth + 1));
        END IF;
      END LOOP;
      RETURN _out;

    ELSE
      RETURN _data;
  END CASE;
END;
$$;

REVOKE ALL ON FUNCTION public._pii_redact_jsonb(uuid, jsonb, int) FROM public;

CREATE OR REPLACE FUNCTION public.pii_redact_jsonb(_org_id uuid, _data jsonb)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public._pii_redact_jsonb(_org_id, _data, 0)
$$;

REVOKE ALL ON FUNCTION public.pii_redact_jsonb(uuid, jsonb) FROM public;
GRANT EXECUTE ON FUNCTION public.pii_redact_jsonb(uuid, jsonb) TO authenticated;

-- Leitura segura do audit log: mesma assinatura dos filtros do export, porem
-- com old_data/new_data/metadata passando pelo motor de PII.
CREATE OR REPLACE FUNCTION public.read_audit_logs_safe(
  _org_id uuid,
  _limit int DEFAULT 100,
  _action text DEFAULT NULL,
  _table_name text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  action text,
  table_name text,
  record_id uuid,
  old_data jsonb,
  new_data jsonb,
  metadata jsonb,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _lim int := LEAST(GREATEST(coalesce(_limit, 100), 1), 1000);
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'nao autenticado' USING ERRCODE = '28000';
  END IF;

  IF NOT public.has_org_role(_org_id, auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'apenas admin da organizacao pode ler audit log mascarado' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT a.id, a.user_id, a.action, a.table_name, a.record_id,
         public.pii_redact_jsonb(_org_id, a.old_data) AS old_data,
         public.pii_redact_jsonb(_org_id, a.new_data) AS new_data,
         public.pii_redact_jsonb(_org_id, a.metadata) AS metadata,
         a.created_at
  FROM public.audit_logs a
  WHERE a.organization_id = _org_id
    AND (_action IS NULL OR a.action = _action)
    AND (_table_name IS NULL OR a.table_name = _table_name)
  ORDER BY a.created_at DESC, a.id DESC
  LIMIT _lim;
END;
$$;

REVOKE ALL ON FUNCTION public.read_audit_logs_safe(uuid, int, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.read_audit_logs_safe(uuid, int, text, text) TO authenticated;

-- Varredura: quantas linhas de cada coluna conhecida contem PII.
-- Colunas ausentes no schema real sao ignoradas, nunca quebram a chamada.
CREATE OR REPLACE FUNCTION public.pii_scan(_org_id uuid)
RETURNS TABLE (
  table_name text,
  column_name text,
  category text,
  rows_total bigint,
  rows_with_pii bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _targets text[][] := ARRAY[
    ['stakeholders', 'email', 'email'],
    ['stakeholders', 'phone', 'phone'],
    ['stakeholders', 'notes', 'email'],
    ['stakeholders', 'full_name', 'email'],
    ['lusha_contacts', 'email', 'email'],
    ['lusha_contacts', 'phone_raw', 'phone'],
    ['email_suppressions', 'email', 'email'],
    ['deal_activities', 'content', 'email'],
    ['deal_activities', 'title', 'email']
  ];
  _t text;
  _c text;
  _cat text;
  _pat text;
  _total bigint;
  _hit bigint;
  _i int;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'nao autenticado' USING ERRCODE = '28000';
  END IF;

  IF NOT public.has_org_role(_org_id, auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'apenas admin da organizacao pode varrer PII' USING ERRCODE = '42501';
  END IF;

  FOR _i IN 1..array_length(_targets, 1) LOOP
    _t := _targets[_i][1];
    _c := _targets[_i][2];
    _cat := _targets[_i][3];

    CONTINUE WHEN NOT EXISTS (
      SELECT 1 FROM information_schema.columns c
      WHERE c.table_schema = 'public' AND c.table_name = _t AND c.column_name = _c
    );

    _pat := public.pii_regex(_cat);

    EXECUTE format(
      'SELECT count(*), count(*) FILTER (WHERE %I ~* $1) FROM public.%I WHERE organization_id = $2',
      _c, _t
    ) INTO _total, _hit USING _pat, _org_id;

    table_name := _t;
    column_name := _c;
    category := _cat;
    rows_total := _total;
    rows_with_pii := _hit;
    RETURN NEXT;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.pii_scan(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.pii_scan(uuid) TO authenticated;

-- Lista as regras, criando os defaults (tudo mascarado) na primeira chamada.
CREATE OR REPLACE FUNCTION public.list_pii_rules(_org_id uuid)
RETURNS TABLE (category text, action text, enabled boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'nao autenticado' USING ERRCODE = '28000';
  END IF;

  IF NOT public.has_org_role(_org_id, auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'apenas admin da organizacao pode listar regras de PII' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.pii_redaction_rules AS t (organization_id, category, action, enabled)
  SELECT _org_id, c.cat, 'mask', true
  FROM unnest(ARRAY['email', 'phone', 'cpf', 'cnpj', 'credit_card', 'secret']) AS c(cat)
  ON CONFLICT ON CONSTRAINT pii_redaction_rules_unique DO NOTHING;

  RETURN QUERY
  SELECT r.category, r.action, r.enabled
  FROM public.pii_redaction_rules r
  WHERE r.organization_id = _org_id
  ORDER BY r.category;
END;
$$;

REVOKE ALL ON FUNCTION public.list_pii_rules(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.list_pii_rules(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.set_pii_rule(
  _org_id uuid,
  _category text,
  _action text DEFAULT 'mask',
  _enabled boolean DEFAULT true
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'nao autenticado' USING ERRCODE = '28000';
  END IF;

  IF NOT public.has_org_role(_org_id, auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'apenas admin da organizacao pode alterar regras de PII' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.pii_redaction_rules (organization_id, category, action, enabled)
  VALUES (_org_id, _category, _action, _enabled)
  ON CONFLICT ON CONSTRAINT pii_redaction_rules_unique
  DO UPDATE SET action = EXCLUDED.action, enabled = EXCLUDED.enabled, updated_at = now();

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.set_pii_rule(uuid, text, text, boolean) FROM public;
GRANT EXECUTE ON FUNCTION public.set_pii_rule(uuid, text, text, boolean) TO authenticated;