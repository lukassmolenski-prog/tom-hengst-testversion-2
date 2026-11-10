// Two continuous V10 layers follow speed/load for every nearby Ferrari.
// A cyclic crossfade removes the generated clips' start/end discontinuities.
export function installVehicleAudio(G){
 const {p,player,sound}=G,loops=new Map(),instances=new Map(),stats={started:0,stopped:0},previous=new WeakMap();
 function loopBuffer(id){if(loops.has(id))return loops.get(id);const input=sound.buffers.get(id),ctx=G.audioContext();if(!input||!ctx)return;
  const samples=input.getChannelData(0),start=Math.floor(input.sampleRate*.22),end=samples.length-Math.floor(input.sampleRate*.22),fade=Math.min(Math.floor(input.sampleRate*.18),Math.floor((end-start)/8)),length=end-start-fade,out=ctx.createBuffer(1,length,input.sampleRate),data=out.getChannelData(0);
  for(let i=0;i<length;i++)data[i]=samples[start+i];for(let i=0;i<fade;i++){const t=i/fade;data[i]=samples[start+length+i]*(1-t)+samples[start+i]*t;}
  loops.set(id,out);return out;
 }
 function stop(a){const voice=instances.get(a);if(!voice)return;for(const layer of voice.layers){layer.source.stop();layer.source.disconnect();layer.gain.disconnect();}voice.filter.disconnect();voice.pan.disconnect();voice.master.disconnect();instances.delete(a);stats.stopped++;}
 function clear(){for(const a of instances.keys())stop(a);}
 function create(a){const ctx=G.audioContext(),idle=loopBuffer('v10-idle'),drive=loopBuffer('v10-drive');if(!idle||!drive)return;
  const master=ctx.createGain(),filter=ctx.createBiquadFilter(),pan=ctx.createStereoPanner();filter.type='lowpass';filter.Q.value=.5;master.gain.value=0;filter.connect(pan);pan.connect(master);master.connect(G.audioOutput());
  const layers=[idle,drive].map(buffer=>{const source=ctx.createBufferSource(),gain=ctx.createGain();source.buffer=buffer;source.loop=true;gain.gain.value=0;source.connect(gain);gain.connect(filter);source.start();return{source,gain};});
  const v={layers,master,filter,pan,rpm:1000,gear:1,lastSpeed:0,lastOverrun:-10};instances.set(a,v);stats.started++;return v;
 }
 function tick(dt){
  const ctx=G.audioContext(),allowed=ctx?.state==='running'&&!document.hidden&&!G.audio.isMuted()&&p.mode==='play';if(!allowed){clear();return;}
  const avatars=[player,...p.remotes.values()],alive=new Set(avatars);
  for(const a of instances.keys())if(!alive.has(a)||a.mount!=='ferrari'||a.dead)stop(a);
  for(const a of avatars){const was=previous.get(a);previous.set(a,a.mount);const dx=a.pos.x-player.pos.x,dz=a.pos.z-player.pos.z,distance=Math.hypot(dx,dz);if(a.mount!=='ferrari'||a.dead||distance>38){stop(a);continue;}
   let v=instances.get(a);if(!v){v=create(a);if(!v)continue;if(was!=='ferrari')sound.play('v10-start',{at:a.pos,volume:.46});}
   const speed=Math.abs(a.speed),load=Math.min(1,speed/3),accel=(speed-v.lastSpeed)/Math.max(dt,.016),gear=speed<3?1:speed<6.5?2:speed<10.5?3:4,lower=[0,0,3,6.5,10.5][gear],upper=[0,3,6.5,10.5,15][gear],phase=Math.max(0,Math.min(1,(speed-lower)/(upper-lower)));
   const target=speed<.2?1000:gear===1?1300+phase*5200:3700+phase*3200;v.rpm+=(target-v.rpm)*(1-Math.exp(-dt*9));v.gear=gear;v.lastSpeed=speed;
   const duck=p.net?.members?.some(m=>m.mic&&!m.away)?.6:1,volume=(a===player?.34:.3)*Math.pow(Math.max(0,1-distance/38),1.8)*duck,now=ctx.currentTime;
   v.master.gain.setTargetAtTime(volume,now,.08);v.layers[0].gain.gain.setTargetAtTime(1-load*.78,now,.08);v.layers[1].gain.gain.setTargetAtTime(load*.85,now,.08);v.layers[0].source.playbackRate.setTargetAtTime(.88+Math.min(1,v.rpm/3500)*.55,now,.06);v.layers[1].source.playbackRate.setTargetAtTime(.65+v.rpm/8000,now,.06);
   v.filter.frequency.setTargetAtTime(1600+load*8500,now,.08);v.pan.pan.setTargetAtTime(Math.max(-.85,Math.min(.85,(dx*p.camRight.x+dz*p.camRight.z)/Math.max(1,distance))),now,.05);
   if(accel< -12&&speed>1&&p.time-v.lastOverrun>1.2){sound.play('v10-overrun',{at:a.pos,volume:.32});v.lastOverrun=p.time;}
  }
 }
 const suspend=G.audio.suspend.bind(G.audio);G.audio.suspend=()=>{clear();suspend();};document.addEventListener('visibilitychange',()=>{if(document.hidden)clear();});
 G.vehicleAudio={tick,instances,stats,clear,loops};return G.vehicleAudio;
}
