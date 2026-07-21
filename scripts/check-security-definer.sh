#!/usr/bin/env bash
# =============================================================================
# CI Guard — SECURITY DEFINER anti-regression
# =============================================================================
# Verifica que nenhuma função SECURITY DEFINER em public tenha EXECUTE para
# anon/authenticated fora da allowlist versionada em
# scripts/sql/security-definer-allowlist.txt.
#
# Ver: docs/adr/009-security-baseline.md
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

DRIFT=$(comm -23 <(echo "$EXPOSED" | sort -u) <(echo "$ALLOWED"))

if [[ -n "$DRIFT" ]]; then
  echo "::error::SECURITY DEFINER fora da allowlist detectadas:"
  echo "$DRIFT" | sed 's/^/  - /'
  echo ""
  echo "Ação: revogue EXECUTE ou adicione à scripts/sql/security-definer-allowlist.txt"
  echo "com justificativa em docs/adr/009-security-baseline.md."
  exit 1
fi

echo "✅ Todas as SECURITY DEFINER expostas estão na allowlist."
