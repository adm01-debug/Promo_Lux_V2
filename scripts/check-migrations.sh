#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# check-migrations.sh
#
# Lint estático de supabase/migrations/. Não toca em banco nenhum, não precisa
# de credencial. Roda em qualquer máquina e no CI.
#
# Regras verificadas:
#   1. Nome no formato <timestamp 14 dígitos>_<slug>.sql
#   2. Sem timestamps duplicados (duas migrations no mesmo instante quebram a
#      ordenação determinística que o CLI usa).
#   3. Arquivo não vazio.
#   4. Sem statements proibidos (ALTER DATABASE, alterações em schemas
#      gerenciados pelo Supabase).
#   5. Todo CREATE TABLE em public tem GRANT + ENABLE ROW LEVEL SECURITY na
#      mesma migration.
# ---------------------------------------------------------------------------
set -uo pipefail

DIR="supabase/migrations"
ERRORS=0
WARNINGS=0

# Baseline de grandfathering. Migrations com timestamp ANTERIOR a este valor
# foram escritas antes deste lint existir; suas tabelas já receberam GRANT/RLS
# em migrations posteriores, e reescrever histórico já aplicado é pior que o
# problema. Para elas, as regras de GRANT/RLS viram aviso, não erro.
# Migrations NOVAS (timestamp >= baseline) são validadas de forma estrita.
BASELINE="${MIGRATIONS_BASELINE:-20260727000000}"

fail() {
  echo "::error::$1"
  ERRORS=$((ERRORS + 1))
}

warn() {
  echo "::warning::$1"
  WARNINGS=$((WARNINGS + 1))
}

# Erro para migrations novas, aviso para as anteriores ao baseline.
fail_if_new() {
  local ts="$1" msg="$2"
  if [ "$ts" \> "$BASELINE" ] || [ "$ts" = "$BASELINE" ]; then
    fail "$msg"
  else
    warn "[legado] $msg"
  fi
}


if [ ! -d "$DIR" ]; then
  echo "Diretório $DIR não existe — nada a validar."
  exit 0
fi

shopt -s nullglob
FILES=("$DIR"/*.sql)
shopt -u nullglob

if [ ${#FILES[@]} -eq 0 ]; then
  echo "Nenhuma migration encontrada."
  exit 0
fi

echo "▶ Validando ${#FILES[@]} migrations em $DIR"

# --- 1 e 3: formato do nome e arquivo não vazio -----------------------------
for f in "${FILES[@]}"; do
  base=$(basename "$f")
  if ! [[ "$base" =~ ^[0-9]{14}_[A-Za-z0-9._-]+\.sql$ ]]; then
    fail "Nome inválido: $base (esperado <14 dígitos>_<slug>.sql — use 'supabase migration new <slug>')"
  fi
  if [ ! -s "$f" ]; then
    fail "Migration vazia: $base"
  fi
done

# --- 2: timestamps duplicados ----------------------------------------------
DUPES=$(for f in "${FILES[@]}"; do basename "$f" | cut -c1-14; done | sort | uniq -d)
if [ -n "$DUPES" ]; then
  while read -r ts; do
    [ -z "$ts" ] && continue
    fail "Timestamp duplicado: $ts"
  done <<< "$DUPES"
fi

# --- 4: statements proibidos ------------------------------------------------
for f in "${FILES[@]}"; do
  base=$(basename "$f")
  if grep -qiE '^\s*ALTER\s+DATABASE\b' "$f"; then
    fail "$base: ALTER DATABASE não é permitido (rejeitado pelo Supabase)."
  fi
  if grep -qiE '\b(CREATE|ALTER|DROP)\s+(TRIGGER|TABLE|POLICY)\b[^;]*\b(auth|storage|realtime|supabase_functions|vault)\.' "$f"; then
    fail "$base: alteração em schema gerenciado pelo Supabase (auth/storage/realtime/vault)."
  fi
done
# --- 5: CREATE TABLE public exige GRANT + RLS -------------------------------
for f in "${FILES[@]}"; do
  base=$(basename "$f")
  ts=$(echo "$base" | cut -c1-14)
  # Captura o nome de cada tabela criada no schema public nesta migration.
  TABLES=$(grep -ioE 'CREATE\s+TABLE\s+(IF\s+NOT\s+EXISTS\s+)?(public\.)?"?[a-z0-9_]+"?' "$f" \
    | sed -E 's/.*[[:space:]]//; s/public\.//; s/"//g' | sort -u)
  for t in $TABLES; do
    [ -z "$t" ] && continue
    if ! grep -qiE "GRANT[[:space:]].*[[:space:]]ON[[:space:]]+(TABLE[[:space:]]+)?(public\.)?\"?${t}\"?" "$f"; then
      fail_if_new "$ts" "$base: tabela public.${t} criada sem GRANT na mesma migration (PostgREST retornará permission denied)."
    fi
    if ! grep -qiE "ALTER[[:space:]]+TABLE[[:space:]]+(public\.)?\"?${t}\"?[[:space:]].*ENABLE[[:space:]]+ROW[[:space:]]+LEVEL[[:space:]]+SECURITY" "$f"; then
      fail_if_new "$ts" "$base: tabela public.${t} criada sem ENABLE ROW LEVEL SECURITY."
    fi
  done
done

echo "▶ Baseline de grandfathering: $BASELINE (migrations anteriores geram apenas aviso)"

if [ "$ERRORS" -gt 0 ]; then
  echo "::error::$ERRORS problema(s) bloqueante(s) nas migrations ($WARNINGS aviso(s) de legado)."
  exit 1
fi

echo "✅ Migrations válidas ($WARNINGS aviso(s) de legado, não bloqueantes)."

