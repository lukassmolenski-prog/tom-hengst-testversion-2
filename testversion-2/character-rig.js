import * as THREE from 'three';

// All inputs face +Z before auto-rigging. Bind matrices are in mesh metres;
// provider node transforms may use centimetres, so recover the rest joints here.
export function prepareCharacter(source,height){
 const root=new THREE.Group(),geometry=source.geometry.clone();geometry.computeBoundingBox();
 const box=geometry.boundingBox,scale=height/(box.max.y-box.min.y),center=box.getCenter(new THREE.Vector3());
 const normalize=new THREE.Matrix4().makeScale(scale,scale,scale).multiply(new THREE.Matrix4().makeTranslation(-center.x,-box.min.y,-center.z));geometry.applyMatrix4(normalize);
 const old=source.skeleton.bones,positions=source.skeleton.boneInverses.map(m=>new THREE.Vector3().setFromMatrixPosition(m.clone().invert()).applyMatrix4(normalize));
 const bones=old.map(b=>{const n=new THREE.Bone();n.name=b.name;return n;}),indices=new Map(old.map((b,i)=>[b,i]));
 old.forEach((b,i)=>{const parent=indices.get(b.parent);bones[i].position.copy(positions[i]);if(parent!==undefined){bones[i].position.sub(positions[parent]);bones[parent].add(bones[i]);}else root.add(bones[i]);});
 const mesh=new THREE.SkinnedMesh(geometry,source.material);root.add(mesh);root.updateMatrixWorld(true);mesh.bind(new THREE.Skeleton(bones));mesh.normalizeSkinWeights();
 return root;
}

// A smooth closed-hand shape supplements the provider's wrist-only skeleton.
// The original hand geometry stays available as morph weight zero.
export function addGripMorph(root){
 root.traverse(mesh=>{if(!mesh.isSkinnedMesh)return;const g=mesh.geometry,position=g.attributes.position,skin=g.attributes.skinIndex,weights=g.attributes.skinWeight,delta=new Float32Array(position.count*3);
  const hands=new Map(mesh.skeleton.bones.map((b,i)=>[i,b]).filter(([,b])=>/^(Left|Right)Hand$/.test(b.name)).map(([i])=>[i,new THREE.Vector3().setFromMatrixPosition(mesh.skeleton.boneInverses[i].clone().invert())]));
  for(let i=0;i<position.count;i++){let strength=0,wrist;for(let k=0;k<4;k++){const id=skin.array[i*4+k];if(hands.has(id)&&weights.array[i*4+k]>strength){strength=weights.array[i*4+k];wrist=hands.get(id);}}if(!wrist||strength<.5)continue;
   const y=position.getY(i),z=position.getZ(i),knuckle=wrist.y-.065,length=knuckle-y;if(length<=0)continue;
   const radius=.04,angle=Math.min(2.75,length/radius),blend=THREE.MathUtils.smoothstep(strength,.5,.9);
   delta[i*3+1]=(knuckle-Math.sin(angle)*radius-y)*blend;delta[i*3+2]=(-radius*(1-Math.cos(angle)))*blend;
  }
  g.morphAttributes.position=[new THREE.Float32BufferAttribute(delta,3)];g.morphTargetsRelative=true;mesh.updateMorphTargets();mesh.morphTargetInfluences[0]=1;
 });
}

export function poseRoll(a,d){
 const phase=THREE.MathUtils.clamp(a.t/.46,0,1),s=THREE.MathUtils.smoothstep,tuck=s(phase,0,.18)*(1-s(phase,.78,1)),angle=Math.PI*2*s(phase,0,1),pivot=1.02;
 d.root.rotation.set(angle,0,0);d.root.position.set(0,pivot-.28*tuck+.1*Math.sin(Math.PI*phase)-pivot*Math.cos(angle),-pivot*Math.sin(angle));
 const r=d.rig;r.pose('Spine02',.65*tuck);r.pose('Head',.4*tuck);r.pose('RightUpLeg',-1.7*tuck);r.pose('LeftUpLeg',-1.55*tuck);r.pose('RightLeg',2.25*tuck);r.pose('LeftLeg',2.25*tuck);r.pose('RightArm',-.95*tuck,0,-.25*tuck);r.pose('LeftArm',-.95*tuck,0,.25*tuck);r.pose('RightForeArm',-1.25*tuck);r.pose('LeftForeArm',-1.25*tuck);
 // Carry the weapons close to the body through the roll.
 r.pose('RightHand',.3,-Math.PI/2,0);r.pose('LeftHand',0,0,0);
 // Ground the tucked body instead of rotating around a floating waist pivot.
 groundPose(a,d,.025*Math.sin(Math.PI*phase));
}

const probe=new THREE.Vector3();
function groundPose(a,d,clearance=0){
 a.group.updateMatrixWorld(true);let lowest=Infinity;
 d.root.traverse(mesh=>{if(!mesh.isSkinnedMesh)return;mesh.skeleton.update();const count=mesh.geometry.attributes.position.count;for(let i=0;i<count;i+=24){mesh.getVertexPosition(i,probe);probe.applyMatrix4(mesh.matrixWorld);lowest=Math.min(lowest,probe.y);}});
 if(Number.isFinite(lowest))d.root.position.y+=a.pos.y+clearance-lowest;
}

export function poseSignature(a,d){
 const s=THREE.MathUtils.smoothstep,t=a.t,wind=s(t,0,.15),hit=s(t,.15,.29),release=1-s(t,.36,.72),lift=hit*release,brace=wind*release,r=d.rig;
 d.root.position.set(0,0,0);d.root.rotation.set(-.1*lift,0,0);
 r.pose('Spine02',-.12*lift,-.22*brace);r.pose('Head',.12*brace);
 r.pose('RightUpLeg',-1.85*lift);r.pose('RightLeg',2.15*lift);r.pose('RightFoot',-.3*lift);
 r.pose('LeftUpLeg',-.12*brace);r.pose('LeftLeg',.2*brace);
 r.pose('RightArm',-.95*brace,-.2*brace,-.12);r.pose('LeftArm',-1.05*brace,.25*brace,.12);r.pose('RightForeArm',-1.15*brace);r.pose('LeftForeArm',-1.2*brace);
 r.pose('RightHand');r.pose('LeftHand');groundPose(a,d);
 // Equipment is put away during the unarmed signature attack.
 d.sword.visible=d.shield.visible=false;
}
