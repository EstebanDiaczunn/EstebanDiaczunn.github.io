"use strict";
const canvas=document.getElementById('world'),ctx=canvas.getContext('2d');
const pause=document.getElementById('pause'),push=document.getElementById('push');
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
let paused=reduced.matches,held=false,t=0,last=0,attempt=1,ready=false;
const duration=24, PENDIENTE=Math.atan(.365),clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const bg=new Image(),piezas={};let bodyMask;bg.src='mountain.webp';
const smooth=x=>{x=clamp(x);return x*x*(3-2*x)};
function pauseUI() { pause.setAttribute('aria-label', paused ? 'Reanudar animación' : 'Pausar animación'); pause.title = pause.getAttribute('aria-label'); document.getElementById('pauseIcon').textContent = paused ? '▷' : 'Ⅱ' }
function hold(v) { held = v; push.classList.toggle('holding', v); if (v && paused) { paused = false; pauseUI() } }
pauseUI(); pause.onclick = () => { paused = !paused; hold(false); pauseUI() };
push.onpointerdown = e => { push.setPointerCapture(e.pointerId); hold(true) }; push.onpointerup = push.onpointercancel = push.onlostpointercapture = () => hold(false);
push.onkeydown = e => { if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); hold(true) } }; push.onkeyup = e => { if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); hold(false) } };
window.addEventListener('keydown', e => { if (e.code === 'Space' && document.activeElement === document.body && !essay.open) { e.preventDefault(); hold(true) } }); window.addEventListener('keyup', e => { if (e.code === 'Space') hold(false) }); window.addEventListener('blur', () => hold(false)); document.addEventListener('visibilitychange', () => { last = 0; hold(false) });
const essay = document.getElementById('essay'); let wasPaused = false;
document.getElementById('read').onclick = () => { wasPaused = paused; paused = true; hold(false); pauseUI(); essay.showModal() };
document.getElementById('closeEssay').onclick = () => essay.close(); essay.addEventListener('close', () => { paused = wasPaused; pauseUI() }); essay.addEventListener('click', e => { if (e.target === essay) { const r = essay.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) essay.close() } });
function resize() { const d = Math.min(devicePixelRatio || 1, 2); canvas.width = canvas.clientWidth * d; canvas.height = canvas.clientHeight * d; if(ready)render() } window.addEventListener('resize', resize); resize();

// Reloj único para todas las acciones. La ayuda sólo modifica el ascenso.
// Las poses se dibujan enteras: sin deformación, mezclas ni inversión de piernas.
const phases=[
 {key:'A',start:0,end:9.6,label:'EL ASCENSO',roman:'I',thought:'Todavía no es imposible.'},
 {key:'B',start:9.6,end:11.6,label:'LA CAÍDA',roman:'II',thought:'Caer no responde todas las preguntas.'},
 {key:'C',start:11.6,end:14,label:'ANTES DE BAJAR',roman:'III',thought:'¿Y si todavía existe una salida?'},
 {key:'D',start:14,end:15.6,label:'EL REGRESO',roman:'IV',thought:'La derrota tampoco está garantizada.'},
 {key:'E',start:15.6,end:21.2,label:'EL REGRESO',roman:'IV',thought:'La derrota tampoco está garantizada.'},
 {key:'F',start:21.2,end:24,label:'OTRA VEZ',roman:'V',thought:'No hay promesa. Hay un intento.'}
];
function stateAt(time){
 const phase=phases.find(p=>time<p.end)||phases[5],u=clamp((time-phase.start)/(phase.end-phase.start));
 let index,q;
 if(phase.key==='A'){index=Math.floor(u*120)%40;q=u;}
 if(phase.key==='B'){index=40+Math.min(7,Math.floor(u*8));q=1;}
 if(phase.key==='C'){index=48+Math.floor(u*16)%8;q=1;}
 if(phase.key==='D'){index=56+Math.min(7,Math.floor(u*8));q=1-.08*smooth(u);}
 if(phase.key==='E'){index=64+Math.floor(u*48)%24;q=.92*(1-u);}
 if(phase.key==='F'){index=88+Math.min(15,Math.floor(u*16));q=0;}
 return {phase:phase.key,index,q,u,description:phase};
}
function geometry(){
 const W=canvas.width,H=canvas.height,mobile=canvas.clientWidth<700;
 const scale=Math.max(W/bg.width,H/bg.height),bw=bg.width*scale,bh=bg.height*scale;
 const ox=(W-bw)*(mobile?.47:.5),oy=(H-bh)*.5;
 const unit=Math.min(W*.10,bw*.062),baseX=W*.18,length=W*.53;
 const ground=x=>oy+bh*(.874-.548*((x-ox)/bw));
 return {W,H,bw,bh,ox,oy,unit,baseX,length,ground};
}
function figure(index,x,y,unit){
 const m=piezas.ciclo.meta,p=m.poses[index],f=unit/80,a=m.giro*Math.PI/180;
 ctx.save();ctx.translate(x,y);ctx.rotate(a);
 ctx.drawImage(bodyMask,index%8*m.celda[0],Math.floor(index/8)*m.celda[1],...m.celda,-p.pie[0]*f,-p.pie[1]*f,180*f,240*f);
 ctx.globalCompositeOperation='multiply';
 ctx.drawImage(piezas.ciclo.img,index%8*m.celda[0],Math.floor(index/8)*m.celda[1],...m.celda,-p.pie[0]*f,-p.pie[1]*f,180*f,240*f);ctx.restore();
 const dx=(p.mano[0]-p.pie[0])*f,dy=(p.mano[1]-p.pie[1])*f;
 return {hand:[x+dx*Math.cos(a)-dy*Math.sin(a),y+dx*Math.sin(a)+dy*Math.cos(a)],foot:[x,y]};
}
function stoneProfile(angle){
 const cs=Math.cos(angle),sn=Math.sin(angle);
 return piezas.piedra.meta.contorno.map(([x,y])=>[x*cs-y*sn,x*sn+y*cs]);
}
function stone(x,groundY,angle,unit,drop=0){
 const m=piezas.piedra.meta,poly=stoneProfile(angle+PENDIENTE);
 const height=Math.max(...poly.map(p=>p[1]));
 const cx=x-height*unit*Math.sin(PENDIENTE),cy=groundY-height*unit*Math.cos(PENDIENTE)+drop;
 const f=unit/m.pixeles_por_metro;
 ctx.save();ctx.translate(cx,cy);ctx.rotate(angle);
 ctx.fillStyle='#bca477';ctx.beginPath();m.contorno.forEach(([x,y],i)=>{if(i)ctx.lineTo(x*unit,y*unit);else ctx.moveTo(x*unit,y*unit)});ctx.closePath();ctx.fill();ctx.globalCompositeOperation='multiply';
 ctx.drawImage(piezas.piedra.img,-m.ancla[0]*f,-m.ancla[1]*f,m.celda[0]*f,m.celda[1]*f);ctx.restore();
 return {center:[cx,cy],angle,radius:m.radio_piedra*unit};
}
function render(){
 const g=geometry(),s=stateAt(t),{unit,ground}=g;
 ctx.clearRect(0,0,g.W,g.H);ctx.drawImage(bg,g.ox,g.oy,g.bw,g.bh);
 const x=g.baseX+g.length*s.q,y=ground(x);
 function contact(index,footX){
  const p=piezas.ciclo.meta.poses[index],dx=(p.mano[0]-p.pie[0])/80,hy=(p.pie[1]-p.mano[1])/80;
  let along=dx+.68;
  for(let n=0;n<12;n++){
   const poly=stoneProfile((footX-g.baseX+along*unit*Math.cos(PENDIENTE))/(unit*.72*Math.cos(PENDIENTE)));
   const height=Math.max(...poly.map(p=>p[1])),level=height-hy,edges=[];
   for(let j=0;j<poly.length;j++){const a=poly[j],b=poly[(j+1)%poly.length];if((a[1]<=level&&b[1]>level)||(b[1]<=level&&a[1]>level))edges.push(a[0]+(b[0]-a[0])*(level-a[1])/(b[1]-a[1]));}
   along=dx-(edges.length?Math.min(...edges):-.5);
  }
  return footX+along*unit*Math.cos(PENDIENTE);
 }
 const stoneBase=contact(0,g.baseX),stoneTop=contact(0,g.baseX+g.length);
 let rockX=contact(s.index,x),drop=0;
 if(t>=9.6){
  const u=clamp((t-10.05)/3.4),travel=smooth((u-.16)/.84);
  rockX=stoneTop+(stoneBase-stoneTop)*travel;
  drop=unit*2.4*Math.sin(Math.PI*Math.pow(u,.55))**2;
  if(u>=1)drop=0;
 }
 const angle=(rockX-g.baseX)/(unit*.72*Math.cos(PENDIENTE))-PENDIENTE;
 let rock,human;
 if(s.phase==='E'||s.phase==='D'){human=figure(s.index,x,y,unit);rock=stone(rockX,ground(rockX),angle,unit,drop);}
 else{rock=stone(rockX,ground(rockX),angle,unit,drop);human=figure(s.index,x,y,unit);}
 const d=s.description;
 document.getElementById('phaseName').textContent=d.label;
 document.getElementById('phaseNumber').textContent=d.roman;
 document.getElementById('thought').textContent=d.thought;
 document.getElementById('count').textContent='INTENTO '+String(attempt).padStart(3,'0');
 document.getElementById('progress').style.height=t/duration*100+'%';
 document.getElementById('pushLabel').textContent=s.phase==='A'?(held?'Un paso más…':'Ayudalo a empujar'):'Acompañalo';
 window.revisionCiclo={time:t,attempt,...s,figure:human,stone:rock,unit,viewport:[g.W,g.H]};
}
function frame(ts){
 requestAnimationFrame(frame);if(!ready)return;
 const dt=last?Math.min((ts-last)/1000,.05):0;last=ts;
 if(!paused&&!document.hidden){
  let advance=dt*(held&&t<9.6?1.35:1);
  if(t<9.6&&t+advance>9.6)advance=9.6-t+(advance-(9.6-t))/(held?1.35:1);
  t+=advance;while(t>=duration){t-=duration;attempt++;}
 }
 render();
}
reduced.addEventListener('change',e=>{if(e.matches){paused=true;hold(false);pauseUI();}});
const version=new URLSearchParams(location.search).get('v')||'ciclo-1';
async function load(name,file){
 const res=await fetch('media/'+file+'.json?v='+encodeURIComponent(version));if(!res.ok)throw Error(file);
 const meta=await res.json(),img=new Image();img.src='media/'+meta.imagen+'?v='+encodeURIComponent(version);await img.decode();piezas[name]={meta,img};
}
async function loadMask(){const img=new Image();img.src='media/ciclo-mascara.webp?v='+encodeURIComponent(version);await img.decode();bodyMask=document.createElement('canvas');bodyMask.width=img.width;bodyMask.height=img.height;const g=bodyMask.getContext('2d');g.drawImage(img,0,0);g.globalCompositeOperation='source-in';g.fillStyle='#ddc48f';g.fillRect(0,0,img.width,img.height);}
Promise.all([bg.decode(),load('ciclo','ciclo'),load('piedra','piedra-ciclo'),loadMask()]).then(()=>{ready=true;render();document.getElementById('loading').classList.add('loaded')}).catch(e=>{document.getElementById('loading').textContent='No se pudo cargar la escena.';console.error(e)});
requestAnimationFrame(frame);
