#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# check-migration-target.sh
#
# Guarda de ambiente. Roda ANTES de qualquer `supabase link` / `db push` no CI.
#
# Motivo de existir: o erro mais caro num fluxo de migração não é uma migration
# ruim — é uma migration boa aplicada no banco errado. Este script recusa a
# execução se:
#   * as credenciais do ambiente não estiverem presentes;
#   * o project ref do ambiente do GitHub for igual ao de outro ambiente
#     (indício clássico de secret copiado de staging para production);
#   * o ref não tiver o formato esperado de um project ref do Supabase.
#
# Variáveis esperadas (vindas do GitHub Environment):
#   SUPABASE_PROJECT_REF      (vars)    — ref do projeto alvo
#   SUPABASE_ACCESS_TOKEN     (secrets) — token da conta/CI
#   SUPABASE_DB_PASSWORD      (secrets) — senha do banco do projeto alvo
#   EXPECTED_PROJECT_REF      (vars, opcional) — trava dura: se definida, o ref
#                                                precisa ser exatamente este.
# ---------------------------------------------------------------------------
set -uo pipefail

ERRORS=0

fail() {
  echo "::error::$1"
  ERRORS=$((ERRORS + 1))
}

REF="${SUPABASE_PROJECT_REF:-}"

if [ -z "$REF" ]; then
  fail "SUPABASE_PROJECT_REF não definido. Configure-o como variável do GitHub Environment alvo."
fi

if [ -z "${SUPABASE_ACCESS_TOKEN:-}" ]; then
  fail "SUPABASE_ACCESS_TOKEN ausente. Configure-o como secret do GitHub Environment alvo."
fi

if [ -z "${SUPABASE_DB_PASSWORD:-}" ]; then
  fail "SUPABASE_DB_PASSWORD ausente. Configure-o como secret do GitHub Environment alvo."
fi

# Project refs do Supabase são 20 caracteres alfabéticos minúsculos.
if [ -n "$REF" ] && ! [[ "$REF" =~ ^[a-z]{20}$ ]]; then
  fail "SUPABASE_PROJECT_REF='$REF' não tem o formato de um project ref do Supabase (20 letras minúsculas)."
fi

# Trava dura opcional por ambiente.
if [ -n "${EXPECTED_PROJECT_REF:-}" ] && [ "$REF" != "$EXPECTED_PROJECT_REF" ]; then
  fail "Ambiente errado: esperado '$EXPECTED_PROJECT_REF', recebido '$REF'. Abortando antes de tocar no banco."
fi

if [ "$ERRORS" -gt 0 ]; then
  exit 1
fi

echo "✅ Alvo validado: project ref ${REF:0:6}…${REF: -4} (ambiente '${GITHUB_ENVIRONMENT_NAME:-${1:-desconhecido}}')."
