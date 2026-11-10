import * as THREE from 'three';

// A committed close-range knee strike, separate from the sword combos.
export function installCombat(G){
 const {p,player,Player,scene}=G,impactAt=.29,duration=.76,cooldown=1.25,effects=[],history=[],confirmed=new Set(),requests=new Set(),bound=new WeakSet();let requested=false,signatureStrike=false;
 const button=document.createElement('button');button.id='bSignature';button.className='gb';button.type='button';button.setAttribute('aria-label','Hengst-Kick – Knieangriff, Taste F');button.innerHTML='<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m17 2-3 6 2 8 9-4 3 4-9 8-6-4-2 10H6l2-16 3-5M14 9l8-4 5 3"/><path d="m26 20 3 2m-2-1 1 5"/></svg><span>HENGST</span>';document.getElementById('btns').append(button);
 function request(){if(p.mode==='play'&&!player.dead){G.audio.init();requested=true;}}
 button.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();request();});for(const event of ['pointermove','pointerup','pointercancel'])button.addEventListener(event,e=>e.stopPropagation());
 addEventListener('keydown',e=>{if(e.code!=='KeyF'||e.repeat||/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName))return;e.preventDefault();request();});
 Player.prototype.startSignature=function(){
  if(this.remote||this.dead||this.g.mode!=='play'||!['idle','block','parry'].includes(this.state)||this.stam<26||(this.signatureCooldown||0)>0)return false;
  if(this===player)G.mounts.choose('foot',{force:true,silent:true});
  const target=this.g.aimTarget(3.2);if(target)this.rot=Math.atan2(target.pos.x-this.pos.x,target.pos.z-this.pos.z);else if(this.g.input.mag>.3)this.rot=Math.atan2(this.g.input.mx,this.g.input.mz);
  this.signatureCooldown=cooldown;this.stam-=26;this.stamDelay=.85;this.hitSet.clear();this.set('signature');this.held=0;this.charge=0;this.signatureHit=false;this.signatureId=(this.signatureId||Date.now()%1000000000)+1;return true;
 };
 const update=Player.prototype.update,netGet=Player.prototype.netGet,netSet=Player.prototype.netSet;
 Player.prototype.netGet=function(){const packet=netGet.call(this);packet[13]=this.signatureId||0;return packet;};
 Player.prototype.netSet=function(packet){netSet.call(this,packet);this.signatureId=Number.isFinite(packet[13])?packet[13]:0;};
 Player.prototype.update=function(dt,input){
  this.signatureCooldown=Math.max(0,(this.signatureCooldown||0)-dt);
  if(this===player&&requested){requested=false;this.startSignature();}
  if(this.state!=='signature')return update.call(this,dt,input);
  // Shared updates preserve invulnerability, stamina, knockback and grounding.
  update.call(this,dt,{...input,atk:false,atkP:false,block:false,rollP:false});
  if(this.state!=='signature')return;
  if(this.t<impactAt){const step=dt*1.4;this.move(Math.sin(this.rot)*step,Math.cos(this.rot)*step);}
  if(!this.signatureHit&&this.t>=impactAt){this.signatureHit=true;signatureStrike=true;try{this.strike(1.35,.8,this.dmgFor(3),'signature');}finally{signatureStrike=false;}}
  if(this.t>=duration)this.set('idle');
 };
 const sfx=G.audio.sfx.bind(G.audio);G.audio.sfx=(id,options)=>{if(signatureStrike&&['hit','hitHeavy','swing','swingHeavy'].includes(id))return;sfx(id,options);};
 const hitEnemy=p.hitEnemy;
 p.hitEnemy=(enemy,damage,a,kind)=>{
  if(kind!=='signature')return hitEnemy(enemy,damage,a,kind);
  if(p.net?.guest){const result=enemy.probe(a,'heavy');if(result!=='none')p.net.send({t:'signatureHit',enemy:enemy.id,seq:a.signatureId,damage});return result;}
  const result=enemy.takeHit(damage,a,'heavy');if(result==='hit')confirm(a,enemy,a.signatureId);return result;
 };
 function remember(set,key){set.add(key);if(set.size>128)set.delete(set.values().next().value);}
 function confirm(a,enemy,seq){const pid=a===player?p.myPid:a.pid,at=[enemy.pos.x,enemy.pos.y+Math.min(1.15,enemy.height*.55),enemy.pos.z],packet={t:'signatureImpact',pid,seq,at};impact(packet);if(p.net?.hosting)p.net.send(packet);}
 function bindNetwork(){const n=p.net;if(!n||bound.has(n)||!n.on.data)return;bound.add(n);const base=n.on.data;n.on.data=(q,from)=>{
  if(q?.t==='signatureImpact'){if(n.guest&&from===0)impact(q);return;}
  if(q?.t==='signatureHit'){
   if(!n.hosting)return;const a=p.remotes.get(from),enemy=p.byId.get(q.enemy),key=from+':'+q.seq+':'+q.enemy;
   if(!a||a.dead||!enemy?.alive||requests.has(key)||!Number.isInteger(q.seq)||q.seq!==a.signatureId||a.state!=='signature'||a.t>1.1)return;
   const dx=enemy.pos.x-a.pos.x,dz=enemy.pos.z-a.pos.z,angle=Math.atan2(Math.sin(Math.atan2(dx,dz)-a.rot),Math.cos(Math.atan2(dx,dz)-a.rot));
   if(Math.hypot(dx,dz)>1.7+enemy.radius||Math.abs(angle)>.95)return;remember(requests,key);
   if(enemy.takeHit(Math.max(1,Math.min(5,Number(q.damage)||3)),a,'heavy')==='hit')confirm(a,enemy,q.seq);return;
  }
  base(q,from);
 };}
 const canvas=document.createElement('canvas');canvas.width=canvas.height=512;const ctx=canvas.getContext('2d');
 function star(points,outer,inner,color,offset=0){ctx.fillStyle=color;ctx.beginPath();for(let i=0;i<points*2;i++){const angle=i*Math.PI/points+offset,r=i%2?inner:outer*(.88+.12*Math.sin(i*7.1));const x=256+Math.cos(angle)*r,y=256+Math.sin(angle)*r;i?ctx.lineTo(x,y):ctx.moveTo(x,y);}ctx.closePath();ctx.fill();}
 star(17,250,100,'#ff16bd');star(14,211,82,'#fff24d',.08);star(11,149,52,'#fffdf4',.17);
 const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
 function impact(packet){
  if(!Number.isInteger(packet.pid)||!Number.isInteger(packet.seq)||!Array.isArray(packet.at)||packet.at.length!==3||!packet.at.every(Number.isFinite))return;
  const key=packet.pid+':'+packet.seq;if(confirmed.has(key))return;remember(confirmed,key);if(document.hidden)return;const at=new THREE.Vector3(...packet.at);
  G.sound.play('hengst-impact',{at,volume:.7,offset:.12});G.sound.play('monsterkill',{at,volume:.64,delay:.16});
  const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,transparent:true,depthWrite:false,toneMapped:false}));sprite.position.copy(at);sprite.scale.setScalar(.25);scene.add(sprite);effects.push({sprite,age:0});
  p.fx.burst(at.x,at.y,at.z,0xff36b8,8,3,.25,.08,2);p.fx.burst(at.x,at.y,at.z,0xffee57,10,4,.25,.07,2);
  history.push({pid:packet.pid,id:packet.seq,time:performance.now()});if(history.length>80)history.shift();
 }
 function tick(dt){
  bindNetwork();
  for(let i=effects.length-1;i>=0;i--){const e=effects[i];e.age+=dt;const q=e.age/.29;if(q>=1){scene.remove(e.sprite);e.sprite.material.dispose();effects.splice(i,1);continue;}e.sprite.scale.setScalar(.22+Math.sin(Math.min(1,q*2)*Math.PI/2)*.72);e.sprite.material.opacity=1-THREE.MathUtils.smoothstep(q,.35,1);e.sprite.material.rotation=q*.23;}
  const wait=player.signatureCooldown||0;button.disabled=player.dead||wait>0||player.stam<26;button.style.setProperty('--ready',String(1-Math.min(1,wait/cooldown)));button.title=wait>0?'Bereit in '+wait.toFixed(1)+' s':'Hengst-Kick · F · 26 Ausdauer';
 }
 G.combat={tick,request,history,effects,impactAt,duration,cooldown};return G.combat;
}
