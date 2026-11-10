// Generated creature vocals: shared world events trigger local, spatial audio.
// Audio is never sent through the microphone/voice-chat connection.
export function installEnemyAudio(G){
 const {p,player,audio}=G,types={glimm:'ghoul',spor:'revenant',mirror:'vampire',roller:'orc',boss:'nachtgeweih'},buffers=new Map(),previous=new WeakMap(),cooldowns=new WeakMap(),voices=new Set(),played=[],stats={},failures=[];
 const ids=Object.values(types).flatMap(id=>['alert','hurt','death'].map(s=>id+'-'+s)).concat(['sword-swing','sword-hit','shield-parry','hengst-impact','monsterkill','v10-idle','v10-drive','v10-overrun','v10-start']);
 const decoder=new OfflineAudioContext(1,1,48000);
 async function load(id){try{const response=await fetch(`assets/game/${id}.mp3`);if(!response.ok)throw new Error(String(response.status));let b=await decoder.decodeAudioData(await response.arrayBuffer());let peak=0,sum=0,first=b.length,last=0;
  for(let ch=0;ch<b.numberOfChannels;ch++){const samples=b.getChannelData(ch);for(let i=0;i<samples.length;i++){const v=Math.abs(samples[i]);peak=Math.max(peak,v);sum+=v*v;if(v>.004){first=Math.min(first,i);last=Math.max(last,i);}}}
  if(peak<.001)throw new Error('silent audio');first=Math.max(0,first-Math.round(.015*b.sampleRate));last=Math.min(b.length,last+Math.round(.06*b.sampleRate));
  const out=decoder.createBuffer(1,Math.max(1,last-first),b.sampleRate),data=out.getChannelData(0),gain=Math.min(2,.82/peak);
  for(let ch=0;ch<b.numberOfChannels;ch++){const samples=b.getChannelData(ch);for(let i=0;i<data.length;i++)data[i]+=samples[first+i]*gain/b.numberOfChannels;}
  const fade=Math.min(240,Math.floor(data.length/6));for(let i=0;i<fade;i++){data[i]*=i/fade;data[data.length-1-i]*=i/fade;}
  buffers.set(id,out);stats[id]={duration:out.duration,peak,rms:Math.sqrt(sum/(b.length*b.numberOfChannels)),bytes:out.length*4};
 }catch(e){failures.push(id);console.warn('Audioclip',id,e.message);}}
 const ready=Promise.all(ids.map(load));
 function play(id,{at=null,volume=.42,pitch=1,enemy=null,offset=0,delay=0}={}){
  const ctx=G.audioContext(),output=G.audioOutput(),buffer=buffers.get(id);if(!ctx||ctx.state!=='running'||!output||!buffer||audio.isMuted()||document.hidden)return false;
  if(offset>=buffer.duration)return false;
  if(id==='monsterkill')for(const v of voices)if(v.id===id){v.source.stop();voices.delete(v);}
  if(voices.size>=7){if(!['hengst-impact','monsterkill'].includes(id))return false;const oldest=voices.values().next().value;oldest.source.stop();voices.delete(oldest);}
  let distance=0,pan=0;if(at){const dx=at.x-player.pos.x,dz=at.z-player.pos.z;distance=Math.hypot(dx,dz);const max=enemy?.kind==='boss'?55:30;if(distance>max)return false;volume*=Math.pow(1-distance/max,1.6);pan=Math.max(-.85,Math.min(.85,(dx*p.camRight.x+dz*p.camRight.z)/Math.max(distance,1)));}
  if(p.net?.members?.some(m=>m.mic&&!m.away))volume*=.6;
  const source=ctx.createBufferSource(),gain=ctx.createGain(),stereo=ctx.createStereoPanner();source.buffer=buffer;source.playbackRate.value=pitch;gain.gain.value=volume;stereo.pan.value=pan;source.connect(gain);gain.connect(stereo);stereo.connect(output);
  const voice={source,gain,stereo,enemy,id};voices.add(voice);source.onended=()=>{voices.delete(voice);source.disconnect();gain.disconnect();stereo.disconnect();};source.start(ctx.currentTime+delay,offset);played.push({id,time:performance.now(),distance,volume});if(played.length>120)played.shift();return true;
 }
 function vocal(a,event){const id=types[a.kind];if(!id)return;const now=performance.now(),last=cooldowns.get(a)||{};if(now-(last[event]||-1e9)<({alert:4200,hurt:650,death:10000}[event]))return;
  if(event==='death')for(const v of voices)if(v.enemy===a)v.source.stop();
  if(play(id+'-'+event,{at:a.pos,enemy:a,volume:a.kind==='boss'?.7:event==='hurt'?.3:.52,pitch:1+((a.seed||0)%1-.5)*.08})){last[event]=now;cooldowns.set(a,last);}
 }
 const alerts={glimm:['wind'],spor:['emerge','aim'],mirror:['wind'],roller:['rev'],boss:['intro','chW','rage']};
 function tick(){for(const a of p.enemies){const before=previous.get(a);if(before){if((before.alive&&!a.alive)||before.state!=='dying'&&a.state==='dying')vocal(a,'death');else if(a.hp<before.hp&&a.hp>0)vocal(a,'hurt');else if(a.state!==before.state&&alerts[a.kind]?.includes(a.state))vocal(a,'alert');}previous.set(a,{state:a.state,hp:a.hp,alive:a.alive});}}
 const original=audio.sfx.bind(audio),replaced={swing:'sword-swing',swingHeavy:'sword-swing',mirrorSlash:'sword-swing',hit:'sword-hit',hitHeavy:'sword-hit',parry:'shield-parry',clang:'shield-parry',block:'shield-parry'};
 audio.sfx=(name,options={})=>{const id=replaced[name];if(id&&play(id,{volume:(options.vol??1)*(name==='swingHeavy'?.5:.35),pitch:options.pitch??(name==='swingHeavy'?.82:1)}))return;if(['bud','spore','rollerRev','rollerCrash','bossRoar'].includes(name)&&buffers.size)return;original(name,options);};
 const suspend=audio.suspend.bind(audio);audio.suspend=()=>{for(const v of voices)v.source.stop();suspend();};
 G.sound={ready,buffers,stats,failures,played,play,vocal,tick};return G.sound;
}
