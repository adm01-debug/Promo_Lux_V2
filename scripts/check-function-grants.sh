#!/usr/bin/env bash
# =============================================================================
# CI Guard -- Grants de EXECUTE em funcoes do schema public
# =============================================================================
# Compara a postura real do banco com tres baselines versionados em scripts/sql:
#
#   anon-execute-baseline.txt          funcoes que anon PODE executar (fechado)
#   service-role-missing-baseline.txt  funcoes que service_role NAO pode (divida)
#   authenticated-required.txt         RPCs do front que authenticated DEVE poder
#
# A comparacao e bidirecional: falha quando aparece uma exposicao nova E tambem
# quando uma linha do baseline virou zumbi (nao corresponde mais ao banco), para
# o baseline nao mentir no futuro. O racional de cada lista esta no cabecalho do
# proprio arquivo.
#
# Requer connection string em SUPABASE_DB_URL (ou DATABASE_URL).
# Configure como secret no repositorio: Settings -> Secrets -> Actions.
#
# Fail-closed: nos eventos push/schedule/workflow_dispatch a ausencia da URL FALHA o
# build; em pull_request e na maquina local apenas avisa (o secret nao existe em PR).
# =============================================================================
set -euo pipefail

DB_URL="${SUPABASE_DB_URL:-${DATABASE_URL:-}}"

if [[ -z "$DB_URL" ]]; then
  # Fail-closed apenas nos eventos que sempre recebem o secret; em pull_request ele
  # nao existe, e falhar aqui deixaria todo PR vermelho sem validar o banco.
  if [[ "${GITHUB_EVENT_NAME:-}" =~ ^(push|schedule|workflow_dispatch)$ ]]; then
    echo "::error::SUPABASE_DB_URL (ou DATABASE_URL) nao configurada -- guard de grants/RLS NAO pode ser validado no evento ${GITHUB_EVENT_NAME}."
    echo "Cadastre a connection string em Settings -> Secrets -> Actions (secret SUPABASE_DB_URL)."
    exit 1
  fi
  echo "::warning::SUPABASE_DB_URL (ou DATABASE_URL) nao configurada -- guard de grants/RLS ignorado (evento: ${GITHUB_EVENT_NAME:-local}); a validacao roda no push para main."
  echo "Adicione a connection string do banco como secret para ativar este guard: Settings -> Secrets -> Actions."
  exit 0
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SQL_DIR="$SCRIPT_DIR/sql"

ANON_BASELINE="$SQL_DIR/anon-execute-baseline.txt"
SVC_BASELINE="$SQL_DIR/service-role-missing-baseline.txt"
AUTH_REQUIRED="$SQL_DIR/authenticated-required.txt"

for f in "$ANON_BASELINE" "$SVC_BASELINE" "$AUTH_REQUIRED"; do
  if [[ ! -f "$f" ]]; then
    echo "::error::Baseline de grants nao encontrado: $f"
    exit 1
  fi
done

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

# Nomes de um baseline: sem comentarios, sem linha vazia, sem CR, ordenados.
baseline_names() {
  grep -vE '^[[:space:]]*(#|$)' "$1" | tr -d '\r' | sort -u || true
}

echo "--> Verificando grants de EXECUTE das funcoes public..."

psql "$DB_URL" -At -F'|' -v ON_ERROR_STOP=1 > "$WORK/grants.raw" <<'SQL'
SELECT p.proname,
       CASE WHEN has_function_privilege('anon',          p.oid, 'EXECUTE') THEN 't' ELSE 'f' END,
       CASE WHEN has_function_privilege('authenticated', p.oid, 'EXECUTE') THEN 't' ELSE 'f' END,
       CASE WHEN has_function_privilege('service_role',  p.oid, 'EXECUTE') THEN 't' ELSE 'f' END
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.prokind = 'f'
ORDER BY p.proname;
SQL

TOTAL=$(wc -l < "$WORK/grants.raw" | tr -d ' ')
if [[ "$TOTAL" -lt 1 ]]; then
  echo "::error::A consulta de grants nao retornou nenhuma funcao em public -- guard invalido."
  exit 1
fi

awk -F'|' '$2 == "t" { print $1 }' "$WORK/grants.raw" | sort -u > "$WORK/db_anon"
awk -F'|' '$3 == "t" { print $1 }' "$WORK/grants.raw" | sort -u > "$WORK/db_auth"
awk -F'|' '$4 == "f" { print $1 }' "$WORK/grants.raw" | sort -u > "$WORK/db_svc_missing"

baseline_names "$ANON_BASELINE" > "$WORK/base_anon"
baseline_names "$SVC_BASELINE"  > "$WORK/base_svc_missing"
baseline_names "$AUTH_REQUIRED" > "$WORK/base_auth_required"

STATUS=0

print_list() {
  sed 's/^/  /' "$1"
}

# 1) anon: exposicao nova ou linha zumbi.
comm -13 "$WORK/base_anon" "$WORK/db_anon" > "$WORK/new_anon"
if [[ -s "$WORK/new_anon" ]]; then
  echo "::error::Funcoes public executaveis por anon FORA do baseline (exposicao nova):"
  print_list "$WORK/new_anon"
  echo "  Acao: REVOKE EXECUTE ON FUNCTION public.<nome>(...) FROM anon; ou registre a exposicao em scripts/sql/anon-execute-baseline.txt com justificativa."
  STATUS=1
fi

comm -23 "$WORK/base_anon" "$WORK/db_anon" > "$WORK/stale_anon"
if [[ -s "$WORK/stale_anon" ]]; then
  echo "::error::Baseline de anon com linhas zumbis (nao sao mais executaveis por anon):"
  print_list "$WORK/stale_anon"
  echo "  Acao: remova estas linhas de scripts/sql/anon-execute-baseline.txt -- baseline desatualizado esconde regressao."
  STATUS=1
fi

# 2) service_role: divida registrada, tambem bidirecional.
comm -13 "$WORK/base_svc_missing" "$WORK/db_svc_missing" > "$WORK/new_svc_missing"
if [[ -s "$WORK/new_svc_missing" ]]; then
  echo "::error::Funcoes public que service_role NAO pode executar e nao estao na divida registrada:"
  print_list "$WORK/new_svc_missing"
  echo "  Acao: GRANT EXECUTE ON FUNCTION public.<nome>(...) TO service_role; ou registre a excecao em scripts/sql/service-role-missing-baseline.txt."
  STATUS=1
fi

comm -23 "$WORK/base_svc_missing" "$WORK/db_svc_missing" > "$WORK/stale_svc_missing"
if [[ -s "$WORK/stale_svc_missing" ]]; then
  echo "::error::Divida de service_role com linhas zumbis (estas funcoes ja sao executaveis):"
  print_list "$WORK/stale_svc_missing"
  echo "  Acao: remova estas linhas de scripts/sql/service-role-missing-baseline.txt."
  STATUS=1
fi

# 3) authenticated: piso obrigatorio -- as RPCs que o frontend chama.
comm -23 "$WORK/base_auth_required" "$WORK/db_auth" > "$WORK/auth_missing"
if [[ -s "$WORK/auth_missing" ]]; then
  echo "::error::RPCs do frontend que DEIXARAM de ser executaveis por authenticated:"
  print_list "$WORK/auth_missing"
  echo "  Acao: GRANT EXECUTE ON FUNCTION public.<nome>(...) TO authenticated; a UI quebra sem isso."
  STATUS=1
fi

if [[ $STATUS -eq 0 ]]; then
  echo "OK: EXECUTE conforme os baselines -- anon=$(wc -l < "$WORK/db_anon" | tr -d ' ') funcoes (baseline $(wc -l < "$WORK/base_anon" | tr -d ' ')), service_role bloqueado em $(wc -l < "$WORK/db_svc_missing" | tr -d ' ') funcoes (divida registrada $(wc -l < "$WORK/base_svc_missing" | tr -d ' ')), authenticated executando as $(wc -l < "$WORK/base_auth_required" | tr -d ' ') RPCs exigidas pelo front; total de funcoes public: $TOTAL."
fi

exit $STATUS