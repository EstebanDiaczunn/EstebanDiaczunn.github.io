#!/usr/bin/env bash
# Crea una nota nueva con la fecha de hoy. Uso: ./nota.sh "Título de la nota"
set -euo pipefail
cd "$(dirname "$0")"
[ $# -ge 1 ] || { echo "Uso: ./nota.sh \"Título\""; exit 1; }
titulo="$1"
slug=$(printf '%s' "$titulo" | iconv -f utf8 -t ascii//TRANSLIT 2>/dev/null | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9]+/-/g; s/^-|-$//g')
hoy=$(date +%F)
f="contenido/notas/$hoy-$slug.md"
[ -e "$f" ] && { echo "Ya existe: $f"; exit 1; }
printf -- '---\ntitulo: %s\nfecha: %s\ntema: \n---\n\n' "$titulo" "$hoy" > "$f"
echo "$f"
