'use strict';
// Ensayo local de los dibujos aportados el 20/09. No sustituye la obra.
const canvas=document.getElementById('world'),ctx=canvas.getContext('2d');
const pause=document.getElementById('pause'),push=document.getElementById('push');
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
let paused=reduced.matches,held=false,t=0,last=0,attempt=1,ready=false;
const duration=18, ASCENSO=14, SEGUNDOS_CICLO=3.2, PENDIENTE=Math.atan(.365);
const bg=new Image();bg.src='mountain.webp';const piezas={};
const version=new URLSearchParams(location.search).get('v')||'pasos-1';
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
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

let contactos,pasoA,pasoB,ciclo,referenciaRoca;
function perfilRoca(theta,alturaMano){
  const cs=Math.cos(theta),sn=Math.sin(theta);
  const poly=piezas.piedra.meta.contorno.map(([x,y])=>[x*cs-y*sn,x*sn+y*cs]);
  const height=Math.max(...poly.map(p=>p[1]));
  const nivel=height-alturaMano,intersections=[];
  for(let j=0;j<poly.length;j++){
    const a=poly[j],b=poly[(j+1)%poly.length];
    if((a[1]<=nivel&&b[1]>nivel)||(b[1]<=nivel&&a[1]>nivel))
      intersections.push(a[0]+(b[0]-a[0])*(nivel-a[1])/(b[1]-a[1]));
  }
  if(!intersections.length)throw new Error('La palma queda fuera de la altura de la piedra.');
  return {height,left:Math.min(...intersections)};
}
function prepararContactos(){
  const m=piezas.empuje.meta,theta=PENDIENTE+m.giro_grados*Math.PI/180;
  const cs=Math.cos(theta),sn=Math.sin(theta);
  contactos=m.contactos.map(c=>{
    // Punto de tinta que realmente apoya tras la rotación rígida del dibujo.
    const pie=c.huella.reduce((a,b)=>a[0]*sn+a[1]*cs>b[0]*sn+b[1]*cs?a:b);
    const dx=(c.mano[0]-pie[0])/m.pixeles_por_metro,dy=(c.mano[1]-pie[1])/m.pixeles_por_metro;
    const manoX=dx*cs-dy*sn,manoY=-dx*sn-dy*cs;
    return {...c,pie,manoX,manoY,roca:manoX-perfilRoca(0,manoY).left};
  });
  referenciaRoca=contactos[0].roca;
  pasoA=contactos[3].roca-contactos[4].roca+.14;
  pasoB=contactos[7].roca-contactos[0].roca+.14;
  ciclo=pasoA+pasoB;
}
function posicionPiedra(contacto,stance){
  const r=piezas.piedra.meta.radio_piedra;
  let s=stance+contacto.roca;
  // El perfil girado toca el suelo y la palma a la vez. No se deforma el dibujo.
  for(let n=0;n<16;n++){
    const perfil=perfilRoca((s-referenciaRoca)/r,contacto.manoY);
    const siguiente=stance+contacto.manoX-perfil.left;
    if(Math.abs(siguiente-s)<1e-8){s=siguiente;break}
    s=siguiente;
  }
  const theta=(s-referenciaRoca)/r,perfil=perfilRoca(theta,contacto.manoY);
  return {s,height:perfil.height,angle:theta-PENDIENTE,error:s+perfil.left-stance-contacto.manoX};
}
function dibujarFigura(i,footX,footY,unit){
  const p=piezas.empuje,m=p.meta,c=contactos[i],f=unit/m.pixeles_por_metro;
  ctx.save();ctx.globalCompositeOperation='multiply';ctx.translate(footX,footY);
  ctx.rotate(m.giro_grados*Math.PI/180);
  ctx.drawImage(p.img,(i%m.columnas)*m.celda[0],Math.floor(i/m.columnas)*m.celda[1],...m.celda,
    -c.pie[0]*f,-c.pie[1]*f,m.celda[0]*f,m.celda[1]*f);
  ctx.restore();
}
function dibujarPiedra(x,y,unit,angle){
  const p=piezas.piedra,m=p.meta,f=unit/m.pixeles_por_metro;
  ctx.save();ctx.globalCompositeOperation='multiply';ctx.translate(x,y);ctx.rotate(angle);
  ctx.drawImage(p.img,-m.ancla[0]*f,-m.ancla[1]*f,m.celda[0]*f,m.celda[1]*f);
  ctx.restore();
}
function frame(ts){
  requestAnimationFrame(frame);if(!ready)return;
  const dt=last?Math.min((ts-last)/1000,.05):0;last=ts;
  const W=canvas.width,H=canvas.height,mobile=canvas.clientWidth<700;
  const scale=Math.max(W/bg.width,H/bg.height),bw=bg.width*scale,bh=bg.height*scale;
  const ox=(W-bw)*(mobile?.47:.5),oy=(H-bh)*.5;
  ctx.clearRect(0,0,W,H);ctx.drawImage(bg,ox,oy,bw,bh);
  const unit=Math.min(bw*.065,W*(mobile?.15:.075)),cs=Math.cos(PENDIENTE),sn=Math.sin(PENDIENTE);
  const margin=W*(mobile?.06:.04),baseX=margin+unit*1.05;
  const baseY=oy+bh*(.874-.548*((baseX-ox)/bw));
  const r=piezas.piedra.meta.radio_piedra;
  // El extremo se calcula incluyendo el radio de la piedra independiente.
  const available=(W-margin-baseX)/unit/cs-r-1.1;
  const cycles=Math.max(.5,available/ciclo);
  // La velocidad del paso no depende de cuántos pasos entren en la pantalla.
  // t conserva la fase normalizada del recorrido para no saltar al redimensionar.
  const clockRate=ASCENSO/(cycles*SEGUNDOS_CICLO);
  if(!paused&&!document.hidden)t+=dt*clockRate*(held&&t<ASCENSO?1.55:1);
  if(t>=duration){t-=duration;attempt++}
  const exposure=Math.floor(clamp(t/ASCENSO)*cycles*8);
  const i=exposure%8,lap=Math.floor(exposure/8),stance=lap*ciclo+(i>=4?pasoA:0);
  const c=contactos[i],rock=posicionPiedra(c,stance),stoneS=rock.s;
  const footX=baseX+stance*unit*cs,footY=baseY-stance*unit*sn;
  const angle=rock.angle,height=rock.height;
  const stoneX=baseX+stoneS*unit*cs-height*unit*sn;
  const stoneY=baseY-stoneS*unit*sn-height*unit*cs;
  dibujarPiedra(stoneX,stoneY,unit,angle);
  dibujarFigura(i,footX,footY,unit);
  // Sólo evidencia de revisión; no altera la representación.
  window.revisionPaso={cuadro:i,exposure,stance,foot:[footX,footY],stone:[stoneX,stoneY],angle,cycles,unit,clockRate,mano:[footX+(c.manoX*cs-c.manoY*sn)*unit,footY-(c.manoX*sn+c.manoY*cs)*unit],errorContacto:rock.error*unit};
  document.getElementById('count').textContent='INTENTO '+String(attempt).padStart(3,'0');
  document.getElementById('phaseName').textContent=t<ASCENSO?'EL ASCENSO':'EL ESFUERZO';
  document.getElementById('phaseNumber').textContent=t<ASCENSO?'I':'II';
  document.getElementById('thought').textContent=t<ASCENSO?'Todavía no es imposible.':'No hay promesa. Hay un intento.';
  document.getElementById('progress').style.height=t/duration*100+'%';
  document.getElementById('pushLabel').textContent=held?'Un paso más…':'Ayudalo a empujar';
}
async function cargar(nombre,archivo){
  const meta=await(await fetch('media/'+archivo+'.json?v='+encodeURIComponent(version))).json();
  const img=new Image();img.src='media/'+meta.imagen+'?v='+encodeURIComponent(version);await img.decode();
  piezas[nombre]={meta,img};
}
Promise.all([bg.decode(),cargar('empuje','empuje-pasos'),cargar('piedra','piedra-dibujo')])
 .then(()=>{prepararContactos();ready=true;document.getElementById('loading').classList.add('loaded')})
 .catch(()=>{document.getElementById('loading').textContent='No se pudo cargar el ensayo.'});
requestAnimationFrame(frame);
