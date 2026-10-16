import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {Lookup} from './baseline/data.ts';
import {trace as originalTrace} from './baseline/trace.ts';
import {CompactLookup,repack,verifyRepack,PageBuilder,keyForRect,MAX_BYTES} from './compact.ts';
import {trace} from './trace-compact.ts';
import {loadFrozen,sha} from './fixture.ts';
import {validatePages} from './validate-pages.ts';
import {PROTOCOL,bundles,cleanPose,requestsFromNormalCap,neighborRequests} from './protocol.ts';
const phase=Bun.argv.find(x=>x.startsWith('--phase='))?.split('=')[1];
if(!Bun.argv.includes('--allow-cpu-replay')||!['packing','pages','full'].includes(phase??''))throw Error('CPU replay/build is gated: root must authorize --allow-cpu-replay and --phase=packing|pages|full');
const out=new URL('./results/',import.meta.url);await mkdir(out,{recursive:true});
const emit=async(name:string,data:any)=>writeFile(new URL(name,out),JSON.stringify(data,null,2)+'\n');
const {pack,fixture,provenance}=await loadFrozen();
const frozenSourceHashes:any={};for(const f of['compact.ts','trace-compact.ts','protocol.ts','run.ts','fixture.ts','validate-pages.ts','baseline/validate.ts','baseline/data.ts','baseline/trace.ts','baseline/gradient.ts','baseline/bounds.ts','baseline/landscape.source.ts'])frozenSourceHashes[f]=sha(await readFile(new URL(f,import.meta.url)));
const options={budget:PROTOCOL.visits,maxHeightEvaluations:PROTOCOL.heightCap,toleranceKm:PROTOCOL.toleranceKm,stackCapacity:PROTOCOL.stack};
function summary(rows:any[]){const counts:Record<string,number>={},groups:Record<string,Record<string,number>>={};for(const r of rows){counts[r.status]=(counts[r.status]??0)+1;if(r.group){groups[r.group]??={};groups[r.group][r.status]=(groups[r.group][r.status]??0)+1;}}const sum=(k:string)=>rows.reduce((s,r)=>s+(r[k]??0),0);return{count:rows.length,counts,groups,unresolved:rows.filter(r=>r.status.startsWith('unresolved')).length,heightEvaluations:sum('heightEvaluations'),visits:sum('visits'),baseRecordLoads:sum('baseRecordLoads'),gradientRecordLoads:sum('gradientRecordLoads'),metadataRecordLoads:sum('metadataLoads'),childClips:sum('childClips')};}
const comparable=(r:any)=>{const q={...r};for(const k of['metadataLoads','baseRecordLoads','gradientRecordLoads','childClips','blockerKey'])delete q[k];return q;};
function compareRows(before:any[],after:any[]){const failures:any[]=[];for(let i=0;i<before.length;i++){if(JSON.stringify(comparable(before[i]))!==JSON.stringify(comparable(after[i])))failures.push({name:before[i].name,before:comparable(before[i]),after:comparable(after[i])});}return{count:before.length,failures,failureCount:failures.length};}
function safetyCompare(before:any[],after:any[]){const conflicts:any[]=[],invalidWitnesses:any[]=[],resolvedChanges:any[]=[];for(let i=0;i<before.length;i++){const a=before[i],b=after[i];if(b.status==='hit'&&(!(b.enclosureKm<=.00100001)||!(b.witness?.upperClearance<=0)))invalidWitnesses.push({name:b.name,result:b});if(a.status==='hit'&&['miss','outer-envelope-miss'].includes(b.status))conflicts.push({name:a.name,kind:'qualified-hit-to-miss',a,b});if(['miss','outer-envelope-miss'].includes(a.status)&&b.status==='hit')conflicts.push({name:a.name,kind:'qualified-miss-to-hit',a,b});if(a.status==='hit'&&b.status==='hit'&&(a.interval[0]>b.interval[1]+1e-5||b.interval[0]>a.interval[1]+1e-5))conflicts.push({name:a.name,kind:'disjoint-first-entry-enclosures',a:a.interval,b:b.interval});if(!a.status.startsWith('unresolved')&&b.status.startsWith('unresolved'))resolvedChanges.push({name:a.name,before:a.status,after:b.status});}return{conflicts,invalidWitnesses,resolvedToUnresolved:resolvedChanges};}
const compact=repack(pack.nodes),structural=verifyRepack(pack.nodes,compact);
if(phase==='packing'){
 const originalLookup=new Lookup(pack),nextLookup=new CompactLookup(compact),rays=fixture.rays.map(cleanPose);
 const t0=performance.now(),a=rays.map(r=>originalTrace(r,originalLookup,options)),originalMs=performance.now()-t0,t1=performance.now(),b=rays.map(r=>trace(r,nextLookup,options)),compactMs=performance.now()-t1,identity=compareRows(a,b);
 const recordsBefore=originalLookup.loads*3,recordsAfter=nextLookup.loads,reduction=1-recordsAfter/recordsBefore;
 const result={phase,provenance,frozenSourceHashes,protocol:PROTOCOL,structural,original:summary(a),compact:summary(b),identity,recordsBefore,recordsAfter,reduction,recordGatePassed:reduction>=PROTOCOL.metadataRecordReductionGate,originalMs,compactMs,CPUTimeIsGPUTime:false};
 await emit('packing.json',result);await emit('packing-original-rows.json',a);await emit('packing-compact-rows.json',b);console.log(JSON.stringify({...result,identity:{count:identity.count,failureCount:identity.failureCount}}));if(identity.failureCount||!result.recordGatePassed)process.exitCode=1;
}
if(phase==='pages'){
 // This phase is deliberately separate: full matrix cannot influence page requests.
 const views=bundles(fixture.rays),builder=new PageBuilder(pack.nodes),rounds:any[]=[];
 for(let round=0;round<PROTOCOL.trainingRounds;round++){
  const resident=builder.serialize(),lookup=new CompactLookup(resident),rows=views.training.map(r=>trace(r,lookup,options)),primary=requestsFromNormalCap(rows),neighbors=neighborRequests(builder,primary),logs=[];
  for(const request of[...primary,...neighbors])logs.push(builder.prepare(request));rounds.push({round,training:summary(rows),rows,primary,neighbors,logs});if(!logs.some(l=>l.status==='resident'))break;
 }
 const resident=builder.serialize(),lookup=new CompactLookup(resident),baseLookup=new CompactLookup(compact),evaluate=(poses:any[])=>{const before=poses.map(p=>trace(p,baseLookup,options)),after=poses.map(p=>trace(p,lookup,options));return{before:summary(before),after:summary(after),safety:safetyCompare(before,after),beforeRows:before,afterRows:after};};
 const structural=verifyRepack(builder.nodes,resident),verification=validatePages(builder.nodes,resident,pack.nodes.length);
 const holdout=evaluate(views.holdout),yawHoldout=evaluate(views.yawHoldout),controls=evaluate(views.controls),descriptor={format:'one RGBA32F base per node; one RGBA32F gradient per leaf; implicit dyadic coordinates',nodeCount:resident.nodeCount,leafCount:resident.leafCount,bytes:resident.bytes,baseBytes:resident.base.byteLength,gradientBytes:resident.gradients.byteLength,sourceSha256:resident.sourceSha256,ledgerVersion:resident.ledgerVersion};
 const result={phase,provenance,frozenSourceHashes,protocol:PROTOCOL,views,rounds,descriptor,structural,verification,holdout,yawHoldout,controls,oracleWasUsedForPageRequests:false,fullMatrixExecuted:false,GPUExecuted:false};
 await writeFile(new URL('resident-base.f32.bin',out),new Uint8Array(resident.base.buffer));await writeFile(new URL('resident-gradient.f32.bin',out),new Uint8Array(resident.gradients.buffer));
 await emit('pages.json',result);console.log(JSON.stringify({phase,rounds:rounds.map(r=>({round:r.round,training:r.training,accepted:r.logs.filter((l:any)=>l.status==='resident').length})),descriptor,structural,verification,holdout:{before:holdout.before,after:holdout.after,safety:holdout.safety},yawHoldout:{before:yawHoldout.before,after:yawHoldout.after,safety:yawHoldout.safety},controls:{before:controls.before,after:controls.after,safety:controls.safety}}));
 if(verification.failureCount||resident.bytes>MAX_BYTES||[holdout,yawHoldout,controls].some(q=>q.safety.conflicts.length||q.safety.invalidWitnesses.length))process.exitCode=1;
}
if(phase==='full'){
 const qualified=JSON.parse(await readFile(new URL('pages.json',out),'utf8'));
 if(JSON.stringify(qualified.frozenSourceHashes)!==JSON.stringify(frozenSourceHashes))throw Error('Pages were generated by different prototype source; do not silently reuse');
 if(qualified.verification.failureCount)throw Error('New page finite bounds checks failed: full replay rejected');
 for(const q of[qualified.holdout,qualified.yawHoldout,qualified.controls])if(q.safety.conflicts.length||q.safety.invalidWitnesses.length)throw Error('Holdout safety failed: full replay not authorized by protocol');
 const loadF32=async(name:string)=>{const b=await readFile(new URL(name,out));return new Float32Array(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength));},base=await loadF32('resident-base.f32.bin'),gradients=await loadF32('resident-gradient.f32.bin');
 const resident={...compact,base,gradients,nodeCount:base.length/4,leafCount:gradients.length/4,bytes:base.byteLength+gradients.byteLength};if(resident.bytes!==qualified.descriptor.bytes||resident.bytes>MAX_BYTES)throw Error('Resident metadata size mismatch');
 const next=new CompactLookup(resident),beforeLookup=new CompactLookup(compact),poses=fixture.rays.map(cleanPose),t0=performance.now(),before=poses.map(p=>trace(p,beforeLookup,options)),baselineMs=performance.now()-t0,t1=performance.now(),after=poses.map(p=>trace(p,next,options)),pagedMs=performance.now()-t1,safety=safetyCompare(before,after);
 const a=summary(before),b=summary(after),result={phase,provenance,frozenSourceHashes,protocol:PROTOCOL,descriptor:qualified.descriptor,before:a,after:b,safety,unresolvedGatePassed:b.unresolved<=PROTOCOL.primaryUnresolvedGate,bytesGatePassed:resident.bytes<=MAX_BYTES,baselineMs,pagedMs,CPUTimeIsGPUTime:false,GPUExecuted:false,oracleWasUsedForPageRequests:false};
 await emit('full.json',result);await emit('full-rows.json',after);await emit('all-unresolved.json',after.filter(r=>r.status.startsWith('unresolved')));console.log(JSON.stringify(result));if(safety.conflicts.length||safety.invalidWitnesses.length||!result.unresolvedGatePassed)process.exitCode=1;
}
