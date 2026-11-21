#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# check-migration-drift.sh
#
# Guarda de drift entre o repositorio e o banco alvo. Com o projeto ja linkado.
#
# Motivo de existir: o job `shadow` faz replay das migrations num banco
# efemero e depois compara o resultado com... as proprias migrations
# (`supabase db diff --local`). Isso e tautologico: prova que as migrations
# sao internamente coerentes, nunca que elas chegaram ao banco de verdade.
#
# Consequencia real: duas migrations de correcao de `companies`
# (20260718140000 e 20260721164832) ficaram meses sem aplicar em producao
# enquanto todo CI passava verde. O banco continuou com o indice global
# `UNIQUE(name, source)` sem escopo de tenant, deixando o takeover
# cross-tenant aberto, e com o UNIQUE parcial de place_id, que o PostgREST
# nao consegue usar em `ON CONFLICT` (`42P10`).
#
# Este script le `supabase migration list --linked` e falha quando existir
# migration no repo que nao esta registrada no banco alvo. E o mesmo teste que
# `supabase db push --dry-run` faz, mas exposto como assercao: o `push` pode
# sair 0 sem aplicar (foi o que aconteceu), a assercao nao.
#
# Falso positivo conhecido: migration aplicada a mao pelo SQL Editor do
# dashboard nao entra em `schema_migrations`, entao aparece como pendente aqui
# mesmo com o DDL ja no banco. Nesse caso o fix e `supabase migration repair
# --status applied <timestamp>`, nao reescrever a migration.
#
# Variaveis:
#   STRICT (opcional) - "1" (padrao) falha o job; "0" so avisa.
#
# Encaixe: no job `plan` roda com STRICT=0 (aviso), porque em PR o alvo e
# staging e la migration legitima pode estar pendente — bloquear tornaria todo
# PR vermelho. No job `apply` roda estrito, depois do `db push`: e ali que o
# drift real se prova, e e ali que ele ja passou verde sem aplicar.
# ---------------------------------------------------------------------------
set -uo pipefail

STRICT="${STRICT:-1}"

if [ -z "${SUPABASE_ACCESS_TOKEN:-}" ] || [ -z "${SUPABASE_PROJECT_REF:-}" ]; then
  echo "::warning::check-migration-drift: credenciais ausentes, guarda pulada."
  exit 0
fi

LIST="$(supabase migration list --linked 2>&1)" || {
  echo "::error::check-migration-drift: falha ao ler o estado de migrations do banco alvo."
  echo "$LIST"
  exit 1
}

# Formato: "  LOCAL       REMOTE      TIME (UTC)" seguido de linhas
# "<timestamp>  <timestamp>  <data>". Uma migration ainda nao aplicada tem a
# coluna REMOTE vazia — detectada pela ausencia do timestamp repetido.
# Comparacao por token, nao por coluna: o awk colapsa espacos multiplos, entao
# $2 seria o TIME quando REMOTE estiver vazio.
PENDENTES="$(printf '%s\n' "$LIST" | awk '
  /^[[:space:]]*[0-9]{14}[[:space:]]/ {
    ts = $1; n = 0;
    for (i = 1; i <= NF; i++) if ($i == ts) n++;
    if (n < 2) print ts;
  }
')"

# O `migration list` so lista arquivos que o CLI reconhece pelo nome. Um .sql
# com timestamp fora do padrao fica invisivel para ele — e para o `db push`
# tambem, ou seja nunca seria aplicado. Esse tambem e drift, entao falha.
# Raiz do repo: prefere o toplevel do git (funciona com qualquer cwd e tambem
# para script chamado por caminho absoluto); cai para o pai de `scripts/`.
RAIZ="$(git rev-parse --show-toplevel 2>/dev/null)"
[ -n "$RAIZ" ] || RAIZ="$(cd "$(dirname "$0")/.." 2>/dev/null && pwd)"
ARQUIVOS="$(ls -1 "$RAIZ"/supabase/migrations/*.sql 2>/dev/null | sed 's#.*/##')"
if [ -z "$ARQUIVOS" ]; then
  echo "::error::check-migration-drift: nao encontrei supabase/migrations em $RAIZ."
  exit 1
fi
FORA_PADRAO=0
for arq in $ARQUIVOS; do
  ts="${arq%%_*}"
  case "$ts" in
    ''|*[!0-9]*) echo "::error::Migration com nome fora do padrao <timestamp>_<slug>.sql: $arq"; FORA_PADRAO=1 ;;
    *) printf '%s\n' "$LIST" | grep -q "$ts" || PENDENTES="$PENDENTES $ts" ;;
  esac
done

if [ -n "$PENDENTES" ]; then
  echo "::error::Drift: migrations no repositorio que NAO estao aplicadas no banco alvo:"
  printf '  - %s\n' $PENDENTES
  echo ""
  echo "O schema do banco esta atras do codigo. Aplicar antes de qualquer outra mudanca."
  if [ "$STRICT" = "1" ]; then
    exit 1
  fi
  echo "::warning::STRICT=0 - apenas avisando."
  exit 0
fi

if [ "$FORA_PADRAO" = "1" ]; then
  echo "::error::Existem migrations com nome invalido (ver acima): o Supabase CLI as ignora, entao nunca serao aplicadas."
  if [ "$STRICT" = "1" ]; then
    exit 1
  fi
fi

echo "OK: nenhuma migration pendente no banco alvo."
