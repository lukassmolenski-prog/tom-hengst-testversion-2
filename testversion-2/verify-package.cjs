const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {WebSocket}=require('./runtime/node_modules/ws');
const {assets}=require('./assets-manifest.json');
const report={passed:false,checks:[]};
function message(socket,type){return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{socket.off('message',handler);reject(new Error('Timeout: '+type));},5000);function handler(raw){const q=JSON.parse(raw);if(q.type===type){clearTimeout(timer);socket.off('message',handler);resolve(q);}}socket.on('message',handler);});}
async function main(){
 for(const a of assets){const name=a.kind==='texture'?a.file.replace(/\.png$/,'.jpg'):a.file,b=fs.readFileSync(path.join(__dirname,'assets/game',name));assert.ok(b.length>1000,name);if(a.kind==='model'){assert.equal(b.toString('ascii',0,4),'glTF',name);assert.equal(b.readUInt32LE(8),b.length,name);}if(a.kind==='texture')assert.equal(b.readUInt16BE(0),0xffd8,name);if(a.kind==='audio')assert.equal(crypto.createHash('sha256').update(b).digest('hex'),a.sha256,name);}
 assert.equal(assets.length,42);report.checks.push('42 vollständige Assets: 14 GLB, 24 MP3, 4 JPEG');
 const server=require('./server.cjs').createServer(),sockets=[];await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const origin='http://127.0.0.1:'+server.address().port;
 async function connect(q,type='ready'){const s=new WebSocket(origin.replace('http','ws')+'/room',{origin});sockets.push(s);await new Promise((r,j)=>{s.once('open',r);s.once('error',j);});const reply=message(s,type);s.send(JSON.stringify(q));return{socket:s,data:await reply};}
 try{
  const health=await(await fetch(origin+'/health')).json();assert.equal(health.maxPlayers,4);assert.equal(health.graceMs,600000);
  for(const url of ['/','/game.local.js','/combat.js','/vehicle-audio.js','/runtime/node_modules/three/build/three.module.js','/assets/game/tom-correct-rig.glb']){const r=await fetch(origin+url);assert.equal(r.status,200,url);await r.arrayBuffer();}
  assert.equal((await fetch(origin+'/assets-manifest.json')).status,404);report.checks.push('HTTP-Auslieferung und 10-Minuten-Raumreservierung');
  const host=await connect({type:'create',name:'Tom'}),code=host.data.code;
  assert.equal(code.length,5);
  const pong=message(host.socket,'pong');host.socket.send(JSON.stringify({type:'cache',world:{test:true},version:5}));host.socket.send(JSON.stringify({type:'ping'}));await pong;
  const closed=new Promise(r=>host.socket.once('close',r));host.socket.close();await closed;
  for(const name of ['A','B','C'])await connect({type:'join',name,code});
  assert.equal(server.rooms.get(code).members.size,4);report.checks.push('Drei Gäste treten bei getrenntem Gastgeber bei');
  const fifth=await connect({type:'join',name:'Fünfter',code},'error');assert.match(fifth.data.message,/voll/);report.checks.push('Fünfter Spieler wird abgewiesen');
  const resumed=await connect({type:'join',name:'Tom',code,token:host.data.token});assert.equal(resumed.data.id,0);assert.deepEqual(resumed.data.world,{test:true});assert.equal(server.rooms.get(code).members.size,4);report.checks.push('Gastgeber erhält denselben Platz und Weltzustand zurück');
  report.passed=true;
 }finally{for(const s of sockets)s.terminate();for(const room of server.rooms.values())for(const m of room.members.values())m.socket?.terminate();await new Promise(r=>server.close(r));}
 console.log(JSON.stringify(report,null,2));
}
main().catch(e=>{report.error=e.message;console.error(e);process.exitCode=1;}).finally(()=>fs.writeFileSync(path.join(__dirname,'package-check.json'),JSON.stringify(report,null,2)+'\n'));
