'use strict';
// Candidato completo para revisión local. No sustituye la portada sin revisión.
const canvas = document.getElementById('world');
const ctx = canvas.getContext('2d');
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const bg = new Image();
const assets = {};
const slope = Math.atan(.365), cs = Math.cos(slope), sn = Math.sin(slope);
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a, b, x) => a + (b-a)*x;
const smooth = x => { x = clamp(x); return x*x*(3-2*x); };
let ready = false, paused = reduced.matches, held = false, time = 0, last = 0;
let attempt = 1, layout, plan, bodyMask;
const pause = document.getElementById('pause'), push = document.getElementById('push');
const essay = document.getElementById('essay');
bg.src = 'mountain.webp';

function pauseUI() {
  pause.setAttribute('aria-label', paused ? 'Reanudar animación' : 'Pausar animación');
  pause.title = pause.getAttribute('aria-label');
  document.getElementById('pauseIcon').textContent = paused ? '▷' : 'Ⅱ';
}
function hold(value) {
  held = value;
  push.classList.toggle('holding', value);
  if (value && paused) { paused = false; pauseUI(); }
}
pause.onclick = () => { paused = !paused; hold(false); pauseUI(); };
push.onpointerdown = e => { push.setPointerCapture(e.pointerId); hold(true); };
push.onpointerup = push.onpointercancel = push.onlostpointercapture = () => hold(false);
push.onkeydown = e => {
  if (['Space', 'Enter'].includes(e.code)) { e.preventDefault(); hold(true); }
};
push.onkeyup = e => {
  if (['Space', 'Enter'].includes(e.code)) { e.preventDefault(); hold(false); }
};
window.addEventListener('keydown', e => {
  if (e.code === 'Space' && document.activeElement === document.body && !essay.open) {
    e.preventDefault(); hold(true);
  }
});
window.addEventListener('keyup', e => { if (e.code === 'Space') hold(false); });
window.addEventListener('blur', () => hold(false));
document.addEventListener('visibilitychange', () => { last = 0; hold(false); });
let wasPaused = false;
document.getElementById('read').onclick = () => {
  wasPaused = paused; paused = true; hold(false); pauseUI(); essay.showModal();
};
document.getElementById('closeEssay').onclick = () => essay.close();
essay.addEventListener('close', () => { paused = wasPaused; pauseUI(); });
essay.addEventListener('click', e => {
  if (e.target !== essay) return;
  const r = essay.getBoundingClientRect();
  if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) essay.close();
});
reduced.addEventListener('change', e => {
  if (e.matches) { paused = true; hold(false); pauseUI(); }
});
pauseUI();

function point(s, z = 0) {
  return [layout.baseX + (s*cs-z*sn)*layout.unit,
          layout.baseY - (s*sn+z*cs)*layout.unit];
}
function pose(action, i) { return assets.body.meta.poses[assets.body.meta.acciones[action][i]]; }
function poseIndex(action, i) { return assets.body.meta.acciones[action][i]; }
function vector(p, origin, rotation) {
  const a = rotation + slope, c = Math.cos(a), s = Math.sin(a);
  const x = (p[0]-origin[0])/100, y = (p[1]-origin[1])/100;
  return [x*c-y*s, -(x*s+y*c)];
}
function profile(angle) {
  const c = Math.cos(angle), s = Math.sin(angle);
  const poly = assets.stone.meta.contorno.map(([x,y]) => [x*c-y*s, x*s+y*c]);
  return {poly, height: Math.max(...poly.map(p => p[1]))};
}
function leftAt(profile, height) {
  const level = profile.height-height, hits = [];
  const poly = profile.poly;
  for (let i=0; i<poly.length; i++) {
    const a=poly[i], b=poly[(i+1)%poly.length];
    if ((a[1]<=level && b[1]>level) || (b[1]<=level && a[1]>level))
      hits.push(a[0]+(b[0]-a[0])*(level-a[1])/(b[1]-a[1]));
  }
  if (!hits.length) throw Error('Palma fuera de la altura de la piedra');
  return Math.min(...hits);
}
const PUSH_ROT = -8*Math.PI/180;
function pushContact(i, anchor) {
  const p = pose('push', i), hand = vector(p.hand, p.supportSlope || p.support, PUSH_ROT);
  return contactForHand(hand, anchor);
}
function contactForHand(hand, anchor) {
  let s = anchor + hand[0] + .55;
  for (let n=0;n<24;n++) {
    const pr = profile(s/.72);
    const next = anchor+hand[0]-leftAt(pr, hand[1]);
    if (Math.abs(next-s)<1e-7) { s=next; break; }
    s=next;
  }
  return {s, hand, error: s+leftAt(profile(s/.72),hand[1])-anchor-hand[0]};
}

function buildPlan() {
  const a = pushContact(3, 0).s-pushContact(4, 0).s+.06;
  const b = pushContact(7, 0).s-pushContact(0, 0).s+.06;
  const stride = a+b;
  const room = (layout.W-layout.margin-layout.baseX)/layout.unit/cs-2.15;
  const cycles = Math.max(1, Math.floor(room/stride));
  const up = [];
  for (let k=0; k<cycles; k++) for (let i=0; i<8; i++) {
    const anchor=k*stride+(i>=4?a:0);
    up.push({action:'push',i,anchor,depth:0,rotation:PUSH_ROT,rock:pushContact(i,anchor).s});
  }
  // Finish on the same double-support pose that begins the next cycle.
  const summit = cycles*stride;
  up.push({action:'push',i:0,anchor:summit,depth:0,rotation:PUSH_ROT,
           rock:pushContact(0,summit).s});
  const top = up.at(-1).rock, base = up[0].rock;
  const release=[];
  let releaseTop=top;
  for(let i=0;i<7;i++) {
    const rotation=lerp(PUSH_ROT,-slope,clamp((i-3)/3));
    const depth=i<4?0:(i-3)*.65/3;
    const p=pose('release',i),hand=vector(p.hand,p.right,rotation);
    // Once the hands lower out of the contact zone they no longer drive the rock.
    if(i<4)releaseTop=Math.max(releaseTop,contactForHand(hand,summit).s);
    release.push({action:'release',i,anchor:summit,depth,rotation,rock:releaseTop});
  }
  // Two seven-drawing swings. The eighth drawing is the following contact.
  const dark = pose('downDark',6), light = pose('downLight',6);
  const turnEnd=pose('turn',7);
  const downStart=summit+vector(turnEnd.left,turnEnd.right,-slope)[0];
  const stepD = Math.abs(dark.right[0]-dark.left[0])/100;
  const stepL = Math.abs(light.right[0]-light.left[0])/100;
  const pairs = Math.max(1, Math.round(downStart/(stepD+stepL)));
  // Uniform scale for the complete descent, never individual limb deformation.
  const downScale = downStart/(pairs*(stepD+stepL));
  const down=[];
  let anchor=downStart;
  for (let k=0;k<pairs;k++) {
    for (const [action,step] of [['downDark',stepD],['downLight',stepL]]) {
      for (let i=0;i<7;i++) down.push({action,i,anchor,depth:.65,rotation:-slope,scale:downScale});
      anchor-=step*downScale;
    }
  }
  let start=0;
  const phases=[
    ['up',up.length*.12,'EL ASCENSO','I','Todavía no es imposible.'],
    ['release',2.3,'LA PÉRDIDA','II','Caer no responde todas las preguntas.'],
    ['wait',3.8,'ANTES DE BAJAR','III','¿Y si todavía existe una salida?'],
    ['turn',.95,'EL REGRESO','IV','La derrota tampoco está garantizada.'],
    ['down',down.length*.105,'EL REGRESO','IV','La derrota tampoco está garantizada.'],
    ['return',1.25,'OTRA VEZ','V','No hay promesa. Hay un intento.'],
    ['placement',.45,'OTRA VEZ','V','No hay promesa. Hay un intento.'],
    ['reach',1.4,'OTRA VEZ','V','No hay promesa. Hay un intento.'],
    ['brace',.48,'OTRA VEZ','V','No hay promesa. Hay un intento.'],
    ['settle',.08,'OTRA VEZ','V','No hay promesa. Hay un intento.']
  ].map(([key,duration,label,roman,thought])=>{
    const p={key,start,end:start+duration,duration,label,roman,thought};
    start+=duration;return p;
  });
  return {up,down,release,releaseTop,summit,top,base,stride,cycles,downScale,phases,duration:start};
}
function phaseAt(t) {
  return plan.phases.find(p=>t<p.end) || plan.phases.at(-1);
}
function resize() {
  let saved;
  if (ready && plan) { const p=phaseAt(time); saved=[p.key,(time-p.start)/p.duration]; }
  const d=Math.min(devicePixelRatio||1,2);
  canvas.width=Math.round(canvas.clientWidth*d);canvas.height=Math.round(canvas.clientHeight*d);
  const W=canvas.width,H=canvas.height,mobile=canvas.clientWidth<700;
  const scale=Math.max(W/bg.width,H/bg.height),bw=bg.width*scale,bh=bg.height*scale;
  const ox=(W-bw)*(mobile?.47:.5),oy=(H-bh)*.5;
  const unit=Math.min(W*(mobile?.11:.065),bw*.06),margin=W*.065;
  const baseX=margin+unit*1.2;
  const baseY=oy+bh*(.878-.548*((baseX-ox)/bw));
  layout={W,H,bw,bh,ox,oy,unit,margin,baseX,baseY};
  if (ready) {
    plan=buildPlan();
    if(saved) { const p=plan.phases.find(p=>p.key===saved[0]);time=p.start+p.duration*saved[1]; }
    render();
  }
}
window.addEventListener('resize',resize);

function stateAt(t) {
  const phase=phaseAt(t),u=clamp((t-phase.start)/phase.duration);
  let human,rock=plan.base;
  if(phase.key==='up') {
    human=plan.up[Math.min(plan.up.length-1,Math.floor(u*plan.up.length))];rock=human.rock;
  } else if(phase.key==='release') {
    const i=Math.min(6,Math.floor(u*7));
    human=plan.release[i];rock=human.rock;
  } else if(phase.key==='wait') {
    human={action:'wait',i:0,anchor:plan.summit,depth:.65,rotation:-slope};
    // Reversal starts after the release and the move to the foreground path.
    rock=lerp(plan.releaseTop,plan.base,smooth((t-phase.start)/3.4));
  } else if(phase.key==='turn') {
    human={action:'turn',i:Math.min(7,Math.floor(u*8)),anchor:plan.summit,depth:.65,rotation:-slope};
  } else if(phase.key==='down') {
    human=plan.down[Math.min(plan.down.length-1,Math.floor(u*plan.down.length))];
  } else if(phase.key==='return') {
    const i=Math.min(7,Math.floor(u*8));
    human={action:'return',i,anchor:0,depth:[.65,.65,.65,.65,.4,.4,.1,0][i],rotation:-slope};
  } else if(phase.key==='reach') {
    human={action:'reach',i:Math.min(7,Math.floor(u*8)),anchor:0,depth:0,rotation:lerp(-slope,PUSH_ROT,smooth(u))};
  } else if(phase.key==='placement') {
    human={action:'placement',i:Math.min(2,Math.floor(u*3)),anchor:0,depth:0,rotation:-slope};
  } else if(phase.key==='brace') {
    human={action:'brace',i:Math.min(3,Math.floor(u*4)),anchor:0,depth:0,rotation:PUSH_ROT};
  } else {
    human=plan.up[0];
  }
  return {phase,u,human,rock};
}
function drawHuman(h) {
  const p=pose(h.action,h.i),index=poseIndex(h.action,h.i),m=assets.body.meta;
  let anchor=h.action==='push'?(p.supportSlope||p.support):p.support;
  // During stationary phases the same right foot remains the reference.
  if(!['push','downDark','downLight'].includes(h.action)) anchor=p.right;
  if(h.action==='return' && h.i<7) anchor=p.left;
  const scale=h.scale||1, f=layout.unit/100*scale;
  const at=point(h.anchor,-h.depth);
  ctx.save();ctx.translate(...at);ctx.rotate(h.rotation);
  const src=[index%8*m.celda[0],Math.floor(index/8)*m.celda[1],...m.celda];
  const dst=[-anchor[0]*f,-anchor[1]*f,m.celda[0]*f,m.celda[1]*f];
  ctx.drawImage(bodyMask,...src,...dst);
  ctx.globalCompositeOperation='multiply';ctx.drawImage(assets.body.img,...src,...dst);
  ctx.restore();
  const hand=vector(p.hand,anchor,h.rotation);
  const worldHand=point(h.anchor+hand[0]*scale,hand[1]*scale-h.depth);
  const map=pixel=>{
    const v=vector(pixel,anchor,h.rotation);
    return point(h.anchor+v[0]*scale,v[1]*scale-h.depth);
  };
  const corners=[[8,8],[p.size[0],8],[8,p.size[1]],p.size].map(map);
  return {action:h.action,frame:h.i,foot:at,hand:worldHand,anchor:h.anchor,depth:h.depth,
          scale,rotation:h.rotation,index,left:map(p.left),right:map(p.right),
          bounds:[Math.min(...corners.map(p=>p[0])),Math.min(...corners.map(p=>p[1])),
                  Math.max(...corners.map(p=>p[0])),Math.max(...corners.map(p=>p[1]))]};
}
function drawStone(s) {
  const angle=s/.72,pr=profile(angle),at=point(s,pr.height);
  const m=assets.stone.meta,f=layout.unit/m.pixeles_por_metro;
  ctx.save();ctx.translate(...at);ctx.rotate(angle-slope);
  ctx.fillStyle='#bda577';ctx.beginPath();
  m.contorno.forEach(([x,y],i)=>i?ctx.lineTo(x*layout.unit,y*layout.unit):ctx.moveTo(x*layout.unit,y*layout.unit));
  ctx.closePath();ctx.fill();ctx.globalCompositeOperation='multiply';
  ctx.drawImage(assets.stone.img,-m.ancla[0]*f,-m.ancla[1]*f,...m.celda.map(v=>v*f));ctx.restore();
  return {s,center:at,angle:angle-slope,height:pr.height,radius:.72*layout.unit,
    groundClearance:Math.min(...pr.poly.map(p=>pr.height-p[1]))};
}
function render() {
  if(!ready)return;
  const s=stateAt(time),g=layout;
  ctx.clearRect(0,0,g.W,g.H);ctx.drawImage(bg,g.ox,g.oy,g.bw,g.bh);
  const stone=drawStone(s.rock),human=drawHuman(s.human),p=s.phase;
  document.getElementById('phaseName').textContent=p.label;
  document.getElementById('phaseNumber').textContent=p.roman;
  document.getElementById('thought').textContent=p.thought;
  document.getElementById('count').textContent='INTENTO '+String(attempt).padStart(3,'0');
  document.getElementById('progress').style.height=time/plan.duration*100+'%';
  document.getElementById('pushLabel').textContent=p.key==='up'?(held?'Un paso más…':'Ayudalo a empujar'):'Acompañalo';
  window.revisionObra={time,attempt,phase:p.key,u:s.u,human,stone,unit:g.unit,
    viewport:[g.W,g.H],duration:plan.duration,phases:plan.phases,cycles:plan.cycles,
    downScale:plan.downScale,paused,held};
}
function tick(dt) {
  if(paused||!ready)return;
  let advance=dt*(held&&phaseAt(time).key==='up'?1.3:1);
  const boundary=plan.phases[0].end;
  if(time<boundary&&time+advance>boundary&&held)
    advance=boundary-time+(advance-(boundary-time))/1.3;
  time+=advance;
  while(time>=plan.duration){time-=plan.duration;attempt++;}
}
function frame(ts) {
  requestAnimationFrame(frame);
  const dt=last?Math.min((ts-last)/1000,.05):0;last=ts;
  if(!document.hidden)tick(dt);
  render();
}
async function load(name,file) {
  const res=await fetch('media/'+file+'.json');if(!res.ok)throw Error(file);
  const meta=await res.json(),img=new Image();img.src='media/'+meta.imagen;await img.decode();
  assets[name]={meta,img};
}
async function init() {
  await Promise.all([bg.decode(),load('body','obra'),load('stone','piedra-ciclo')]);
  const source=new Image();source.src='media/'+assets.body.meta.mascara;await source.decode();
  bodyMask=document.createElement('canvas');bodyMask.width=source.width;bodyMask.height=source.height;
  const c=bodyMask.getContext('2d');c.drawImage(source,0,0);c.globalCompositeOperation='source-in';
  c.fillStyle='#ddc48f';c.fillRect(0,0,source.width,source.height);
  ready=true;resize();document.getElementById('loading').classList.add('loaded');
  window.obraReview={
    seek(t){time=((t%plan.duration)+plan.duration)%plan.duration;attempt=Math.floor(t/plan.duration)+1;paused=true;pauseUI();render();return window.revisionObra;},
    tick(dt){tick(dt);render();return window.revisionObra;},
    phases(){return plan.phases;},
  };
}
init().catch(e=>{document.getElementById('loading').textContent='No se pudo cargar la escena.';console.error(e);});
requestAnimationFrame(frame);
