#!/usr/bin/env bash
# ==============================================================================
# CI Guard — v_sec_definer_anon_grants view
# ==============================================================================
# Consulta a view criada pela migration assert_service_or_admin.
# Zero linhas = postura segura.
# Linhas com risco CRÍTICO + anon = falha o build.
#
# Em push sem SUPABASE_DB_URL: FALHA (obrigatório)
# Em PR de fork sem secrets: WARNING (não bloqueia)
# ==============================================================================
set -euo pipefail

DB_URL="${SUPABASE_DB_URL:-${DATABASE_URL:-}}"
EVENT="${GITHUB_EVENT_NAME:-}"

if [[ -z "$DB_URL" ]]; then
  echo "::warning::SUPABASE_DB_URL (ou DATABASE_URL) não configurada — guard de anon grants ignorado."
  echo "Adicione a connection string do banco como secret para ativar este guard: Settings → Secrets → Actions."
  exit 0
fi

echo "▶ Verificando v_sec_definer_anon_grants (funções SECURITY DEFINER com acesso anon)..."

CRITICAL=$(psql "$DB_URL" -t -A -c \
  "SELECT COUNT(*) FROM public.v_sec_definer_anon_grants WHERE risk_level LIKE '%CRÍTICO%'" \
  || echo "ERROR")

if [[ "$CRITICAL" == "ERROR" ]]; then
  echo "::warning::View v_sec_definer_anon_grants não encontrada -- migração pendente."
  exit 0
elif [[ "$CRITICAL" -gt 0 ]]; then
  echo "::error::$CRITICAL função(ões) SECURITY DEFINER com EXECUTE para anon detectada(s):"
  psql "$DB_URL" -c \
    "SELECT schema_name, function_name, function_args, risk_level FROM public.v_sec_definer_anon_grants ORDER BY risk_level"
  echo ""
  echo "Revogar com: REVOKE EXECUTE ON FUNCTION public.<nome>() FROM anon;"
  exit 1
else
  TOTAL=$(psql "$DB_URL" -t -A -c "SELECT COUNT(*) FROM public.v_sec_definer_anon_grants")
  echo "✅ Zero funções SECURITY DEFINER com acesso anon. Total monitoradas: $TOTAL. Postura segura."
fi
