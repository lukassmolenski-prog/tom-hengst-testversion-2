import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { installMounts,rigMount } from './mounts.js';
import { prepareCharacter,addGripMorph,poseRoll,poseSignature } from './character-rig.js';
import { installEnemyAudio } from './enemy-audio.js';
import { installCombat } from './combat.js';
import { installVehicleAudio } from './vehicle-audio.js';
const G=window.__game;
if(!G)throw new Error('Spielkern wurde nicht geladen.');
const {p,scene,world,player,renderer,camera}=G;
const status=document.createElement('div');status.id='asset-status';status.textContent='Neue Welt wird geladen …';document.body.append(status);
const edition=document.createElement('div');edition.id='edition';edition.textContent='DIE GLOCKE DER MORGENRÖTE · LOKALE EDITION';document.body.append(edition);
const hint=document.createElement('div');hint.id='keyboard-hint';hint.textContent='WASD · Laufen     J · Schwert     F · Hengst-Kick     K · Schild     Leertaste · Rolle';document.body.append(hint);
const panel=document.createElement('aside');panel.id='voice-panel';panel.innerHTML='<div id="room-label"></div><div id="voice-roster"></div><button id="voice-toggle" type="button" aria-pressed="false">🎙 Mikrofon einschalten</button><div id="voice-note" role="status" aria-live="polite"></div>';document.body.append(panel);
const coopScreen=document.getElementById('coop');const dockVoice=()=>{const lobby=!coopScreen.classList.contains('hide');panel.classList.toggle('in-lobby',lobby);const parent=lobby?document.getElementById('coRoom'):document.body;if(panel.parentElement!==parent)parent.append(panel);};new MutationObserver(dockVoice).observe(coopScreen,{attributes:true,attributeFilter:['class']});dockVoice();
const mic=document.getElementById('voice-toggle');mic.onclick=()=>p.net?.voice.toggle();
addEventListener('local-room-state',({detail:n})=>{
 panel.style.display=n.role?'block':'none';document.getElementById('room-label').textContent=`RAUM ${n.code} · ${n.members.length}/4`;
 const roster=document.getElementById('voice-roster');roster.replaceChildren();for(const m of n.members){const tag=document.createElement('span');tag.textContent=`${m.away||!m.online?'◌':m.mic?'●':'○'} ${m.name}${m.id===n.id?' (du)':''}`;roster.append(tag);}
 mic.textContent=n.voice.enabled?'🎙 Mikrofon stummschalten':'🎙 Mikrofon einschalten';mic.setAttribute('aria-pressed',String(n.voice.enabled));const host=n.members.find(m=>m.id===0),waiting=n.guest&&host&&(host.away||!host.online);document.getElementById('voice-note').textContent=!n.connected?n.message:waiting?'Gastgeber kurz weg · Welt wartet. Raum bleibt 10 Minuten offen.':n.voice.message;
});
const share=document.createElement('button');share.className='btn alt';share.textContent='Einladung teilen';share.type='button';document.getElementById('coRoom').append(share);share.onclick=async()=>{if(!p.net)return;const u=new URL(location.href);u.searchParams.set('join',p.net.code);p.net.cache(G.snapshot(),G.version);try{if(navigator.share)await navigator.share({title:'Tom Hengst · Gemeinsam spielen',text:'Komm in meinen Koop-Raum '+p.net.code,url:u.href});else{await navigator.clipboard.writeText(u.href);share.textContent='Einladung kopiert';}}catch(e){if(e.name!=='AbortError'){document.getElementById('coLink').textContent=u.href;}}};
document.querySelector('#title p').textContent=matchMedia('(pointer:fine)').matches?'Ein Abenteuer im ewigen Zwielicht. Allein oder mit bis zu drei Freunden.\nWASD zum Laufen · Maus ziehen für die Kamera.':'Ein Abenteuer im ewigen Zwielicht. Allein oder mit bis zu drei Freunden. Links ziehen zum Laufen, rechts wischen für die Kamera.';
const loader=new GLTFLoader(),assets=new Map(),failures=[],actors=new WeakMap();let loaded=0;
const mounts=installMounts(G,assets);
const sound=installEnemyAudio(G),combat=installCombat(G),vehicleAudio=installVehicleAudio(G);
const specs=[['tom-correct-rig',1.9],['dawn-sword',1.12],['dawn-shield',.66],['ferrari',1.15],['unicorn',2.65],['cottage',6],['forge',4.6],['well',3.3],['ghoul-rig',1.7],['revenant-rig',2],['vampire-rig',2.05],['orc-rig',2.25],['nachtgeweih',7],['mirja',1.85]];
function prepare(gltf,height){
 let root=new THREE.Group(),skinned;gltf.scene.traverse(o=>{if(o.isSkinnedMesh)skinned=o;});
 if(skinned){
  root=prepareCharacter(skinned,height);
 }else{
  const model=gltf.scene;model.rotation.y=-Math.PI/2;model.updateMatrixWorld(true);const box=new THREE.Box3().setFromObject(model),size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3()),scale=height/size.y;model.scale.multiplyScalar(scale);model.position.add(new THREE.Vector3(-center.x*scale,-box.min.y*scale,-center.z*scale));root.add(model);root.updateMatrixWorld(true);
 }
 root.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;o.frustumCulled=!o.isSkinnedMesh;for(const m of Array.isArray(o.material)?o.material:[o.material]){m.roughness=Math.max(.55,m.roughness??1);m.metalness=Math.min(.55,m.metalness??0);m.envMapIntensity=.55;if(m.map)m.map.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());}}});
 return root;
}
function copy(id){return cloneSkeleton(assets.get(id));}
const tempV=new THREE.Vector3(),tempQ=new THREE.Quaternion();
function skeletal(root){
 const bones={};root.updateMatrixWorld(true);const rootQ=root.getWorldQuaternion(new THREE.Quaternion());root.traverse(b=>{if(b.isBone){const parentQ=b.parent.getWorldQuaternion(new THREE.Quaternion());bones[b.name]={bone:b,rest:b.quaternion.clone(),frame:parentQ.invert().multiply(rootQ)};}});
 return {bones,pose(name,x=0,y=0,z=0){const b=bones[name];if(!b)return;const delta=new THREE.Quaternion().setFromEuler(new THREE.Euler(x,y,z));b.bone.quaternion.copy(b.frame).multiply(delta).multiply(b.frame.clone().invert()).multiply(b.rest);}};
}
const steel=new THREE.MeshStandardMaterial({color:0xc8d2d6,metalness:.75,roughness:.28}),gold=new THREE.MeshStandardMaterial({color:0xcaa367,metalness:.65,roughness:.4}),leather=new THREE.MeshStandardMaterial({color:0x392b23,roughness:.9});
function makeSword(crystal=false){const g=new THREE.Group();const blade=new THREE.Mesh(new THREE.BoxGeometry(.09,.92,.035),crystal?new THREE.MeshStandardMaterial({color:0x9bc8e8,metalness:.5,roughness:.22,emissive:0x122b47}):steel);blade.position.y=.55;g.add(blade);const tip=new THREE.Mesh(new THREE.ConeGeometry(.062,.18,4),blade.material);tip.position.y=1.1;tip.rotation.y=Math.PI/4;g.add(tip);const guard=new THREE.Mesh(new THREE.BoxGeometry(.36,.06,.08),gold);guard.position.y=.08;g.add(guard);const grip=new THREE.Mesh(new THREE.CylinderGeometry(.035,.035,.2,8),leather);grip.position.y=-.05;g.add(grip);g.traverse(o=>{if(o.isMesh)o.castShadow=true;});return g;}
function makeShield(crystal=false){const g=new THREE.Group(),m=new THREE.Mesh(new THREE.CylinderGeometry(.3,.3,.07,crystal?6:24),crystal?steel:leather);m.rotation.x=Math.PI/2;g.add(m);const rim=new THREE.Mesh(new THREE.TorusGeometry(.3,.024,6,24),gold);rim.position.z=.04;g.add(rim);if(!crystal){const shoe=new THREE.Mesh(new THREE.TorusGeometry(.14,.028,7,20,Math.PI*1.5),gold);shoe.position.z=.055;shoe.rotation.z=-Math.PI/4;g.add(shoe);}return g;}
function hideOriginal(group){group.traverse(o=>{if(o.isMesh)o.visible=false;});}
const contactCanvas=document.createElement('canvas');contactCanvas.width=contactCanvas.height=128;const contactContext=contactCanvas.getContext('2d'),contactGradient=contactContext.createRadialGradient(64,64,8,64,64,64);contactGradient.addColorStop(0,'rgba(10,16,20,.48)');contactGradient.addColorStop(.45,'rgba(10,16,20,.25)');contactGradient.addColorStop(1,'rgba(10,16,20,0)');contactContext.fillStyle=contactGradient;contactContext.fillRect(0,0,128,128);const contactTexture=new THREE.CanvasTexture(contactCanvas);
function humanoid(a,id){
 if(actors.has(a)||!assets.has(id)||!assets.has('dawn-sword')||!assets.has('dawn-shield'))return;const root=copy(id),hero=id.startsWith('tom-'),armed=hero||a.kind==='mirror';if(armed)addGripMorph(root);hideOriginal(a.group);a.group.add(root);const rig=skeletal(root),sword=new THREE.Group(),shield=new THREE.Group();
 const blade=copy('dawn-sword');blade.position.y=-.15;sword.add(blade);sword.rotation.z=-Math.PI/2;sword.position.set(0,-.09,-.035);
 const buckler=copy('dawn-shield');buckler.position.y=-.33;shield.add(buckler);shield.position.set(0,-.18,.13);
 rig.bones.RightHand?.bone.add(sword);rig.bones.LeftForeArm?.bone.add(shield);
 if(!hero){sword.visible=shield.visible=armed;a.height={glimm:1.7,spor:2,mirror:2.05,roller:2.25}[a.kind];a.name=(a.elite?'Elite · ':'')+({glimm:'Grabghul',spor:'Seuchenwiedergänger',mirror:'Blutritter',roller:'Eisenhauer-Ork'}[a.kind]||a.name);}
 const contact=new THREE.Mesh(new THREE.PlaneGeometry(1.7,1.2),new THREE.MeshBasicMaterial({map:contactTexture,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2}));contact.rotation.x=-Math.PI/2;contact.position.y=.035;contact.renderOrder=1;a.group.add(contact);
 const entry={root,rig,sword,shield,contact,humanoid:true,hero,armed};actors.set(a,entry);return entry;
}
function followHand(a,entry,name,obj,rotation,offset){const b=entry.rig.bones[name]?.bone;if(!b)return;b.getWorldPosition(tempV);a.group.worldToLocal(tempV);obj.position.copy(tempV).add(offset||new THREE.Vector3());obj.rotation.set(...rotation);}
function poseHumanoid(a,d){
 const t=a.cur||{ty:(a.body?.position.y||1.3)-1.3,tx:0,toX:0,toY:0,hX:0,aRx:a.armR?.rotation.x||0,aRy:a.armR?.rotation.y||0,aRz:0,aLx:a.armL?.rotation.x||-.6,aLy:0,aLz:0,lRx:Math.sin(p.time*5+a.seed)*.35*(a.state==='app'?1:0),lLx:-Math.sin(p.time*5+a.seed)*.35*(a.state==='app'?1:0)};
 const r=d.rig;for(const name of Object.keys(r.bones))r.pose(name);d.root.position.set(0,t.ty||0,0);d.root.rotation.set(t.tx||0,0,0);d.sword.visible=d.shield.visible=d.armed;r.pose('Spine02',t.toX||0,t.toY||0);r.pose('Head',t.hX||0,-(t.toY||0)*.25);
 r.pose('RightArm',t.aRx||0,t.aRy||0,(t.aRz||0)*.6);r.pose('LeftArm',t.aLx||0,t.aLy||0,(t.aLz||0)*.6);
 r.pose('RightUpLeg',t.lRx||0);r.pose('LeftUpLeg',t.lLx||0);r.pose('RightLeg',Math.max(0,-(t.lRx||0))*.6);r.pose('LeftLeg',Math.max(0,-(t.lLx||0))*.6);
 r.pose('RightHand',a.state==='attack'?.1:.65,-Math.PI/2,0);r.pose('LeftForeArm',a.state==='block'||a.state==='parry'?.9:0);
 if(d.hero&&a.state==='roll')poseRoll(a,d);
 if(d.hero&&a.state==='signature')poseSignature(a,d);
 if(!d.hero){const moving=['app','chase','charge','roll'].includes(a.state)?1:.1,phase=p.time*(a.kind==='roller'?10:7)+(a.seed||0),stride=Math.sin(phase)*.65*moving;
  d.root.position.set(0,a.kind==='spor'?(a.by||0)*2.4:a.kind==='glimm'?Math.max(0,(a.body?.position.y||.44)-.44):0);d.root.rotation.set(a.kind==='glimm'?.28:a.kind==='roller'?.13:0,0,0);
  r.pose('RightUpLeg',stride);r.pose('LeftUpLeg',-stride);r.pose('RightLeg',Math.max(0,-stride)*1.2);r.pose('LeftLeg',Math.max(0,stride)*1.2);
  if(a.kind!=='mirror'){const attacking=['wind','leap','rev','charge','roll','aim'].includes(a.state),reach=attacking?-.95: a.kind==='glimm'?-.45:0;r.pose('RightArm',reach-stride*.5,0,-.12);r.pose('LeftArm',reach+stride*.5,0,.12);r.pose('RightForeArm',-.35);r.pose('LeftForeArm',-.35);}
  if(!a.alive){d.root.rotation.x=-Math.min(1,a.t/.28)*1.5;d.root.position.y-=Math.min(1,a.t/.28)*.45;}
 }
 a.group.updateMatrixWorld(true);
}
function creature(a,id){if(actors.has(a)||!assets.has(id))return;hideOriginal(a.group);const root=copy(id);a.group.add(root);if(a.kind==='boss'){a.core.visible=true;a.core.scale.setScalar(.65);a.core.material=a.coreMat=new THREE.MeshStandardMaterial({color:0xffb05a,emissive:0xe97712,emissiveIntensity:.6,roughness:.28,metalness:.3});for(const lantern of a.lanterns)lantern.traverse(o=>{if(o.isMesh)o.visible=true;});}actors.set(a,{root});}
function updateActors(dt){
 for(const a of [player,...p.remotes.values()]){const d=actors.get(a)||humanoid(a,'tom-correct-rig');if(d){poseHumanoid(a,d);mounts.updateActor(a,d,dt);}}mounts.tick();
 for(const a of p.enemies){const id={glimm:'ghoul-rig',spor:'revenant-rig',mirror:'vampire-rig',roller:'orc-rig',boss:'nachtgeweih'}[a.kind];if(!id)continue;
  if(!actors.has(a)){if(a.kind!=='boss')humanoid(a,id);else creature(a,id);}const d=actors.get(a);if(!d)continue;const near=Math.hypot(a.pos.x-player.pos.x,a.pos.z-player.pos.z)<(a.kind==='boss'?90:55);d.root.visible=near;if(!near)continue;
  if(d.humanoid)poseHumanoid(a,d);else{
   d.root.rotation.copy(a.body?.rotation||new THREE.Euler());d.root.scale.set(1,1,1);
   if(a.kind==='glimm'){d.root.position.y=(a.body.position.y-.44);d.root.scale.y=a.body.scale.y;}
   if(a.kind==='spor'){d.root.position.y=a.by||0;d.root.scale.y=1+Math.sin(p.time*3+a.seed)*.025;}
   if(a.kind==='roller'){const roll=a.wheel.visible;d.root.rotation.x=roll?p.time*17:Math.sin(p.time*8+a.seed)*.035;d.root.position.y=roll?.12:Math.abs(Math.sin(p.time*7+a.seed))*.03;}
   if(a.kind==='boss'){d.root.position.y=a.body.position.y-.3;d.root.rotation.z=Math.sin(p.time*1.2)*.025;a.coreMat.emissiveIntensity=a.state==='stun'?2.4:.5;}
  }
 }
}
// Keep original colliders and interaction points while swapping their visuals.
const housePlaces=[[-11,63,.75],[11.5,62,-.7],[-13,79,2.2],[12.5,80,-2.25],[0,87,Math.PI]];
const obstacleMeshes=[];
function place(id,x,z,ry=0,scale=1){const root=copy(id);root.position.set(x,world.heightAt(x,z)-.04,z);root.rotation.y=ry;root.scale.setScalar(scale);scene.add(root);root.traverse(o=>{if(o.isMesh)obstacleMeshes.push(o);});return root;}
function buildings(){
 const houseOld=[];scene.traverse(o=>{if(o.isInstancedMesh&&o.count===5){const mat=new THREE.Matrix4();o.getMatrixAt(0,mat);const v=new THREE.Vector3().setFromMatrixPosition(mat);if(Math.abs(v.x+11)<.1&&Math.abs(v.z-63)<.1)houseOld.push(o);}});houseOld.forEach(o=>o.visible=false);
 housePlaces.forEach(([x,z,r])=>place('cottage',x,z,r,.93));place('forge',-7.5,66,0,.72);place('well',5,73,0,.9);
 // The old well, forge and sign share a mesh. Remove only triangles near the replaced props.
 for(const o of [...scene.children]){if(!o.isMesh||o.isInstancedMesh||!o.geometry?.attributes.position||o===world.terrain)continue;const g=o.geometry;g.computeBoundingBox();const b=g.boundingBox;if(b.min.z<20.5||b.max.z<72||b.max.z>75||b.min.x> -7)continue;
  const pos=g.attributes.position,idx=g.index,kept=[];for(let i=0;i<(idx?.count||pos.count);i+=3){const ids=[0,1,2].map(k=>idx?idx.getX(i+k):i+k);if(ids.every(k=>pos.getZ(k)<30))kept.push(...ids);}g.setIndex(kept);g.computeBoundingBox();g.computeBoundingSphere();
 }
}
function lamp(x,z){const g=new THREE.Group();g.position.set(x,world.heightAt(x,z),z);const post=new THREE.Mesh(new THREE.CylinderGeometry(.075,.11,3,8),leather);post.position.y=1.5;g.add(post);const lamp=new THREE.Mesh(new THREE.BoxGeometry(.25,.4,.25),new THREE.MeshStandardMaterial({color:0xf4c986,emissive:0xffb25a,emissiveIntensity:.8,roughness:.3}));lamp.position.set(.25,2.8,0);g.add(lamp);const roof=new THREE.Mesh(new THREE.ConeGeometry(.28,.2,4),steel);roof.position.copy(lamp.position).y+=.3;roof.rotation.y=Math.PI/4;g.add(roof);scene.add(g);}
function villageDetails(){
 const mat=new THREE.MeshStandardMaterial({color:0x776d5a,roughness:1}),geo=new THREE.IcosahedronGeometry(1,1),stones=new THREE.InstancedMesh(geo,mat,140),dummy=new THREE.Object3D();
 let seed=418;const rnd=()=>((seed=Math.imul(seed,1664525)+1013904223|0)>>>0)/4294967296;
 for(let i=0;i<140;i++){const z=51+rnd()*34,x=(rnd()-.5)*7,y=world.heightAt(x,z);dummy.position.set(x,y+.015,z);dummy.scale.set(.2+rnd()*.4,.045,.18+rnd()*.3);dummy.rotation.y=rnd()*6.28;dummy.updateMatrix();stones.setMatrixAt(i,dummy.matrix);}stones.receiveShadow=true;scene.add(stones);
 if(world.oldLamps){const matrix=new THREE.Matrix4(),v=new THREE.Vector3();for(let i=0;i<world.oldLamps[0].count;i++){world.oldLamps[0].getMatrixAt(i,matrix);v.setFromMatrixPosition(matrix);lamp(v.x,v.z);}world.oldLamps.forEach(m=>m.visible=false);}else for(const [x,z] of [[-3.8,61],[3.8,57],[-3.8,78],[3.5,82]])lamp(x,z);
 const barrelGeo=new THREE.CylinderGeometry(.35,.31,.8,12,3),wood=new THREE.MeshStandardMaterial({color:0x72513b,roughness:.88});
 for(const [x,z] of [[-8,62],[-8.6,61.8],[9,79],[9,79.9],[-10,80.3],[12,58.5]]){const g=new THREE.Group();g.position.set(x,world.heightAt(x,z)+.4,z);g.add(new THREE.Mesh(barrelGeo,wood));for(const y of [-.24,.24]){const hoop=new THREE.Mesh(new THREE.TorusGeometry(.346,.025,5,12),steel);hoop.rotation.x=Math.PI/2;hoop.position.y=y;g.add(hoop);}scene.add(g);}
}
const oldUpdate=world.update;
const skyUniforms=[];scene.traverse(o=>{if(o.material?.uniforms?.uTop)skyUniforms.push(o.material.uniforms);});
const skyTop=new THREE.Color('#527ca4'),skyHorizon=new THREE.Color('#c1d2ce'),skyBottom=new THREE.Color('#8c9f99'),fogColor=new THREE.Color('#a5b9b3'),sunColor=new THREE.Color('#ffe0b1');
scene.traverse(o=>{if(o.material?.uniforms?.uTop){o.material.fragmentShader=`uniform vec3 uTop;uniform vec3 uHor;uniform vec3 uBot;uniform vec3 uGlow;uniform vec3 uSunDir;varying vec3 vDir;
 float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
 void main(){vec3 d=normalize(vDir);float h=max(d.y,0.);vec3 c=mix(uHor,uTop,pow(h,.45));c=mix(c,uBot,1.-smoothstep(-.3,0.,d.y));vec2 uv=d.xz/(h+.2)*2.7;float n=noise(uv)*.55+noise(uv*2.1)*.28+noise(uv*4.2)*.12;float clouds=smoothstep(.44,.68,n)*smoothstep(.02,.2,h)*.45;c=mix(c,vec3(.87,.86,.81),clouds);float sun=max(dot(d,normalize(vec3(-.4,.65,.5))),0.);c+=vec3(.16,.1,.04)*pow(sun,18.);gl_FragColor=vec4(c,1.);
 #include <colorspace_fragment>
 }`;o.material.needsUpdate=true;}});
world.grass.material.vertexShader=world.grass.material.vertexShader.replace('t * 0.66 * s','t * 0.38 * s').replace('position.x * (0.6 + 0.8 * aOff.w)','position.x * (0.35 + 0.5 * aOff.w)').replace('m.rgb * mix(0.5, 1.15, t)','mix(m.rgb, vec3(0.18,0.26,0.09),0.65) * mix(0.55, 1.25, t)');world.grass.material.needsUpdate=true;
world.clouds.forEach(c=>c.visible=false);
world.update=(dt,time,cam,pos)=>{
 oldUpdate(dt,time,cam,pos);world.sun.color.copy(sunColor);world.sun.intensity=2.8;world.sun.position.copy(world.sun.target.position).add(new THREE.Vector3(-24,38,22));world.hemi.color.set('#b5c6d8');world.hemi.groundColor.set('#454532');world.hemi.intensity=.65;
 for(const u of skyUniforms){u.uTop.value.copy(skyTop);u.uHor.value.copy(skyHorizon);u.uBot.value.copy(skyBottom);}world.stars.material.opacity=.04;
 scene.fog.color.copy(fogColor);scene.fog.near=52;scene.fog.far=180;world.grass.material.uniforms.uLight.value.setRGB(.9,.92,.8);world.grass.material.uniforms.uFogC.value.copy(fogColor);
 if(world.lightPools)world.lightPools.material.opacity*=.18;
 updateActors(dt);sound.tick();combat.tick(dt);vehicleAudio.tick(dt);edition.style.display=p.mode==='title'?'block':'none';hint.style.display=p.mode==='play'&&matchMedia('(pointer:fine)').matches?'block':'none';
 if(p.mode==='play')cameraCollision();
};
renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;
world.sun.shadow.mapSize.set(2048,2048);world.sun.shadow.normalBias=.015;world.sun.shadow.bias=-.00005;
const fill=new THREE.DirectionalLight('#dcecff',.2);fill.position.set(0,8,15);scene.add(fill);
const pmrem=new THREE.PMREMGenerator(renderer),studio=new RoomEnvironment();scene.environment=pmrem.fromScene(studio,.08).texture;scene.environmentIntensity=.28;studio.dispose();pmrem.dispose();
const ray=new THREE.Raycaster(),origin=new THREE.Vector3(),direction=new THREE.Vector3();
function cameraCollision(){origin.copy(player.pos).y+=1.6;direction.copy(camera.position).sub(origin);const length=direction.length();ray.set(origin,direction.normalize());ray.far=length;const hit=ray.intersectObjects(obstacleMeshes,false)[0];if(hit&&hit.distance>1)camera.position.copy(origin).addScaledVector(direction,Math.max(1.2,hit.distance-.4));}
async function terrainTextures(){
 const tl=new THREE.TextureLoader();const textures=await Promise.all(['meadow','earth','stone'].map(id=>tl.loadAsync(`assets/game/${id}.jpg`)));for(const t of textures){t.wrapS=t.wrapT=THREE.RepeatWrapping;t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;}
 const geo=world.terrain.geometry,pos=geo.attributes.position,weights=new Float32Array(pos.count*2);
 for(let i=0;i<pos.count;i++){const x=pos.getX(i),z=pos.getZ(i);weights[i*2]=Math.max(1-THREE.MathUtils.smoothstep(world.pathDist(x,z),1.8,3.8),1-THREE.MathUtils.smoothstep(Math.hypot(x,z-70),6,9));weights[i*2+1]=THREE.MathUtils.smoothstep(pos.getY(i),8,19);}
 geo.setAttribute('terrainWeights',new THREE.BufferAttribute(weights,2));const material=new THREE.MeshStandardMaterial({roughness:.96,vertexColors:true});
 material.onBeforeCompile=shader=>{Object.assign(shader.uniforms,{grassTex:{value:textures[0]},dirtTex:{value:textures[1]},rockTex:{value:textures[2]}});shader.vertexShader='attribute vec2 terrainWeights; varying vec2 vTerrainWeights; varying vec3 vTerrainPos;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvTerrainWeights=terrainWeights;vTerrainPos=position;');shader.fragmentShader='uniform sampler2D grassTex;uniform sampler2D dirtTex;uniform sampler2D rockTex;varying vec2 vTerrainWeights;varying vec3 vTerrainPos;\n'+shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\nvec3 ground=mix(texture2D(grassTex,vTerrainPos.xz*.19).rgb,texture2D(dirtTex,vTerrainPos.xz*.22).rgb,vTerrainWeights.x);ground=mix(ground,texture2D(rockTex,vTerrainPos.xz*.14).rgb,vTerrainWeights.y);diffuseColor.rgb=mix(diffuseColor.rgb,ground,.82);');};world.terrain.material=material;
}
async function forest(){
 const bark=await new THREE.TextureLoader().loadAsync('assets/game/bark.jpg');bark.wrapS=bark.wrapT=THREE.RepeatWrapping;bark.repeat.set(2,3);bark.colorSpace=THREE.SRGBColorSpace;
 const barkMat=new THREE.MeshStandardMaterial({map:bark,roughness:.94});
 const canvas=document.createElement('canvas');canvas.width=canvas.height=256;const ctx=canvas.getContext('2d');let seed=75;const rnd=()=>((seed=Math.imul(seed,1664525)+1013904223|0)>>>0)/4294967296;
 for(let i=0;i<430;i++){const a=rnd()*Math.PI*2,r=Math.sqrt(rnd())*109,x=128+Math.cos(a)*r,y=128+Math.sin(a)*r;ctx.fillStyle=['#526536','#697b42','#3e582e','#7b874a','#344b29'][i%5];ctx.beginPath();ctx.ellipse(x,y,5+rnd()*7,3+rnd()*4,a,0,Math.PI*2);ctx.fill();}
 const leafTex=new THREE.CanvasTexture(canvas);leafTex.colorSpace=THREE.SRGBColorSpace;
 const leafMat=new THREE.MeshStandardMaterial({map:leafTex,alphaTest:.45,side:THREE.DoubleSide,roughness:.9,color:0xaab89b});
 for(const [old,pine] of [[world.oakTrees,false],[world.pineTrees,true]]){
  if(!old)continue;const wood=[],leaves=[];
  wood.push(new THREE.CylinderGeometry(.16,.38,6.6,7,3).translate(0,3.3,0));
  for(let i=0;i<10;i++){
   const angle=i*2.399,base=2.5+i*.32,length=pine?2.4-i*.14:2.4-i*.08;
   const from=new THREE.Vector3(0,base,0),to=new THREE.Vector3(Math.cos(angle)*length,base+1.1,Math.sin(angle)*length),dir=to.clone().sub(from);
   const branch=new THREE.CylinderGeometry(.035,.11,dir.length(),5);branch.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),dir.clone().normalize()));branch.translate(...from.add(to).multiplyScalar(.5).toArray());wood.push(branch);
   for(let j=0;j<5;j++){const leaf=new THREE.PlaneGeometry(pine?2.5:3.4,pine?1.5:2.5);leaf.rotateX((rnd()-.5)*2);leaf.rotateY(angle+j*1.3);leaf.rotateZ(rnd()*2);leaf.translate(to.x+(rnd()-.5)*1.5,to.y+(rnd()-.5)*1.5,to.z+(rnd()-.5)*1.5);leaves.push(leaf);}
  }
  const trunk=new THREE.InstancedMesh(mergeGeometries(wood),barkMat,old.count),crown=new THREE.InstancedMesh(mergeGeometries(leaves),leafMat,old.count);trunk.instanceMatrix.copy(old.instanceMatrix);crown.instanceMatrix.copy(old.instanceMatrix);trunk.castShadow=crown.castShadow=true;trunk.receiveShadow=crown.receiveShadow=true;scene.add(trunk,crown);old.visible=false;
 }
}
async function loadAll(){for(const [id,height] of specs){try{const gltf=await loader.loadAsync(`assets/game/${id}.glb`);assets.set(id,rigMount(prepare(gltf,height),id));status.textContent=`Neue Modelle: ${++loaded} / ${specs.length}`;}catch(e){failures.push(id);console.error('Modell',id,e);}}
 if(['cottage','forge','well'].every(id=>assets.has(id)))buildings();villageDetails();await terrainTextures().catch(e=>console.warn('Texturen noch nicht bereit',e.message));await forest().catch(e=>console.warn('Waldtexturen',e.message));
 if(assets.has('mirja')){world.oldMirja.visible=false;const npc=place('mirja',world.npcPos.x,world.npcPos.z,world.npcPos.rot);world.anim.push((dt,t)=>{npc.position.y=world.heightAt(world.npcPos.x,world.npcPos.z)+Math.sin(t*2)*.012;});}
 G.premium={assets,actors,failures,loaded:true};status.textContent=failures.length?'Einzelne Modelle konnten nicht geladen werden. Originalgrafik bleibt verfügbar.':`Lokale Edition · ${specs.length} neue Modelle bereit`;setTimeout(()=>status.style.opacity='0',6000);p.net?.status();
}
await loadAll();
