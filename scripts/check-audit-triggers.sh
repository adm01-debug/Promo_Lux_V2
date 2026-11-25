#!/usr/bin/env bash
# =============================================================================
# CI Guard — Integridade dos gatilhos de auditoria
# =============================================================================
# Executa `scripts/sql/check-audit-triggers.sql` contra o banco e propaga o
# código de saída: 0 = topologia OK, != 0 = drift detectado (falha o build).
#
# Requer uma connection string em SUPABASE_DB_URL (ou DATABASE_URL).
# Configure como secret no repositório: Settings → Secrets → Actions.
# =============================================================================
set -euo pipefail

DB_URL="${SUPABASE_DB_URL:-${DATABASE_URL:-}}"

if [[ -z "$DB_URL" ]]; then
  if [[ -n "${CI:-}" ]]; then
    echo "::error::SUPABASE_DB_URL (ou DATABASE_URL) não configurada — guard de auditoria NÃO pode ser validado no CI."
    echo "Cadastre a connection string em Settings → Secrets → Actions (secret SUPABASE_DB_URL)."
    exit 1
  fi
  echo "::warning::SUPABASE_DB_URL (ou DATABASE_URL) não configurada — guard de auditoria ignorado fora do CI."
  exit 0
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "▶ Verificando integridade dos gatilhos de auditoria…"
psql "$DB_URL" -v ON_ERROR_STOP=1 -f "$SCRIPT_DIR/sql/check-audit-triggers.sql"
echo "✅ Gatilhos de auditoria conforme o esperado."
