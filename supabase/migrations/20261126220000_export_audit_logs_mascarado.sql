-- DLP: o export de auditoria passa a mascarar PII conforme as regras da organizacao.
--
-- Antes: `pii_redaction_rules` (configurada em Configuracoes > Mascaramento de
-- PII) e o motor `pii_redact_jsonb` existiam e a tela mascarava a amostra, mas o
-- unico caminho que TIRA o log da organizacao -- o arquivo NDJSON/JSON de
-- `export_audit_logs`, consumido por SIEM e auditoria externa -- devolvia
-- `old_data`, `new_data` e `metadata` crus. A regra configurada nao tinha efeito
-- no arquivo exportado.
--
-- Agora: as tres colunas passam pelo mesmo motor de PII (mask | hash | redact)
-- que ja alimenta `read_audit_logs_safe`. Sem regra ativa para a organizacao o
-- motor devolve o valor inalterado (`_pii_redact_jsonb` so percorre as regras de
-- `pii_active_rules`), portanto nao ha mudanca de comportamento para quem nao
-- usa o recurso.
--
-- Assinatura, filtros, cursor, ordenacao e grants permanecem identicos aos de
-- 20261122240000_audit_log_export.sql: a UI nao precisa passar parametro novo e
-- nenhuma chamada existente muda de forma.
--
-- Correcao de coluna: a versao original filtrava por `a.user_id`, coluna que nao
-- existe em `audit_logs` (o schema real usa `actor_id` -- mesma divergencia ja
-- documentada em 20260713123956 e corrigida em 20261124220000). Em plpgsql o
-- corpo nao e validado na criacao, entao `export_audit_logs`, `count_audit_logs`
-- e `read_audit_logs_safe` foram criados com sucesso e falhavam em tempo de
-- execucao com "column a.user_id does not exist" -- ou seja, o botao Exportar do
-- painel de auditoria nunca conseguiu ler uma linha. Aqui a coluna passa a ser
-- `actor_id` e a comparacao de `action` vira explicita (`::text`) para nao
-- depender de resolucao de operador entre `text` e o enum `public.audit_action`.

-- O parametro `_user_id` vira `_actor_id` e a coluna de retorno `user_id` vira
-- `actor_id`: CREATE OR REPLACE nao renomeia parametro ("cannot change name of input
-- parameter"), entao a versao antiga e removida antes de recriar. Nenhum hook, view ou
-- edge function depende dela (todas falhavam em execucao).
DROP FUNCTION IF EXISTS public.export_audit_logs(uuid, timestamptz, timestamptz, text, text, uuid, timestamptz, uuid, int);

CREATE OR REPLACE FUNCTION public.export_audit_logs(
  _org_id uuid,
  _from timestamptz DEFAULT NULL,
  _to timestamptz DEFAULT NULL,
  _action text DEFAULT NULL,
  _table_name text DEFAULT NULL,
  _actor_id uuid DEFAULT NULL,
  _after_created_at timestamptz DEFAULT NULL,
  _after_id uuid DEFAULT NULL,
  _limit int DEFAULT 1000
)
RETURNS TABLE (
  id uuid,
  organization_id uuid,
  actor_id uuid,
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
  _lim int := LEAST(GREATEST(COALESCE(_limit, 1000), 1), 5000);
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'nao autenticado' USING ERRCODE = '28000';
  END IF;

  IF NOT public.has_org_role(_org_id, auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'apenas admin da organizacao pode exportar audit log' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT a.id,
         a.organization_id,
         a.actor_id,
         a.action::text,
         a.table_name,
         a.record_id,
         public.pii_redact_jsonb(_org_id, a.old_data) AS old_data,
         public.pii_redact_jsonb(_org_id, a.new_data) AS new_data,
         public.pii_redact_jsonb(_org_id, a.metadata) AS metadata,
         a.created_at
  FROM public.audit_logs a
  WHERE a.organization_id = _org_id
    AND (_from IS NULL OR a.created_at >= _from)
    AND (_to IS NULL OR a.created_at < _to)
    AND (_action IS NULL OR a.action::text = _action)
    AND (_table_name IS NULL OR a.table_name = _table_name)
    AND (_actor_id IS NULL OR a.actor_id = _actor_id)
    -- cursor: (created_at, id) estritamente posterior ao ultimo item exportado
    AND (
      _after_created_at IS NULL
      OR a.created_at > _after_created_at
      OR (a.created_at = _after_created_at AND (_after_id IS NULL OR a.id > _after_id))
    )
  ORDER BY a.created_at ASC, a.id ASC
  LIMIT _lim;
END;
$$;

REVOKE ALL ON FUNCTION public.export_audit_logs(uuid, timestamptz, timestamptz, text, text, uuid, timestamptz, uuid, int) FROM public;
-- O projeto concede EXECUTE a `anon` por default privileges: sem este REVOKE o
-- visitante sem login continua com a funcao exposta na API (a barreira interna
-- devolve "nao autenticado", mas a superficie nao precisa existir).
REVOKE ALL ON FUNCTION public.export_audit_logs(uuid, timestamptz, timestamptz, text, text, uuid, timestamptz, uuid, int) FROM anon;
GRANT EXECUTE ON FUNCTION public.export_audit_logs(uuid, timestamptz, timestamptz, text, text, uuid, timestamptz, uuid, int) TO authenticated;