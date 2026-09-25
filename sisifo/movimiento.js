'use strict';
(()=>{
const TAU=Math.PI*2,step=80,stance=.64,R=70;
const lerp=(a,b,v)=>a+(b-a)*v;
const smooth=v=>v*v*(3-2*v);
function ik(a,b,l1,l2,bend=1){const dx=b.x-a.x,dy=b.y-a.y,raw=Math.hypot(dx,dy),d=Math.max(.001,Math.min(raw,l1+l2-.001));const ux=dx/(raw||1),uy=dy/(raw||1);const along=(l1*l1-l2*l2+d*d)/(2*d),height=Math.sqrt(Math.max(0,l1*l1-along*along));return {x:a.x+ux*along-uy*height*bend,y:a.y+uy*along+ux*height*bend}}
function foot(distance,offset){const cycle=distance/step+offset,k=Math.floor(cycle),f=cycle-k;const anchor=(k-offset)*step+stance*step/2;let x=anchor,y=-7,heel=0;
if(f>=stance){let z=(f-stance)/(1-stance);x+=step*smooth(z);y-=Math.sin(Math.PI*z)**2*21;heel=Math.sin(Math.PI*z)*.12}
return {x:x-158,y,planted:f<stance,phase:f,heel}}
function model(time){const distance=time*22-2.8*Math.sin(time*TAU/1.38),effort=(1+Math.cos(time*TAU/1.38))/2;
const hip={x:distance-147,y:-96-2*Math.sin(distance/step*TAU*2)};
const shoulder={x:hip.x+55+effort*3,y:hip.y-55+effort*2};
const rock={x:distance,y:-R,r:R,angle:distance/R};
const contact=theta=>({x:rock.x+R*Math.cos(theta),y:rock.y+R*Math.sin(theta)});
const hands=[contact(Math.PI+.30),contact(Math.PI+.48)];
const feet=[foot(distance,0),foot(distance,.5)];
const knees=feet.map(f=>ik(hip,f,55,55,-1));
const elbows=hands.map(h=>ik(shoulder,h,44,44,1));
return {distance,effort,hip,shoulder,rock,hands,feet,knees,elbows};}
// Expose the pure kinematic model so contact constraints can be checked separately.
if(typeof window!=='undefined')window.sisifoMotionModel=model;
if(typeof module!=='undefined')module.exports={model,ik,step,stance};
if(typeof document==='undefined')return;
const canvas=document.getElementById('motion'),ctx=canvas.getContext('2d'),play=document.getElementById('play'),guides=document.getElementById('guides');
let time=1,last=0,speed=1,paused=matchMedia('(prefers-reduced-motion: reduce)').matches;
function updatePlay(){play.textContent=paused?'Reproducir':'Pausar';play.setAttribute('aria-label',paused?'Reproducir animación':'Pausar animación')}
play.onclick=()=>{paused=!paused;updatePlay()};updatePlay();
for(const [id,value] of [['slow',.5],['normal',1]])document.getElementById(id).onclick=()=>{speed=value;document.getElementById('slow').setAttribute('aria-pressed',String(value===.5));document.getElementById('normal').setAttribute('aria-pressed',String(value===1))};
document.addEventListener('visibilitychange',()=>last=0);
function resize(){const r=canvas.getBoundingClientRect(),d=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(r.width*d);canvas.height=Math.round(r.height*d)}window.addEventListener('resize',resize);resize();
const P=(x,y)=>({x,y});
function line(a,b,width,color){ctx.strokeStyle=color;ctx.lineWidth=width;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke()}
function circle(p,r,color){ctx.fillStyle=color;ctx.beginPath();ctx.arc(p.x,p.y,r,0,TAU);ctx.fill()}
function label(text,p){ctx.save();ctx.font='10px Arial';ctx.fillStyle='#985035';ctx.fillText(text,p.x,p.y);ctx.restore()}
function draw(ts){requestAnimationFrame(draw);const dt=last?Math.min((ts-last)/1000,.06):0;last=ts;if(!paused&&!document.hidden)time+=dt*speed;const m=model(time),W=canvas.width,H=canvas.height,scale=Math.min(W/570,H/330);ctx.clearRect(0,0,W,H);ctx.save();ctx.translate(W*.58,H*.68);ctx.scale(scale,scale);ctx.rotate(-.21);ctx.translate(-m.distance,0);
// The ridge scrolls through the camera; grounded feet stay fixed to its marks.
line(P(m.distance-700,0),P(m.distance+650,0),1.8,'#858776');
for(let k=Math.floor((m.distance-700)/28);k<Math.ceil((m.distance+650)/28);k++)line(P(k*28,4),P(k*28-7,10),.75,'#aaa58f');
// Back limbs are a darker value. The endpoints are solved, never swapped images.
for(let i=1;i>=0;i--){const f=m.feet[i],k=m.knees[i],color=i?'#858472':'#353c34';line(m.hip,k,15,color);line(k,f,10,color);const toe=P(f.x+15,f.y+7),heel=P(f.x-7,f.y+7);line(heel,toe,6,color);if(guides.checked&&f.planted){line(P(f.x-9,1),P(f.x+19,1),3,'#aa6340');circle(P(f.x+3,1),2.3,'#aa6340')}}
// A restrained, deliberately schematic body keeps attention on the motion.
line(m.hip,m.shoulder,25,'#353c34');circle(m.hip,13,'#353c34');
const neck=P(m.shoulder.x+8,m.shoulder.y-13),head=P(neck.x+12,neck.y-10);line(m.shoulder,neck,13,'#353c34');circle(head,13,'#353c34');line(P(head.x+8,head.y),P(head.x+14,head.y+3),4,'#353c34');
for(let i=1;i>=0;i--){const color=i?'#747762':'#454e40';line(m.shoulder,m.elbows[i],11,color);line(m.elbows[i],m.hands[i],8,color);circle(m.hands[i],4.1,color)}
// Rigid circular body: angular displacement exactly equals distance / radius.
ctx.save();ctx.translate(m.rock.x,m.rock.y);ctx.rotate(m.rock.angle);circle(P(0,0),R,'#474a3c');ctx.strokeStyle='#aaa486';ctx.lineWidth=1;ctx.beginPath();ctx.arc(0,0,R-5,0,TAU);ctx.stroke();for(let i=0;i<9;i++){let x=-54+i*13,y=Math.sqrt(Math.max(0,(R-10)**2-x*x));line(P(x,-y),P(x,y),.65,'#686c56')}line(P(-46,11),P(21,-34),1.5,'#8d8a6d');line(P(21,-34),P(47,-9),1.2,'#8d8a6d');ctx.restore();
if(guides.checked){ctx.save();ctx.setLineDash([3,4]);line(P(m.rock.x,0),m.rock,1,'#ae6c43');ctx.restore();for(const p of [m.hip,m.shoulder,...m.knees,...m.elbows,...m.feet]){circle(p,3.7,'#ede2c8');circle(p,1.5,'#985035')}m.hands.forEach(p=>circle(p,3.5,'#cf9764'));circle(P(m.rock.x,0),3,'#985035');label('CONTACTO',P(m.rock.x-45,-R*2-13));label('APOYO',P(m.feet.find(f=>f.planted)?.x-10||m.hip.x,29))}
ctx.restore();
}
requestAnimationFrame(draw);
})();
