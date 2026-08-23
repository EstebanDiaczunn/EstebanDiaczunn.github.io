#!/usr/bin/env bash
# Configura el DNS de diaczun.com en Cloudflare apuntando a GitHub Pages.
# Uso: CF_TOKEN=xxx ./dns-cloudflare.sh
set -euo pipefail
: "${CF_TOKEN:?Falta CF_TOKEN}"
API=https://api.cloudflare.com/client/v4
H=(-H "Authorization: Bearer $CF_TOKEN" -H "Content-Type: application/json")

ZONA=$(curl -s "${H[@]}" "$API/zones?name=diaczun.com" | node -pe 'JSON.parse(require("fs").readFileSync(0)).result[0]?.id ?? ""')
[ -n "$ZONA" ] || { echo "No encuentro la zona diaczun.com (¿token sin permiso o dominio aún no activo?)"; exit 1; }
echo "Zona: $ZONA"

crear() { # tipo nombre contenido
  curl -s "${H[@]}" -X POST "$API/zones/$ZONA/dns_records" \
    --data "{\"type\":\"$1\",\"name\":\"$2\",\"content\":\"$3\",\"ttl\":1,\"proxied\":false}" \
    | node -pe 'const r=JSON.parse(require("fs").readFileSync(0)); r.success ? "  ✓ "+r.result.type+" "+r.result.name+" → "+r.result.content : "  ✗ "+JSON.stringify(r.errors)'
}
for ip in 185.199.108.153 185.199.109.153 185.199.110.153 185.199.111.153; do crear A diaczun.com "$ip"; done
crear CNAME www estebandiaczunn.github.io

echo "Registros actuales:"
curl -s "${H[@]}" "$API/zones/$ZONA/dns_records" | node -pe 'JSON.parse(require("fs").readFileSync(0)).result.map(r=>"  "+r.type+" "+r.name+" → "+r.content+(r.proxied?" (proxied)":"")).join("\n")'
