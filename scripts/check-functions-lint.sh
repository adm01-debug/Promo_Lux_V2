#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# check-functions-lint.sh
#
# Lint estatico de supabase/functions/. Nao toca em projeto remoto nenhum,
# nao precisa de credencial. Roda em qualquer maquina e no CI.
#
# Regras verificadas:
#   1. Todo diretorio em supabase/functions/ (exceto _shared) tem index.ts
#      na raiz -- sem isso a function nao e deployavel.
#   2. Nome de function valido: letras minusculas, numeros e hifens (formato
#      aceito pelo Supabase Functions).
#   3. `_shared/` nao pode conter index.ts -- se tiver, seria deployado como
#      function; ela existe so para imports compartilhados.
# ---------------------------------------------------------------------------
set -uo pipefail

DIR="supabase/functions"
ERRORS=0

fail() {
  echo "::error::$1"
  ERRORS=$((ERRORS + 1))
}

if [ ! -d "$DIR" ]; then
  echo "Diretorio $DIR nao existe -- nada a validar."
  exit 0
fi

shopt -s nullglob
for d in "$DIR"/*/; do
  NAME=$(basename "$d")
  [ "$NAME" = "_shared" ] && continue
  if ! [[ "$NAME" =~ ^[a-z0-9][a-z0-9-]*$ ]]; then
    fail "Function '$NAME': nome invalido (use minusculas, numeros e hifen)."
  fi
  if [ ! -f "$d/index.ts" ]; then
    fail "Function '$NAME': sem index.ts na raiz (nao e deployavel)."
  fi
done
shopt -u nullglob

if [ -f "$DIR/_shared/index.ts" ]; then
  fail "_shared/ contem index.ts -- ele seria deployado como function. Remova o index.ts de _shared."
fi

if [ "$ERRORS" -gt 0 ]; then
  echo "Erros de lint em supabase/functions: $ERRORS."
  exit 1
fi

echo "OK: $(find "$DIR" -maxdepth 1 -mindepth 1 -type d ! -name _shared | wc -l) functions validas."