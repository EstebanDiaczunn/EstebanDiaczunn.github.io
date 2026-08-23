#!/usr/bin/env node
// Generador estático de diaczun.com. Sin framework: Markdown → HTML.
// Uso: node build.js   (o: npm run build)
const fs = require("fs");
const path = require("path");
const { marked } = require("marked");
const matter = require("gray-matter");

const RAIZ = __dirname;
const SITIO = "https://diaczun.com";
const AUTOR = "Esteban Diaczun";
const MAIL = "estebandiaczun@gmail.com";
const ANIO = 2026;

marked.setOptions({ gfm: true, breaks: false });

// ---------- utilidades ----------
const leer = (f) => fs.readFileSync(path.join(RAIZ, f), "utf8");
const escribir = (f, s) => {
  const abs = path.join(RAIZ, f);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, s);
};
const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const MESES = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
const fechaLarga = (d) => `${d.getUTCDate()} de ${MESES[d.getUTCMonth()]} de ${d.getUTCFullYear()}`;
const fechaCorta = (d) => `${String(d.getUTCDate()).padStart(2,"0")} ${MESES[d.getUTCMonth()].slice(0,3)}`;
const iso = (d) => d.toISOString().slice(0, 10);
const aFecha = (v) => (v instanceof Date ? v : new Date(String(v).slice(0, 10) + "T12:00:00Z"));
const slugDe = (nombre) => nombre.replace(/\.md$/, "").replace(/^\d{4}-\d{2}-\d{2}-/, "");
const textoPlano = (html) => html.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
const extracto = (html, n = 160) => {
  const t = textoPlano(html);
  return t.length > n ? t.slice(0, n).replace(/\s+\S*$/, "") + "…" : t;
};
const limpiar = (dir) => fs.rmSync(path.join(RAIZ, dir), { recursive: true, force: true });

// ---------- contenido ----------
function cargarNotas() {
  const dir = path.join(RAIZ, "contenido/notas");
  return fs.readdirSync(dir)
    .filter((f) => f.endsWith(".md"))
    .map((f) => {
      const { data, content } = matter(fs.readFileSync(path.join(dir, f), "utf8"));
      const fechaArchivo = f.match(/^(\d{4}-\d{2}-\d{2})/);
      const fecha = aFecha(data.fecha || (fechaArchivo && fechaArchivo[1]));
      if (isNaN(fecha)) throw new Error(`Nota sin fecha válida: ${f}`);
      const html = marked.parse(content);
      const titulo = data.titulo || (content.match(/^#\s+(.+)$/m) || [])[1] || slugDe(f);
      return {
        archivo: f,
        slug: data.slug || slugDe(f),
        titulo,
        fecha,
        tema: data.tema || null,
        resumen: data.resumen || extracto(html),
        borrador: !!data.borrador,
        html,
      };
    })
    .filter((n) => !n.borrador)
    .sort((a, b) => b.fecha - a.fecha || a.slug.localeCompare(b.slug));
}

function cargarObras() {
  const dir = path.join(RAIZ, "contenido/obras");
  return fs.readdirSync(dir)
    .filter((f) => f.endsWith(".md"))
    .map((f) => {
      const { data, content } = matter(fs.readFileSync(path.join(dir, f), "utf8"));
      return { slug: slugDe(f), orden: data.orden ?? 99, ...data, html: marked.parse(content) };
    })
    .sort((a, b) => a.orden - b.orden);
}

// ---------- plantilla ----------
function pagina({ titulo, descripcion, ruta, cuerpo, tipo = "website", imagen, extraHead = "" }) {
  const tituloCompleto = ruta === "/" ? `${AUTOR}` : `${titulo} — ${AUTOR}`;
  const prof = ruta.split("/").filter(Boolean).length; // profundidad para rutas relativas
  const base = prof === 0 ? "./" : "../".repeat(prof);
  const activo = (p) => (ruta === p || (p !== "/" && ruta.startsWith(p)) ? ' aria-current="page"' : "");
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(tituloCompleto)}</title>
<meta name="description" content="${esc(descripcion)}">
<meta name="author" content="${AUTOR}">
<link rel="canonical" href="${SITIO}${ruta}">
<meta property="og:title" content="${esc(tituloCompleto)}">
<meta property="og:description" content="${esc(descripcion)}">
<meta property="og:type" content="${tipo}">
<meta property="og:url" content="${SITIO}${ruta}">
${imagen ? `<meta property="og:image" content="${SITIO}${imagen}">` : ""}
<link rel="alternate" type="application/rss+xml" title="Libreta de ${AUTOR}" href="${SITIO}/feed.xml">
<link rel="icon" href="${base}assets/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="${base}style.css">
${extraHead}
</head>
<body>
<div class="wrap">
<header class="top">
  <a class="marca" href="${base}">Esteban Diaczun</a>
  <nav>
    <a href="${base}libreta/"${activo("/libreta/")}>Libreta</a>
    <a href="${base}obras/"${activo("/obras/")}>Obras</a>
  </nav>
</header>
<main>
${cuerpo}
</main>
<footer>
  <span>© ${ANIO} ${AUTOR}</span>
  <span><a href="mailto:${MAIL}">${MAIL}</a></span>
  <span><a href="${base}feed.xml">RSS</a></span>
</footer>
</div>
</body>
</html>
`;
}

const itemNota = (n, base) =>
  `<li><time datetime="${iso(n.fecha)}">${fechaCorta(n.fecha)} <span class="anio">${n.fecha.getUTCFullYear()}</span></time><a href="${base}libreta/${n.slug}/">${esc(n.titulo)}</a>${n.tema ? `<span class="tema">${esc(n.tema)}</span>` : ""}</li>`;

const tarjetaObra = (o, base) => `
<article class="obra">
  ${o.portada ? `<a href="${o.url}"><img src="${base}${o.portada}" alt="${esc(o.alt || "Portada de " + o.titulo)}"></a>` : ""}
  <div>
    <p class="over">${esc(o.genero || "Libro")}${o.anio ? ` · ${o.anio}` : ""}</p>
    <h3><a href="${o.url}">${esc(o.titulo)}</a></h3>
    ${o.subtitulo ? `<p class="sub">${esc(o.subtitulo)}</p>` : ""}
    <div class="texto">${o.html}</div>
    <p class="acciones"><a class="btn" href="${o.url}">${esc(o.accion || "Leer")}</a>${(o.enlaces || []).map((e) => `<a class="btn sec" href="${e.url}">${esc(e.texto)}</a>`).join("")}</p>
  </div>
</article>`;

// ---------- páginas ----------
function construir() {
  const notas = cargarNotas();
  const obras = cargarObras();
  const inicio = matter(leer("contenido/inicio.md"));

  ["index.html", "feed.xml", "404.html", "style.css"].forEach((f) => fs.rmSync(path.join(RAIZ, f), { force: true }));
  limpiar("libreta"); limpiar("obras");

  fs.copyFileSync(path.join(RAIZ, "src/style.css"), path.join(RAIZ, "style.css"));

  // Inicio
  escribir("index.html", pagina({
    titulo: AUTOR, ruta: "/",
    descripcion: inicio.data.descripcion || `Libreta y obras de ${AUTOR}.`,
    cuerpo: `
<section class="portada">
  <h1>${esc(inicio.data.titulo || AUTOR)}</h1>
  <div class="texto intro">${marked.parse(inicio.content)}</div>
</section>
<section>
  <h2 class="over">Obras</h2>
  ${obras.map((o) => tarjetaObra(o, "./")).join("\n")}
</section>
<section>
  <h2 class="over">Libreta · últimas notas</h2>
  <ul class="notas">${notas.slice(0, 6).map((n) => itemNota(n, "./")).join("\n")}</ul>
  <p class="mas"><a href="./libreta/">Todas las notas →</a></p>
</section>`,
  }));

  // Libreta: índice por año
  const porAnio = {};
  notas.forEach((n) => { const a = n.fecha.getUTCFullYear(); (porAnio[a] ||= []).push(n); });
  escribir("libreta/index.html", pagina({
    titulo: "Libreta", ruta: "/libreta/",
    descripcion: `Notas, pensamientos y fragmentos de ${AUTOR}.`,
    cuerpo: `
<h1>Libreta</h1>
<p class="texto intro">${esc(inicio.data.libreta || "Lo que no es un libro: notas, pensamientos, fragmentos. Sin orden más que la fecha.")}</p>
${Object.keys(porAnio).sort((a, b) => b - a).map((a) => `
<h2 class="over">${a}</h2>
<ul class="notas">${porAnio[a].map((n) => itemNota(n, "../")).join("\n")}</ul>`).join("\n")}`,
  }));

  // Cada nota
  notas.forEach((n, i) => {
    const ant = notas[i + 1], sig = notas[i - 1];
    escribir(`libreta/${n.slug}/index.html`, pagina({
      titulo: n.titulo, ruta: `/libreta/${n.slug}/`, descripcion: n.resumen, tipo: "article",
      cuerpo: `
<article class="nota">
  <p class="over"><a href="../">Libreta</a> · <time datetime="${iso(n.fecha)}">${fechaLarga(n.fecha)}</time>${n.tema ? ` · ${esc(n.tema)}` : ""}</p>
  <h1>${esc(n.titulo)}</h1>
  <div class="texto">${n.html.replace(/^<h1[^>]*>.*?<\/h1>\s*/s, "")}</div>
</article>
${ant || sig ? `<nav class="vecinas">
  ${ant ? `<a href="../${ant.slug}/">← ${esc(ant.titulo)}</a>` : "<span></span>"}
  ${sig ? `<a href="../${sig.slug}/">${esc(sig.titulo)} →</a>` : "<span></span>"}
</nav>` : ""}`,
    }));
  });

  // Obras
  escribir("obras/index.html", pagina({
    titulo: "Obras", ruta: "/obras/",
    descripcion: `Libros de ${AUTOR}: lectura gratuita.`,
    cuerpo: `<h1>Obras</h1>\n${obras.map((o) => tarjetaObra(o, "../")).join("\n")}`,
  }));

  // 404
  escribir("404.html", pagina({
    titulo: "No está", ruta: "/404.html", descripcion: "Página no encontrada.",
    cuerpo: `<h1>No está.</h1><p class="texto intro">Esa página no existe o se movió. <a href="/">Volver al inicio</a>.</p>`,
  }));

  // RSS
  escribir("feed.xml", `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
<title>Libreta de ${AUTOR}</title>
<link>${SITIO}/libreta/</link>
<atom:link href="${SITIO}/feed.xml" rel="self" type="application/rss+xml"/>
<description>Notas, pensamientos y fragmentos.</description>
<language>es</language>
${notas.slice(0, 20).map((n) => `<item>
<title>${esc(n.titulo)}</title>
<link>${SITIO}/libreta/${n.slug}/</link>
<guid>${SITIO}/libreta/${n.slug}/</guid>
<pubDate>${n.fecha.toUTCString()}</pubDate>
<description><![CDATA[${n.html}]]></description>
</item>`).join("\n")}
</channel>
</rss>
`);

  console.log(`✓ ${notas.length} notas, ${obras.length} obras → index.html, libreta/, obras/, feed.xml`);
}

construir();
