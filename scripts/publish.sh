#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Uso: web-portal/scripts/publish.sh [remoto-o-url]
Publica el historial de web-portal/ en la rama main del repositorio público.
Ejecuta el comando desde la raíz del repositorio principal con el árbol limpio.
Destino predeterminado: https://github.com/SamuelCharry/enad-web.git
USAGE
}

if [[ ${1:-} == --help || ${1:-} == -h ]]; then
  usage
  exit 0
fi
if [[ $# -gt 1 || ${1:-} == -* ]]; then
  usage >&2
  exit 2
fi

root=$(git rev-parse --show-toplevel 2>/dev/null) || root=''
if [[ $(pwd -P) != "$root" || ! -f web-portal/scripts/publish.sh ]]; then
  echo 'Ejecuta este script desde la raíz del repositorio principal.' >&2
  exit 1
fi
status=$(git status --porcelain --untracked-files=all)
if [[ -n "$status" ]]; then
  echo 'Hay cambios pendientes. Confirma o guarda los cambios antes de publicar.' >&2
  exit 1
fi

remote=${1:-https://github.com/SamuelCharry/enad-web.git}
# Una URL directa puede carecer de una rama de seguimiento local.
# Si main cambia durante la preparación, la publicación se detiene.
remote_ref=$(git ls-remote --heads "$remote" refs/heads/main)
expected=${remote_ref%%[[:space:]]*}
git subtree split --prefix web-portal -b enad-web-publish
git push --force-with-lease="refs/heads/main:$expected" "$remote" enad-web-publish:main
