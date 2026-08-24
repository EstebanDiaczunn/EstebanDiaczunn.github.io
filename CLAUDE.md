# diaczun.com

Sitio personal de Esteban Nicolás Diaczun: **Libreta** (notas), **Cosas** (lo que terminó: Las Máscaras…),
**Visto** (películas, automático desde Letterboxd `evilnaiki`) y **Colofón** (cómo está hecho y cuánta IA hay).
Tono: honesto y sin pose. Esteban no se considera escritor; nada se llama "obra" ni "libro" en el sitio, y se dice
explícitamente que casi todo se hizo con IA.
Estático, sin framework. Markdown → HTML con `build.js` (Node + marked + gray-matter). Se publica en
GitHub Pages desde el repo `EstebanDiaczunn/EstebanDiaczunn.github.io` con dominio `diaczun.com`.
Los demás repos con Pages (p. ej. `las-mascaras`) quedan servidos debajo: `diaczun.com/las-mascaras/`.

## Dónde va cada cosa

- `contenido/notas/AAAA-MM-DD-slug.md` — una nota de la libreta. Frontmatter: `titulo`, `fecha`,
  `tema` (opcional), `resumen` (opcional), `borrador: true` (no se publica).
- `contenido/cosas/slug.md` — una cosa terminada. Frontmatter: `orden`, `titulo`, `subtitulo`, `tipo`, `anio`,
  `url`, `accion`, `portada`, `alt`, `enlaces: [{texto,url}]`. El cuerpo es la reseña.
- `contenido/inicio.md` — portada (`titulo`, `descripcion`, y los textos de cabecera `libreta`, `cosas`, `visto`).
- `contenido/colofon.md` — el colofón.
- `datos/letterboxd.json` — caché del RSS de Letterboxd; se regenera en cada build con red (`--offline` para no tocarla).
- `.env` (no versionado) — `CF_TOKEN` de Cloudflare con permisos de DNS + Email Routing sobre diaczun.com.
- `src/style.css` — estilos (papel claro / tinta oscura según el sistema). Se copia a `style.css`.
- `assets/` — imágenes, favicon.

Generado (no editar a mano): `index.html`, `libreta/`, `cosas/`, `visto/`, `colofon/`, `feed.xml`, `404.html`, `style.css`.

## Flujo

```
./nota.sh "Título"        # crea contenido/notas/HOY-titulo.md
node build.js             # regenera
npm run dev               # vista previa en http://localhost:8787
./publicar.sh "mensaje"   # build + commit + push → GitHub Pages
```

## Reglas

- Español rioplatense en la libreta; las obras respetan su propia voz.
- Una nota puede tener tres líneas. No hay mínimo. No se fuerza un cierre.
- No agregar analítica, comentarios ni fotos. El único JS es el botón de tema.
- Nada de salud (`faro`), dirección ni teléfono. Steam/Letterboxd son públicos y se pueden sacar borrando una línea.
- Pendiente: `cv.diaczun.com` desde un solo `cv.md` → página + PDF; después apagar Pages de `cv-land`.
- Las URLs de las notas (`/libreta/slug/`) no se cambian una vez publicadas.
