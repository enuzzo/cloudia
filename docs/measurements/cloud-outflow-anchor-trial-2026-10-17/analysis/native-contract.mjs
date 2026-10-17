import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';

export const sha256=value=>createHash('sha256').update(value).digest('hex');
export const SOURCE_PROOF=Object.freeze({
 file:'src/cumulonimbus/GPUSceneEngine.ts',sha256:'d2279f60b29a373c66976af628f6783025ff96e4e883a6da01e4da237c9657c8',
 advanceLine:464,stormUseLines:[746,773],comparisonClearLine:906,
 scope:'weatherTime advances while paused; only lightning/scheduling uses affect rendering. Under settled clear/no-flash controls it is an owner wall/storm clock, not a submitted shader uniform.',
});
const excluded=new Set([
 'rendererVersion','anatomyVariant','frame.ownerDrawSerial','frame.rafTimestamp','frame.localSnapshotTime','frame.localTimeOrigin','frame.date',
 'terrainRaster.cache.requests','terrainRaster.cache.hits','terrainRaster.cache.submissions','terrainRaster.cache.epoch',
 'skyTextures.requestSerial','skyTextures.from.uuid','skyTextures.from.version','skyTextures.to.uuid','skyTextures.to.version',
 'material.supportMin','material.supportMax','weather.precipitationBounds','clocks.weatherTime',
]);
function leaves(value,path='',out=new Map()){
 if(value!==null&&typeof value==='object'&&!Array.isArray(value)){
  if(!Object.keys(value).length)out.set(path,value);
  for(const [key,child] of Object.entries(value))leaves(child,path?path+'.'+key:key,out);
 }else out.set(path,value);
 return out;
}
export function finiteNumbers(value,path=''){
 if(typeof value==='number')assert(Number.isFinite(value),'Nonfinite metadata number '+path);
 else if(value!==null&&typeof value==='object')for(const [k,v] of Object.entries(value))finiteNumbers(v,path+'.'+k);
}
function differences(a,b,ignore=new Set()){
 const aa=leaves(a),bb=leaves(b),out=[];
 for(const path of [...new Set([...aa.keys(),...bb.keys()])].sort()){
  if(ignore.has(path))continue;
  if(!aa.has(path)||!bb.has(path)||!isDeepStrictEqual(aa.get(path),bb.get(path)))out.push({path,a:aa.has(path)?aa.get(path):null,b:bb.has(path)?bb.get(path):null,missingA:!aa.has(path),missingB:!bb.has(path)});
 }
 return out;
}
function clearPausedNoFlash(m){
 const w=m.weather,l=m.lighting;
 return m.paused===true&&m.orbit===false&&w?.skyIntent==='clear'&&w.rain===0&&w.targetRain===0&&w.haze===1&&w.overcast===0&&w.skyPending===false&&w.atmosphereProgress===1&&w.atmosphereBlend===1&&w.dispersion===0&&l?.flashCount===0&&Array.isArray(l.flash)&&l.flash.length===4&&l.flash[3]===0&&Number.isFinite(m.clocks?.weatherTime);
}
export function validateDTO(d){
 assert.equal(d.schema,'cloudia-native-frame-v1');assert.equal(d.state,'ready');assert.equal(d.metadata.ready,true);assert.equal(d.metadata.regenerating,false);
 assert.equal(d.metadata.seed,74);assert.equal(d.metadata.family,'sheared');assert.equal(d.metadata.quality,'ultra');assert.equal(d.metadata.nominalSteps,384);
 assert.deepEqual(d.metadata.volume,[256,256,256]);assert.deepEqual(d.metadata.detailVolume,[128,128,128]);assert.deepEqual(d.metadata.motionField,[16,16,16]);
 assert.equal(d.metadata.densitySampling.format,'rgba8unorm');assert.equal(d.metadata.densitySampling.path,'macro-rgba8-r');assert.deepEqual(d.metadata.densitySampling.dimensions,[256,256,256]);
 assert.equal(d.png.mime,'image/png');assert.deepEqual([d.png.width,d.png.height],[2474,1844]);
 for(const key of ['output','internal','canvas'])assert.deepEqual(d.metadata[key],[d.png.width,d.png.height]);
 assert.match(d.png.sha256,/^[a-f0-9]{64}$/);assert(Number.isInteger(d.png.byteLength)&&d.png.byteLength>0);finiteNumbers(d.metadata);
 return true;
}
export function compareMetadata(a,b){
 validateDTO(a);validateDTO(b);
 assert.equal(a.metadata.rendererVersion,'observatory-v61-observed-terrain-material');assert.equal(a.metadata.anatomyVariant,undefined);
 assert.equal(b.metadata.rendererVersion,'experiment-v61-source-anchored-outflow-r1');assert.equal(b.metadata.anatomyVariant,'source-axis-outflow-horizontal-translation');
 const ma=a.metadata,mb=b.metadata;
 const physicalControlDiffs=differences({lighting:ma.lighting,material:ma.material,weather:ma.weather},{lighting:mb.lighting,material:mb.material,weather:mb.weather},excluded);
 const exemptionValid=clearPausedNoFlash(ma)&&clearPausedNoFlash(mb)&&physicalControlDiffs.length===0;
 const mismatch=differences(ma,mb,excluded);
 if(!exemptionValid)mismatch.push({path:'clocks.weatherTime.exemption',a:clearPausedNoFlash(ma),b:clearPausedNoFlash(mb),reason:'Settled clear/no-flash physical-control gate failed; no weatherTime exemption permitted.'});
 const recordedExclusions=[];
 const la=leaves(ma),lb=leaves(mb);
 for(const path of excluded)if(la.has(path)||lb.has(path))recordedExclusions.push({path,a:la.has(path)?la.get(path):null,b:lb.has(path)?lb.get(path):null,equal:isDeepStrictEqual(la.get(path),lb.get(path))});
 return {qualified:mismatch.length===0,mismatches:mismatch,recordedExclusions,weatherTime:{a:ma.clocks.weatherTime,b:mb.clocks.weatherTime,equal:Object.is(ma.clocks.weatherTime,mb.clocks.weatherTime),exemptionValid,sourceProof:SOURCE_PROOF},pngContentIdentity:a.png.sha256===b.png.sha256,scope:'Exact submitted CPU metadata controls; PNG content identity is not a quality score, GPU uniform/readback, density proof or performance evidence.'};
}
export function validatePNG(buffer,png){
 assert.equal(buffer.length,png.byteLength,'PNG byte count');assert.equal(sha256(buffer),png.sha256,'PNG SHA256');
 assert(buffer.length>=33);assert(buffer.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])),'PNG signature');
 assert.equal(buffer.readUInt32BE(8),13);assert.equal(buffer.toString('ascii',12,16),'IHDR');
 assert.equal(buffer.readUInt32BE(16),png.width);assert.equal(buffer.readUInt32BE(20),png.height);
 return {sha256:png.sha256,bytes:buffer.length,width:png.width,height:png.height};
}
export function validateTransfer(dto,buffer,transfer){
 validatePNG(buffer,dto.png);assert.deepEqual(transfer.png,dto.png);
 assert.equal(dto.textExport.partCharacters,65536);
 const data='data:image/png;base64,'+buffer.toString('base64'),n=Math.ceil(data.length/65536);
 assert.equal(dto.textExport.totalCharacters,data.length);assert.equal(dto.textExport.parts,n);assert.equal(transfer.parts.length,n);
 transfer.parts.forEach((p,i)=>{const part=data.slice(i*65536,(i+1)*65536);assert.equal(p.part,i+1,'Part order');assert.equal(p.characters,part.length,'Part length');assert.equal(p.sha256,sha256(part),'Part SHA256');});
 return {parts:n,characters:data.length,allPartHashesVerified:true};
}
export function validateAlias(dto,buffer,alias,metadataName){
 assert.equal(alias.kind,'native-png-exact-content-alias-v1');assert.equal(alias.actualExportMetadata,metadataName);
 assert.equal(alias.actualExportSHA256,dto.png.sha256);assert.equal(alias.bytes,dto.png.byteLength);assert.equal(alias.width,dto.png.width);assert.equal(alias.height,dto.png.height);
 assert.equal(typeof alias.existingExactPNG,'string');assert(alias.existingExactPNG.startsWith('/'));
 validatePNG(buffer,dto.png);return {exactContentAlias:true,existingExactPNG:alias.existingExactPNG,actualExportMetadata:metadataName,scope:'Actual export digest plus independent existing bitmap hash; no duplicate transfer claimed.'};
}
