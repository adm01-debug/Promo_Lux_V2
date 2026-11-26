#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# check-functions-orphans.sh
#
# Compara o que esta PUBLICADO no projeto Supabase com o que existe no
# repositorio e falha quando encontra function publicada que nao existe no repo.
#
# Motivo de existir: `supabase functions deploy` roda SEM --prune de proposito,
# entao tirar uma function do repositorio NAO a tira do projeto -- ela continua
# publica e respondendo. Foi assim que migrate-helper (que devolvia a
# service_role key), latency-alerts, api-latency-alerts e audit-logs-prune
# ficaram ACTIVE no projeto por semanas depois de sairem do repo; ninguem era
# avisado, so o log do job de plano mostrava.
#
# Somente leitura: faz um GET na Management API. Nunca apaga nada; a remocao
# continua sendo responsabilidade de scripts/retire-functions.sh (lista
# revisada em PR).
#
# Requer (do GitHub Environment `production`, o mesmo do deploy):
#   SUPABASE_ACCESS_TOKEN  (secrets) -- token de gestao da API Supabase
#   SUPABASE_PROJECT_REF   (vars)    -- projeto alvo
#
# Uso: bash scripts/check-functions-orphans.sh [dir-de-functions]
# Saida: 0 = sem orfa; 1 = ha orfa (ou nao foi possivel verificar).
# ---------------------------------------------------------------------------
set -uo pipefail

DIR="${1:-supabase/functions}"
ARQUIVO_APOSENTADAS="$DIR/retired.txt"
API="${SUPABASE_API_BASE:-https://api.supabase.com}/v1/projects"

if [ -z "${SUPABASE_PROJECT_REF:-}" ]; then
  echo "::error::SUPABASE_PROJECT_REF nao definido. Configure-o como variavel do GitHub Environment alvo."
  exit 1
fi
if [ -z "${SUPABASE_ACCESS_TOKEN:-}" ]; then
  echo "::error::SUPABASE_ACCESS_TOKEN ausente. Configure-o como secret do GitHub Environment alvo."
  exit 1
fi
if [ ! -d "$DIR" ]; then
  echo "::error::Diretorio de functions nao encontrado: $DIR"
  exit 1
fi
command -v jq >/dev/null 2>&1 || { echo "::error::jq nao encontrado no runner."; exit 1; }
command -v curl >/dev/null 2>&1 || { echo "::error::curl nao encontrado no runner."; exit 1; }

# --- o que esta publicado no projeto (fonte: Management API) -----------------
CORPO=$(mktemp)
STATUS=$(curl -sS -o "$CORPO" -w '%{http_code}' \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Accept: application/json" \
  "$API/$SUPABASE_PROJECT_REF/functions") || STATUS="000"
if [ "$STATUS" != "200" ]; then
  echo "::error::Nao foi possivel listar as functions publicadas (HTTP $STATUS). Sem isso o check nao pode afirmar nada."
  head -c 400 "$CORPO" 2>/dev/null || true
  echo
  rm -f "$CORPO"
  exit 1
fi
PUBLICADAS=$(jq -r 'if type == "array" then .[].slug // empty else empty end' "$CORPO" | sort -u)
rm -f "$CORPO"
if [ -z "$PUBLICADAS" ]; then
  echo "::error::A API respondeu 200 sem nenhuma function. Resposta vazia nao prova ausencia de orfa."
  exit 1
fi

# --- o que existe no repositorio --------------------------------------------
NO_REPO=$(find "$DIR" -mindepth 1 -maxdepth 1 -type d -printf '%f\n' \
  | grep -vE '^_' | sort -u)

# --- o que ja foi aposentado (lista revisada em PR) -------------------------
APOSENTADAS=""
if [ -f "$ARQUIVO_APOSENTADAS" ]; then
  APOSENTADAS=$(sed -e '1s/^\xEF\xBB\xBF//' -e 's/[[:space:]]*$//' "$ARQUIVO_APOSENTADAS" \
    | grep -vE '^[[:space:]]*(#|$)' | sort -u)
fi

ORFAS=$(comm -23 <(printf '%s\n' "$PUBLICADAS") <(printf '%s\n' "$NO_REPO" "$APOSENTADAS" | grep -vE '^$' | sort -u))
AUSENTES=$(comm -13 <(printf '%s\n' "$PUBLICADAS") <(printf '%s\n' "$NO_REPO" | grep -vE '^$' | sort -u))

TOTAL_PUB=$(printf '%s\n' "$PUBLICADAS" | grep -c . || true)
TOTAL_REPO=$(printf '%s\n' "$NO_REPO" | grep -c . || true)

echo "Publicadas no projeto: $TOTAL_PUB | No repositorio: $TOTAL_REPO | Aposentadas na lista: $(printf '%s\n' "$APOSENTADAS" | grep -c . || true)"

if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then
  {
    echo "## Detector de functions orfas"
    echo
    echo "| | |"
    echo "| --- | --- |"
    echo "| Publicadas no projeto | $TOTAL_PUB |"
    echo "| No repositorio | $TOTAL_REPO |"
    echo "| Orfas (publicadas e fora do repo) | $(printf '%s\n' "$ORFAS" | grep -c . || true) |"
    echo "| No repo mas nao publicadas | $(printf '%s\n' "$AUSENTES" | grep -c . || true) |"
    echo
    if [ -n "$ORFAS" ]; then
      echo "### Orfas"
      echo '```'
      printf '%s\n' "$ORFAS"
      echo '```'
      echo "Para cada nome: se ainda serve, restaure o codigo no repositorio; se morreu, adicione a \`supabase/functions/retired.txt\` (revisado em PR) e o workflow Functions Retirement remove do projeto."
    fi
    if [ -n "$AUSENTES" ]; then
      echo "### No repositorio mas nao publicadas"
      echo '```'
      printf '%s\n' "$AUSENTES"
      echo '```'
      echo "Sintoma de deploy que nao chegou ao projeto."
    fi
  } >> "$GITHUB_STEP_SUMMARY"
fi

SAIDA=0

if [ -n "$AUSENTES" ]; then
  while IFS= read -r NOME; do
    [ -z "$NOME" ] && continue
    echo "::warning::No repositorio mas nao publicada: $NOME (deploy nao chegou ao projeto)"
  done <<< "$AUSENTES"
fi

if [ -n "$ORFAS" ]; then
  while IFS= read -r NOME; do
    [ -z "$NOME" ] && continue
    echo "::error::Function orfa: $NOME -- publicada no projeto e inexistente no repositorio. Restaure o codigo ou adicione o nome em supabase/functions/retired.txt."
  done <<< "$ORFAS"
  SAIDA=1
else
  echo "OK: nenhuma function publicada fora do repositorio e fora da lista de aposentadas."
fi

exit $SAIDA