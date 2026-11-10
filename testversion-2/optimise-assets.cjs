// Keep the generated originals; build lighter runtime GLBs with embedded JPEG textures.
const fs=require('node:fs'),path=require('node:path'),sharp=require('./runtime/node_modules/sharp');
async function optimise(file){
 const b=fs.readFileSync(file),jl=b.readUInt32LE(12),j=JSON.parse(b.subarray(20,20+jl)),bin=b.subarray(28+jl),chunks=[];
 let offset=0;const detailed=/^(tom-|mirja|vampire|orc|ghoul|revenant|dawn-)/.test(path.basename(file)),colourImages=new Set((j.materials||[]).map(m=>j.textures?.[m.pbrMetallicRoughness?.baseColorTexture?.index]?.source).filter(i=>i!==undefined));
 for(let i=0;i<j.bufferViews.length;i++){
  const v=j.bufferViews[i],img=j.images?.find(x=>x.bufferView===i);let data=bin.subarray(v.byteOffset||0,(v.byteOffset||0)+v.byteLength);
  if(img){const size=detailed&&colourImages.has(j.images.indexOf(img))?2048:1024;data=await sharp(data).resize({width:size,height:size,fit:'inside',withoutEnlargement:true}).jpeg({quality:size===2048?92:86,chromaSubsampling:'4:4:4'}).toBuffer();img.mimeType='image/jpeg';}
  v.byteOffset=offset;v.byteLength=data.length;chunks.push(data);offset+=data.length;const pad=(4-offset%4)%4;if(pad){chunks.push(Buffer.alloc(pad));offset+=pad;}
 }
 j.buffers=[{byteLength:offset}];let json=Buffer.from(JSON.stringify(j));json=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,32)]);
 const out=Buffer.alloc(28+json.length+offset);out.write('glTF');out.writeUInt32LE(2,4);out.writeUInt32LE(out.length,8);out.writeUInt32LE(json.length,12);out.write('JSON',16);json.copy(out,20);out.writeUInt32LE(offset,20+json.length);out.writeUInt32LE(0x004e4942,24+json.length);Buffer.concat(chunks).copy(out,28+json.length);
 const target=path.join(__dirname,'assets','game',path.basename(file));fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,out);console.log(path.basename(file)+': '+(b.length/1e6).toFixed(1)+' -> '+(out.length/1e6).toFixed(2)+' MB');
}
(async()=>{const selected=process.argv.slice(2);for(const f of fs.readdirSync(__dirname+'/assets').filter(f=>f.endsWith('.glb')&&(!selected.length||selected.includes(f))))await optimise(path.join(__dirname,'assets',f));})().catch(e=>{console.error(e);process.exitCode=1;});
