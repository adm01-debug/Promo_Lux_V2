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
  echo "::warning::SUPABASE_DB_URL (ou DATABASE_URL) não configurada — guard de auditoria ignorado."
  echo "Adicione a connection string do banco como secret para ativar este guard: Settings → Secrets → Actions."
  exit 0
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "▶ Verificando integridade dos gatilhos de auditoria…"
psql "$DB_URL" -v ON_ERROR_STOP=1 -f "$SCRIPT_DIR/sql/check-audit-triggers.sql"
echo "✅ Gatilhos de auditoria conforme o esperado."
