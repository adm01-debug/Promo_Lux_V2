#!/usr/bin/env bash
# =============================================================================
# CI Guard -- view v_sec_definer_anon_grants (SECURITY DEFINER com acesso anon)
# =============================================================================
# A view lista as funcoes SECURITY DEFINER do schema public executaveis por anon.
# Este guard exige:
#   1) a view existe e devolve dados (migracao aplicada, definicao funcional);
#   2) o conjunto de funcoes que ela devolve e EXATAMENTE o allowlist de
#      scripts/sql/security-definer-allowlist.txt (comparacao bidirecional);
#   3) portanto, qualquer exposicao nova a anon aparece aqui e em
#      check-security-definer.sh, e uma entrada zumbi tambem.
#
# Por que nao "zero linhas = seguro": o projeto tem 43 funcoes SECURITY DEFINER
# executaveis por anon -- parte por default herdado do PostgreSQL via PUBLIC
# (ver cabecalho do allowlist). "Zero linhas" nunca foi a postura real; o
# contrato passou a ser baseline + deteccao de desvio, igual ao guard irmao.
#
# Fail-closed: no CI a ausencia de SUPABASE_DB_URL FALHA o build.
# =============================================================================
set -euo pipefail

DB_URL="${SUPABASE_DB_URL:-${DATABASE_URL:-}}"

if [[ -z "$DB_URL" ]]; then
  if [[ -n "${CI:-}" ]]; then
    echo "::error::SUPABASE_DB_URL (ou DATABASE_URL) nao configurada -- guard da view v_sec_definer_anon_grants NAO pode ser validado no CI."
    echo "Cadastre a connection string em Settings -> Secrets -> Actions (secret SUPABASE_DB_URL)."
    exit 1
  fi
  echo "::warning::SUPABASE_DB_URL (ou DATABASE_URL) nao configurada -- guard da view v_sec_definer_anon_grants ignorado fora do CI."
  exit 0
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ALLOWLIST="$SCRIPT_DIR/sql/security-definer-allowlist.txt"

if [[ ! -f "$ALLOWLIST" ]]; then
  echo "::error::Allowlist nao encontrada: $ALLOWLIST"
  exit 1
fi

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

echo "--> Verificando v_sec_definer_anon_grants (funcoes SECURITY DEFINER com acesso anon)..."

if ! VIEW_NAMES=$(psql "$DB_URL" -At -v ON_ERROR_STOP=1 -c \
  "SELECT DISTINCT function_name FROM public.v_sec_definer_anon_grants ORDER BY function_name" 2>"$WORK/err"); then
  echo "::error::Nao foi possivel consultar public.v_sec_definer_anon_grants:"
  sed 's/^/  /' "$WORK/err"
  exit 1
fi

printf '%s\n' "$VIEW_NAMES" | sed '/^$/d' | tr -d '\r' | sort -u > "$WORK/view_names"
grep -vE '^[[:space:]]*(#|$)' "$ALLOWLIST" | tr -d '\r' | sort -u > "$WORK/allowed" || true

if [[ ! -s "$WORK/view_names" ]]; then
  echo "::error::A view v_sec_definer_anon_grants nao devolveu nenhuma funcao -- definicao defasada ou quebrada."
  exit 1
fi

if [[ ! -s "$WORK/allowed" ]]; then
  echo "::error::Allowlist vazia ($ALLOWLIST) -- contrato invalido."
  exit 1
fi

STATUS=0

comm -13 "$WORK/allowed" "$WORK/view_names" > "$WORK/view_extra"
if [[ -s "$WORK/view_extra" ]]; then
  echo "::error::Funcoes SECURITY DEFINER com EXECUTE para anon fora do allowlist (exposicao nova):"
  sed 's/^/  + /' "$WORK/view_extra"
  echo "  Acao: REVOKE EXECUTE ON FUNCTION public.<nome>(...) FROM anon; ou registre no allowlist com justificativa."
  STATUS=1
fi

comm -23 "$WORK/allowed" "$WORK/view_names" > "$WORK/view_missing"
if [[ -s "$WORK/view_missing" ]]; then
  echo "::error::Entradas do allowlist que a view nao reporta (divergencia entre view e banco real):"
  sed 's/^/  - /' "$WORK/view_missing"
  echo "  Acao: confira a definicao da view (migration A1-assert-service-or-admin-guard) e o allowlist."
  STATUS=1
fi

if [[ $STATUS -eq 0 ]]; then
  echo "OK: view v_sec_definer_anon_grants em sincronia com o allowlist -- $(wc -l < "$WORK/view_names" | tr -d ' ') funcoes SECURITY DEFINER com EXECUTE para anon, todas registradas."
fi

exit $STATUS