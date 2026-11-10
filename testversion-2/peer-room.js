/* Browser-hosted rooms. PeerJS Cloud only introduces peers; game data travels
   over WebRTC. Host snapshots and reservations stay in this browser tab. */
(()=>{
const GRACE=600000,PREFIX='tomhengst-v2-online-',alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const random=n=>Array.from(crypto.getRandomValues(new Uint8Array(n)),v=>alphabet[v%alphabet.length]).join('');
const storageKey=code=>'th.online-host.'+code;
window.TH_ICE_CONFIG={iceServers:[{urls:'stun:stun.l.google.com:19302'},{urls:'stun:stun.cloudflare.com:3478'}]};
window.TH_ICE_READY=fetch('./rtc-config.json').then(r=>r.ok?r.json():null).then(c=>{if(Array.isArray(c?.iceServers)&&c.iceServers.length)window.TH_ICE_CONFIG=c;}).catch(()=>{});
class PeerRoomSocket {
 constructor(){this.readyState=0;this.bufferedAmount=0;this.members=new Map();this.pending=new Set();this.timers=new Set();this.closed=false;this.started=Date.now();this.retries=0;this.pagehide=()=>this.close();addEventListener('pagehide',this.pagehide);this.later(()=>{this.readyState=1;this.onopen?.();},0);}
 later(fn,ms){const t=setTimeout(()=>{this.timers.delete(t);if(!this.closed)fn();},ms);this.timers.add(t);return t;}
 emit(q){this.later(()=>this.onmessage?.({data:JSON.stringify(q)}),0);}
 send(q){if(this.closed)return;try{if(typeof q==='string')q=JSON.parse(q);if(!this.request){this.request=q;this.begin().catch(()=>this.close());return;}if(this.host)this.handle(0,q);else this.transmit(this.link,q);}catch{}}
 transmit(conn,q){try{if(conn?.open&&conn.dataChannel?.bufferedAmount<512*1024)conn.send(q);}catch{}}
 async begin(){
  await window.TH_ICE_READY;if(this.closed)return;
  const q=this.request;this.code=q.type==='create'?random(5):String(q.code||'').toUpperCase();
  if(!/^[A-Z2-9]{5}$/.test(this.code)){this.emit({type:'error',message:'Der Einladungscode hat fünf Zeichen.'});return;}
  let saved;try{saved=JSON.parse(sessionStorage.getItem(storageKey(this.code))||'null');}catch{}
  this.host=q.type==='create'||!!(q.token&&saved?.token===q.token);
  if(this.host){
   if(saved&&Date.now()-saved.updated>GRACE){this.emit({type:'error',message:'Der gespeicherte Raum ist abgelaufen. Bitte einen neuen Raum öffnen.'});return;}
   this.world=saved?.world||null;this.version=saved?.version;this.token=saved?.token||random(32);
   this.members.set(0,{id:0,token:this.token,name:String(q.name||'Tom').slice(0,12),away:document.hidden,mic:false,online:true});
   for(const m of saved?.members||[])if(m.id>0&&Date.now()-(m.disconnected||saved.updated)<GRACE)this.members.set(m.id,{...m,online:false,mic:false,conn:null,disconnected:m.disconnected||saved.updated});
   this.persist();
  }
  this.openPeer();
 }
 openPeer(){
  if(this.closed)return;
  const peer=this.host?new window.TomPeer(PREFIX+this.code,{debug:0,config:window.TH_ICE_CONFIG}):new window.TomPeer({debug:0,config:window.TH_ICE_CONFIG});this.peer=peer;
  const startup=this.later(()=>{if(this.peer===peer&&!peer.open)this.close();},30000);
  peer.on('open',()=>{
   if(this.closed||this.peer!==peer)return;clearTimeout(startup);this.retries=0;
   if(this.host){this.emit({type:'ready',id:0,code:this.code,token:this.token,graceMs:GRACE,world:this.request.token?this.world:null});this.roster();if(!this.sweeping){this.sweeping=true;this.sweep();}}
   else this.connectHost();
  });
  peer.on('connection',c=>{if(this.host)this.accept(c);else c.close();});
  peer.on('disconnected',()=>{if(this.closed||this.peer!==peer)return;this.later(()=>{try{if(!peer.destroyed)peer.reconnect();else this.close();}catch{this.close();}},1500);});
  peer.on('error',e=>{
   if(this.closed||this.peer!==peer)return;
   if(e.type==='peer-unavailable'&&!this.host){this.link?.close();this.link=null;this.queueConnect();return;}
   if(e.type==='unavailable-id'&&this.host){clearTimeout(startup);peer.destroy();if(!this.request.token){try{sessionStorage.removeItem(storageKey(this.code));}catch{}this.code=random(5);this.persist();}if(Date.now()-this.started>GRACE){this.emit({type:'error',message:'Der Raum konnte nicht wiederhergestellt werden. Bitte einen neuen Raum öffnen.'});return;}this.later(()=>this.openPeer(),3000);return;}
   if(['browser-incompatible','invalid-id','invalid-key'].includes(e.type)){this.emit({type:'error',message:'Dieser Browser kann die Online-Verbindung nicht aufbauen. Bitte Chrome oder Safari aktualisieren.'});return;}
   this.close();
  });
 }
 queueConnect(){if(this.closed||this.connectQueued)return;this.connectQueued=true;this.later(()=>{this.connectQueued=false;this.connectHost();},5000);}
 connectHost(){
  if(this.closed||this.link?.open||!this.peer?.open)return;
  if(Date.now()-this.started>GRACE){this.emit({type:'error',message:'Der Gastgeber ist weiterhin nicht erreichbar. Bitte den Code prüfen und auf beiden Handys zum Spiel zurückkehren.'});return;}
  const c=this.peer.connect(PREFIX+this.code,{reliable:true,serialization:'json'});this.link=c;
  const timer=this.later(()=>{if(this.link===c&&!this.joined){c.close();this.link=null;this.queueConnect();}},12000);
  c.on('open',()=>this.transmit(c,this.request));
  c.on('data',q=>{if(this.link!==c||!q||typeof q!=='object')return;if(q.type==='ready'){this.joined=true;clearTimeout(timer);}this.emit(q);});
  const ended=()=>{if(this.link!==c||this.closed)return;this.link=null;if(this.joined)this.close();else this.queueConnect();};c.on('close',ended);c.on('error',ended);
 }
 accept(c){
  if(this.pending.size>=8){c.on('open',()=>c.close());return;}this.pending.add(c);let member;
  const timeout=this.later(()=>{if(!member)c.close();},15000);
  c.on('data',q=>{
   if(this.closed||!q||typeof q!=='object')return;
   if(JSON.stringify(q).length>512*1024){c.close();return;}
   if(!member){
    if(q.type!=='join'||q.code!==this.code){c.close();return;}
    if(q.token){member=[...this.members.values()].find(m=>m.id>0&&m.token===q.token);if(!member){this.transmit(c,{type:'error',message:'Dein reservierter Platz ist abgelaufen. Bitte erneut beitreten.'});this.later(()=>c.close(),300);return;}}
    if(!member){if(this.members.size>=4){this.transmit(c,{type:'error',message:'Der Raum ist voll (höchstens 4 Spieler).'});this.later(()=>c.close(),300);return;}let id=1;while(this.members.has(id))id++;member={id,token:random(32)};}
    const old=member.conn;member.conn=c;old?.close();Object.assign(member,{name:String(q.name||member.name||'Freund').slice(0,12),online:true,away:false,mic:false,disconnected:0});this.members.set(member.id,member);clearTimeout(timeout);this.pending.delete(c);
    this.transmit(c,{type:'ready',id:member.id,code:this.code,token:member.token,graceMs:GRACE,world:null});this.roster();this.persist();return;
   }
   if(member.conn!==c)return;const now=Date.now();if(!member.rateStart||now-member.rateStart>1000){member.rateStart=now;member.rate=0;}if(++member.rate>120){c.close();return;}
   this.handle(member.id,q);
  });
  const ended=()=>{this.pending.delete(c);if(member?.conn===c){member.conn=null;member.online=false;member.mic=false;member.disconnected=Date.now();this.roster();this.persist();}};c.on('close',ended);c.on('error',ended);
 }
 deliver(id,q){if(id===0)this.emit(q);else this.transmit(this.members.get(id)?.conn,q);}
 roster(){const members=[...this.members.values()].map(({id,name,online,away,mic})=>({id,name,online,away,mic}));for(const m of this.members.values())this.deliver(m.id,{type:'roster',members});}
 handle(id,q){
  const m=this.members.get(id);if(!m)return;
  if(q.type==='ping'){this.deliver(id,{type:'pong'});return;}
  if(q.type==='presence'){m.away=!!q.away;m.mic=!!q.mic;this.roster();this.persist();return;}
  if(q.type==='cache'&&id===0){this.world=q.world;this.version=q.version;this.persist();return;}
  if(q.type==='leave'){if(id===0){try{sessionStorage.removeItem(storageKey(this.code));}catch{}this.ended=true;for(const g of this.members.values())if(g.id)this.deliver(g.id,{type:'ended'});}else this.remove(id);return;}
  if(q.type==='kick'&&id===0){this.deliver(q.id,{type:'ended'});this.remove(q.id);return;}
  if(q.type==='signal'){if(Number.isInteger(q.to)&&q.to!==id&&this.members.has(q.to)&&q.signal&&JSON.stringify(q.signal).length<65000)this.deliver(q.to,{type:'signal',from:id,signal:q.signal});return;}
  if(q.type!=='data'||!q.data||typeof q.data!=='object')return;
  if(id===0){for(const g of this.members.values())if(g.id>0&&(q.to===undefined||q.to===g.id))this.deliver(g.id,{type:'data',from:0,data:q.data});}
  else {if(q.data.t==='hello'){m.name=String(q.data.name||m.name).slice(0,12);this.roster();this.persist();}this.deliver(0,{type:'data',from:id,data:q.data});}
 }
 remove(id){if(!id)return;const m=this.members.get(id);this.members.delete(id);m?.conn?.close();for(const g of this.members.values())this.deliver(g.id,{type:'left',id});this.roster();this.persist();}
 sweep(){if(this.closed)return;for(const m of this.members.values())if(m.id&&!m.online&&Date.now()-m.disconnected>GRACE)this.remove(m.id);this.later(()=>this.sweep(),5000);}
 persist(){if(!this.host||this.ended)return;try{sessionStorage.setItem(storageKey(this.code),JSON.stringify({token:this.token,world:this.world,version:this.version,updated:Date.now(),members:[...this.members.values()].map(({id,token,name,disconnected})=>({id,token,name,disconnected}))}));}catch{}}
 close(){if(this.closed)return;this.persist();this.closed=true;this.readyState=3;removeEventListener('pagehide',this.pagehide);for(const t of this.timers)clearTimeout(t);this.timers.clear();this.peer?.destroy();this.onclose?.();}
}
window.PeerRoomSocket=PeerRoomSocket;
})();
