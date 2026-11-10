/* Local room transport. The host remains the game authority; the relay keeps
   membership and the last world snapshot while a phone suspends the page. */
(()=>{
class LocalCoop {
 constructor(){this.role=null;this.on={};this.conns=new Map();this.code='';this.id=-1;this.closed=false;this.members=[];this.retry=0;this.hello=null;this.voice=new RoomVoice(this);this.visibility=()=>{this.presence();if(!document.hidden)this.ensureConnected();};document.addEventListener('visibilitychange',this.visibility);this.online=()=>this.ensureConnected();addEventListener('online',this.online);}
 get guest(){return this.role==='guest';}get hosting(){return this.role==='host';}get count(){return this.conns.size;}
 emit(k,...args){this.on[k]?.(...args);}
 create(){return this.connect({type:'create'});}
 join(code){return this.connect({type:'join',code:code.toUpperCase()});}
 resume(saved){this.token=saved.token;this.code=saved.code;return this.connect({type:'join',code:saved.code,name:saved.name});}
 connect(request){
  this.request={...request,name:request.name||document.getElementById('coName')?.value||'Abenteurer'};
  return new Promise((resolve,reject)=>{this.resolve=resolve;this.reject=reject;this.start=Date.now();this.open();});
 }
 open(){
  if(this.closed)return;clearTimeout(this.retryTimer);const ws=window.TH_ONLINE?new window.PeerRoomSocket():new WebSocket(`${location.protocol==='https:'?'wss:':'ws:'}//${location.host}/room`);this.socket=ws;
  const timeout=setTimeout(()=>ws.close(),15000);
  ws.onopen=()=>{clearTimeout(timeout);ws.send(JSON.stringify(this.token?{type:'join',code:this.code,token:this.token,name:this.request.name}:this.request));};
  ws.onmessage=({data})=>{if(this.socket!==ws)return;let q;try{q=JSON.parse(data);}catch{return;}
   if(q.type==='ready'){
    const resumed=!!this.token;this.token=q.token;this.code=q.code;this.id=q.id;this.role=q.id===0?'host':'guest';this.retry=0;this.connected=true;this.disconnectedAt=0;this.resumeWorld=q.world;
    try{sessionStorage.setItem('th.local-room',JSON.stringify({code:this.code,token:this.token,id:this.id,name:this.request.name}));}catch{}
    this.resolve?.(this.code);this.resolve=this.reject=null;
    if(resumed&&this.hello)this.send(this.hello);this.presence();this.status('Verbunden');this.emit('restored');
    clearInterval(this.heartbeat);this.heartbeat=setInterval(()=>{this.raw({type:'ping'});},15000);
   }else if(q.type==='roster'){
    this.members=q.members;this.conns.clear();for(const m of q.members)if(m.id!==0)this.conns.set(m.id,{open:m.online});
    this.voice.roster(q.members).catch(()=>this.voice.note('Sprachverbindung wird erneut aufgebaut'));this.status();this.emit('roster',q.members);
   }else if(q.type==='data')this.emit('data',q.data,q.from);
   else if(q.type==='signal'){this.voice.signals=(this.voice.signals||Promise.resolve()).then(()=>this.voice.signal(q.from,q.signal)).catch(()=>this.voice.note('Sprachverbindung wird erneut aufgebaut'));}
   else if(q.type==='left'){this.voice.remove(q.id);this.emit('leave',q.id);}
   else if(q.type==='ended'){this.closed=true;this.voice.stop();this.emit('lost');ws.close();}
   else if(q.type==='error'){if(this.reject){this.reject(new Error(q.message));this.resolve=this.reject=null;this.close(false);}else this.status(q.message);}
  };
  ws.onerror=()=>{};ws.onclose=()=>{clearTimeout(timeout);if(this.socket!==ws||this.closed)return;this.connected=false;this.voice.dropConnections();this.disconnectedAt ||=Date.now();this.status('Verbindung wird wiederhergestellt · Platz bleibt 10 Minuten reserviert');
   if(!this.token&&Date.now()-this.start>(window.TH_ONLINE?600000:45000)){this.reject?.(new Error(window.TH_ONLINE?'Der Gastgeber ist nicht erreichbar. Bitte Code prüfen und das Spiel auf beiden Handys öffnen. Manche Mobilfunknetze benötigen eine zusätzliche Weiterleitung.':'Der lokale Koop-Server ist nicht erreichbar. Bitte das Spiel über Start-Testversion.cmd öffnen.'));this.resolve=this.reject=null;this.close(false);return;}
   if(Date.now()-this.disconnectedAt>600000){this.emit('lost');this.close(false);return;}
   this.retryTimer=setTimeout(()=>this.open(),Math.min(1000*2**this.retry++,10000));
  };
 }
 ensureConnected(){if(this.closed)return;if(!this.socket||this.socket.readyState>1)this.open();else this.raw({type:'ping'});}
 raw(data){if(this.socket?.readyState===1&&this.socket.bufferedAmount<512*1024)this.socket.send(JSON.stringify(data));}
 send(data,to){if(data.t==='hello')this.hello=data;this.raw({type:'data',data,to});}
 cache(world,version){this.raw({type:'cache',world,version});}
 kick(id){this.raw({type:'kick',id});}
 presence(){this.raw({type:'presence',away:document.hidden,mic:this.voice.enabled&&!document.hidden});this.voice.visibility();}
 status(message){if(message)this.message=message;if(window.TH_ONLINE&&!this.connected&&document.getElementById('coStat'))document.getElementById('coStat').textContent='Warte auf den Gastgeber … Bei WhatsApp kurz zurück ins Spiel wechseln. Beitritt wird bis zu 10 Minuten wiederholt.';window.dispatchEvent(new CustomEvent('local-room-state',{detail:this}));}
 close(notify=true){if(notify)this.raw({type:'leave'});try{sessionStorage.removeItem('th.local-room');}catch{}this.closed=true;clearTimeout(this.retryTimer);clearInterval(this.heartbeat);document.removeEventListener('visibilitychange',this.visibility);removeEventListener('online',this.online);this.socket?.close();this.voice.stop();this.role=null;this.conns.clear();this.status('Raum verlassen');}
}
class RoomVoice {
 constructor(room){this.room=room;this.peers=new Map();this.enabled=false;this.stream=null;this.ice=null;this.message='Mikrofon aus';}
 note(message){this.message=message;this.room.status();}
 async toggle(){
  if(this.enabled){this.enabled=false;this.stream?.getTracks().forEach(t=>t.stop());this.stream=null;for(const p of this.peers.values())await p.sender?.replaceTrack(null);this.note('Mikrofon aus');this.room.presence();return;}
  if(!isSecureContext||!navigator.mediaDevices?.getUserMedia){this.note('Handy-Mikrofon braucht eine HTTPS-Adresse. Lokal am PC funktioniert localhost.');return;}
  try{this.stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true},video:false});this.enabled=true;for(const p of this.peers.values())await p.sender?.replaceTrack(this.stream.getAudioTracks()[0]);this.note('Mikrofon an');this.room.presence();await this.roster(this.room.members);for(const [id,p] of this.peers){p.audio?.play().catch(()=>{});if(this.room.id<id)await this.offer(id,p);else this.room.raw({type:'signal',to:id,signal:{restart:true}});}}
  catch(e){this.note(e.name==='NotAllowedError'?'Mikrofon nicht freigegeben. In den Browser-Einstellungen erlauben.':'Mikrofon konnte nicht gestartet werden.');}
 }
 async config(){if(window.TH_ONLINE){await window.TH_ICE_READY;return window.TH_ICE_CONFIG;}if(!this.ice)this.ice=fetch('/rtc-config').then(r=>r.json()).catch(()=>({iceServers:[]}));return this.ice;}
 async ensure(id){
  if(this.peers.has(id))return this.peers.get(id);
  const pc=new RTCPeerConnection(await this.config());if(this.peers.has(id)){pc.close();return this.peers.get(id);}
  const trans=this.room.id<id?pc.addTransceiver('audio',{direction:'sendrecv'}):null,p={pc,sender:trans?.sender,pending:[],audio:null};this.peers.set(id,p);
  if(this.stream)await p.sender?.replaceTrack(this.stream.getAudioTracks()[0]);
  pc.onicecandidate=({candidate})=>{if(candidate)this.room.raw({type:'signal',to:id,signal:{candidate}});};
  pc.ontrack=({track})=>{const audio=document.createElement('audio');audio.autoplay=true;audio.setAttribute('playsinline','');audio.srcObject=new MediaStream([track]);document.body.append(audio);p.audio=audio;audio.play().catch(()=>this.note('Für Sprachton einmal auf Mikrofon tippen.'));};
  pc.onconnectionstatechange=()=>{this.room.status();if(pc.connectionState==='failed'){if(this.room.id<id){pc.restartIce();this.offer(id,p).catch(()=>{});}else this.room.raw({type:'signal',to:id,signal:{restart:true}});}};
  return p;
 }
 async offer(id,p){if(p.makingOffer||p.pc.signalingState!=='stable'){p.needsOffer=true;return;}p.makingOffer=true;try{await p.pc.setLocalDescription(await p.pc.createOffer());this.room.raw({type:'signal',to:id,signal:{description:p.pc.localDescription}});}finally{p.makingOffer=false;}}
 async roster(members){
  const wanted=new Set(members.filter(m=>m.id!==this.room.id&&m.online&&!m.away&&(this.enabled||m.mic)).map(m=>m.id));
  for(const id of this.peers.keys())if(!wanted.has(id))this.remove(id);
  for(const id of wanted){const fresh=!this.peers.has(id);const p=await this.ensure(id);if(fresh&&this.room.id<id)await this.offer(id,p);}
 }
 async signal(id,s){
  const member=this.room.members.find(m=>m.id===id);if(!member||document.hidden)return;const p=await this.ensure(id);
  if(s.description){await p.pc.setRemoteDescription(s.description);for(const c of p.pending.splice(0))await p.pc.addIceCandidate(c);if(s.description.type==='offer'){const t=p.pc.getTransceivers().find(t=>t.receiver.track.kind==='audio');if(t){t.direction='sendrecv';p.sender=t.sender;await p.sender.replaceTrack(this.stream?.getAudioTracks()[0]||null);}await p.pc.setLocalDescription(await p.pc.createAnswer());this.room.raw({type:'signal',to:id,signal:{description:p.pc.localDescription}});}else if(p.needsOffer){p.needsOffer=false;await this.offer(id,p);}}
  if(s.candidate){if(p.pc.remoteDescription)await p.pc.addIceCandidate(s.candidate);else p.pending.push(s.candidate);}
  if(s.restart&&this.room.id<id){p.pc.restartIce();await this.offer(id,p);}
 }
 visibility(){this.stream?.getAudioTracks().forEach(t=>t.enabled=!document.hidden);if(!document.hidden)this.roster(this.room.members).catch(()=>{});}
 remove(id){const p=this.peers.get(id);if(p){p.pc.close();p.audio?.remove();this.peers.delete(id);}}
 dropConnections(){for(const id of this.peers.keys())this.remove(id);}
 stop(){this.enabled=false;this.stream?.getTracks().forEach(t=>t.stop());this.stream=null;this.dropConnections();}
}
window.LocalCoop=LocalCoop;
})();
