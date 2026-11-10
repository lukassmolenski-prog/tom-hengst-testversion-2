import * as THREE from 'three';
import {clone} from 'three/addons/utils/SkeletonUtils.js';

// Mount selection travels with each avatar snapshot, including reconnects.
export function installMounts(G,assets){
 const {p,player,world,Player}=G,states=['foot','ferrari','unicorn'],instances=new WeakMap();
 const labels={foot:'Zu Fuß',ferrari:'Roter Ferrari',unicorn:'Weißes Einhorn'};
 const controls=document.createElement('aside');controls.id='mount-panel';controls.hidden=true;
 controls.innerHTML='<button id="mount-open" type="button" aria-expanded="false">Fortbewegung · V</button><div id="mount-options" hidden><span>DEIN NÄCHSTER AUFTRITT</span><div class="mount-choices"><button data-mount="foot" type="button">Zu Fuß <kbd>1</kbd></button><button data-mount="ferrari" type="button">Roter Ferrari <kbd>2</kbd></button><button data-mount="unicorn" type="button">Weißes Einhorn <kbd>3</kbd></button></div><small>Angriff, Schild oder Rolle: automatisch absteigen.</small></div>';
 document.body.append(controls);const open=controls.querySelector('#mount-open'),options=controls.querySelector('#mount-options');
 const note=document.createElement('div');note.id='mount-note';note.setAttribute('role','status');controls.append(note);let noteUntil=0;
 function say(text){note.textContent=text;noteUntil=performance.now()+3500;}
 function toggle(){options.hidden=!options.hidden;open.setAttribute('aria-expanded',String(!options.hidden));}
 open.onclick=toggle;for(const event of ['pointerdown','pointermove','pointerup'])controls.addEventListener(event,e=>e.stopPropagation());
 function available(kind){return kind==='foot'||assets.has(kind);}
 function clearance(kind){
  if(kind==='foot')return true;const r=kind==='ferrari'?1:.55,extent=kind==='ferrari'?1.3:.65;
  for(const z of [-extent,0,extent]){const q=player.pos.clone();q.x+=Math.sin(player.rot)*z;q.z+=Math.cos(player.rot)*z;const x=q.x,z0=q.z;world.resolve(q,r);if(Math.hypot(q.x-x,q.z-z0)>.18)return false;}
  return true;
 }
 function choose(kind,{force=false,silent=false}={}){
  if(!states.includes(kind))return false;
  if(!force&&(p.mode!=='play'||player.dead||!['idle','block'].includes(player.state)))return false;
  if(kind!=='foot'&&!available(kind)){say('Das Modell wird noch geladen.');return false;}
  if(!force&&!clearance(kind)){say('Hier ist zu wenig Platz. Geh auf einen freien Weg.');return false;}
  player.mount=kind;player.radius=kind==='ferrari'?1:kind==='unicorn'?.55:.45;
  if(kind!=='foot'){p.lock=null;player.set('idle');}player.speed=0;
  try{sessionStorage.setItem('th.mount',kind);}catch{}
  if(!silent)say(labels[kind]);options.hidden=true;open.setAttribute('aria-expanded','false');return true;
 }
 controls.querySelectorAll('[data-mount]').forEach(b=>b.onclick=()=>choose(b.dataset.mount));
 addEventListener('keydown',e=>{if(e.repeat||/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName)||p.mode!=='play')return;if(e.code==='KeyV'){e.preventDefault();toggle();}else if(/^Digit[123]$/.test(e.code)){e.preventDefault();choose(states[Number(e.code.slice(-1))-1]);}else if(e.code==='Escape'){options.hidden=true;open.setAttribute('aria-expanded','false');}});
 const netGet=Player.prototype.netGet,netSet=Player.prototype.netSet,update=Player.prototype.update,move=Player.prototype.move,receive=Player.prototype.receive;
 Player.prototype.netGet=function(){const packet=netGet.call(this);packet[12]=states.indexOf(this.mount||'foot');return packet;};
 Player.prototype.netSet=function(packet){netSet.call(this,packet);this.mount=states[packet[12]]||'foot';this.radius=this.mount==='ferrari'?1:this.mount==='unicorn'?.55:.45;};
 Player.prototype.update=function(dt,input){
  if(this===player&&this.mount&&this.mount!=='foot'&&(input.atkP||input.atk||input.block||input.rollP||this.dead))choose('foot',{force:true,silent:true});
  update.call(this,dt,input);
 };
 Player.prototype.receive=function(hit){const result=receive.call(this,hit);if(this===player&&result==='hurt')choose('foot',{force:true,silent:true});return result;};
 Player.prototype.move=function(dx,dz){
  if(!this.mount||this.mount==='foot')return move.call(this,dx,dz);
  const steps=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.22));
  for(let i=0;i<steps;i++){
   move.call(this,dx/steps,dz/steps);
   // Resolve front and rear circles as well as the player centre.
   const extent=this.mount==='ferrari'?1.3:.65;
   for(const offset of [-extent,extent]){const q=this.pos.clone(),ox=Math.sin(this.rot)*offset,oz=Math.cos(this.rot)*offset;q.x+=ox;q.z+=oz;world.resolve(q,this.radius);this.pos.x=q.x-ox;this.pos.z=q.z-oz;}
   this.g.constrain(this.pos,this.radius);
  }
 };
 player.mount='foot';let preference;try{preference=sessionStorage.getItem('th.mount');}catch{}
 function updateActor(a,d,dt){
  const kind=states.includes(a.mount)?a.mount:'foot';let mount=instances.get(a);
  if(mount?.kind!==kind){if(mount)a.group.remove(mount.root);instances.delete(a);mount=null;}
  if(d.contact)d.contact.scale.set(kind==='ferrari'?1.1:kind==='unicorn'?.85:1,kind==='ferrari'?3:kind==='unicorn'?2.3:1,1);
  if(kind==='foot'||!available(kind)){if(a.tag)a.tag.position.y=2.35;return;}
  if(!mount){const root=clone(assets.get(kind));a.group.add(root);mount={root,kind,phase:0,bones:[],wheels:[]};root.traverse(o=>{if(o.isBone&&o.name.startsWith('hoof'))mount.bones.push(o);if(o.isBone&&o.name.startsWith('wheel'))mount.wheels.push(o);});instances.set(a,mount);}
  const moving=Math.min(1,Math.abs(a.speed)/8);mount.phase+=dt*Math.abs(a.speed)*2.1;const bob=kind==='unicorn'?Math.sin(mount.phase*2)*.035*moving:Math.sin(mount.phase)*.006*moving;
  mount.root.position.y=bob;mount.root.rotation.z=kind==='unicorn'?Math.sin(mount.phase)*.012*moving:0;
  for(const b of mount.bones)b.rotation.x=Math.sin(mount.phase+(b.userData.phase||0))*.48*moving;
  for(const b of mount.wheels)b.rotation.x=mount.phase*.6;
  d.sword.visible=d.shield.visible=false;d.root.rotation.set(0,0,0);d.root.position.set(kind==='ferrari'?.38:0,(kind==='ferrari'?-.5:.7)+bob,kind==='ferrari'?-.27:-.15);
  const r=d.rig;for(const name of Object.keys(r.bones))r.pose(name);
  r.pose('Spine02',kind==='ferrari'?-.09:.04);r.pose('RightArm',-.8,-.15,.35);r.pose('LeftArm',-.8,.15,-.35);r.pose('RightForeArm',-.35);r.pose('LeftForeArm',-.35);
  r.pose('RightUpLeg',kind==='ferrari'?-1.3:-.72,0,kind==='unicorn'?-.34:0);r.pose('LeftUpLeg',kind==='ferrari'?-1.3:-.72,0,kind==='unicorn'?.34:0);r.pose('RightLeg',kind==='ferrari'?1.05:.85);r.pose('LeftLeg',kind==='ferrari'?1.05:.85);
  if(a.tag)a.tag.position.y=kind==='unicorn'?3.15:2;
 }
 function tick(){controls.hidden=p.mode!=='play'||player.dead;const kind=player.mount||'foot';open.textContent=labels[kind]+' · '+(matchMedia('(pointer:fine)').matches?'V':'Wechseln');for(const b of controls.querySelectorAll('[data-mount]')){b.setAttribute('aria-pressed',String(b.dataset.mount===kind));b.disabled=!available(b.dataset.mount);}if(performance.now()>noteUntil)note.textContent='';if(preference&&p.mode==='play'&&available(preference)){choose(preference,{silent:true});preference=null;}}
 G.mounts={choose,instances,states,available};return{updateActor,tick};
}

// Add four local joints to a continuous generated mesh. Blended weights preserve
// the shoulder/hip transitions while feet move independently of the body.
export function rigMount(root,kind){
 if(kind!=='unicorn'&&kind!=='ferrari')return root;
 root.updateMatrixWorld(true);const meshes=[];root.traverse(o=>{if(o.isMesh)meshes.push(o);});const result=new THREE.Group();
 const body=new THREE.Bone();body.name='mountBody';result.add(body);const bones=[body];
 const unicorn=kind==='unicorn',height=unicorn?1.35:.3,spread=unicorn?.3:.76,front=unicorn?.63:1.12,rear=unicorn?-.71:-1.16;
 for(let i=0;i<4;i++){const b=new THREE.Bone();b.name=(unicorn?'hoof':'wheel')+i;b.position.set(i%2===0?spread:-spread,height,i<2?front:rear);b.userData.phase=[0,Math.PI,Math.PI,0][i];body.add(b);bones.push(b);}
 for(const source of meshes){const g=source.geometry.clone();g.applyMatrix4(source.matrixWorld);if(unicorn)g.rotateY(-Math.PI/2);const pos=g.attributes.position,idx=new Uint16Array(pos.count*4),weights=new Float32Array(pos.count*4);
  if(unicorn){const index=g.index,keep=[];for(let i=0;i<(index?.count||pos.count);i+=3){const a=[0,1,2].map(k=>index?index.getX(i+k):i+k);if(a.some(k=>pos.getY(k)>.045))keep.push(...a);}g.setIndex(keep);}
  for(let i=0;i<pos.count;i++){const x=pos.getX(i),y=pos.getY(i),z=pos.getZ(i);let id=(z>0?0:2)+(x>0?0:1)+1,w=0;
   if(unicorn)w=(1-THREE.MathUtils.smoothstep(y,1.05,1.48))*THREE.MathUtils.smoothstep(Math.abs(z),.22,.45);
   else {const b=bones[id];w=Math.abs(x)>.68&&Math.hypot(y-b.position.y,z-b.position.z)<.34?1:0;}
   idx[i*4]=0;weights[i*4]=1-w;idx[i*4+1]=id;weights[i*4+1]=w;
  }
  g.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(idx,4));g.setAttribute('skinWeight',new THREE.Float32BufferAttribute(weights,4));const mesh=new THREE.SkinnedMesh(g,source.material);mesh.castShadow=mesh.receiveShadow=true;mesh.frustumCulled=false;result.add(mesh);result.updateMatrixWorld(true);mesh.bind(new THREE.Skeleton(bones));
 }
 return result;
}
