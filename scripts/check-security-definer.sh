#!/usr/bin/env bash
# =============================================================================
# CI Guard — SECURITY DEFINER anti-regression (Rodada #24 hardening)
# =============================================================================
# Bidirecional:
#   1) Falha se o banco expõe a anon/authenticated uma função SECURITY DEFINER
#      que NÃO está em scripts/sql/security-definer-allowlist.txt.
#   2) Falha se a allowlist contém uma função que já não é mais exposta
#      (evita "allowlist zumbi" que mascara futuras exposições acidentais).
#
# Ver: docs/adr/009-security-baseline.md e docs/adr/018-round24-operational-depth.md
# =============================================================================
set -euo pipefail

DB_URL="${SUPABASE_DB_URL:-${DATABASE_URL:-}}"
if [[ -z "$DB_URL" ]]; then
  echo "::warning::SUPABASE_DB_URL não configurada — guard de SECURITY DEFINER ignorado."
  exit 0
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ALLOWLIST="$SCRIPT_DIR/sql/security-definer-allowlist.txt"

if [[ ! -f "$ALLOWLIST" ]]; then
  echo "::error::Allowlist não encontrada: $ALLOWLIST"
  exit 1
fi

echo "▶ Verificando SECURITY DEFINER expostas em public…"

EXPOSED=$(psql "$DB_URL" -At -v ON_ERROR_STOP=1 <<'SQL'
SELECT p.proname
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.prosecdef = true
  AND (has_function_privilege('anon', p.oid, 'EXECUTE')
    OR has_function_privilege('authenticated', p.oid, 'EXECUTE'))
ORDER BY p.proname;
SQL
)

ALLOWED=$(grep -vE '^\s*(#|$)' "$ALLOWLIST" | sort -u)
EXPOSED_SORTED=$(echo "$EXPOSED" | sort -u)

DRIFT_NEW=$(comm -23 <(echo "$EXPOSED_SORTED") <(echo "$ALLOWED"))
DRIFT_STALE=$(comm -13 <(echo "$EXPOSED_SORTED") <(echo "$ALLOWED"))

STATUS=0
if [[ -n "$DRIFT_NEW" ]]; then
  echo "::error::SECURITY DEFINER expostas fora da allowlist:"
  echo "$DRIFT_NEW" | sed 's/^/  + /'
  echo "  Ação: revogue EXECUTE ou adicione à allowlist com justificativa."
  STATUS=1
fi

if [[ -n "$DRIFT_STALE" ]]; then
  echo "::error::Entradas zumbis na allowlist (não mais expostas no banco):"
  echo "$DRIFT_STALE" | sed 's/^/  - /'
  echo "  Ação: remova de scripts/sql/security-definer-allowlist.txt."
  STATUS=1
fi

if [[ $STATUS -eq 0 ]]; then
  echo "✅ Allowlist SECURITY DEFINER em sincronia com o banco."
fi

exit $STATUS
