/** Bounded actual recipe prefixes only. Requires root's source freeze first. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {hash,layoutBytes,tupleExact,uniformXZ,pretransformAnchor,contraction,recipeIdentity} from './contract.mjs';

const own=dirname(fileURLToPath(import.meta.url)),cycle=dirname(own),candidate=resolve(cycle,'outflow-source/src/cumulonimbus');
const baseline='/Users/enuzzo/Library/CloudStorage/Dropbox/Mitnick/Cloudia/src/cumulonimbus';
const seeds=[74,72,73],started=performance.now(),cpuStarted=process.cpuUsage();
const pins={
 volume:'3f67f044d9bfe653d60fa2daac3521f69680f98d6838b0441249c4b9a35b6eb7',
 helper:'b0838fed4e63ff202a6204f6f3216dc05c8ac97f43fce7cd57bfeaa4eb057a95',
 extractorHelper:'2ba00a25a651b01f29c54d9a5e3bca7fc9db43429402f7d862a933660283b724',
 baselineVolume:'c349e8f7526a2dafa0348516079f3f67ab7288a17769f28193ebcef7e124d34d',
};
const limits={cpuSeconds:2,wallSeconds:5,peakRssBytes:256*1024*1024,seeds};
const rows=[],inputs=[];
function text(path){const raw=readFileSync(path);inputs.push({path,bytes:raw.length,sha256:hash(raw)});return raw.toString('utf8');}
function pinned(path,pin){const source=text(path);assert.equal(hash(source),pin,`Frozen input changed: ${path}`);return source;}
function once(source,anchor){assert.equal(source.split(anchor).length,2,`Extraction anchor changed: ${anchor}`);}
function replace(source,anchor,value){once(source,anchor);return source.replace(anchor,value);}
function instrumentation(source,isCandidate){
 assert(!source.includes('__outflowAudit'),'Audit identifier collision');
 const declaration=`
  const __outflowAudit:any={genericParents:[],contractions:[]};
  const __outflowAuditRaw=()=>({family:shape.family,shape:{...shape},liquid:liquid.map(l=>l.slice()),iceCores:iceCores.map(l=>l.slice()),summits:summits.map(l=>l.slice()),foundations:foundations.map(l=>l.slice()),rng:__layoutRng.map(r=>({...r}))});
`;
 source=replace(source,'  const shape=cloudParameters(seed);','  const shape=cloudParameters(seed);'+declaration);
 if(isCandidate){
  const anchor='    // Anchor the complete sheared outflow to the mature feeding axis.';
  source=replace(source,anchor,'    __outflowAudit.rawBefore=__outflowAuditRaw();\n'+anchor);
 }
 source=replace(source,'  const transform=(c:Lobe,isIce:boolean) => {',
  `  __outflowAudit.rawBefore??=__outflowAuditRaw();__outflowAudit.rawAfter=__outflowAuditRaw();
  __outflowAudit.declaredDelta=${isCandidate?'[...outflowTranslation]':'[0,0]'};
  const transform=(c:Lobe,isIce:boolean) => {`);
 const lobeDeclaration='  const lobes:Lobe[]=[...liquid,...iceCores];';
 source=replace(source,lobeDeclaration,lobeDeclaration+'\n  __outflowAudit.coreIds=iceCores.map((_,i)=>liquid.length+i);');
 source=replace(source,'  [...liquid,...iceCores].forEach((c,i) => {','  [...liquid,...iceCores].forEach((c,i) => {\n    const __outflowAuditChildStart=lobes.length;');
 const genericEnd='  });\n  // Unequal overlapping outflow billows give the cap a three-dimensional shoulder.';
 source=replace(source,genericEnd,`    __outflowAudit.genericParents.push({parentId:i,isIce,ids:Array.from({length:lobes.length-__outflowAuditChildStart},(_,j)=>j+__outflowAuditChildStart)});
  });
  __outflowAudit.capStart=lobes.length;
  // Unequal overlapping outflow billows give the cap a three-dimensional shoulder.`);
 const streakComment='  // Sparse, thin ice streaks connect to the outflow and taper at varying heights.';
 source=replace(source,streakComment,'  __outflowAudit.capEnd=lobes.length;__outflowAudit.streakStart=lobes.length;\n'+streakComment);
 const contractionComment='  // Contract whole horizontal axes if a seeded puff/outflow would approach the';
 source=replace(source,contractionComment,`  __outflowAudit.streakEnd=lobes.length;__outflowAudit.preContraction=lobes.map(l=>l.slice());
  __outflowAudit.preContractionRng=__layoutRng.map(r=>({...r}));
`+contractionComment);
 const scale='    const scale=Math.min(1,limit/extent);';
 source=replace(source,scale,scale+'\n    __outflowAudit.contractions.push({axis,radius,limit,extent,scale,before:lobes.map(l=>l.slice())});');
 const axisLoop='    for(const c of lobes) {c[axis]*=scale;c[radius]*=scale;}';
 source=replace(source,axisLoop,axisLoop+'\n    __outflowAudit.contractions.at(-1).after=lobes.map(l=>l.slice());');
 const marker='  // Rasterize lobes into their local bounds instead of testing every lobe at every voxel.';
 source=replace(source,marker,`
  const __outflowAuditM=summits.reduce((a,b)=>a[1]>b[1]?a:b),__outflowAuditF=foundations[summits.indexOf(__outflowAuditM)];
  const __outflowAuditC=capParents.get(__outflowAuditM)??iceCores.reduce((a,b)=>Math.hypot(a[0]-__outflowAuditM[0],a[2]-__outflowAuditM[2])<Math.hypot(b[0]-__outflowAuditM[0],b[2]-__outflowAuditM[2])?a:b);
  __outflowAudit.endpoints={applies:shape.family==='sheared',F:__outflowAuditF.slice(),M:__outflowAuditM.slice(),C:__outflowAuditC.slice(),capIndex:iceCores.indexOf(__outflowAuditC),
    start:[0,1,2].map(axis=>__outflowAuditF[axis]+(__outflowAuditM[axis]-__outflowAuditF[axis])*.68),
    end:[__outflowAuditC[0]+__outflowAuditC[3]*.28,__outflowAuditC[1]-__outflowAuditC[4]*.1,__outflowAuditC[2]]};
`+marker);
 return source;
}

function runtime(){
 const delta=process.cpuUsage(cpuStarted),usage=process.resourceUsage();
 // Node resourceUsage.maxRSS is KiB on supported Unix platforms.
 return {cpuSeconds:(delta.user+delta.system)/1e6,wallSeconds:(performance.now()-started)/1000,peakRssBytes:usage.maxRSS*1024,node:process.version,arch:process.arch};
}
function budget(){const r=runtime();assert(r.cpuSeconds<=limits.cpuSeconds&&r.wallSeconds<=limits.wallSeconds&&r.peakRssBytes<=limits.peakRssBytes,'Prefix budget exceeded');return r;}
function serialTrace(trace){return {lobes:trace.lobes.length,uniqueLobes:trace.uniqueLobes,layoutSHA256:hash(layoutBytes(trace.lobes)),rngStreams:trace.afterRng};}

function run(){
 assert(process.argv.includes('--execute-frozen-prefixes'),'Root freeze required: invoke only with --execute-frozen-prefixes after authorization');
 pinned(resolve(cycle,'run/SOURCE-FREEZE-R1.json'),'e809c77ed113331d54003d5d730a964c15b87589b794d634fe1d4e4286e08792');
 const baselineManifest=JSON.parse(text(resolve(cycle,'baseline-manifest.json')));assert.equal(Object.keys(baselineManifest).length,141);
 assert.equal(baselineManifest['src/cumulonimbus/volume.ts'],pins.baselineVolume);
 const baselineSource=pinned(resolve(baseline,'volume.ts'),pins.baselineVolume),candidateSource=pinned(resolve(candidate,'volume.ts'),pins.volume);
 pinned(resolve(candidate,'outflowAnchor.ts'),pins.helper);
 let adapterSource=pinned(resolve(candidate,'layoutPrefix.test-helper.ts'),pins.extractorHelper);
 adapterSource=replace(adapterSource,'return {family:shape.family,before:','return {outflowAudit:__outflowAudit,family:shape.family,before:');
 const require=createRequire(resolve(candidate,'../../package.json')),ts=require('typescript');
 const moduleCache=new Map();
 const names=new Set(['./light','./sun','./motion','./inclinedShoulder','./outflowAnchor']);
 const compile=(source,label)=>{
  const emitted=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true},reportDiagnostics:true});
  assert(!emitted.diagnostics?.some(d=>d.category===ts.DiagnosticCategory.Error),`TypeScript syntax error: ${label}`);
  const module={exports:{}};
  const local=spec=>{
   if(spec==='node:assert/strict')return require(spec);if(spec==='typescript')return ts;
   assert(names.has(spec),`Unexpected prefix import: ${spec}`);
   if(!moduleCache.has(spec)){
    const file=resolve(candidate,spec+'.ts'),source=text(file);
    if(spec!=='./outflowAnchor')assert.equal(hash(source),baselineManifest['src/cumulonimbus/'+spec.slice(2)+'.ts'],`Baseline dependency changed: ${spec}`);
    moduleCache.set(spec,compile(source,file));
   }
   return moduleCache.get(spec);
  };
  new Function('require','module','exports',emitted.outputText)(local,module,module.exports);return module.exports;
 };
 const helper=compile(adapterSource,'instrumented existing layoutPrefix.test-helper.ts');
 const before=helper.createLayoutPrefix(instrumentation(baselineSource,false)),after=helper.createLayoutPrefix(instrumentation(candidateSource,true));
 budget();
 for(const seed of seeds){
  budget();const a=before(seed),b=after(seed),ta=a.outflowAudit,tb=b.outflowAudit;
  assert.equal(a.family,b.family);assert.equal(a.lobes.length,b.lobes.length);assert.equal(a.uniqueLobes,a.lobes.length);assert.equal(b.uniqueLobes,b.lobes.length);
  assert.deepEqual(a.afterRng,b.afterRng,'Actual recipe RNG stream/call count changed');
  assert.deepEqual(ta.rawBefore.rng,tb.rawBefore.rng);assert.deepEqual(tb.rawBefore.rng,tb.rawAfter.rng,'Anchoring consumed RNG');
  const jointA=helper.assertJointLayoutContract(a),jointB=helper.assertJointLayoutContract(b);
  const result={seed,family:a.family,baseline:serialTrace(a),candidate:serialTrace(b),jointA,jointB,
   contractionsA:ta.contractions.map(contraction),contractionsB:tb.contractions.map(contraction),endpointsA:ta.endpoints,endpointsB:tb.endpoints};
  if(a.family!=='sheared')result.unchangedFamily=recipeIdentity(a,b);
  else{
   tupleExact(ta.rawBefore.liquid,tb.rawBefore.liquid,'Raw baseline liquid mismatch');tupleExact(ta.rawBefore.iceCores,tb.rawBefore.iceCores,'Raw baseline ice cores mismatch');
   const anchor=pretransformAnchor(tb.rawBefore,tb.rawAfter,tb.declaredDelta),worldDelta=anchor.observedDelta.map(value=>value*tb.rawAfter.shape.towerWidth);
   assert.deepEqual(ta.preContractionRng,tb.preContractionRng);assert.deepEqual(ta.coreIds,tb.coreIds);assert.deepEqual(ta.genericParents,tb.genericParents);
   const range=(lo,hi)=>Array.from({length:hi-lo},(_,i)=>i+lo);
   const iceIds=[...tb.coreIds,...tb.genericParents.filter(g=>g.isIce).flatMap(g=>g.ids),...range(tb.capStart,tb.capEnd),...range(tb.streakStart,tb.streakEnd)];
   assert.equal(iceIds.length,98);uniformXZ(ta.preContraction,tb.preContraction,iceIds,worldDelta,'Entire sheared outflow before contraction');
   result.anchor=anchor;result.worldDeltaBeforeContraction=worldDelta;result.outflowGroups={coreCount:tb.coreIds.length,genericIceBillows:tb.genericParents.filter(g=>g.isIce).reduce((sum,g)=>sum+g.ids.length,0),capBillows:tb.capEnd-tb.capStart,streaks:tb.streakEnd-tb.streakStart,total:iceIds.length};
   result.collarScope='No A/B collar identity is required: anchoring intentionally changes the feeding collar. The legacy joint contract is checked independently inside each actual owner.';
  }
  rows.push(result);budget();
 }
}
let status='PASS_FIXED_PREFIX_CONTRACTS',error=null;
try{run();}catch(caught){status=String(caught).includes('budget')?'INCOMPLETE_BUDGET':'FAIL_PREFIX_CONTRACT';error=caught instanceof Error?caught.message:String(caught);}
const report={status,error,seeds,checked:rows.length,limits,runtime:runtime(),inputs,scriptSHA256:hash(readFileSync(fileURLToPath(import.meta.url))),contractSHA256:hash(readFileSync(resolve(own,'contract.mjs'))),rows,
 scope:'Actual baseline/candidate recipe prefixes only; strict existing extractor with observational checkpoints, dense allocations and cellular call removed, return before raster. Baseline dependency bytes pinned to141-source manifest; no broad seed scan, density/bake, model, ray, browser, GPU, anatomy acceptance or FPS proof.'};
if(process.argv.includes('--execute-frozen-prefixes'))writeFileSync(resolve(own,'result.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({...report,rows:undefined}));if(status!=='PASS_FIXED_PREFIX_CONTRACTS')process.exitCode=1;
