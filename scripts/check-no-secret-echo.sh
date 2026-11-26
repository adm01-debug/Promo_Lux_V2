#!/usr/bin/env bash
# Etapa 004 do docs/qa/04-PLANO.md (achados G10-2 e G13-2).
#
# Recusa edge function que devolva segredo do projeto no corpo da resposta.
# O caso real (supabase/functions/migrate-helper, removido na etapa 003) montava
# a resposta com JSON.stringify({ ... Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") })
# com o segredo em outra linha; por isso o guard acompanha o bloco de argumentos
# aberto por JSON.stringify( / new Response( / body: em vez de olhar so a linha.
#
# Uso: bash scripts/check-no-secret-echo.sh
# Saida: 0 sem achado; 1 com ::error:: listando arquivo:linha:trecho.
set -u

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ALVO="$RAIZ/supabase/functions"

if [ ! -d "$ALVO" ]; then
  echo "::error::supabase/functions nao encontrada em $RAIZ -- guard nao pode ser executado"
  exit 1
fi

CONSTRUCAO='JSON[.]stringify[(]|new Response[(]|body:'
SEGREDO='SERVICE_ROLE_KEY|SUPABASE_DB_URL|SUPABASE_JWT_SECRET'
# Limite de linhas dentro de um bloco de resposta: evita que uma linha sem
# fechamento transforme o arquivo inteiro em falso positivo.
LIMITE=40

ARQUIVOS="$(find "$ALVO" -name '*.ts' -not -path '*/__tests__/*' -not -name '*.test.ts' | sort || true)"
TOTAL="$(printf '%s\n' "$ARQUIVOS" | grep -c . || true)"

if [ "$TOTAL" -eq 0 ]; then
  echo "::error::nenhum arquivo .ts encontrado em supabase/functions -- guard nao pode ser executado"
  exit 1
fi

VIOLACOES=""
while IFS= read -r arq; do
  [ -n "$arq" ] || continue
  ACHADO="$(awk -v alvo="${arq#$RAIZ/}" -v segredo="$SEGREDO" -v construcao="$CONSTRUCAO" -v limite="$LIMITE" '
    function profundidade(s,   i, c, d) {
      d = 0
      for (i = 1; i <= length(s); i++) {
        c = substr(s, i, 1)
        if (c == "(") d++
        else if (c == ")") d--
      }
      return d
    }
    {
      linha = $0
      if (ctx > 0) {
        if (linha ~ segredo) printf "%s:%d: %s\n", alvo, NR, linha
        ctx += profundidade(linha)
        if (ctx <= 0 || NR - inicio > limite) ctx = 0
        next
      }
      if (linha ~ construcao) {
        inicio = NR
        ctx = profundidade(linha)
        if (ctx <= 0) ctx = 0
        if (linha ~ segredo) printf "%s:%d: %s\n", alvo, NR, linha
      }
    }
  ' "$arq")"
  if [ -n "$ACHADO" ]; then
    VIOLACOES="$VIOLACOES$ACHADO
"
  fi
done <<< "$ARQUIVOS"

if [ -n "$VIOLACOES" ]; then
  echo "::error::edge function monta resposta com segredo do projeto:"
  printf '%s' "$VIOLACOES"
  echo "::error::remova o campo da resposta. Ler a chave dentro de createClient continua permitido."
  exit 1
fi

echo "OK: nenhuma das $TOTAL funcoes devolve SERVICE_ROLE_KEY, SUPABASE_DB_URL ou SUPABASE_JWT_SECRET no corpo da resposta."