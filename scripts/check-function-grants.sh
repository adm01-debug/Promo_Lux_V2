#!/usr/bin/env bash
# =============================================================================
# CI Guard — Grants/RLS de funções
# =============================================================================
# Executa `scripts/sql/check-function-grants.sql` contra o banco e propaga o
# código de saída: 0 = postura OK, != 0 = drift detectado (falha o build).
#
# Requer uma connection string em SUPABASE_DB_URL (ou DATABASE_URL).
# Configure como secret no repositório: Settings → Secrets → Actions.
# =============================================================================
set -euo pipefail

DB_URL="${SUPABASE_DB_URL:-${DATABASE_URL:-}}"

if [[ -z "$DB_URL" ]]; then
  echo "::warning::SUPABASE_DB_URL (ou DATABASE_URL) não configurada — guard de grants/RLS ignorado."
  echo "Adicione a connection string do banco como secret para ativar este guard: Settings → Secrets → Actions."
  exit 0
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "▶ Verificando grants de EXECUTE das funções public…"
psql "$DB_URL" -v ON_ERROR_STOP=1 -f "$SCRIPT_DIR/sql/check-function-grants.sql"
echo "✅ Grants/RLS de funções conforme o esperado."
