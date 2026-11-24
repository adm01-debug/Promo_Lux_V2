#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# check-schema-replay-drift.sh
#
# Guarda de schema: compara o banco alvo com o resultado do replay limpo das
# migrations e falha quando o repositorio declara um objeto que NAO existe no
# banco.
#
# Motivo de existir: `check-migration-drift.sh` compara HISTORICO (versao no
# repo x versao em `supabase_migrations.schema_migrations`). Historico igual
# nao prova efeito: a migration pode estar registrada como aplicada e o DDL
# nao ter chegado ao banco. Foi exatamente o caso das duas migrations de
# `companies` (20260718140000 e 20260721164832), que ficaram meses registradas
# sem efeito enquanto todo o CI passava verde.
#
# Este script compara ESTADO, nao historico: o CLI monta um banco sombra
# aplicando `supabase/migrations/` do zero e o diferencia do banco alvo.
#   * statement que CRIA algo  -> o repo declara, o banco alvo nao tem -> drift
#                                 perigoso (um rebuild do banco perde o objeto).
#   * statement que REMOVE    -> o banco alvo tem alem do repo (objetos de
#                                 ferramenta/infra aplicados fora do
#                                 versionamento, ex: mcp_exec, v_*_audit).
#                                 Aviso, nao falha: nao some no rebuild.
#
# Variaveis:
#   STRICT (opcional) - "1" (padrao) falha o job; "0" so avisa.
#
# Encaixe: no job `plan` (PR) roda com STRICT=0 porque o alvo do PR e outro
# ambiente e pode estar atras de proposito. No job `apply`, depois do push,
# roda estrito: e ali que a promessa das migrations tem de valer.
#
# Falha de ferramenta (CLI/docker/rede) NAO derruba o job: sem diff nao ha
# veredito, e bloquear migration por causa de infra de CI seria pior que nao
# verificar. Nesse caso emite ::warning:: e sai 0.
# ---------------------------------------------------------------------------
set -uo pipefail

STRICT="${STRICT:-1}"
LIMITE_LINHAS=25

if [ -z "${SUPABASE_ACCESS_TOKEN:-}" ] || [ -z "${SUPABASE_PROJECT_REF:-}" ]; then
  echo "::warning::check-schema-replay-drift: credenciais ausentes, guarda pulada."
  exit 0
fi

SAIDA="$(supabase db diff --from linked --to migrations --schema public 2>&1)"
RC=$?

if [ "$RC" -ne 0 ]; then
  # Erro de uso do CLI (flag inexistente nesta versao) e bug de configuracao
  # deste script, nao instabilidade de infra: tem de aparecer, senao a guarda
  # fica silenciosamente desligada para sempre.
  if printf '%s\n' "$SAIDA" | grep -Eqi 'unknown flag|unknown command|invalid argument|incorrect usage|flag provided but not defined'; then
    echo "::error::check-schema-replay-drift: o CLI rejeitou os argumentos de 'db diff' (rc=$RC). A guarda nao esta funcionando."
    printf '%s\n' "$SAIDA" | head -20
    exit 1
  fi
  echo "::warning::check-schema-replay-drift: 'supabase db diff --from linked --to migrations' falhou (rc=$RC); sem veredito de schema."
  printf '%s\n' "$SAIDA" | tail -20
  exit 0
fi

# Statements que o banco alvo precisa receber para ficar igual ao replay.
FALTA="$(printf '%s\n' "$SAIDA" | grep -Ei '^[[:space:]]*(create[[:space:](]|create[[:space:]]+(or[[:space:]]+replace[[:space:]]+)?(table|index|unique|view|materialized|function|procedure|type|trigger|policy|sequence|domain|extension)[[:space:]]|alter[[:space:]]+table[^;]*[[:space:]]add[[:space:]]+(column|constraint))' | grep -vi '^[[:space:]]*--' || true)"

# Statements que o banco alvo precisa perder para ficar igual ao replay.
EXTRA="$(printf '%s\n' "$SAIDA" | grep -Ei '^[[:space:]]*(drop[[:space:]]|alter[[:space:]]+table[^;]*[[:space:]]drop[[:space:]])' | grep -vi '^[[:space:]]*--' || true)"

if [ -n "$EXTRA" ]; then
  echo "::warning::O banco alvo tem objetos que nao existem no repositorio (nao somem no rebuild, apenas aviso):"
  printf '%s\n' "$EXTRA" | head -"$LIMITE_LINHAS" | sed 's/^/  /'
  echo ""
fi

if [ -z "$FALTA" ]; then
  echo "OK: o banco alvo tem tudo que as migrations declaram (schema public)."
  exit 0
fi

TOTAL="$(printf '%s\n' "$FALTA" | wc -l | tr -d ' ')"
echo "::error::Drift de schema: $TOTAL objeto(s) que as migrations declaram NAO existem no banco alvo."
printf '%s\n' "$FALTA" | head -"$LIMITE_LINHAS" | sed 's/^/  /'
echo ""
echo "Replay limpo (todas as migrations, banco vazio) produz esses objetos; o banco alvo"
echo "nao. Ou a migration esta registrada como aplicada sem efeito, ou alguem removeu o"
echo "objeto depois. Um rebuild do banco a partir do repositorio recria o objeto e o"
echo "banco atual nao: as duas bases ficam diferentes. Corrigir antes de seguir."

if [ "$STRICT" = "1" ]; then
  exit 1
fi
echo "::warning::STRICT=0 - apenas avisando."