const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto'),{spawnSync}=require('node:child_process');
const sharp=require('./runtime/node_modules/sharp');
const {assets}=require('./assets-manifest.json');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
async function matches(file,a){try{const b=await fs.readFile(file);return b.length===a.bytes&&hash(b)===a.sha256?b:null;}catch{return null;}}
async function main(){
 await fs.mkdir(path.join(__dirname,'assets/game'),{recursive:true});
 const cache=process.env.ASSET_SOURCE_DIR;
 for(const a of assets){
  if(!/^[\w.-]+$/.test(a.file)||!/^https:\/\//.test(a.url))throw new Error('Invalid manifest entry');
  const target=path.join(__dirname,'assets',a.kind==='audio'?'game':'',a.file);
  let b=await matches(target,a);
  if(!b&&cache)b=await matches(path.join(cache,a.kind==='audio'?'game':'',a.file),a);
  for(let attempt=1;!b&&attempt<=3;attempt++){
   try{const r=await fetch(a.url,{signal:AbortSignal.timeout(120000)});if(!r.ok)throw new Error('HTTP '+r.status);const data=Buffer.from(await r.arrayBuffer());if(data.length!==a.bytes||hash(data)!==a.sha256)throw new Error('Checksum mismatch: '+a.file);b=data;}
   catch(e){if(attempt===3)throw e;await new Promise(r=>setTimeout(r,attempt*1000));}
  }
  await fs.writeFile(target,b);
  if(a.kind==='texture')await sharp(b).resize(1024,1024).jpeg({quality:90}).toFile(path.join(__dirname,'assets/game',a.file.replace(/\.png$/,'.jpg')));
  console.log('Verified '+a.file);
 }
 const result=spawnSync(process.execPath,['optimise-assets.cjs',...assets.filter(a=>a.kind==='model').map(a=>a.file)],{cwd:__dirname,stdio:'inherit'});
 if(result.error||result.status!==0)throw result.error||new Error('Model optimisation failed');
 console.log('Ready: 14 models, 24 audio clips, 4 textures.');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
