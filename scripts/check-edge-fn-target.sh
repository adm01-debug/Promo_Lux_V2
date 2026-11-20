#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# check-edge-fn-target.sh
#
# Guarda de ambiente para deploy de Edge Functions. Roda ANTES de qualquer
# `supabase link` / `functions list` / `functions deploy` no CI.
#
# Motivo de existir: o erro mais caro num deploy de functions nao e uma
# function ruim -- e uma function boa publicada no projeto errado. Este script
# recusa a execucao se:
#   * a credencial (SUPABASE_ACCESS_TOKEN) nao estiver presente;
#   * o project ref do ambiente do GitHub for invalido/ausente;
#   * o ref nao bater com EXPECTED_PROJECT_REF (trava dura por ambiente).
#
# Diferenca para check-migration-target.sh: deploy de functions NAO precisa
# de SUPABASE_DB_PASSWORD (so do access token da API), entao ela nao e
# exigida aqui.
#
# Variaveis esperadas (vindas do GitHub Environment):
#   SUPABASE_PROJECT_REF      (vars)    -- ref do projeto alvo
#   SUPABASE_ACCESS_TOKEN     (secrets) -- token de acesso a API Supabase
#   EXPECTED_PROJECT_REF      (vars, opcional) -- trava dura: se definida, o ref
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
  fail "SUPABASE_PROJECT_REF nao definido. Configure-o como variavel do GitHub Environment alvo."
fi

if [ -z "${SUPABASE_ACCESS_TOKEN:-}" ]; then
  fail "SUPABASE_ACCESS_TOKEN ausente. Configure-o como secret do GitHub Environment alvo."
fi

# Project refs do Supabase sao 20 caracteres alfabeticos minusculos.
if [ -n "$REF" ] && ! [[ "$REF" =~ ^[a-z]{20}$ ]]; then
  fail "SUPABASE_PROJECT_REF='$REF' nao tem o formato de um project ref do Supabase (20 letras minusculas)."
fi

# Trava dura opcional por ambiente.
if [ -n "${EXPECTED_PROJECT_REF:-}" ] && [ "$REF" != "$EXPECTED_PROJECT_REF" ]; then
  fail "Ambiente errado: esperado '$EXPECTED_PROJECT_REF', recebido '$REF'. Abortando antes de publicar em qualquer projeto."
fi

if [ "$ERRORS" -gt 0 ]; then
  exit 1
fi

echo "OK: alvo validado, project ref ${REF:0:6}...${REF: -4} (ambiente '${GITHUB_ENVIRONMENT_NAME:-${1:-desconhecido}}')."