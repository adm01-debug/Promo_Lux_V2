#!/usr/bin/env bash
# =============================================================================
# CI Guard — Cobertura de queue_kind em DLQ/Advisories (Rodada #18)
# =============================================================================
set -euo pipefail

DB_URL="${SUPABASE_DB_URL:-${DATABASE_URL:-}}"

if [[ -z "$DB_URL" ]]; then
  echo "::warning::SUPABASE_DB_URL (ou DATABASE_URL) não configurada — guard de queue_kind ignorado."
  exit 0
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "▶ Verificando cobertura de queue_kind (últimas 24h)…"
psql "$DB_URL" -v ON_ERROR_STOP=1 -f "$SCRIPT_DIR/sql/check-queue-kind-coverage.sql"
echo "✅ Cobertura de queue_kind OK."
