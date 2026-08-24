#!/usr/bin/env node
// Generador estático de diaczun.com. Markdown → HTML. Sin framework.
// Uso: node build.js            (regenera todo; refresca Letterboxd si hay red)
//      node build.js --offline  (usa la caché de datos/ sin tocar la red)
const fs = require("fs");
const path = require("path");
const { marked } = require("marked");
const matter = require("gray-matter");

const RAIZ = __dirname;
const SITIO = "https://diaczun.com";
const AUTOR = "Esteban Nicolás Diaczun";
const MAIL = "esteban@diaczun.com";
const ANIO = 2026;
const LETTERBOXD = "evilnaiki";
const ENLACES = [
  { texto: "Letterboxd", url: `https://letterboxd.com/${LETTERBOXD}/` },
  { texto: "Steam", url: "https://steamcommunity.com/profiles/76561198059032778/" },
  { texto: "GitHub", url: "https://github.com/EstebanDiaczunn" },
  { texto: "Substack", url: "https://estebandiaczun.substack.com/" },
  { texto: "CV", url: "https://cv.diaczun.com/" },
];
const OFFLINE = process.argv.includes("--offline");

marked.setOptions({ gfm: true, breaks: false });

// ---------- utilidades ----------
const leer = (f) => fs.readFileSync(path.join(RAIZ, f), "utf8");
const existe = (f) => fs.existsSync(path.join(RAIZ, f));
const escribir = (f, s) => {
  const abs = path.join(RAIZ, f);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, s);
};
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const MESES = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
const fechaLarga = (d) => `${d.getUTCDate()} de ${MESES[d.getUTCMonth()]} de ${d.getUTCFullYear()}`;
const fechaCorta = (d) => `${String(d.getUTCDate()).padStart(2, "0")} ${MESES[d.getUTCMonth()].slice(0, 3)}`;
const iso = (d) => d.toISOString().slice(0, 10);
const aFecha = (v) => (v instanceof Date ? v : new Date(String(v).slice(0, 10) + "T12:00:00Z"));
const slugDe = (n) => n.replace(/\.md$/, "").replace(/^\d{4}-\d{2}-\d{2}-/, "");
const textoPlano = (html) => html.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
const extracto = (html, n = 160) => { const t = textoPlano(html); return t.length > n ? t.slice(0, n).replace(/\s+\S*$/, "") + "…" : t; };
const limpiar = (d) => fs.rmSync(path.join(RAIZ, d), { recursive: true, force: true });
const estrellas = (r) => { if (r == null) return ""; const n = Number(r); return "★".repeat(Math.floor(n)) + (n % 1 ? "½" : ""); };

// ---------- datos externos ----------
async function cargarLetterboxd() {
  const cache = "datos/letterboxd.json";
  if (!OFFLINE) {
    try {
      const res = await fetch(`https://letterboxd.com/${LETTERBOXD}/rss/`, { headers: { "user-agent": "Mozilla/5.0 diaczun.com build" } });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const xml = await res.text();
      const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((m) => m[1]).map((it) => {
        const g = (tag) => (it.match(new RegExp(`<${tag}>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${tag}>`)) || [])[1]?.trim();
        return { titulo: g("letterboxd:filmTitle"), anio: g("letterboxd:filmYear"), nota: g("letterboxd:memberRating"), fecha: g("letterboxd:watchedDate"), revision: g("letterboxd:rewatch") === "Yes", url: g("link") };
      }).filter((x) => x.titulo && x.fecha);
      if (items.length) { escribir(cache, JSON.stringify(items, null, 2) + "\n"); console.log(`  letterboxd: ${items.length} películas (actualizado)`); return items; }
    } catch (e) { console.log("  letterboxd: sin red, uso caché (" + e.message + ")"); }
  }
  return existe(cache) ? JSON.parse(leer(cache)) : [];
}

// ---------- contenido ----------
function cargarNotas() {
  const dir = path.join(RAIZ, "contenido/notas");
  return fs.readdirSync(dir).filter((f) => f.endsWith(".md")).map((f) => {
    const { data, content } = matter(fs.readFileSync(path.join(dir, f), "utf8"));
    const fa = f.match(/^(\d{4}-\d{2}-\d{2})/);
    const fecha = aFecha(data.fecha || (fa && fa[1]));
    if (isNaN(fecha)) throw new Error(`Nota sin fecha válida: ${f}`);
    const html = marked.parse(content);
    return { slug: data.slug || slugDe(f), titulo: data.titulo || (content.match(/^#\s+(.+)$/m) || [])[1] || slugDe(f), fecha, tema: data.tema || null, resumen: data.resumen || extracto(html), borrador: !!data.borrador, html };
  }).filter((n) => !n.borrador).sort((a, b) => b.fecha - a.fecha || a.slug.localeCompare(b.slug));
}
function cargarCosas() {
  const dir = path.join(RAIZ, "contenido/cosas");
  return fs.readdirSync(dir).filter((f) => f.endsWith(".md")).map((f) => {
    const { data, content } = matter(fs.readFileSync(path.join(dir, f), "utf8"));
    return { slug: slugDe(f), orden: data.orden ?? 99, ...data, html: marked.parse(content) };
  }).sort((a, b) => a.orden - b.orden);
}
function cargarPagina(f) { const { data, content } = matter(leer(f)); return { ...data, html: marked.parse(content) }; }

// ---------- plantilla ----------
function pagina({ titulo, descripcion, ruta, cuerpo, tipo = "website", imagen, clase = "" }) {
  const completo = ruta === "/" ? AUTOR : `${titulo} — ${AUTOR}`;
  const prof = ruta.split("/").filter(Boolean).length;
  const base = prof === 0 ? "./" : "../".repeat(prof);
  const activo = (p) => (ruta.startsWith(p) ? ' aria-current="page"' : "");
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(completo)}</title>
<meta name="description" content="${esc(descripcion)}">
<meta name="author" content="${AUTOR}">
<meta name="color-scheme" content="light dark">
<link rel="canonical" href="${SITIO}${ruta}">
<meta property="og:title" content="${esc(completo)}">
<meta property="og:description" content="${esc(descripcion)}">
<meta property="og:type" content="${tipo}">
<meta property="og:url" content="${SITIO}${ruta}">
${imagen ? `<meta property="og:image" content="${SITIO}${imagen}">` : ""}
<link rel="alternate" type="application/rss+xml" title="Libreta de ${AUTOR}" href="${SITIO}/feed.xml">
<link rel="icon" href="${base}assets/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="${base}assets/apple-touch-icon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300..600;1,9..144,300..600&family=Inter:wght@400;500&display=swap">
<link rel="stylesheet" href="${base}style.css">
<script>try{const t=localStorage.getItem("tema");if(t)document.documentElement.dataset.tema=t}catch(e){}</script>
</head>
<body class="${clase}">
<div class="wrap">
<header class="top">
  <a class="marca" href="${base}"><svg class="mono" viewBox="0 0 100 100" aria-hidden="true"><defs><mask id="ojo"><rect width="100" height="100" fill="#fff"/><path d="M38 50q12 12 24 0" fill="none" stroke="#000" stroke-width="6" stroke-linecap="round"/></mask></defs><path d="M26 18h26a32 32 0 0 1 0 64H26z" fill="currentColor" mask="url(#ojo)"/></svg><span>Esteban Diaczun</span></a>
  <nav>
    <a href="${base}libreta/"${activo("/libreta/")}>Libreta</a>
    <a href="${base}cosas/"${activo("/cosas/")}>Cosas</a>
    <a href="${base}visto/"${activo("/visto/")}>Visto</a>
    <a href="${base}colofon/"${activo("/colofon/")}>Colofón</a>
    <button class="tema" type="button" aria-label="Cambiar tema" title="Claro / oscuro"><span></span></button>
  </nav>
</header>
<main>
${cuerpo}
</main>
<footer>
  <div class="enlaces">${ENLACES.map((e) => `<a href="${e.url}" rel="me noopener">${e.texto}</a>`).join("")}<a href="mailto:${MAIL}">${MAIL}</a><a href="${base}feed.xml">RSS</a></div>
  <div class="firma">© ${ANIO} ${AUTOR}</div>
</footer>
</div>
<script>
(function(){if(!matchMedia("(hover: hover)").matches||matchMedia("(prefers-reduced-motion: reduce)").matches)return;document.querySelectorAll(".cosa .port").forEach(function(z){var o=z.querySelector("img");z.addEventListener("mousemove",function(e){var r=z.getBoundingClientRect(),x=(e.clientX-r.left)/r.width,y=(e.clientY-r.top)/r.height;o.style.transform="rotateY("+((x-.5)*12)+"deg) rotateX("+((.5-y)*12)+"deg) translateZ(6px)";z.style.setProperty("--mx",x*100+"%");z.style.setProperty("--my",y*100+"%")});z.addEventListener("mouseleave",function(){o.style.transform=""})})})();
(function(){var b=document.querySelector(".tema");if(!b)return;b.addEventListener("click",function(){var r=document.documentElement,o=r.dataset.tema||(matchMedia("(prefers-color-scheme: dark)").matches?"oscuro":"claro"),n=o==="oscuro"?"claro":"oscuro";r.dataset.tema=n;try{localStorage.setItem("tema",n)}catch(e){}})})();
</script>
</body>
</html>
`;
}

const itemNota = (n, base) => `<li><time datetime="${iso(n.fecha)}">${fechaCorta(n.fecha)} <span class="anio">${n.fecha.getUTCFullYear()}</span></time><a href="${base}libreta/${n.slug}/">${esc(n.titulo)}</a>${n.tema ? `<span class="tema-nota">${esc(n.tema)}</span>` : ""}</li>`;
const itemPeli = (p) => `<li><span class="peli"><a href="${p.url}" rel="noopener">${esc(p.titulo)}</a> <span class="anio">${p.anio || ""}</span>${p.revision ? ' <span class="re" title="Revisión">↻</span>' : ""}</span><span class="nota" aria-label="${p.nota || "sin nota"} de 5">${estrellas(p.nota)}</span><time datetime="${p.fecha}">${fechaCorta(aFecha(p.fecha))}</time></li>`;

const tarjetaCosa = (c, base) => `
<article class="cosa">
  ${c.portada ? `<a class="port" href="${c.url}"><img src="${base}${c.portada}" alt="${esc(c.alt || "Portada de " + c.titulo)}"></a>` : ""}
  <div>
    <p class="over">${esc(c.tipo || "")}${c.anio ? ` · ${c.anio}` : ""}</p>
    <h3><a href="${c.url}">${esc(c.titulo)}</a></h3>
    ${c.subtitulo ? `<p class="sub">${esc(c.subtitulo)}</p>` : ""}
    <div class="texto">${c.html}</div>
    <p class="acciones"><a class="btn" href="${c.url}">${esc(c.accion || "Ver")}</a>${(c.enlaces || []).map((e) => `<a class="btn sec" href="${e.url}">${esc(e.texto)}</a>`).join("")}</p>
  </div>
</article>`;

// ---------- construcción ----------
async function construir() {
  console.log("diaczun.com");
  const notas = cargarNotas();
  const cosas = cargarCosas();
  const inicio = cargarPagina("contenido/inicio.md");
  const colofon = cargarPagina("contenido/colofon.md");
  const pelis = await cargarLetterboxd();

  ["index.html", "feed.xml", "404.html", "style.css"].forEach((f) => fs.rmSync(path.join(RAIZ, f), { force: true }));
  ["libreta", "cosas", "visto", "colofon", "obras"].forEach(limpiar);
  fs.copyFileSync(path.join(RAIZ, "src/style.css"), path.join(RAIZ, "style.css"));

  // Portada
  escribir("index.html", pagina({
    titulo: AUTOR, ruta: "/", descripcion: inicio.descripcion, clase: "portada",
    cuerpo: `
<section class="hero">
  <h1 class="in">${esc(inicio.titulo || AUTOR)}</h1>
  <div class="texto intro in">${inicio.html}</div>
</section>
<section class="in">
  <h2 class="over"><a href="./cosas/">Cosas</a></h2>
  ${cosas.slice(0, 2).map((c) => tarjetaCosa(c, "./")).join("\n")}
</section>
<div class="dos in">
<section>
  <h2 class="over"><a href="./libreta/">Libreta</a></h2>
  <ul class="notas">${notas.slice(0, 5).map((n) => itemNota(n, "./")).join("\n")}</ul>
  <p class="mas"><a href="./libreta/">Todas las notas →</a></p>
</section>
<section>
  <h2 class="over"><a href="./visto/">Visto</a></h2>
  ${pelis.length ? `<ul class="pelis">${pelis.slice(0, 6).map(itemPeli).join("\n")}</ul><p class="mas"><a href="./visto/">Más películas →</a></p>` : `<p class="texto">Nada todavía.</p>`}
</section>
</div>`,
  }));

  // Libreta
  const porAnio = {};
  notas.forEach((n) => { const a = n.fecha.getUTCFullYear(); (porAnio[a] ||= []).push(n); });
  escribir("libreta/index.html", pagina({
    titulo: "Libreta", ruta: "/libreta/", descripcion: `Notas y pensamientos de ${AUTOR}.`,
    cuerpo: `<h1>Libreta</h1>
<p class="texto intro">${esc(inicio.libreta || "")}</p>
${Object.keys(porAnio).sort((a, b) => b - a).map((a) => `<h2 class="over">${a}</h2>\n<ul class="notas">${porAnio[a].map((n) => itemNota(n, "../")).join("\n")}</ul>`).join("\n")}`,
  }));
  notas.forEach((n, i) => {
    const ant = notas[i + 1], sig = notas[i - 1];
    escribir(`libreta/${n.slug}/index.html`, pagina({
      titulo: n.titulo, ruta: `/libreta/${n.slug}/`, descripcion: n.resumen, tipo: "article",
      cuerpo: `<article class="nota">
  <p class="over"><a href="../">Libreta</a> · <time datetime="${iso(n.fecha)}">${fechaLarga(n.fecha)}</time>${n.tema ? ` · ${esc(n.tema)}` : ""}</p>
  <h1>${esc(n.titulo)}</h1>
  <div class="texto">${n.html.replace(/^<h1[^>]*>.*?<\/h1>\s*/s, "")}</div>
</article>
${ant || sig ? `<nav class="vecinas">${ant ? `<a href="../${ant.slug}/">← ${esc(ant.titulo)}</a>` : "<span></span>"}${sig ? `<a href="../${sig.slug}/">${esc(sig.titulo)} →</a>` : "<span></span>"}</nav>` : ""}`,
    }));
  });

  // Cosas
  escribir("cosas/index.html", pagina({
    titulo: "Cosas", ruta: "/cosas/", descripcion: `Cosas que hizo ${AUTOR}.`,
    cuerpo: `<h1>Cosas</h1>\n<p class="texto intro">${esc(inicio.cosas || "")}</p>\n${cosas.map((c) => tarjetaCosa(c, "../")).join("\n")}`,
  }));

  // Visto
  const porMes = {};
  pelis.forEach((p) => { const d = aFecha(p.fecha); const k = `${MESES[d.getUTCMonth()]} ${d.getUTCFullYear()}`; (porMes[k] ||= []).push(p); });
  escribir("visto/index.html", pagina({
    titulo: "Visto", ruta: "/visto/", descripcion: `Películas que vio ${AUTOR}, desde Letterboxd.`,
    cuerpo: `<h1>Visto</h1>
<p class="texto intro">${esc(inicio.visto || "")} <a href="https://letterboxd.com/${LETTERBOXD}/" rel="me noopener">Letterboxd ↗</a></p>
${Object.entries(porMes).map(([k, ps]) => `<h2 class="over">${k}</h2>\n<ul class="pelis">${ps.map(itemPeli).join("\n")}</ul>`).join("\n") || "<p class='texto'>Nada todavía.</p>"}`,
  }));

  // Colofón
  escribir("colofon/index.html", pagina({
    titulo: "Colofón", ruta: "/colofon/", descripcion: colofon.descripcion || "Cómo está hecho este sitio.",
    cuerpo: `<h1>Colofón</h1>\n<div class="texto">${colofon.html}</div>`,
  }));

  // 404
  escribir("404.html", pagina({ titulo: "No está", ruta: "/404.html", descripcion: "Página no encontrada.", cuerpo: `<h1>No está.</h1><p class="texto intro">Esa página no existe o se movió. <a href="/">Volver al inicio</a>.</p>` }));

  // RSS
  escribir("feed.xml", `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
<title>Libreta de ${AUTOR}</title>
<link>${SITIO}/libreta/</link>
<atom:link href="${SITIO}/feed.xml" rel="self" type="application/rss+xml"/>
<description>Notas y pensamientos.</description>
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

  console.log(`✓ ${notas.length} notas, ${cosas.length} cosas, ${pelis.length} películas → index.html, libreta/, cosas/, visto/, colofon/, feed.xml`);
}

construir().catch((e) => { console.error(e); process.exit(1); });
