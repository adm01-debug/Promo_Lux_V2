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
#   * statement que CRIA ESTRUTURA (create table/index/view/type/policy/trigger,
#     alter table add column) -> o repo declara o objeto e o banco alvo nao tem:
#     drift perigoso (um rebuild do banco perde o objeto).
#   * `create or replace X`   -> o diff emite essa forma tambem quando o objeto
#                                 EXISTE e a definicao difere (corpo de funcao,
#                                 metadados). Nao prova ausencia: aviso, nao falha.
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

# Statements que provam AUSENCIA de estrutura no banco alvo. `create or replace`
# fica de fora de proposito: o diff tambem emite essa forma quando o objeto
# existe e a definicao difere, entao ela nao prova que o objeto falta.
FALTA="$(printf '%s\n' "$SAIDA" | grep -Ei '^[[:space:]]*(create[[:space:]]+(table|index|unique|view|materialized|type|domain|sequence|policy|trigger|extension)[[:space:](]|alter[[:space:]]+table[^;]*[[:space:]]add[[:space:]]+(column|constraint))' | grep -vi '^[[:space:]]*--' || true)"

# Objetos que existem nos dois lados com definicao diferente (corpo de funcao ou
# metadados). Nao prova ausencia: entra como aviso com a contagem.
DIFERENTES="$(printf '%s\n' "$SAIDA" | grep -Ei '^[[:space:]]*create[[:space:]]+or[[:space:]]+replace[[:space:]]' | grep -vi '^[[:space:]]*--' || true)"

# Statements que o banco alvo precisa perder para ficar igual ao replay.
EXTRA="$(printf '%s\n' "$SAIDA" | grep -Ei '^[[:space:]]*(drop[[:space:]]|alter[[:space:]]+table[^;]*[[:space:]]drop[[:space:]])' | grep -vi '^[[:space:]]*--' || true)"

if [ -n "$EXTRA" ]; then
  echo "::warning::O banco alvo tem objetos que nao existem no repositorio (nao somem no rebuild, apenas aviso):"
  printf '%s\n' "$EXTRA" | head -"$LIMITE_LINHAS" | sed 's/^/  /'
  echo ""
fi

if [ -n "$DIFERENTES" ]; then
  TOTAL_DIF="$(printf '%s\n' "$DIFERENTES" | wc -l | tr -d ' ')"
  echo "::warning::O repositorio e o banco alvo divergem em $TOTAL_DIF objeto(s) que existem nos dois lados com definicao diferente (corpo de funcao/metadados). Nao bloqueia: o diff nao prova ausencia."
  printf '%s\n' "$DIFERENTES" | head -"$LIMITE_LINHAS" | sed 's/^/  /'
  echo ""
fi

# ---------------------------------------------------------------------------
# Baseline de drift conhecido.
#
# O diff nao prova ausencia: ele emite CREATE tambem para objeto que EXISTE no
# alvo com definicao diferente (view e policy nao tem forma "create or replace")
# e para objeto que nasceu fora do versionamento (`mcp_exec`, `v_*_audit`).
# Sem baseline esses objetos derrubam todo run de producao com falso positivo,
# e guarda sempre vermelha deixa de ser guarda, porque ninguem le o aviso.
#
# `schema-drift-baseline.txt` lista o drift conhecido e aceito, um objeto por
# linha na forma "<tipo> <nome>" em minusculas. O guard continua falhando para
# todo objeto NOVO. Tirar uma linha do baseline so depois que o objeto existir
# no banco exatamente como o replay das migrations o cria.
# ---------------------------------------------------------------------------
BASELINE_ARQUIVO="${BASELINE_ARQUIVO:-$(dirname "$0")/schema-drift-baseline.txt}"

# Reduz um statement a "<tipo> <nome>" para comparar com o baseline sem
# depender da definicao (que muda com o tempo e nao diz se o objeto existe).
chave_objeto() {
  printf '%s' "$1" \
    | sed -E 's/[[:space:]]+/ /g; s/^ //; s/ $//' \
    | sed -E 's/[[:space:]]+(ON|AS|USING|IN[[:space:]]+SCHEMA|WITH)[[:space:]].*$//' \
    | sed -E 's/[[:space:]]*[(].*$//' \
    | tr '[:upper:]' '[:lower:]'
}

declare -A BASELINE=()
TEM_BASELINE=0
if [ -f "$BASELINE_ARQUIVO" ]; then
  while IFS= read -r linha_base || [ -n "$linha_base" ]; do
    case "$linha_base" in ''|\#*) continue ;; esac
    BASELINE["$linha_base"]=1
    TEM_BASELINE=1
  done < "$BASELINE_ARQUIVO"
else
  echo "::warning::baseline de drift ausente ($BASELINE_ARQUIVO): todo objeto declarado tem de existir no alvo."
fi

declare -A VISTOS=()
NOVOS=""
CONHECIDOS=0
while IFS= read -r linha_falta || [ -n "$linha_falta" ]; do
  [ -z "$linha_falta" ] && continue
  chave="$(chave_objeto "$linha_falta")"
  VISTOS["$chave"]=1
  if [ -n "${BASELINE[$chave]:-}" ]; then
    CONHECIDOS=$((CONHECIDOS + 1))
  else
    NOVOS="${NOVOS}${linha_falta}"$'\n'
  fi
done <<< "$FALTA"

# Baseline que envelheceu: o objeto deixou de faltar, a linha tem de sair.
if [ "$TEM_BASELINE" = "1" ]; then
  for chave_base in "${!BASELINE[@]}"; do
    if [ -z "${VISTOS[$chave_base]:-}" ]; then
      echo "::warning::Baseline obsoleto: '$chave_base' nao falta mais no alvo. Remover a linha de $(basename "$BASELINE_ARQUIVO")."
    fi
  done
fi

if [ "$CONHECIDOS" -gt 0 ]; then
  TOTAL_DIFF="$(printf '%s\n' "$FALTA" | wc -l | tr -d ' ')"
  echo "::warning::Drift conhecido e aceito ($(basename "$BASELINE_ARQUIVO")): $CONHECIDOS de $TOTAL_DIFF objeto(s) do diff. Cada linha do arquivo tem a justificativa conferida no catalogo do alvo."
  echo ""
fi

if [ -z "$NOVOS" ]; then
  echo "OK: o alvo tem tudo que as migrations declaram, fora do drift conhecido em $(basename "$BASELINE_ARQUIVO")."
  exit 0
fi

TOTAL="$(printf '%s' "$NOVOS" | wc -l | tr -d ' ')"
echo "::error::Drift de schema NOVO: $TOTAL objeto(s) de estrutura que as migrations declaram e NAO existem no banco alvo, fora do baseline."
printf '%s' "$NOVOS" | head -"$LIMITE_LINHAS" | sed 's/^/  /'
echo ""
echo "Replay limpo (todas as migrations, banco vazio) produz esses objetos de estrutura; o banco alvo"
echo "nao. Ou a migration esta registrada como aplicada sem efeito, ou alguem removeu o"
echo "objeto depois. Um rebuild do banco a partir do repositorio recria o objeto e o"
echo "banco atual nao: as duas bases ficam diferentes. Corrigir antes de seguir."
echo ""
echo "Antes de acrescentar qualquer linha ao baseline, confirme no catalogo do alvo que o"
echo "objeto ja existe com outro nome ou outra definicao: o baseline existe para divida de"
echo "nomenclatura comprovada, nunca para calar ausencia real."

if [ "$STRICT" = "1" ]; then
  exit 1
fi
echo "::warning::STRICT=0 - apenas avisando."