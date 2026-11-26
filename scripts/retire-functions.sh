#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# retire-functions.sh
#
# Remove do projeto alvo as edge functions listadas em
# supabase/functions/retired.txt (um nome por linha; linhas vazias e linhas
# comecando com # sao ignoradas).
#
# Motivo de existir: `supabase functions deploy` roda SEM --prune de proposito
# (function publicada fora do repositorio fica intacta), entao tirar uma
# function do repositorio NAO a tira do projeto: ela continua publica e
# respondendo. Foi o caso da migrate-helper, que devolvia a service_role key no
# corpo da resposta depois de sair do repo (PR #229, etapa 003).
#
# Requer (vindos do GitHub Environment `production`, o mesmo do deploy):
#   SUPABASE_ACCESS_TOKEN  (secrets) -- token de gestao da API Supabase
#   SUPABASE_PROJECT_REF   (vars)    -- projeto alvo
#
# Idempotente: HTTP 404 e sucesso (a function ja nao existia no projeto).
# Qualquer outro codigo vira ::error:: e o script sai com 1.
#
# Uso: bash scripts/retire-functions.sh [caminho-da-lista]
# ---------------------------------------------------------------------------
set -uo pipefail

ARQUIVO="${1:-supabase/functions/retired.txt}"
API="https://api.supabase.com/v1/projects"

if [ -z "${SUPABASE_PROJECT_REF:-}" ]; then
  echo "::error::SUPABASE_PROJECT_REF nao definido. Configure-o como variavel do GitHub Environment alvo."
  exit 1
fi

if [ -z "${SUPABASE_ACCESS_TOKEN:-}" ]; then
  echo "::error::SUPABASE_ACCESS_TOKEN ausente. Configure-o como secret do GitHub Environment alvo."
  exit 1
fi

if [ ! -f "$ARQUIVO" ]; then
  echo "Sem lista de aposentadas ($ARQUIVO): nada a remover."
  exit 0
fi

# O arquivo pode ter vindo de um editor Windows (BOM/CRLF); normaliza antes de
# usar o nome na URL -- cr ou BOM colado no nome vira "Malformed input to a URL".
NOMES=$(sed -e '1s/^\xEF\xBB\xBF//' -e 's/[[:space:]]*$//' "$ARQUIVO" \
  | grep -vE '^[[:space:]]*(#|$)' || true)
if [ -z "$NOMES" ]; then
  echo "Lista de aposentadas vazia: nada a remover."
  exit 0
fi

ERROS=0
TOTAL=0
while IFS= read -r NOME; do
  [ -z "$NOME" ] && continue
  TOTAL=$((TOTAL + 1))
  # Mesmo formato exigido pelo check-functions-lint.sh: evita nome com barra,
  # espaco ou ../ chegando na URL da API.
  if ! [[ "$NOME" =~ ^[a-z0-9][a-z0-9-]*$ ]]; then
    echo "::error::Nome invalido em $ARQUIVO: '$NOME'."
    ERROS=$((ERROS + 1))
    continue
  fi
  CODIGO=$(curl -sS -o /tmp/retire-functions.out -w '%{http_code}' \
    -X DELETE \
    -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
    "$API/$SUPABASE_PROJECT_REF/functions/$NOME") || CODIGO="000"
  case "$CODIGO" in
    200|204)
      echo "Removida do projeto: $NOME"
      ;;
    404)
      echo "Ja nao existia no projeto: $NOME"
      ;;
    *)
      echo "::error::Falha ao remover '$NOME' (HTTP $CODIGO): $(cat /tmp/retire-functions.out 2>/dev/null)"
      ERROS=$((ERROS + 1))
      ;;
  esac
done <<< "$NOMES"

if [ "$ERROS" -gt 0 ]; then
  echo "Erros ao remover functions: $ERROS de $TOTAL."
  exit 1
fi

echo "OK: $TOTAL nome(s) conferido(s) no projeto ${SUPABASE_PROJECT_REF:0:6}... -- nada pendente."