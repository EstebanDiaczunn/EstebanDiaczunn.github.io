'use strict';
// La figura y la piedra son cuadros renderizados en Blender, con alfa, que se
// estampan sobre el grabado. El cuadro no se elige por reloj sino por distancia
// recorrida: el paso no puede patinar aunque el visitante acelere el empuje.
const canvas = document.getElementById('world'), ctx = canvas.getContext('2d');
const pause = document.getElementById('pause'), push = document.getElementById('push');
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
let paused = reduced.matches, held = false, t = 3, last = 0, attempt = 1, ready = false;
// Los tramos del intento, en segundos. El ascenso manda: el resto respira a su lado.
// Con el personaje dibujado a mano sólo existe el ciclo de subida. Hasta que
// estén las otras dos hojas —quedarse mirando y bajar—, el intento termina arriba
// y vuelve a empezar: mejor eso que mezclar dos dibujos distintos en la misma obra.
const SOLO_SUBIDA = true;
const ASCENSO = 14, ESFUERZO = SOLO_SUBIDA ? 4 : 3;
const CAIDA = SOLO_SUBIDA ? 0 : 4, PREGUNTA = SOLO_SUBIDA ? 0 : 4, REGRESO = SOLO_SUBIDA ? 0 : 12;
const T1 = ASCENSO, T2 = T1 + ESFUERZO, T3 = T2 + CAIDA, T4 = T3 + PREGUNTA;
const duration = T4 + REGRESO, dust = [];
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const smooth = v => { v = clamp(v); return v * v * (3 - 2 * v) };

const PENDIENTE = Math.atan(.365);           // la diagonal del grabado
const METRO = .075;                          // un metro, en fracción del ancho del fondo
const bg = new Image(); bg.src = 'mountain.png';
// Safari viejo no tiene ctx.filter; ahí la sombra vuelve al óvalo.
const soportaFiltro = (() => { try { const c = document.createElement('canvas').getContext('2d'); c.filter = 'brightness(0)'; return c.filter !== 'none' } catch (e) { return false } })();
const piezas = {};                           // empuje, mirar, bajar, piedra

function pauseUI() { pause.setAttribute('aria-label', paused ? 'Reanudar animación' : 'Pausar animación'); pause.title = pause.getAttribute('aria-label'); document.getElementById('pauseIcon').textContent = paused ? '▷' : 'Ⅱ' }
function hold(v) { held = v; push.classList.toggle('holding', v); if (v && paused) { paused = false; pauseUI() } }
pauseUI(); pause.onclick = () => { paused = !paused; hold(false); pauseUI() };
push.onpointerdown = e => { push.setPointerCapture(e.pointerId); hold(true) }; push.onpointerup = push.onpointercancel = push.onlostpointercapture = () => hold(false);
push.onkeydown = e => { if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); hold(true) } }; push.onkeyup = e => { if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); hold(false) } };
window.addEventListener('keydown', e => { if (e.code === 'Space' && document.activeElement === document.body && !essay.open) { e.preventDefault(); hold(true) } }); window.addEventListener('keyup', e => { if (e.code === 'Space') hold(false) }); window.addEventListener('blur', () => hold(false)); document.addEventListener('visibilitychange', () => { last = 0; hold(false) });
const essay = document.getElementById('essay'); let wasPaused = false;
document.getElementById('read').onclick = () => { wasPaused = paused; paused = true; hold(false); pauseUI(); essay.showModal() };
document.getElementById('closeEssay').onclick = () => essay.close(); essay.addEventListener('close', () => { paused = wasPaused; pauseUI() }); essay.addEventListener('click', e => { if (e.target === essay) { const r = essay.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) essay.close() } });
function resize() { const d = Math.min(devicePixelRatio || 1, 2); canvas.width = canvas.clientWidth * d; canvas.height = canvas.clientHeight * d } window.addEventListener('resize', resize); resize();

// --- Estampar un cuadro del atlas -------------------------------------------
// Cada pieza trae su ancla (dónde pisa el suelo dentro del cuadro) y su escala
// real, así que sólo hay que decirle en qué punto del sendero apoyarse.
function estampar(pieza, cuadro, x, y, unidad, alpha = 1, espejo = false) {
  if (!pieza || alpha <= 0) return;
  const m = pieza.meta, factor = unidad / m.pixeles_por_metro;
  const col = cuadro % m.columnas, fila = Math.floor(cuadro / m.columnas) % m.filas;
  const [ancho, alto] = m.celda;
  ctx.save();
  ctx.globalAlpha = alpha;
  // Tinta sobre el mismo papel: multiplicar la deja impresa en el grabado en vez
  // de pegada encima, y hace que los pies se hundan en la roca oscura.
  ctx.globalCompositeOperation = 'multiply';
  ctx.translate(x, y);
  if (m.giro_grados) ctx.rotate(m.giro_grados * Math.PI / 180);
  if (espejo) ctx.scale(-1, 1);
  ctx.drawImage(pieza.img, col * ancho, fila * alto, ancho, alto,
    -m.ancla[0] * factor, -m.ancla[1] * factor, ancho * factor, alto * factor);
  ctx.restore();
}

// La piedra suelta se dibuja aparte para poder hacerla rodar y caer.
function rodar(x, y, unidad, giro) {
  const pieza = piezas.piedra; if (!pieza) return;
  const m = pieza.meta, factor = unidad / m.pixeles_por_metro;
  const [ancho, alto] = m.celda;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(giro);
  ctx.drawImage(pieza.img, 0, 0, ancho, alto,
    -m.ancla[0] * factor, -m.ancla[1] * factor, ancho * factor, alto * factor);
  ctx.restore();
}

// La sombra es el mismo cuadro, volcado sobre la ladera y aplastado: por eso
// tiene la forma del cuerpo y no un óvalo genérico. Es lo que lo apoya en la roca.
const SESGO = .34, APLASTE = .18;
function volcar(pieza, cuadro, x, y, unidad, alpha = .17) {
  if (!pieza || !soportaFiltro) return;
  const m = pieza.meta, factor = unidad / m.pixeles_por_metro;
  const col = cuadro % m.columnas, fila = Math.floor(cuadro / m.columnas) % m.filas;
  const [ancho, alto] = m.celda;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-PENDIENTE);
  ctx.transform(1, 0, SESGO, APLASTE, 0, 0);
  if (m.giro_grados) ctx.rotate(m.giro_grados * Math.PI / 180);
  ctx.filter = 'brightness(0)';
  ctx.globalAlpha = alpha;
  ctx.drawImage(pieza.img, col * ancho, fila * alto, ancho, alto,
    -m.ancla[0] * factor, -m.ancla[1] * factor, ancho * factor, alto * factor);
  ctx.restore();
}

// La roca del grabado vuelve a dibujarse un poco más arriba, recortada a la ladera:
// los pies quedan metidos en la cuesta en vez de apoyados sobre una línea.
function cornisa(ox, oy, bw, bh, alto, cs, sn) {
  const W = canvas.width, H = canvas.height;
  const linea = px => oy + bh * (.874 - .548 * ((px - ox) / bw));
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(-10, linea(-10) - alto * cs);
  ctx.lineTo(W + 10, linea(W + 10) - alto * cs);
  ctx.lineTo(W + 10, H + 10);
  ctx.lineTo(-10, H + 10);
  ctx.closePath();
  ctx.clip();
  ctx.drawImage(bg, ox - alto * sn, oy - alto * cs, bw, bh);
  ctx.restore();
}

// Una sombra corta debajo del contacto: sin esto la figura flota sobre el grabado.
function pisada(x, y, unidad, ancho = .42, fuerza = .34) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-PENDIENTE);
  const r = ancho * unidad;
  const degradado = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
  degradado.addColorStop(0, 'rgba(26,22,17,' + fuerza + ')');
  degradado.addColorStop(1, 'rgba(26,22,17,0)');
  ctx.fillStyle = degradado;
  ctx.beginPath(); ctx.ellipse(0, 0, r, r * .3, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function cuadroDe(pieza, metros) {
  const m = pieza.meta;
  if (!m.avance_por_ciclo) return Math.floor(metros * m.fps) % m.cuadros;
  return ((Math.floor(metros / m.avance_por_ciclo * m.cuadros) % m.cuadros) + m.cuadros) % m.cuadros;
}

let previousPhase = -1;
function frame(ts) {
  requestAnimationFrame(frame);
  if (!ready) return;
  const dt = last ? Math.min((ts - last) / 1000, .05) : 0; last = ts;
  const advancing = !paused && !document.hidden;
  if (advancing) t += dt * (held && t < T2 - 1 ? 1.55 : 1);
  if (t >= duration) { t -= duration; attempt++; document.getElementById('count').textContent = 'INTENTO ' + String(attempt).padStart(3, '0') }

  const W = canvas.width, H = canvas.height, mobile = canvas.clientWidth < 700;
  const escala = Math.max(W / bg.width, H / bg.height), bw = bg.width * escala, bh = bg.height * escala;
  const ox = (W - bw) * (mobile ? .47 : .5), oy = (H - bh) * .5;
  ctx.clearRect(0, 0, W, H);
  ctx.drawImage(bg, ox, oy, bw, bh);

  // El sendero: un tramo de la diagonal del grabado, medido en metros.
  const cs = Math.cos(PENDIENTE), sn = Math.sin(PENDIENTE);
  // El tramo se mide sobre la pantalla y se traduce al fondo: así el recorrido
  // entra completo en cualquier ventana, de un teléfono a un monitor ancho.
  const margen = mobile ? .06 : .04;
  const izq = clamp((W * margen - ox) / bw, .02, .9);
  const der = clamp((W * (1 - margen) - ox) / bw, izq + .1, .98);
  const largo = (der - izq) * bw / cs;
  const baseX = ox + bw * izq, baseY = oy + bh * (.874 - .548 * izq);
  // La figura crece con la pantalla, pero nunca más allá de lo que el papel aguanta.
  const unidad = Math.min(bw * METRO, W * (mobile ? .17 : .085));
  const metrosTotales = largo / unidad;
  const suelo = q => [baseX + largo * q * cs, baseY - largo * q * sn];

  // Fases: subir, forzar, la caída, el instante de la pregunta, volver a bajar.
  const fase = t < T1 ? 0 : t < T2 ? 1 : t < T3 ? 2 : t < T4 ? 3 : 4;
  let q = -.07 + (t / T1) * 1.14;             // entra por un borde y sale por el otro
  q = clamp(q, -.07, 1.07);
  if (t >= T1 && t < T2) q = 1 + Math.sin((t - T1) / ESFUERZO * Math.PI) * .009;
  if (t >= T2) q = 1;
  if (t >= T4) q = 1 - smooth((t - T4) / REGRESO);
  const recorrido = q * metrosTotales;

  const [fx, fy] = suelo(q);

  // Dónde está la piedra: pegada al cuerpo mientras sube, suelta cuando cae.
  const medidas = piezas.empuje.meta;
  const radio = (medidas.radio_piedra || .42) * 1.12, delante = (medidas.piedra || [.9])[0] / metrosTotales;
  const qRoca = t < T2 ? q + delante
    : (1 + delante) - smooth((t - T2) / (CAIDA * .9));

  // Las tres capas posibles del cuerpo, con su peso. En las costuras se cruzan
  // durante un momento: sin eso, el cambio de un ciclo a otro es un salto.
  const CRUCE = 1.1;
  const soltando = clamp((t - T2) / CRUCE);            // deja la piedra y se endereza
  const retomando = clamp((t - (duration - CRUCE)) / CRUCE);  // vuelve a agarrarla
  const caminando = clamp((t - T4) / CRUCE);
  const capas = SOLO_SUBIDA
    ? [[piezas.empuje, cuadroDe(piezas.empuje, recorrido), 1]]
    : [
      [piezas.empuje, cuadroDe(piezas.empuje, recorrido), Math.max(1 - soltando, retomando)],
      [piezas.mirar, cuadroDe(piezas.mirar, t - T2), soltando * (1 - caminando)],
      [piezas.bajar, cuadroDe(piezas.bajar, (1 - q) * metrosTotales), caminando * (1 - retomando)],
    ];

  for (const [pieza, cuadro, peso] of capas) volcar(pieza, cuadro, fx, fy, unidad, .17 * peso);
  pisada(fx, fy, unidad, .34, .13);
  for (const [pieza, cuadro, peso] of capas) estampar(pieza, cuadro, fx, fy, unidad, peso);

  if (fase >= 2 && !SOLO_SUBIDA) {
    // La piedra que se fue: rueda cuesta abajo y el giro sale de lo que recorrió.
    const [px, py] = suelo(qRoca);
    volcar(piezas.piedra, 0, px, py, unidad, .17);
    pisada(px, py, unidad, .3, .14);
    rodar(px - radio * sn * unidad, py - radio * cs * unidad, unidad,
          -PENDIENTE + (qRoca - 1 - delante) * metrosTotales / radio);
  }

  // Polvo en los contactos: partículas cortas, atadas al punto donde pisa.
  if (advancing && fase !== 3 && Math.random() < dt * (fase === 2 ? 40 : 7)) {
    const [dx, dy] = suelo(fase === 2 ? qRoca : q);
    dust.push({ x: dx, y: dy, vx: -18 - Math.random() * 25, vy: -12 - Math.random() * 20, age: 0, life: .6 + Math.random(), size: 1 + Math.random() * 2 });
  }
  for (let i = dust.length - 1; i >= 0; i--) {
    const d = dust[i];
    if (advancing) { d.age += dt; d.x += d.vx * dt * escala; d.y += d.vy * dt * escala; d.vy += 12 * dt }
    if (d.age > d.life) { dust.splice(i, 1); continue }
    ctx.fillStyle = 'rgba(48,38,26,' + (.3 * (1 - d.age / d.life)) + ')';
    ctx.beginPath(); ctx.arc(d.x, d.y, d.size * escala, 0, Math.PI * 2); ctx.fill();
  }

  cornisa(ox, oy, bw, bh, unidad * .16, cs, sn);

  if (fase !== previousPhase) {
    document.getElementById('phaseName').textContent = ['EL ASCENSO', 'EL ESFUERZO', 'LA CAÍDA', 'ANTES DE BAJAR', 'EL REGRESO'][fase];
    document.getElementById('phaseNumber').textContent = ['I', 'II', 'III', 'IV', 'V'][fase];
    document.getElementById('thought').textContent = ['Todavía no es imposible.', 'No hay promesa. Hay un intento.', 'Caer no responde todas las preguntas.', '¿Y si todavía existe una salida?', 'La derrota tampoco está garantizada.'][fase];
    previousPhase = fase;
  }
  document.getElementById('progress').style.height = t / duration * 100 + '%';
  document.getElementById('pushLabel').textContent = fase < 2 ? (held ? 'Un paso más…' : 'Ayudalo a empujar') : 'Acompañalo';
}

// ?v=… en la dirección se propaga a los cuadros: sirve para saltear la caché
// mientras se produce, y para que un cambio publicado llegue sin recargas raras.
const version = new URLSearchParams(location.search).get('v');
const conVersion = ruta => version ? ruta + '?v=' + encodeURIComponent(version) : ruta;

async function cargarPieza(nombre) {
  const meta = await (await fetch(conVersion('media/' + nombre + '.json'))).json();
  if (nombre === 'empuje') { meta.ancla = [150, 261]; meta.giro_grados = 12; }
  const img = new Image();
  img.src = conVersion('media/' + meta.imagen);
  await img.decode();
  piezas[nombre] = { img, meta };
}

Promise.all([bg.decode(), ...(SOLO_SUBIDA ? ['empuje'] : ['empuje', 'mirar', 'bajar', 'piedra']).map(cargarPieza)])
  .then(() => { ready = true; document.getElementById('loading').classList.add('loaded') })
  .catch(() => { document.getElementById('loading').textContent = 'No se pudo cargar la escena. Recargá la página para volver a intentarlo.' });
requestAnimationFrame(frame);
