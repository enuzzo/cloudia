/** Scanline R2 preflight: prepared only until root's new freeze/authorization. R1 is untouched. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,openSync,readSync,closeSync,statSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {dirname,resolve,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {SEEDS,LIMITS,hash,layoutBytes,exactTuples,identicalRecipes,retiredLineage,preparedAccounting} from './contract.mjs';

const own=dirname(fileURLToPath(import.meta.url)),started=performance.now(),cpuStart=process.cpuUsage();
const inputs=[],identityRows=[],prepareRows=[],hashChunk=Buffer.allocUnsafe(1024*1024);let phase='authorization',activeSeed=null;
function runtime(){const c=process.cpuUsage(cpuStart);return {cpuSeconds:(c.user+c.system)/1e6,wallSeconds:(performance.now()-started)/1000,peakRssBytes:process.resourceUsage().maxRSS*1024,node:process.version,arch:process.arch};}
function budget(){const r=runtime();if(r.cpuSeconds>LIMITS.cpuSeconds||r.wallSeconds>LIMITS.wallSeconds||r.peakRssBytes>LIMITS.peakRssBytes)throw Object.assign(new Error('PREFLIGHT_PROCESS_BUDGET_EXCEEDED'),{code:'PREFLIGHT_PROCESS_BUDGET'});}
function arg(name){const at=process.argv.indexOf(name);assert(at>=0&&process.argv[at+1]&&!process.argv[at+1].startsWith('--'),'Missing argument '+name);return process.argv[at+1];}
function read(path,max=256*1024){budget();assert(statSync(path).size<=max,'Oversized source/JSON input '+path);const bytes=readFileSync(path);inputs.push({path,bytes:bytes.length,sha256:hash(bytes)});return bytes;}
function once(source,anchor){assert.equal(source.split(anchor).length,2,'Extraction anchor changed: '+anchor);}
function replace(source,anchor,value){once(source,anchor);return source.replace(anchor,value);}
function fileHash(path){budget();const size=statSync(path).size;assert(size<=64*1024*1024,'Oversized frozen source');const fd=openSync(path,'r'),h=createHash('sha256');try{let n;while((n=readSync(fd,hashChunk,0,hashChunk.length,null))!==0){h.update(hashChunk.subarray(0,n));budget();}}finally{closeSync(fd);}return {bytes:size,sha256:h.digest('hex')};}
function verifyManifest(record,root,expectedCount){
 const bytes=read(record.path);assert.equal(hash(bytes),record.sha256,'Source-manifest freeze changed');const map=JSON.parse(bytes);assert.equal(Object.keys(map).length,record.count);
 if(expectedCount!==null)assert.equal(record.count,expectedCount);assert(record.count>0&&record.count<=256);
 for(const [relative,sha] of Object.entries(map)){
  assert(relative&&!relative.includes('\\')&&!relative.split('/').includes('..')&&!relative.startsWith('/'));
  assert.match(sha,/^[a-f0-9]{64}$/);const path=resolve(root,relative);assert(path.startsWith(root+sep));
  const actual=fileHash(path);assert.equal(actual.sha256,sha,'Frozen source changed: '+path);
 }
 return map;
}

const MARKER='  // Rasterize lobes into their local bounds instead of testing every lobe at every voxel.';
function legacyShoulderFragment(baselineSource){
 const first="    const mature=summits.reduce((a,b)=>a[1]>b[1]?a:b),foot=foundations[summits.indexOf(mature)];\n    const cap=iceCores.reduce(";
 const last='    const start=shoulder.min.map((v,i)=>Math.max(1,Math.floor((v-.35-BOUNDS_MIN[i])/BOUNDS_SIZE[i]*size-.5)));';
 once(baselineSource,first);once(baselineSource,last);const from=baselineSource.indexOf(first),to=baselineSource.indexOf(last);assert(to>from&&from>baselineSource.indexOf(MARKER));
 const fragment=baselineSource.slice(from,to);assert.equal(fragment.split('prepareInclinedShoulder(').length,2);
 for(const forbidden of ['for(','for (','sample(','field[','new Float32Array','new Uint8Array'])assert(!fragment.includes(forbidden),'Legacy scalar slice includes work: '+forbidden);
 return fragment;
}
function instrument(source,legacyFragment,isBaseline){
 assert(!source.includes('__loftAudit'),'Observer identifier collision');
 source=replace(source,'  const shape=cloudParameters(seed);',`  const shape=cloudParameters(seed);
  const __loftAudit:any={necks:new Map(),collars:[],parents:[],contractions:[]};`);
 source=replace(source,'    summits.push(top);','    summits.push(top);\n    __loftAudit.necks.set(top,liquid.at(-2));');
 const collar='    for(const t of broadShoulder?[.1,.42,.78]:[.3,.72]) {';
 source=replace(source,collar,collar+'\n      const __loftAuditCollarStart=liquid.length;');
 const collarEnd='    }\n  }\n  const lobes:Lobe[]=[...liquid,...iceCores];';
 source=replace(source,collarEnd,`      __loftAudit.collars.push({core:liquid.at(-1),top,cap,broadShoulder,t,appendCount:liquid.length-__loftAuditCollarStart});
`+collarEnd);
 const generic='  [...liquid,...iceCores].forEach((c,i) => {';
 source=replace(source,generic,generic+'\n    const __loftAuditChildStart=lobes.length;');
 const genericEnd='  });\n  // Unequal overlapping outflow billows give the cap a three-dimensional shoulder.';
 source=replace(source,genericEnd,`    __loftAudit.parents.push({core:c,isIce,ids:Array.from({length:lobes.length-__loftAuditChildStart},(_,j)=>j+__loftAuditChildStart)});
`+genericEnd);
 const scale='    const scale=Math.min(1,limit/extent);';
 source=replace(source,scale,scale+'\n    __loftAudit.contractions.push({axis,radius,limit,extent,scale,before:lobes.map(l=>l.slice())});');
 const loop='    for(const c of lobes) {c[axis]*=scale;c[radius]*=scale;}';
 source=replace(source,loop,loop+'\n    __loftAudit.contractions.at(-1).after=lobes.map(l=>l.slice());');
 const legacy=isBaseline?`(()=>{if(shape.family!=='sheared')return null;\n${legacyFragment}\nreturn {min:[...shoulder.min],max:[...shoulder.max]};})()`:'null';
 const exportAudit=`
  const __loftAuditExport=()=>({
    necks:[...__loftAudit.necks].map(([top,neck])=>({top:lobes.indexOf(top),neck:lobes.indexOf(neck)})),
    collars:__loftAudit.collars.map(c=>({...c,core:lobes.indexOf(c.core),top:lobes.indexOf(c.top),cap:lobes.indexOf(c.cap)})),
    parents:__loftAudit.parents.map(p=>({...p,core:lobes.indexOf(p.core)})),
    contractions:__loftAudit.contractions,
    oldShoulder:${legacy},
  });
`;
 return replace(source,MARKER,exportAudit+MARKER);
}

function run(){
 assert(process.argv.includes('--execute-authorized-prefixes'),'No execution authorization flag');
 const freezePath=resolve(arg('--root-freeze')),freezeSHA=arg('--root-freeze-sha256');assert.match(freezeSHA,/^[a-f0-9]{64}$/);
 const freezeBytes=read(freezePath);assert.equal(hash(freezeBytes),freezeSHA,'Root input-pins freeze mismatch');const freeze=JSON.parse(freezeBytes);
 assert.equal(freeze.schema,'cloudia-continuous-outflow-preflight-freeze-v1');
 assert.equal(hash(readFileSync(fileURLToPath(import.meta.url))),freeze.runnerSHA256);assert.equal(hash(readFileSync(resolve(own,'contract.mjs'))),freeze.contractSHA256);assert.equal(hash(readFileSync(resolve(own,'contract.fixture.test.mjs'))),freeze.fixtureSHA256);
 const baselineRoot=resolve(freeze.baselineRoot),candidateRoot=resolve(freeze.candidateRoot);
 phase='source-freeze';const baselineManifest=verifyManifest(freeze.baselineManifest,baselineRoot,141),candidateManifest=verifyManifest(freeze.candidateManifest,candidateRoot,null);
 const volumeRelative='src/cumulonimbus/volume.ts',adapterRelative='src/cumulonimbus/layoutPrefix.test-helper.ts';
 const baselineSource=read(resolve(baselineRoot,volumeRelative)).toString('utf8'),candidateSource=read(resolve(candidateRoot,volumeRelative)).toString('utf8');
 assert.equal(hash(baselineSource),baselineManifest[volumeRelative]);assert.equal(hash(candidateSource),candidateManifest[volumeRelative]);
 const legacy=legacyShoulderFragment(baselineSource);let adapter=read(resolve(candidateRoot,adapterRelative)).toString('utf8');assert.equal(hash(adapter),candidateManifest[adapterRelative]);
 adapter=replace(adapter,'return {family:shape.family,before:','return {audit:__loftAuditExport(),family:shape.family,before:');
 adapter=replace(adapter,' return trace;\n}'," Object.defineProperties(trace,{prepareVolumeContinuousOutflow:{value:module.exports.prepareVolumeContinuousOutflow},nativeGrid:{value:{min:module.exports.BOUNDS_MIN,size:module.exports.BOUNDS_SIZE,resolution:module.exports.VOLUME_RESOLUTION}}});\n return trace;\n}");
 const require=createRequire(resolve(candidateRoot,'package.json')),ts=require('typescript'),moduleCache=new Map();
 const allowed=new Set(['./light','./sun','./motion','./inclinedShoulder','./continuousOutflow']);
 function compile(source,label){
  const emitted=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true},reportDiagnostics:true});
  assert(!emitted.diagnostics?.some(d=>d.category===ts.DiagnosticCategory.Error),'TypeScript syntax changed: '+label);
  const module={exports:{}};
  const local=specifier=>{
   if(specifier==='typescript')return ts;if(specifier==='node:assert/strict')return require(specifier);
   assert(allowed.has(specifier),'Unexpected prefix import: '+specifier);
   if(!moduleCache.has(specifier)){
    const relative='src/cumulonimbus/'+specifier.slice(2)+'.ts',bytes=read(resolve(candidateRoot,relative));assert.equal(hash(bytes),candidateManifest[relative]);
    if(specifier!=='./continuousOutflow')assert.equal(hash(bytes),baselineManifest[relative],'Baseline dependency changed: '+specifier);
    moduleCache.set(specifier,compile(bytes.toString('utf8'),relative));
   }
   return moduleCache.get(specifier);
  };
  new Function('require','module','exports',emitted.outputText)(local,module,module.exports);return module.exports;
 }
 phase='extract';const helper=compile(adapter,adapterRelative),before=helper.createLayoutPrefix(instrument(baselineSource,legacy,true)),after=helper.createLayoutPrefix(instrument(candidateSource,legacy,false));
 assert.equal(typeof after.prepareVolumeContinuousOutflow,'function','Actual owner preparation not exposed by bounded prefix module');
 const enumerateRows=moduleCache.get('./continuousOutflow')?.forEachContinuousOutflowRow;assert.equal(typeof enumerateRows,'function','Actual stateless row enumerator missing');
 const pending=[];phase='five-prefix-identities';
 for(const seed of SEEDS){
  activeSeed=seed;budget();const a=before(seed),b=after(seed),identity=identicalRecipes(a,b),lineage=retiredLineage(a,b);
  const jointA=helper.assertJointLayoutContract(a),jointB=helper.assertJointLayoutContract(b);assert.deepEqual(jointA,jointB,'A/B owner-local joint invariant changed');
  identityRows.push({seed,family:a.family,identity,lineage,jointA,jointB});
  if(lineage.active)pending.push({seed,keyframes:lineage.keyframes});budget();
 }
 assert.equal(identityRows.length,5);assert.deepEqual(pending.map(p=>p.seed),[74,77,80]);
 phase='three-prepare-only';
 for(const {seed,keyframes} of pending){
  activeSeed=seed;budget();const beforeBytes=layoutBytes(keyframes),frames=Object.freeze(keyframes.map(k=>Object.freeze(k.slice())));
  const tick=performance.now(),cpu=process.cpuUsage();const prepared=after.prepareVolumeContinuousOutflow(frames,256);
  const prepareWallSeconds=(performance.now()-tick)/1000,prepareCpu=process.cpuUsage(cpu);
  const replayTick=performance.now(),replayCpuStart=process.cpuUsage(),accounting=preparedAccounting(prepared,keyframes,enumerateRows,after.nativeGrid),replayCpu=process.cpuUsage(replayCpuStart);
  const accountingReplayWallSeconds=(performance.now()-replayTick)/1000,accountingReplayCpuSeconds=(replayCpu.user+replayCpu.system)/1e6;
  assert(beforeBytes.equals(layoutBytes(keyframes)),'Preparation mutated input keyframes');exactTuples(frames,keyframes,'Preparation altered frozen endpoint tuples');
  const kernelTableSHA256=hash(Buffer.concat([layoutBytes(prepared.kernels.map(k=>k.lobe)),layoutBytes(prepared.kernels.map(k=>[...k.start,...k.end]))]));
  prepareRows.push({seed,keyframes,accounting,kernelTableSHA256,prepareWallSeconds,prepareCpuSeconds:(prepareCpu.user+prepareCpu.system)/1e6,accountingReplayWallSeconds,accountingReplayCpuSeconds});budget();
 }
 assert.equal(prepareRows.length,3);phase='complete';activeSeed=null;budget();
}

if(!process.argv.includes('--execute-authorized-prefixes')){
 console.log('Prepared only. No fixtures, recipe prefix, helper prepare/recount, dense raster or model executed. Root new freeze and explicit authorization are required.');
}else{
 let status='PASS_FIXED_PREFIX_IDENTITIES_AND_PREPARE_ACCOUNTING',error=null;
 try{run();}catch(caught){error={name:caught?.name??'Error',message:caught instanceof Error?caught.message:String(caught),phase,seed:activeSeed};status=caught?.code==='PREFLIGHT_PROCESS_BUDGET'?'INCOMPLETE_PROCESS_BUDGET':phase==='three-prepare-only'?'FAIL_PREPARE_GATE':'FAIL_PREFIX_OR_FREEZE';}
 const report={status,error,seeds:SEEDS,limits:LIMITS,runtime:runtime(),phase,activeSeed,inputs,identityRows,prepareRows,
  runnerSHA256:hash(readFileSync(fileURLToPath(import.meta.url))),contractSHA256:hash(readFileSync(resolve(own,'contract.mjs'))),
  scope:'Five actual A/B bounded prefixes; three owner prepares plus shared-enumerator accounting replay. Prepare and replay execute guard kernel evaluations at row peaks/boundaries; callback only counts spans. No dense field/raster, bake, model, GPU, browser, benchmark or visual acceptance. Accounting is not an independent culling solver; floating-point reserve remains nonformal.'};
 writeFileSync(resolve(own,'result.json'),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({...report,inputs:undefined,identityRows:identityRows.map(r=>({seed:r.seed,family:r.family,primitiveCount:r.identity.primitiveCount,tupleSHA256:r.identity.tupleSHA256,retiredCount:r.lineage.retiredCount})),prepareRows:prepareRows.map(r=>({seed:r.seed,kernelTableSHA256:r.kernelTableSHA256,kernelCount:r.accounting.kernelCount,totalRasterVoxelVisits:r.accounting.totalRasterVoxelVisits,envelopeBytes:r.accounting.envelopeBytes,prepareWallSeconds:r.prepareWallSeconds,prepareCpuSeconds:r.prepareCpuSeconds}))}));
 if(status!=='PASS_FIXED_PREFIX_IDENTITIES_AND_PREPARE_ACCOUNTING')process.exitCode=1;
}
