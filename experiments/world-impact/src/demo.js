/* Local interactive harness. This does not contain or replace the v15 game. */
(function () {
'use strict';
const { MutationWorld, ROUTES, KEYS, classifyMass, projectSizes } = BISWorld;
const $ = id => document.getElementById(id);
const engine = new MutationWorld({ seed: 101 });
const canvas = $('worldCanvas'), ctx = canvas.getContext('2d');
let host = null, last = 0, uiClock = 0, down = new Set(), cueUntil = 0;
let viewport = { width: 600, height: 380 }, simulationId = 0;
const clamp = (n,a,b) => Math.max(a,Math.min(b,n));
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
let shownCues = [], nextCueAt = 0;
function freshHost() { return { x: 0, lane: .52, mass: 1, baseMass: 1, hp: 100, maxHp: 100,
  enemies: [], nextSpawn: 1.1, spawnIndex: 0, impacts: [], landmarksAt: 0, time: 0, invulnerableUntil: 0 }; }
function resize() {
  const r = canvas.getBoundingClientRect(); if (!r.width || !r.height) return;
  const d = Math.min(devicePixelRatio || 1, 2);
  viewport = { width: r.width, height: r.height };
  canvas.width = Math.max(1,Math.round(r.width*d)); canvas.height = Math.max(1,Math.round(r.height*d));
  ctx.setTransform(d,0,0,d,0,0); render();
}
function start(route) {
  engine.restart(101); host = freshHost(); simulationId = 0; shownCues = []; nextCueAt = 0;
  $('home').hidden = true; $('play').hidden = false; $('modal').hidden = true;
  addLandmark(host.x+80);
  engine.selectMutation({ token: engine.token, id: 'initial', route, position: host });
  document.documentElement.style.setProperty('--accent', ROUTES[route].color);
  resize(); updateUI(true); last = performance.now();
}
for (const k of KEYS) {
  const b = document.createElement('button'); b.className='route'; b.dataset.route=k;
  b.style.setProperty('--c',ROUTES[k].color);
  b.innerHTML='<span class="eyebrow">ROUTE '+k+'</span><b>'+ROUTES[k].name+'</b><span class="sub">'+ROUTES[k].instant+'</span><span class="enter">进入联动验证 →</span>';
  b.onclick=()=>start(k); $('routeCards').appendChild(b);
}
function addLandmark(x) {
  const names=['村口避雨棚','县城临时安置点','高楼疏散口','前线联络站'];
  engine.registerLandmark({id: 'landmark-'+engine.state.round+'-'+Math.round(x),name:names[engine.state.round%4],x,lane:.46,kind:'shelter'});
}
function collectCues() {
  const cues=engine.drainCues();
  // Immediate mutation/action takes priority over NPC commentary. No stacked banners.
  for (const c of cues) if (c.type==='mutation'||c.type==='ability') shownCues.unshift(c); else shownCues.push(c);
  if (shownCues.length>8) shownCues.length=8;
  if (cues.some(c=>c.type==='mutation'||c.type==='ability')) nextCueAt=0;
}
function updateUI(force=false) {
  if(!host) return;
  const s=engine.state,r=engine.region,k=s.primary;
  collectCues();
  if(shownCues.length && (s.time>=nextCueAt || force)) {
    const c=shownCues.shift(); $('cue').textContent=c.text;
    $('cue').style.borderColor=c.route?ROUTES[c.route].color:'#91ce79';
    cueUntil=s.time+3; nextCueAt=s.time+3;
  } else if (s.time>cueUntil&&!shownCues.length) $('cue').textContent='观察路面痕迹与敌人反应；大于自己的目标仍然危险。';
  $('regionLabel').textContent='第 '+(s.round+1)+' 轮 · '+r.name;
  $('routeLabel').textContent=k?ROUTES[k].name+' · '+ROUTES[k].action+'改变路面':'尚未变异';
  $('massLabel').textContent='本轮尺度 '+Math.sqrt(host.mass/host.baseMass).toFixed(2)+'×';
  $('hpLabel').textContent='体力 '+Math.ceil(host.hp)+' / '+host.maxHp;
  $('hpBar').style.width=clamp(host.hp/host.maxHp*100,0,100)+'%';
  const remaining=Math.max(0,s.cooldownUntil-s.time);
  $('ability').textContent=(k?ROUTES[k].action:'能力')+(remaining>0?' · '+remaining.toFixed(1)+'秒':' · 就绪');
  $('ability').disabled=!engine.ready;
  $('pause').textContent=s.paused?'继续':'暂停';
  $('stats').innerHTML=KEYS.map(r=>'<div class="stat"><span>'+ROUTES[r].name+'痕迹</span><b>'+s.local[r]+'</b></div>').join('');
  const echoes=s.entryEchoes.map(e=>'<div class="trace"><b>上一轮留下的后果</b>'+e.fromRegion+' · '+e.cause+'<br>→ '+e.consequence+'</div>').join('');
  const j=s.journal.filter(e=>e.round===s.round).slice(-3).reverse();
  $('echoList').innerHTML=echoes+j.map(e=>'<div class="trace"><b>'+ROUTES[e.route].name+' / '+e.region+'</b>'+e.text+'</div>').join('');
}
function activate() { if(!host)return; if(engine.activate(host).accepted) updateUI(true); }
$('ability').onclick=activate;
function bindMove(id,key) {
 const b=$(id); b.onpointerdown=e=>{e.preventDefault();b.setPointerCapture(e.pointerId);down.add(key)};
 for(const ev of ['pointerup','pointercancel','lostpointercapture']) b.addEventListener(ev,()=>down.delete(key));
}
bindMove('up','up');bindMove('down','down');
document.addEventListener('keydown',e=>{if(!host||$('play').hidden||e.target.closest('details'))return;
 if(['ArrowUp','ArrowDown',' ','w','s','W','S'].includes(e.key))e.preventDefault();
 if(['ArrowUp','w','W'].includes(e.key))down.add('up');
 if(['ArrowDown','s','S'].includes(e.key))down.add('down');
 if(e.key===' '&&!e.repeat)activate();});
document.addEventListener('keyup',e=>{if(['ArrowUp','w','W'].includes(e.key))down.delete('up');if(['ArrowDown','s','S'].includes(e.key))down.delete('down')});
window.addEventListener('blur',()=>{down.clear();if(host){engine.setPaused(true);updateUI()}});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&host){down.clear();engine.setPaused(true);updateUI()}});
let dragging=false;
function drag(e){if(!host||!dragging||!engine._playing())return;const b=canvas.getBoundingClientRect();host.lane=clamp(((e.clientY-b.top)/b.height-.46)/.45,.08,.92)}
canvas.onpointerdown=e=>{dragging=true;canvas.setPointerCapture(e.pointerId);drag(e)};canvas.onpointermove=drag;
canvas.onpointerup=canvas.onpointercancel=()=>{dragging=false};
$('pause').onclick=()=>{if(host){engine.setPaused(!engine.state.paused);down.clear();updateUI()}};
$('homeButton').onclick=()=>{$('play').hidden=true;$('home').hidden=false;host=null;down.clear()};
function defeatBoss() {
 if(!host)return;
 const summary=engine.defeatBoss({token:engine.token,bossId:engine.region.boss,playerMass:host.mass});
 if(!summary)return;
 const lines=summary.echoes.map(e=>'<div class="resultline"><b>'+ROUTES[e.route].name+' · '+e.count+'处痕迹</b><br>'+e.consequence+'</div>').join('');
 $('modalContent').innerHTML='<div class="eyebrow">流程模拟 / 非完整 BOSS 战</div><h2>胜利之后，后果继续。</h2><p>保留本局变异与绝对力量，只调整下一轮的画面标尺。</p>'+lines+'<button class="action" id="nextRound">前往'+summary.nextRegion+' →</button>';
 $('modal').hidden=false;
 $('nextRound').onclick=()=>{const next=engine.enterNextRound();if(!next)return;
   host.baseMass=next.displayBaseMass;host.x=0;host.enemies=[];host.spawnIndex=0;host.nextSpawn=host.time+1;
   host.hp=Math.min(host.maxHp,host.hp+next.shelterSupport);host.invulnerableUntil=0;
   shownCues=[];nextCueAt=0;addLandmark(90);
   $('modal').hidden=true;updateUI(true);render();};
 updateUI();
}
function die(reason) {
 if(!host)return;engine.die(reason);
 $('modalContent').innerHTML='<div class="eyebrow">本次时间线结束</div><h2>这次的路，到此为止。</h2><p>'+reason+'</p><p>重开后回到故乡；本局变异、地面痕迹和跨轮追踪全部清空。不会继承这一局的生态惩罚。</p><button class="action" id="restart">回到农村 · 重新选择</button>';
 $('modal').hidden=false;
 $('restart').onclick=()=>{engine.restart();host=null;down.clear();$('play').hidden=true;$('home').hidden=false;};
 updateUI(true);
}
$('testBoss').onclick=defeatBoss;
$('testDeath').onclick=()=>die('验收：模拟本局死亡');
$('testWin').onclick=()=>{if(!host||!engine._playing())return;
 host.hp=Math.min(host.hp,80);const result=engine.onCollisionResolved({token:engine.token,id:'sim-'+(++simulationId),result:'shatter',position:host,player:host});
 host.hp+=result.heal;host.mass*=1.08;updateUI(true);};
$('testHit').onclick=()=>{if(!host||!engine._playing())return;const m=engine.playerModifiers();
 host.hp=Math.max(0,host.hp-12*m.damageFactor);engine.onCollisionResolved({token:engine.token,id:'sim-'+(++simulationId),result:'retreat',position:host,player:host});if(host.hp<=0)die('验收受击：体力耗尽');updateUI(true);};
function spawn(){
 const i=host.spawnIndex++,table=[.40,.62,.91,1.33,.54,2.10];
 // Fixed mass at spawn; never follow player growth after appearing.
 const mass=host.baseMass*table[i%table.length];
 const adaptation=engine.decorateSpawn(i);
 const behind=i%4===3;
 host.enemies.push({id:'enemy-'+engine.state.round+'-'+i,x:host.x+(behind?-125:viewport.width*.86),lane:[.52,.30,.73,.52,.42,.85][i%6],
 absMass:mass,baseSpeed:behind?120:-42,pursuer:behind,...adaptation});
}
function step(dt){
 if(!host||!engine._playing())return;
 host.time+=dt;const speed=48;host.x+=speed*dt;
 const pm=engine.playerModifiers();host.lane=clamp(host.lane+((down.has('down')?1:0)-(down.has('up')?1:0))*.72*pm.laneSpeedFactor*dt,.08,.92);
 engine.tick(dt,host);
 if(host.time>=host.nextSpawn){spawn();host.nextSpawn=host.time+2.5;}
 if(host.x>host.landmarksAt+450){host.landmarksAt=host.x;addLandmark(host.x+130)}
 const token=engine.token;
 for(const e of host.enemies){
   const mod=engine.enemyModifiers(e);e.currentModifier=mod;
   e.x+=e.baseSpeed*mod.speedFactor*dt;
   if(e.pursuer&&e.adaptation!=='A')e.lane+=clamp(host.lane-e.lane,-1,1)*dt*.20;
   if(e.adaptation==='A')e.lane=clamp(e.lane+Math.sin(host.time*1.8)*dt*.15,.08,.92);
   if(e.used||host.time<host.invulnerableUntil)continue;
   const sizes=projectSizes(host.mass,e.absMass,host.baseMass,24);
   const dx=e.x-host.x,dy=(e.lane-host.lane)*viewport.height*.45;
   if(Math.hypot(dx,dy)>sizes.player+sizes.enemy)continue;
   e.used=true;const result=classifyMass(host.mass,e.absMass);
   if(!result.win&&!result.fatal){const damage=result.code==='retreat'?9:25;host.hp=Math.max(0,host.hp-damage*pm.damageFactor);
     host.x-=20*pm.knockbackFactor;host.mass=Math.max(.6,host.mass*.97);host.invulnerableUntil=host.time+.6;}
   const resolved=engine.onCollisionResolved({token,id:e.id,result:result.code,position:{x:e.x,lane:e.lane},player:host});
   host.hp=Math.min(host.maxHp,host.hp+resolved.heal);
   host.impacts.push({x:e.x,lane:e.lane,born:host.time,text:result.label,color:result.win?'#f1d679':'#ed9d8e'});
   if(result.win)host.mass+=e.absMass*.17;
   if(result.fatal||host.hp<=0){die(result.fatal?'体型差距过大，被撞碎':'体力耗尽');break;}
 }
 host.enemies=host.enemies.filter(e=>!e.used&&Math.abs(e.x-host.x)<viewport.width*1.5).slice(-18);
 host.impacts=host.impacts.filter(e=>host.time-e.born<1.2).slice(-14);
}
function ellipse(x,y,rx,ry,fill){ctx.fillStyle=fill;ctx.beginPath();ctx.ellipse(x,y,Math.max(.1,rx),Math.max(.1,ry),0,0,Math.PI*2);ctx.fill()}
function line(x1,y1,x2,y2,color,width=2){ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke()}
function roundRect(x,y,w,h,fill){ctx.fillStyle=fill;ctx.beginPath();ctx.roundRect(x,y,w,h,5);ctx.fill()}
function render(){
 if(!ctx||!host)return;const w=viewport.width,h=viewport.height,s=engine.state;
 const route=s.primary||'M',ink=ROUTES[route].color,roadY=lane=>h*(.46+.45*lane);
 const px=w*.26,toX=x=>px+x-host.x;
 const sky=['#293d38','#252f3e','#233442','#3c3030'][s.round%4];ctx.fillStyle=sky;ctx.fillRect(0,0,w,h);
 // Scenery is horizontal, ground-anchored and deliberately provisional.
 ctx.fillStyle='#223429';ctx.beginPath();ctx.moveTo(0,h*.47);for(let x=0;x<=w+60;x+=60)ctx.lineTo(x,h*(.24+.08*Math.sin(x*.012+host.x*.0003)));ctx.lineTo(w,h*.49);ctx.closePath();ctx.fill();
 for(let i=-1;i<7;i++){const x=i*118-(host.x*.25%118);const by=h*.39;
   if(s.round%4===0){roundRect(x,by-38,55,38,'#586446');ctx.fillStyle='#393c35';ctx.beginPath();ctx.moveTo(x-5,by-38);ctx.lineTo(x+27,by-57);ctx.lineTo(x+60,by-38);ctx.closePath();ctx.fill();}
   else {roundRect(x,by-(70+(i%3)*15),64,90,'#34434a');for(let yy=by-60;yy<by;yy+=18)for(let xx=x+10;xx<x+58;xx+=19)roundRect(xx,yy,8,8,s.totals.N?'#d8c577':'#536068')}
 }
 ctx.fillStyle='#617046';ctx.fillRect(0,h*.39,w,h*.1);
 ctx.fillStyle=['#6e5941','#535859','#49535a','#574b43'][s.round%4];ctx.fillRect(0,h*.48,w,h*.49);
 line(0,h*.48,w,h*.48,'#a4986b',3);line(0,h*.97,w,h*.97,'#978c66',3);
 for(let i=-1;i<10;i++){const x=i*110-(host.x%110);line(x,h*.715,x+45,h*.715,'#b6a585',2);line(x,h*.91,x+12,h*.91,'#b6a585',1)}
 ctx.fillStyle='#c5bc9d';ctx.font='11px system-ui';ctx.fillText('→ 向右前进',w-100,h*.96-8);
 // Persistent traces below every actor. Real field coordinates drive both rendering and effects.
 for(const f of s.fields){const x=toX(f.x),y=roadY(f.lane),c=ROUTES[f.route].color;
  if(x<-160||x>w+160)continue;ctx.save();ctx.globalAlpha=.7;
  if(f.route==='F'){ellipse(x,y,f.length/2,16,'#547441');for(let j=0;j<5;j++)line(x-50+j*22,y+10,x-37+j*22,y-9,c,2);}
  if(f.route==='M'){line(x-50,y+6,x-20,y-9,'#29241f',5);line(x-20,y-9,x+8,y+5,c,2);line(x+8,y+5,x+50,y-5,'#29241f',4);}
  if(f.route==='A'){for(let j=0;j<3;j++){ellipse(x-24+j*25,y,13,5,'#17363c');ctx.fillStyle=c;ctx.beginPath();ctx.moveTo(x-36+j*25,y);ctx.lineTo(x-22+j*25,y-14);ctx.lineTo(x-12+j*25,y+1);ctx.closePath();ctx.fill()}}
  if(f.route==='N'){line(x-42,y+3,x-20,y-6,c,2);line(x-20,y-6,x+10,y+4,c,2);line(x+10,y+4,x+46,y-3,c,2)}
  ctx.restore();
 }
 for(const l of s.landmarks){const x=toX(l.x),y=roadY(l.lane);if(x<-100||x>w+120)continue;
  ellipse(x,y,36,6,'#00000045');line(x-23,y,x-23,y-46,'#b0a083',3);line(x+23,y,x+23,y-46,'#b0a083',3);
  roundRect(x-32,y-56,64,12,l.effects.includes('A')?ROUTES.A.color:'#675c48');
  if(l.effects.includes('M'))line(x-35,y+4,x+35,y+2,'#f58e61',3);
  if(l.effects.includes('F')){ellipse(x,y+1,35,9,'#759b4b');if(l.inheritedEffects&&l.inheritedEffects.includes('F')){line(x-40,y-12,x+40,y-12,'#e3c574',3);ctx.font='9px system-ui';ctx.fillStyle='#f1d679';ctx.fillText('菌痕隔离',x-18,y-18)}}
  line(x+34,y,x+34,y-64,'#d2c2a0',2);ellipse(x+34,y-65,5,5,l.effects.includes('N')?'#f1d679':'#727977');
  if(l.effects.includes('N'))ellipse(x+34,y-65,15,15,'#f1d67922');
  ctx.font='10px system-ui';ctx.fillStyle='#f1f1e9';ctx.fillText(l.name,x-35,y-70);
 }
 const units=host.enemies.map(e=>({type:'enemy',entity:e,lane:e.lane}));units.push({type:'player',entity:host,lane:host.lane});units.sort((a,b)=>a.lane-b.lane);
 for(const item of units){const e=item.entity,x=item.type==='player'?px:toX(e.x),y=roadY(e.lane);
  if(item.type==='player'){
   const r=projectSizes(host.mass,host.mass,host.baseMass,24).player;
   ellipse(x,y,r*1.35,7,'#00000066');
   // Wheels/feet share the same ground plane; only upper-body idle sway.
   ellipse(x-15,y-10,10,10,'#1a2428');ellipse(x+13,y-10,10,10,'#1a2428');
   ctx.strokeStyle='#99acae';ctx.lineWidth=3;for(const xx of [x-15,x+13]){ctx.beginPath();ctx.arc(xx,y-10,8,0,Math.PI*2);ctx.stroke()}
   line(x-15,y-11,x+13,y-11,'#b8c7c2',3);
   roundRect(x-r*.57,y-r*2,r*1.14,r*1.58,'#a48f74');ellipse(x,y-r*2.25,r*.46,r*.50,'#e1c3a0');
   const bob=reducedMotion?0:Math.sin(host.time*5)*1;
   if(s.routes.M){ellipse(x-r*.85,y-r*1.35+bob,r*.64,r*.74,ROUTES.M.color);ellipse(x+r*.78,y-r*1.27+bob,r*.67,r*.65,ROUTES.M.color)}
   if(s.routes.A){ellipse(x,y-r*1.10,r*1.09,r*.86,'#287077');for(let i=-1;i<=1;i++)line(x+i*9,y-r*1.8,x+i*14,y-r*.6,ROUTES.A.color,2)}
   if(s.routes.N){line(x-r,y-r*1.8,x-r*1.25,y-r*.5,ROUTES.N.color,3);line(x+r,y-r*.6,x+r*1.23,y-r*1.7,ROUTES.N.color,3)}
   if(s.routes.F){for(const i of [-1,0,1]){line(x+i*16,y-r*1.7,x+i*22,y-r*2.55,ROUTES.F.color,3);ellipse(x+i*22,y-r*2.6,11,5,ROUTES.F.color)}}
   if(engine.playerModifiers().guard){ctx.strokeStyle=ROUTES.A.color;ctx.lineWidth=4;ctx.beginPath();ctx.arc(x,y-r,r*1.5,-Math.PI/2,Math.PI/2);ctx.stroke()}
   ctx.fillStyle='#f1f1e9';ctx.font='10px system-ui';ctx.fillText('你',x-4,y+17);
  }else{
   const r=projectSizes(host.mass,e.absMass,host.baseMass,24).enemy,judgment=classifyMass(host.mass,e.absMass);
   const color=judgment.win?'#bba26d':judgment.fatal?'#bb6861':'#bb8966';
   ellipse(x,y,r,Math.max(3,r*.19),'#00000055');
   for(const d of [-.65,.65])line(x+r*d,y-r*.35,x+r*d,y,'#252c29',Math.max(3,r*.17));
   ellipse(x,y-r,r,r*.85,color);ellipse(x+r*.65,y-r*1.25,r*.35,r*.38,color);
   ellipse(x+r*.84,y-r*1.43,2.1,2.1,'#17232a');
   if(e.currentModifier&&(e.currentModifier.stunned||e.currentModifier.speedFactor<1)){
    ctx.fillStyle=e.currentModifier.source?ROUTES[e.currentModifier.source].color:'#eee';ctx.font='10px system-ui';ctx.fillText(e.currentModifier.stunned?'失衡 / 中断':'菌毯减速',x-r,y-r*2-11);}
   ctx.fillStyle=judgment.fatal?'#f1b1a2':'#e2dfc6';ctx.font='10px system-ui';
   ctx.fillText(e.tag||judgment.label,x-r*.65,y+16);
  }
 }
 for(const e of host.impacts){const age=host.time-e.born;ctx.globalAlpha=1-age/1.2;ctx.fillStyle=e.color;ctx.font='bold 16px system-ui';ctx.fillText(e.text,toX(e.x),roadY(e.lane)-45-age*20);ctx.globalAlpha=1;}
 if(s.paused&&s.phase==='running'){ctx.fillStyle='#142027aa';ctx.fillRect(0,0,w,h);ctx.fillStyle='#f1f1e9';ctx.font='bold 23px system-ui';ctx.textAlign='center';ctx.fillText('已暂停',w/2,h/2);ctx.textAlign='start'}
}
function frame(t){const dt=Math.min(.05,Math.max(0,(t-last)/1000));last=t;
 if(host&&!$('play').hidden){step(dt);render();uiClock+=dt;if(uiClock>.1){updateUI();uiClock=0}}
 requestAnimationFrame(frame);
}
window.addEventListener('resize',resize);requestAnimationFrame(frame);
// Read-only diagnostics, plus explicit developer test functions. Never production telemetry.
window.BIS_TEST={inspect:()=>({world:engine.inspect(),host:host?JSON.parse(JSON.stringify(host)):null}),
 pause:v=>{engine.setPaused(v);updateUI()},start,activate,defeatBoss,die};
})();
