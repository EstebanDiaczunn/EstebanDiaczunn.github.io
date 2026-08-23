#!/usr/bin/env bash
# Genera el sitio y lo sube. Uso: ./publicar.sh "mensaje opcional"
set -euo pipefail
cd "$(dirname "$0")"
node build.js
git add -A
if git diff --cached --quiet; then echo "Nada nuevo que publicar."; exit 0; fi
git commit -q -m "${1:-actualización}"
git push -q
echo "✓ Publicado. En 1-2 minutos: https://diaczun.com"
