import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,statSync,openSync,readSync,closeSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve,dirname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {sha256,compareMetadata,validateDTO,validatePNG,validateTransfer,validateAlias,SOURCE_PROOF} from './native-contract.mjs';

const own=dirname(fileURLToPath(import.meta.url)),cycle=resolve(own,'..'),browser=resolve(cycle,'browser'),source=resolve(cycle,'outflow-source');
const started=performance.now(),cpuStart=process.cpuUsage(),inputs=[],rows=[];
const limits={wallSeconds:10,cpuSeconds:5,peakRssBytes:512*1024*1024,fixedPoses:['front','side'],sourcePaths:143};
const baselinePins={
 'baseline-74-front.json':'a63cf6c81e79c68986797358a9a53273026d7b3aa71104f2ff345701e7be92ec',
 'baseline-74-side.json':'56001fbcd1bf32fa859c7f8bdaf39734320c7c5327c930148729f59323cc0626',
 'baseline-74-front-alias.json':'ebb7e4ec6d45716b4ff3877cd6f3a32083d00ccfeb317ee72e6087116499c59e',
 'baseline-74-side-transfer.json':'68de230d83a33a272e806cbbd6b75393e54d257eed2d6ffdec880cc2dfbd6041',
};
function runtime(){const c=process.cpuUsage(cpuStart);return {wallSeconds:(performance.now()-started)/1000,cpuSeconds:(c.user+c.system)/1e6,peakRssBytes:process.resourceUsage().maxRSS*1024,node:process.version,arch:process.arch};}
function budget(){const r=runtime();assert(r.wallSeconds<=limits.wallSeconds&&r.cpuSeconds<=limits.cpuSeconds&&r.peakRssBytes<=limits.peakRssBytes,'Analysis budget exceeded');}
function read(path,maxBytes){budget();const size=statSync(path).size;assert(size<=maxBytes,'Input too large: '+path);const bytes=readFileSync(path),digest=sha256(bytes);inputs.push({path,bytes:bytes.length,sha256:digest});return bytes;}
function json(name,pin){const path=resolve(browser,name),bytes=read(path,64*1024);if(pin)assert.equal(sha256(bytes),pin,'Frozen baseline changed: '+name);return JSON.parse(bytes);}
function hashFile(path){const size=statSync(path).size;assert(size<=64*1024*1024,'Source entry too large');const fd=openSync(path,'r'),chunk=Buffer.allocUnsafe(1024*1024),h=createHash('sha256');try{let n;while((n=readSync(fd,chunk,0,chunk.length,null))!==0){h.update(chunk.subarray(0,n));budget();}}finally{closeSync(fd);}return {bytes:size,sha256:h.digest('hex')};}
function sourceFreeze(){
 const path=resolve(cycle,'run/SOURCE-FREEZE-R1.json'),bytes=read(path,64*1024);assert.equal(sha256(bytes),'e809c77ed113331d54003d5d730a964c15b87589b794d634fe1d4e4286e08792');
 const manifest=JSON.parse(bytes);assert.equal(Object.keys(manifest).length,143);const verified=[];
 for(const [relative,expected] of Object.entries(manifest)){
  const path=resolve(source,relative);assert(path.startsWith(source+sep),'Source path escapes candidate');const actual=hashFile(path);assert.equal(actual.sha256,expected,'Source R1 changed: '+relative);verified.push({path:relative,...actual});
 }
 assert.equal(manifest[SOURCE_PROOF.file],SOURCE_PROOF.sha256);
 const engine=read(resolve(source,SOURCE_PROOF.file),256*1024).toString('utf8').split('\n');
 assert(engine[463].includes('this.weatherTime+=Math.max(0,interval/1000)'));
 assert(engine[745].includes('createFlash(seed,this.stormDistance,this.weatherTime'));
 assert(engine[757].includes('flashIntensity(f,this.weatherTime)'));
 assert(engine[772].includes('this.activeFlash=null;this.flash.value.w=0'));
 assert(engine[905].includes('this.clearStorm()'));
 return {manifestSHA256:sha256(bytes),count:verified.length,allActualHashesMatch:true,files:verified};
}
function pngInput(dto,name){const bytes=read(resolve(browser,name),16*1024*1024);return {bytes,verified:validatePNG(bytes,dto.png)};}
function validateBaseline(pose,dto){
 if(pose==='front'){
  const alias=json('baseline-74-front-alias.json',baselinePins['baseline-74-front-alias.json']),bytes=read(alias.existingExactPNG,16*1024*1024);
  return {...validatePNG(bytes,dto.png),alias:validateAlias(dto,bytes,alias,'baseline-74-front.json')};
 }
 const {bytes,verified}=pngInput(dto,'baseline-74-side.png'),transfer=json('baseline-74-side-transfer.json',baselinePins['baseline-74-side-transfer.json']);
 return {...verified,transfer:validateTransfer(dto,bytes,transfer)};
}
function validateCandidate(pose,dto){const {bytes,verified}=pngInput(dto,`candidate-74-${pose}.png`),transfer=json(`candidate-74-${pose}-transfer.json`);return {...verified,transfer:validateTransfer(dto,bytes,transfer)};}

let status='PASS_NATIVE_METADATA_BINDINGS',error=null,sourceVerification=null;
if(!process.argv.includes('--execute-frozen-analysis')){
 console.log('Prepared only. Root notification required before --execute-frozen-analysis; no B data read.');
}else{
 try{
  sourceVerification=sourceFreeze();
  for(const pose of limits.fixedPoses){
   const baselineName=`baseline-74-${pose}.json`,a=json(baselineName,baselinePins[baselineName]);validateDTO(a);
   const baselinePNG=validateBaseline(pose,a);
   const b=json(`candidate-74-${pose}.json`);validateDTO(b);const candidatePNG=validateCandidate(pose,b),comparison=compareMetadata(a,b);
   rows.push({pose,baselinePNG,candidatePNG,...comparison});budget();
  }
  if(rows.some(r=>!r.qualified))status='FAIL_NATIVE_METADATA_CONTROLS';
 }catch(caught){error=caught instanceof Error?caught.message:String(caught);status=String(caught).includes('budget')?'INCOMPLETE_BUDGET':'FAIL_NATIVE_METADATA_INPUT';}
 const report={status,error,limits,runtime:runtime(),inputs,sourceVerification,scriptSHA256:sha256(readFileSync(fileURLToPath(import.meta.url))),contractSHA256:sha256(readFileSync(resolve(own,'native-contract.mjs'))),rows,
  scope:'Offline saved native DTO, PNG/transfer binding and installed source hashes. Exact CPU-side submitted controls, with predeclared settled-clear weatherTime exemption. Not a GPU readback, density equivalence, visual judgement, model generation or FPS sample.'};
 writeFileSync(resolve(own,'result.json'),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({...report,inputs:undefined,sourceVerification:sourceVerification?{count:sourceVerification.count,allActualHashesMatch:sourceVerification.allActualHashesMatch}:null,rows:rows.map(({pose,qualified,mismatches,weatherTime,baselinePNG,candidatePNG,pngContentIdentity})=>({pose,qualified,mismatches,weatherTime,baselinePNG,candidatePNG,pngContentIdentity}))}));
 if(status!=='PASS_NATIVE_METADATA_BINDINGS')process.exitCode=1;
}
