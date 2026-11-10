const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {WebSocketServer,WebSocket}=require('./runtime/node_modules/ws');
const ROOT=__dirname,GRACE=10*60*1000,rooms=new Map();
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css','.json':'application/json','.glb':'model/gltf-binary','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.mp3':'audio/mpeg','.wav':'audio/wav'};
function createServer(){
 const server=http.createServer((req,res)=>{
  let pathname;try{pathname=decodeURIComponent(new URL(req.url,'http://local').pathname);}catch{res.writeHead(400);return res.end();}
  if(pathname==='/health'){res.setHeader('Content-Type','application/json');return res.end(JSON.stringify({ok:true,rooms:rooms.size,maxPlayers:4,graceMs:GRACE}));}
  if(pathname==='/rtc-config'){res.setHeader('Content-Type','application/json');let iceServers=[{urls:'stun:stun.l.google.com:19302'}];if(process.env.TURN_URL&&process.env.TURN_USER&&process.env.TURN_PASSWORD)iceServers.push({urls:process.env.TURN_URL,username:process.env.TURN_USER,credential:process.env.TURN_PASSWORD});return res.end(JSON.stringify({iceServers}));}
  if(pathname==='/')pathname='/premium.html';
  // Serve game assets only. Never expose the parent workspace or local reports.
  const allowed=/^\/(premium\.html|game\.local\.js|coop\.js|premium\.js|mounts\.js|enemy-audio\.js|character-rig\.js|combat\.js|vehicle-audio\.js|premium\.css|assets\/game\/[\w.-]+|runtime\/node_modules\/three\/(build|examples\/jsm)\/[\w/.-]+)$/;
  if(!allowed.test(pathname)||pathname.includes('..')){res.writeHead(404);return res.end('Nicht gefunden');}
  const file=path.resolve(ROOT,'.'+pathname);if(!file.startsWith(ROOT+path.sep)){res.writeHead(403);return res.end();}
  fs.stat(file,(err,stat)=>{if(err||!stat.isFile()){res.writeHead(404);return res.end();}res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Cache-Control',pathname.endsWith('.glb')?'public,max-age=3600':'no-cache');fs.createReadStream(file).pipe(res);});
 });
 const wss=new WebSocketServer({server,path:'/room',maxPayload:512*1024});
 const send=(s,o)=>{if(s?.readyState===WebSocket.OPEN&&s.bufferedAmount<1024*1024)s.send(JSON.stringify(o));};
 const roster=r=>[...r.members.values()].map(m=>({id:m.id,name:m.name,online:!!m.socket,away:m.away,mic:m.mic}));
 const presence=r=>{for(const m of r.members.values())send(m.socket,{type:'roster',members:roster(r)});};
 function remove(r,m){r.members.delete(m.id);for(const x of r.members.values())send(x.socket,{type:'left',id:m.id});presence(r);}
 function end(r){for(const m of r.members.values()){send(m.socket,{type:'ended'});m.socket?.close();}rooms.delete(r.code);}
 wss.on('connection',(socket,req)=>{
  if(req.headers.origin){try{if(new URL(req.headers.origin).host!==req.headers.host){socket.close(1008,'origin');return;}}catch{socket.close(1008);return;}}
  let room,member,count=0,windowStart=Date.now();
  const err=message=>send(socket,{type:'error',message});
  const authTimer=setTimeout(()=>{if(!member)socket.close(1008,'join timeout');},15000);authTimer.unref();
  socket.on('message',raw=>{
   if(Date.now()-windowStart>1000){count=0;windowStart=Date.now();}if(++count>100){socket.close(1008,'rate');return;}
   let q;try{q=JSON.parse(raw);}catch{return;}if(!q||typeof q!=='object')return;
   if(!member){
    if(q.type==='create'){
     if(rooms.size>=100)return err('Dienst ausgelastet. Bitte später versuchen.');let code;do{code=Array.from(crypto.randomBytes(5),n=>'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[n%31]).join('');}while(rooms.has(code));
     room={code,members:new Map(),created:Date.now(),world:null,version:null};rooms.set(code,room);member={id:0};
    }else if(q.type==='join'){
     room=rooms.get(String(q.code||'').toUpperCase());if(!room)return err('Kein Raum mit diesem Code gefunden. Bitte den aktuellen Einladungslink verwenden.');
     if(q.token){member=[...room.members.values()].find(m=>m.token===q.token);if(!member)return err('Dein reservierter Platz ist abgelaufen. Bitte erneut beitreten.');}
     if(member){if(member.socket&&member.socket!==socket)member.socket.close(4000,'replaced');}
     else {if(room.members.size>=4)return err('Der Raum ist voll (höchstens 4 Spieler).');let id=1;while(room.members.has(id))id++;member={id};}
    }else return;
    member.token ||= crypto.randomBytes(24).toString('hex');member.name=String(q.name||member.name||'Abenteurer').slice(0,12);member.socket=socket;member.disconnected=0;member.away=false;member.mic=false;room.members.set(member.id,member);clearTimeout(authTimer);
    send(socket,{type:'ready',code:room.code,id:member.id,token:member.token,graceMs:GRACE,world:q.token?room.world:null});presence(room);
    if(member.id===0)for(const m of room.members.values())if(m.id>0&&m.hello)send(socket,{type:'data',from:m.id,data:m.hello});
    return;
   }
   if(q.type==='ping')return send(socket,{type:'pong'});
   if(q.type==='presence'){member.away=!!q.away;member.mic=!!q.mic;presence(room);return;}
   if(q.type==='leave'){if(member.id===0)end(room);else remove(room,member);socket.close();return;}
   if(q.type==='kick'&&member.id===0){const m=room.members.get(q.id);if(m&&m.id){send(m.socket,{type:'ended'});m.socket?.close();remove(room,m);}return;}
   if(q.type==='signal'){const to=room.members.get(q.to);if(to&&to!==member&&q.signal&&JSON.stringify(q.signal).length<65000)send(to.socket,{type:'signal',from:member.id,signal:q.signal});return;}
   if(q.type==='cache'&&member.id===0){room.world=q.world;room.version=q.version;return;}
   if(q.type!=='data'||!q.data||typeof q.data!=='object')return;
   if(member.id>0){
    if(q.data.t==='hello'){
     member.hello=q.data;member.name=String(q.data.name||member.name).slice(0,12);presence(room);
     const host=room.members.get(0);
     if(room.world&&(host.away||!host.socket)){
      if(q.data.v!==room.version)return send(socket,{type:'data',from:0,data:{t:'ver'}});
      send(socket,{type:'data',from:0,data:{t:'welcome',pid:member.id,name:host.name,players:roster(room).filter(x=>x.id!==member.id&&x.id!==0).map(x=>[x.id,x.name]),w:room.world}});
     }
    }
    send(room.members.get(0)?.socket,{type:'data',from:member.id,data:q.data});
   }else for(const m of room.members.values())if(m.id>0&&(q.to===undefined||q.to===m.id))send(m.socket,{type:'data',from:0,data:q.data});
  });
  socket.on('error',()=>{});
  socket.on('close',()=>{clearTimeout(authTimer);if(member?.socket===socket){member.socket=null;member.disconnected=Date.now();member.mic=false;presence(room);}});
 });
 const timer=setInterval(()=>{const now=Date.now();for(const room of rooms.values()){
  const host=room.members.get(0);if(!host||(!host.socket&&now-host.disconnected>GRACE)){end(room);continue;}
  for(const m of room.members.values())if(m.id>0&&!m.socket&&now-m.disconnected>GRACE)remove(room,m);
 }},5000);timer.unref();server.on('close',()=>{clearInterval(timer);wss.close();});server.rooms=rooms;return server;
}
module.exports={createServer};
if(require.main===module){const port=Number(process.env.PORT)||4173,host=process.env.BIND_ADDRESS||'127.0.0.1';const server=createServer();server.listen(port,host,()=>console.log(`Tom Hengst lokal: http://${host}:${port}\nKoop: 4 Spieler, Raum-Erhalt 10 Minuten. Strg+C beendet den lokalen Server.`));}
