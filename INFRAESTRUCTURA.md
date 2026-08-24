# Infraestructura de diaczun.com

*Cómo está armado y dónde tocar si algo se rompe. Actualizado el 23/08/2026.*

## Piezas

| Pieza | Dónde | Detalle |
|---|---|---|
| Dominio | Cloudflare Registrar | `diaczun.com`, comprado el 23/08/2026, 10,46 USD/año, **auto-renovación activada**. Vence/renueva cada 23 de agosto. Titular: Esteban Nicolás Diaczun, estebandiaczun@gmail.com. |
| DNS | Cloudflare (zona `diaczun.com`) | 4 registros `A` en `@` → `185.199.108.153`, `.109.153`, `.110.153`, `.111.153`; `CNAME www` → `estebandiaczunn.github.io`. **Todos en "DNS only" (nube gris)**, sin proxy, para que GitHub emita el certificado. |
| Hosting | GitHub Pages | Repo `EstebanDiaczunn/EstebanDiaczunn.github.io`, rama `main`, raíz. Archivo `CNAME` con `diaczun.com`. Gratis. |
| Código | `proyectos/diaczun` | Generador propio `build.js` (Node + marked + gray-matter). Ver `CLAUDE.md`. |
| HTTPS | GitHub Pages (Let's Encrypt) | Automático una vez que el DNS apunta bien. "Enforce HTTPS" activado desde la API. |

## Subdominios

| Subdominio | Repo | DNS |
|---|---|---|
| `cv.diaczun.com` | `EstebanDiaczunn/cv` (`CNAME cv.diaczun.com`) | `CNAME cv → estebandiaczunn.github.io` (DNS only) |
| `www.diaczun.com` | redirige a `diaczun.com` | `CNAME www → estebandiaczunn.github.io` |

Para otro subdominio: repo con archivo `CNAME`, Pages activado, y un `CNAME` en Cloudflare igual al de `cv`.

## Efecto sobre los otros sitios

Al ser un *user site* con dominio propio, **todos los repos con Pages del usuario cuelgan del dominio**:
`estebandiaczunn.github.io/las-mascaras/` → redirige (301) a `diaczun.com/las-mascaras/`. Los links viejos
(Reddit, Substack) siguen funcionando. Un libro nuevo con Pages en su repo aparece solo en `diaczun.com/<repo>/`.

## Mail — esteban@diaczun.com

Cloudflare Email Routing (gratis): regla `esteban@diaczun.com` → `estebandiaczun@gmail.com` (destino verificado).
Registros: `MX route1/2/3.mx.cloudflare.net` (10/20/30), `TXT v=spf1 include:_spf.mx.cloudflare.net include:_spf.google.com ~all` (Google incluido para "Enviar como" desde Gmail),
`TXT _dmarc "v=DMARC1; p=none"`. Solo recibe; para **enviar** como esteban@ hay que configurar en Gmail
"Enviar como" con SMTP de Gmail (Configuración → Cuentas → Enviar como), o usar el propio Gmail.

## Token de Cloudflare

En `proyectos/diaczun/.env` (`CF_TOKEN`, no versionado): permisos DNS Edit + Email Routing Rules Edit + Email Routing
Addresses Edit, solo zona `diaczun.com`. Creado el 24/08/2026 desde la cuenta de Esteban. Para cambiar DNS:

```bash
set -a; . ./.env; set +a; ./dns-cloudflare.sh
```

También existe el `CF_API_TOKEN` de Clara en la VPS (`/opt/clara-ai/.env`, DNS sobre `clara.net.ar` y `diaczun.com`).

(El script crea los registros; si ya existen, Cloudflare devuelve error 81058 y no pasa nada.)

## Si algo se rompe

- **El sitio no carga**: `gh api repos/EstebanDiaczunn/EstebanDiaczunn.github.io/pages/health` dice qué ve GitHub.
- **Sin HTTPS**: `gh api repos/EstebanDiaczunn/EstebanDiaczunn.github.io/pages --jq .https_certificate`. Si está en `null`
  mucho tiempo, quitar y volver a poner el dominio: `gh api -X PUT .../pages --input <(echo '{"cname":null}')` y luego
  `gh api -X PUT .../pages -f cname=diaczun.com`.
- **Dominio vencido**: Cloudflare → Domain Registration → Manage → Renew. Hay ~30 días de gracia después del vencimiento.
- **Mover a la VPS** (si algún día se quiere): es una carpeta estática; alcanza con copiar el repo a un `root` de nginx
  y agregar un `server` para `diaczun.com` en `clara-nginx`. Hoy no vale la pena: 80/443 los usa Clara en producción.

## Costos

Dominio ~10,46 USD/año. Todo lo demás, 0.
