#!/bin/sh
set -eu
<<<<<<< HEAD
state="$HOME/.cache/repo-maintenance"
=======
state="${XDG_STATE_HOME:-$HOME/.local/state}/repo-maintenance"
>>>>>>> 53636e65 (fix(manutencao): executa autofix staged e preserva trabalho parcial)
mkdir -p "$state"
chmod 700 "$state"
if ! command -v flock >/dev/null 2>&1; then
  printf '%s\n' '{"status":"failed","message":"flock indisponível"}'
  exit 1
fi
<<<<<<< HEAD
exec 9>"$state/fleet.lock"
=======
exec 9>"$state/global.lock"
>>>>>>> 53636e65 (fix(manutencao): executa autofix staged e preserva trabalho parcial)
if ! flock -n 9; then
  printf '%s\n' '{"status":"skipped_busy","message":"Trava global ocupada"}'
  exit 75
fi
exec node "$(dirname "$0")/run.mjs" "$@"
