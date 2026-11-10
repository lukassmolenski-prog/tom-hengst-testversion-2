const fs=require('node:fs'),path=require('node:path');
const root=__dirname,out=path.join(root,'web');fs.mkdirSync(out,{recursive:true});
// GitHub project sites share an origin. Keep test saves separate from version 1.
const isolateStorage=s=>s.replaceAll('tomhengst.v1','tomhengst.testversion2.v1').replaceAll('th.name','th.testversion2.name').replaceAll('th.local-room','th.testversion2.room').replaceAll('th.mount','th.testversion2.mount');
for(const f of ['coop.js','peer-room.js','premium.js','premium.css','character-rig.js','combat.js','enemy-audio.js','vehicle-audio.js','mounts.js'])fs.writeFileSync(path.join(out,f),isolateStorage(fs.readFileSync(path.join(root,f),'utf8')));
let game=fs.readFileSync(path.join(root,'game.local.js'),'utf8');
if(!game.includes('var za = window.LocalCoop;'))throw new Error('Missing network hook');
game=game.replace('var za = window.LocalCoop;','window.TomPeer = Ba;\n  var za = window.LocalCoop;').replace('var ix = 5,','var ix = 6,');
fs.writeFileSync(path.join(out,'game.local.js'),isolateStorage(game));
let html=fs.readFileSync(path.join(root,'premium.html'),'utf8').replace('Lokale Edition · ','Online-Testversion · ');
html=html.replace('<script src="coop.js"></script>','<script>window.TH_ONLINE=true;</script><script src="peer-room.js"></script><script src="coop.js"></script>');
fs.writeFileSync(path.join(out,'index.html'),html);fs.writeFileSync(path.join(out,'.nojekyll'),'');
fs.writeFileSync(path.join(out,'rtc-config.json'),JSON.stringify({iceServers:[{urls:'stun:stun.l.google.com:19302'},{urls:'stun:stun.cloudflare.com:3478'}]},null,2));
fs.cpSync(path.join(root,'assets/game'),path.join(out,'assets/game'),{recursive:true});
fs.cpSync(path.join(root,'runtime/node_modules/three'),path.join(out,'runtime/node_modules/three'),{recursive:true});
let premium=fs.readFileSync(path.join(out,'premium.js'),'utf8').replace('LOKALE EDITION','ONLINE · TESTVERSION 2').replace('Raum bleibt 10 Minuten offen.','Wiederverbindung bis zu 10 Minuten.');
fs.writeFileSync(path.join(out,'premium.js'),premium);
console.log('Static browser game ready: '+out);
