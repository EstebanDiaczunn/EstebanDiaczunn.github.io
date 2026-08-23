# diaczun.com

Sitio personal de Esteban Diaczun: **Libreta** (notas, pensamientos, fragmentos) y **Obras** (libros).
Estático, sin framework. Markdown → HTML con `build.js` (Node + marked + gray-matter). Se publica en
GitHub Pages desde el repo `EstebanDiaczunn/EstebanDiaczunn.github.io` con dominio `diaczun.com`.
Los demás repos con Pages (p. ej. `las-mascaras`) quedan servidos debajo: `diaczun.com/las-mascaras/`.

## Dónde va cada cosa

- `contenido/notas/AAAA-MM-DD-slug.md` — una nota de la libreta. Frontmatter: `titulo`, `fecha`,
  `tema` (opcional), `resumen` (opcional), `borrador: true` (no se publica).
- `contenido/obras/slug.md` — una obra. Frontmatter: `orden`, `titulo`, `subtitulo`, `genero`, `anio`,
  `url`, `accion`, `portada`, `alt`, `enlaces: [{texto,url}]`. El cuerpo es la reseña.
- `contenido/inicio.md` — texto de la portada (`titulo`, `descripcion`, `libreta` en frontmatter).
- `src/style.css` — estilos (papel claro / tinta oscura según el sistema). Se copia a `style.css`.
- `assets/` — imágenes, favicon.

Generado (no editar a mano): `index.html`, `libreta/`, `obras/`, `feed.xml`, `404.html`, `style.css`.

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
- No agregar analítica, comentarios ni JavaScript salvo que Esteban lo pida.
- Las URLs de las notas (`/libreta/slug/`) no se cambian una vez publicadas.
