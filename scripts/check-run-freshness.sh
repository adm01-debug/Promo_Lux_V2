#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# check-run-freshness.sh
#
# Guarda de corrida: diz ao job `apply` se este run ainda e o run da main.
#
# Motivo de existir: o grupo de concorrencia do workflow e serial
# (`cancel-in-progress: false`), correto para nao interromper um push no meio.
# O efeito colateral e que um run de um commit ANTIGO fica na fila (as vezes
# parado na aprovacao do environment) e so roda depois que a main ja avancou.
# Ao rodar, ele carrega um `supabase/migrations/` desatualizado, ve as versoes
# mais novas no historico remoto e aborta com
#   "Remote migration versions not found in local migrations directory"
# deixando a main com um X vermelho que nao e drift nenhum: quem aplicou foi o
# run mais novo. Foi o que aconteceu com o run 45361330244 (sha 588525f4) logo
# depois do merge da PR #172.
#
# O que fazer no lugar errado (NAO e o que este script faz): jamais rodar
# `supabase migration repair --status reverted` nesse caso, porque isso marca
# como nao aplicada uma migration que ESTA aplicada.
#
# Saida: escreve `aplicar=true|false` no $GITHUB_OUTPUT. Os steps que tocam o
# banco alvo usam `if: steps.<id>.outputs.aplicar == 'true'`.
#
# Fail-open: se o `git fetch` falhar (rede), seguimos com `aplicar=true`. Um
# hiccup de rede nao pode liberar nem bloquear migration.
# ---------------------------------------------------------------------------
set -uo pipefail

APLICAR="true"
BRANCO="${GITHUB_REF_NAME:-main}"
SHA="${GITHUB_SHA:-}"

if [ -z "$SHA" ]; then
  echo "Sem GITHUB_SHA (execucao local?): seguindo."
else
  if git fetch --quiet --depth=1 origin "$BRANCO" 2>/dev/null; then
    ATUAL="$(git rev-parse FETCH_HEAD 2>/dev/null)"
    if [ -n "$ATUAL" ] && [ "$ATUAL" != "$SHA" ]; then
      APLICAR="false"
      echo "::notice::Run superado: main esta em ${ATUAL:0:8} e este run partiu de ${SHA:0:8}. Nada a aplicar aqui - o run do commit mais novo e quem aplica."
    else
      echo "Run em dia: ${SHA:0:8} e o topo de $BRANCO."
    fi
  else
    echo "::warning::check-run-freshness: nao consegui ler origin/$BRANCO; seguindo sem a guarda de corrida."
  fi
fi

if [ -n "${GITHUB_OUTPUT:-}" ]; then
  printf 'aplicar=%s\n' "$APLICAR" >> "$GITHUB_OUTPUT"
else
  printf 'aplicar=%s\n' "$APLICAR"
fi