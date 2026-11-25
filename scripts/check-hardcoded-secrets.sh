#!/usr/bin/env bash
# Etapa 005 do docs/qa/04-PLANO.md (achado G13-2).
#
# Varredura de segredos hardcoded do CI. Substitui o bloco inline do job
# security-scan, que cobria apenas AKIA... e sk_live_... e so olhava src/ e
# supabase/functions/ (foi por isso que a chave de migrate-helper e o JWT de
# e2e/helpers/supabase.ts passaram).
#
# Regras, escopo e excecoes ficam aqui e em scripts/secrets-allowlist.txt para
# poderem ser executados localmente e revisados em PR.
#
# Uso: bash scripts/check-hardcoded-secrets.sh
# Saida: 0 sem achado fora da allowlist; 1 com ::error:: listando arquivo:linha.
set -u

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ESCOPO="src supabase e2e scripts .github"
ALLOWLIST="$RAIZ/scripts/secrets-allowlist.txt"
EXCLUSAO_DIR="--exclude-dir=.git --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=coverage --exclude-dir=graphify-out --exclude-dir=__snapshots__ --exclude-dir=.temp"
EXCLUSAO_ARQ="--exclude=package-lock.json --exclude=secrets-allowlist.txt"

REGRAS_NOME="jwt postgres_url sb_secret github_token aws_key stripe_live service_role_literal"
REGRA_jwt='eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}\.'
REGRA_postgres_url='postgres(ql)?://[^ "'":/]+:[^ "':@]{16,}@'
REGRA_sb_secret='sb_secret_[A-Za-z0-9_-]{10,}'
REGRA_github_token='(ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})'
REGRA_aws_key='AKIA[0-9A-Z]{16}'
REGRA_stripe_live='sk_live_[A-Za-z0-9]{20,}'
REGRA_service_role_literal='service_role["'"'"']?[[:space:]]*[:=][[:space:]]*["'"'"']?eyJ'

TOTAL_ACHADOS=0
RELATORIO=""
REGRAS_VAZIAS=""

while IFS= read -r nome; do
  [ -n "$nome" ] || continue
  avaliar="REGRA_$nome"
  padrao="${!avaliar}"
  ACHADOS=""
  for dir in $ESCOPO; do
    [ -d "$RAIZ/$dir" ] || continue
    PARTE="$(grep -rnIE "$padrao" "$RAIZ/$dir" $EXCLUSAO_DIR $EXCLUSAO_ARQ 2>/dev/null || true)"
    [ -n "$PARTE" ] || continue
    ACHADOS="$ACHADOS$(printf '%s\n' "$PARTE" | sed "s|^$RAIZ/||")
"
  done
  ACHADOS="$(printf '%s' "$ACHADOS" | grep -v '^$' || true)"
  [ -n "$ACHADOS" ] || continue

  if [ -f "$ALLOWLIST" ]; then
    while IFS= read -r linha; do
      case "$linha" in ''|\#*) continue ;; esac
      arq_alvo="${linha%%:*}"
      regra_alvo="$(printf '%s' "${linha#*:}" | awk '{print $1}')"
      [ "$regra_alvo" = "$nome" ] || continue
      ACHADOS="$(printf '%s\n' "$ACHADOS" | grep -vF "$arq_alvo:" || true)"
    done < "$ALLOWLIST"
  fi

  ACHADOS="$(printf '%s' "$ACHADOS" | grep -v '^$' || true)"
  [ -n "$ACHADOS" ] || continue
  QTD="$(printf '%s\n' "$ACHADOS" | grep -c . || true)"
  TOTAL_ACHADOS=$((TOTAL_ACHADOS + QTD))
  RELATORIO="$RELATORIO[$nome] $QTD ocorrencia(s)
$ACHADOS
"
done <<< "$(printf '%s\n' $REGRAS_NOME)"

if [ "$TOTAL_ACHADOS" -gt 0 ]; then
  echo "::error::$TOTAL_ACHADOS possivel(is) segredo(s) hardcoded no codigo:"
  printf '%s' "$RELATORIO"
  echo "::error::mova o valor para variavel de ambiente ou segredo do servico. Excecao legitima (fixture de teste) vai em scripts/secrets-allowlist.txt com motivo."
  exit 1
fi

echo "OK: nenhum segredo hardcoded nas regras [$REGRAS_NOME] dentro de: $ESCOPO."