/** PREPARED ONLY. Root executes after canonical-A isolation passes. No volume/bake. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {createLayoutPrefix,assertJointLayoutContract,type LayoutTrace} from '../candidate-source/src/cumulonimbus/layoutPrefix.test-helper';
import type {UpdraftAnatomyDescriptor} from '../candidate-source/src/cumulonimbus/volume';

type Lobe=LayoutTrace['lobes'][number];
type Group={core:number;updraft:number;role:'core'|'cap'|'collar';ids:number[]};
type Updraft={foundation:number;middle:number;neck:number;top:number;shoulders:number[];buried:number|null;cap:number|null};
type Observation={before:Lobe[];updrafts:Updraft[];groups:Group[];ice:number[];matureBody:number[];dominant:number};
type ObservedTrace=LayoutTrace&{lobes:LayoutTrace['lobes']&{__attachmentWitness?:Observation}};
const ROOT='/Users/enuzzo/Library/CloudStorage/Dropbox/Mitnick/Cloudia';
const CANDIDATE='/Users/enuzzo/Documents/Codex/Cloudia-QA-2026-10-17-cycle45/candidate-source/src/cumulonimbus';
const PINS=[
 [`${ROOT}/src/cumulonimbus/volume.ts`,'c349e8f7526a2dafa0348516079f3f67ab7288a17769f28193ebcef7e124d34d'],
 [`${CANDIDATE}/volume.ts`,'db8c77bd79b1e412959b63f647ca1c1026be0cf1e460b4dd71964ad99c840a8f'],
 [`${CANDIDATE}/layoutPrefix.test-helper.ts`,'566e3d3deb52dd56cbb66cb138b863bc14648fdc6ff44b51c42a36e863f97afa'],
 [`${CANDIDATE}/updraftAttachment.ts`,'c9eba3ff685c6d916716af195c09bdd50aaa0fb76ec4867ce326cbf685f5d399'],
 [`${CANDIDATE}/light.ts`,'eb9ecfd6f035bc1cd4cbf40cde2d175ed225cac7eeaf5093cb58dbf92ede63cf'],
 [`${CANDIDATE}/sun.ts`,'893d2e6219a4985f88e83fcc6c9b28548dd4fe995509b0e159b719026d46d8fc'],
 [`${CANDIDATE}/motion.ts`,'62cf7af24ade712c46e710c0607d09549391672845703108e1380e36e2027bb2'],
 [`${CANDIDATE}/inclinedShoulder.ts`,'32a844aaacd1de2bde2760da5cc1686693337445e930611cca4a55e3513d8f66'],
] as const;
const SEEDS=[...Array.from({length:300},(_,i)=>i),912,913,914,-1,1571198069];
const LEGACY='  // Rasterize lobes into their local bounds instead of testing every lobe at every voxel.';
const POST='  // The attached updraft heads are final; rasterize the original kernels next.';
const sha=(data:string|Uint8Array)=>createHash('sha256').update(data).digest('hex');
const start=performance.now(),cpuStart=process.cpuUsage();let maxObservedRSS=0,currentSeed:number|null=null,phase='authenticate';
const rows:Record<string,unknown>[]=[],focus:Record<string,unknown>={},inputHashes:Record<string,string>={};
const checkBudget=()=>{
 const cpu=process.cpuUsage(cpuStart),rss=process.memoryUsage().rss;maxObservedRSS=Math.max(maxObservedRSS,rss);
 assert((cpu.user+cpu.system)/1e6<=20,'Cooperative CPU budget exceeded');
 assert((performance.now()-start)/1000<=30,'Cooperative wall budget exceeded');
 assert(rss<=384*1024*1024,'Observed RSS budget exceeded');
};
const equal=(a:unknown,b:unknown,label:string)=>assert.deepStrictEqual(a,b,label);
const close=(a:number,b:number,label:string)=>assert(Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=1e-12,label);
const idShape=(t:LayoutTrace)=>({family:t.family,summits:t.summits,foundations:t.foundations,sharedBody:t.sharedBody,shoulders:t.shoulders,groups:t.groups});
function tupleSHA(lobes:readonly Lobe[]):string{
 const hash=createHash('sha256'),buffer=Buffer.alloc(58);
 for(const lobe of lobes){
  assert(lobe.length===6||lobe.length===7,'Unexpected primitive arity');buffer.fill(0);buffer[0]=lobe.length;
  lobe.forEach((value,slot)=>{if(value!==undefined){assert(Number.isFinite(value),'Nonfinite primitive');buffer[1]|=1<<slot;buffer.writeDoubleLE(value,2+slot*8);}});
  hash.update(buffer.subarray(0,2+lobe.length*8));
 }
 return hash.digest('hex');
}
function onceInsert(source:string,anchor:string,insertion:string):string{
 assert.equal(source.split(anchor).length,2,'Observation anchor is not unique: '+anchor);
 const result=source.replace(anchor,insertion+anchor);assert.equal(result.replace(insertion,''),source,'Observation insertion is not reversible');return result;
}
// Observation only: reference IDs and copies before attachment; no arithmetic or tuple writes.
const BEFORE=`  const __awIds=new Map(lobes.map((lobe,index)=>[lobe,index]));
  const __awId=(lobe:Lobe)=>{const id=__awIds.get(lobe);if(id===undefined)throw new Error('Unregistered attachment reference');return id;};
  const __awBefore=lobes.map(lobe=>lobe.slice());
  const __awUpdrafts=updrafts.map(updraft=>({foundation:__awId(updraft.foundation),middle:__awId(updraft.middle),neck:__awId(updraft.neck),top:__awId(updraft.top),
    shoulders:updraft.shoulders.map(__awId),buried:updraft.buried?__awId(updraft.buried):null,cap:capParents.has(updraft.top)?__awId(capParents.get(updraft.top)!):null}));
  const __awGroups=[...attachmentOwners].map(([core,owner])=>({core:__awId(core),updraft:updrafts.indexOf(owner.updraft),role:owner.role,ids:[...attachmentGroups.get(core)!].map(__awId)}));
  const __awIce=iceCores.map(__awId);
`;
const AFTER=`  Object.defineProperty(lobes,'__attachmentWitness',{value:{before:__awBefore,updrafts:__awUpdrafts,groups:__awGroups,ice:__awIce,
    matureBody:matureBody.map(__awId),dominant:updrafts.indexOf(dominant)}});
`;
function verifyPost(legacy:LayoutTrace,post:ObservedTrace){
 const o=post.lobes.__attachmentWitness;assert(o,'Missing actual ownership observation');
 const a=legacy.lobes,b=post.lobes;equal(o.before,a,'Observation must reproduce the unmodified legacy stage');
 equal(idShape(post),idShape(legacy),'IDs/order changed after attachment');
 equal(post.before,legacy.before,'Pre-joint tuples changed');equal(post.beforeRng,legacy.beforeRng,'Pre-joint RNG changed');
 equal(post.afterRng,legacy.afterRng,'Attachment consumed RNG');assert.equal(b.length,a.length);assert.equal(post.uniqueLobes,a.length);
 equal(post.foundationTuples,legacy.foundationTuples,'Foundation tuples moved');
 const report=post.attachmentReport as UpdraftAnatomyDescriptor;assert(report&&report.family===post.family,'Missing/mismatched actual report');
 assert.equal(report.dominant,o.dominant);assert.equal(report.heads.length,o.updrafts.length);
 equal(o.updrafts.map(u=>u.top),post.summits,'Actual top identities differ');equal(o.updrafts.map(u=>u.foundation),post.foundations,'Actual foundation identities differ');
 const mature=o.updrafts[o.dominant];assert(mature,'Missing dominant updraft');
 assert.equal(a[mature.top][1],Math.max(...o.updrafts.map(u=>a[u.top][1])),'Dominant is not a highest actual head');
 equal(b[mature.top],a[mature.top],'Mature head moved');
 equal(o.matureBody,[mature.foundation,mature.middle,mature.neck,mature.top,...(mature.buried===null?[]:[mature.buried])],'Mature body membership changed');
 const owner=new Map<number,Group>(),coreIDs=new Set<number>();let changedLobes=0,changedGroups=0,maxRigidResidualKm=0,maxGroupShiftKm=0;
 for(let id=0;id<a.length;id++){
  assert.equal(a[id].length,b[id].length,'Primitive arity changed');
  for(const slot of [1,3,4,5,6])assert(Object.is(a[id][slot],b[id][slot]),'Y/radii/blend changed');
  if(!Object.is(a[id][0],b[id][0])||!Object.is(a[id][2],b[id][2]))changedLobes++;
 }
 const groupRows=o.groups.map(group=>{
  assert(!coreIDs.has(group.core),'Repeated group core');coreIDs.add(group.core);
  assert(group.updraft>=0&&group.updraft<o.updrafts.length,'Group lacks a real parent');
  assert(group.ids.includes(group.core),'Core absent from its own group');assert.equal(new Set(group.ids).size,group.ids.length,'Within-group alias');
  const expected=group.role==='cap'?25+(post.family==='congestus'?16:post.family==='multicell'?36:48)/o.ice.length:91;
  assert.equal(group.ids.length,expected,'Incomplete semantic group');
  const delta:[number,number]=[b[group.core][0]-a[group.core][0],b[group.core][2]-a[group.core][2]];
  maxGroupShiftKm=Math.max(maxGroupShiftKm,Math.hypot(...delta));let changed=false;
  for(const id of group.ids){
   assert(Number.isInteger(id)&&id>=0&&id<a.length&&!owner.has(id),'Repeated/missing actual primitive ownership');owner.set(id,group);
   const residual=Math.max(Math.abs((b[id][0]-b[group.core][0])-(a[id][0]-a[group.core][0])),Math.abs((b[id][2]-b[group.core][2])-(a[id][2]-a[group.core][2])));
   maxRigidResidualKm=Math.max(maxRigidResidualKm,residual);assert(residual<=1e-12,'Group lost core-relative rigid offsets');
   changed ||= !Object.is(a[id][0],b[id][0])||!Object.is(a[id][2],b[id][2]);
   if(group.updraft===o.dominant||group.core===o.updrafts[group.updraft].foundation)equal(b[id],a[id],'Dominant/foundation group moved');
  }
  if(changed)changedGroups++;
  return {core:group.core,updraft:group.updraft,role:group.role,count:group.ids.length,y:a[group.core][1],deltaXZ:delta,before:a[group.core],after:b[group.core]};
 });
 for(let id=0;id<a.length;id++)if(!owner.has(id))equal(b[id],a[id],'Unowned primitive changed');
 assert.equal(changedLobes,report.movedLobes,'Reported moved-lobe count differs');assert.equal(changedGroups,report.movedGroups,'Reported moved-group count differs');
 for(let ordinal=0;ordinal<o.updrafts.length;ordinal++){
  const u=o.updrafts[ordinal],h=report.heads[ordinal];equal(h.head,b[u.top].slice(0,6),'Reported head differs');
  equal(h.foundation,b[u.foundation].slice(0,3),'Reported foundation differs');
  assert(h.head!==b[u.top]&&h.foundation!==b[u.foundation],'Report aliases a mutable primitive');
  assert.equal(h.role,ordinal===o.dominant?'dominant':'young');
  for(const core of [u.foundation,u.middle,u.neck,u.top,...u.shoulders,...(u.buried===null?[]:[u.buried])]){
   const group=owner.get(core);assert(group&&group.core===core&&group.updraft===ordinal&&group.role==='core','Actual updraft core has incorrect ownership');
  }
  if(u.cap!==null)equal(h.cap,b[u.cap].slice(0,6),'Reported parented cap differs');
  else if(h.cap!==null)assert(ordinal===o.dominant&&o.ice.some(id=>b[id].slice(0,6).every((v,s)=>Object.is(v,h.cap![s]))),'Unparented young cap or foreign dominant cap');
  if(ordinal===o.dominant){assert.equal(h.attachment,null);continue;}
  const r=h.attachment;assert(r,'Young updraft has no actual attachment result');
  assert([...r.axisPoint,...r.directionXZ,r.headDistanceKm,...r.translationXZ].every(Number.isFinite),'Nonfinite attachment report');
  assert(Object.is(r.axisPoint[1],a[u.top][1]),'Attachment axis uses a different head height');
  // Independent geometric properties; no quadratic roots or deformation formula replay.
  assert(o.matureBody.some(id=>{const l=a[id];return ((r.axisPoint[0]-l[0])/l[3])**2+((r.axisPoint[1]-l[1])/l[4])**2+((r.axisPoint[2]-l[2])/l[5])**2<=1;}),'Axis outside mature body: no fallback allowed');
  const stem=[a[mature.top][0]-a[mature.foundation][0],a[mature.top][1]-a[mature.foundation][1],a[mature.top][2]-a[mature.foundation][2]];
  const ap=r.axisPoint.map((v,s)=>v-a[mature.foundation][s]);
  close(ap[0]*stem[1],ap[1]*stem[0],'Axis X is off the actual mature line');close(ap[2]*stem[1],ap[1]*stem[2],'Axis Z is off the actual mature line');
  const beforeDistance=Math.hypot(a[u.top][0]-r.axisPoint[0],a[u.top][2]-r.axisPoint[2]);close(beforeDistance,r.headDistanceKm,'Reported original distance differs');
  const headDelta:[number,number]=[b[u.top][0]-a[u.top][0],b[u.top][2]-a[u.top][2]],headNorm=Math.hypot(...headDelta);
  close(headDelta[0],r.translationXZ[0],'Head X displacement differs from actual report');close(headDelta[1],r.translationXZ[1],'Head Z displacement differs from actual report');
  if(r.status==='attached'){
   assert(r.boundaryDistanceKm!==null&&r.boundaryDistanceKm>=0&&beforeDistance>r.boundaryDistanceKm,'Invalid attached status');
   close(Math.hypot(b[u.top][0]-r.axisPoint[0],b[u.top][2]-r.axisPoint[2]),r.boundaryDistanceKm,'Moved head is not on the reported boundary');
   assert(headNorm>0,'Attached status produced no head movement');
  }else{
   equal(headDelta,[0,0],'Nonattached head moved');
   if(r.status==='axis-coincident')assert(beforeDistance===0&&r.boundaryDistanceKm===null,'Invalid coincident status');
   else assert(r.status==='already-contained'&&r.boundaryDistanceKm!==null&&beforeDistance<=r.boundaryDistanceKm,'Invalid containment status');
  }
  const coreWeights:Array<{y:number;weight:number}>=[];
  for(const group of groupRows.filter(g=>g.updraft===ordinal)){
   if(headNorm===0){for(const id of o.groups.find(g=>g.core===group.core)!.ids)equal(b[id],a[id],'No-op attachment changed its group');continue;}
   if(group.role==='cap'||group.role==='collar'){close(group.deltaXZ[0],headDelta[0],'Cap/collar X does not follow head');close(group.deltaXZ[1],headDelta[1],'Cap/collar Z does not follow head');continue;}
   const weight=(group.deltaXZ[0]*headDelta[0]+group.deltaXZ[1]*headDelta[1])/(headNorm*headNorm);
   assert(weight>=-1e-12&&weight<=1+1e-12,'Observed core movement exceeds head movement');
   close(group.deltaXZ[0]*headDelta[1],group.deltaXZ[1]*headDelta[0],'Core movement is not collinear with actual head movement');
   coreWeights.push({y:group.y,weight});
  }
  coreWeights.sort((x,y)=>x.y-y.y);for(let i=1;i<coreWeights.length;i++)assert(coreWeights[i].weight+1e-12>=coreWeights[i-1].weight,'Observed core movement is not monotone with height');
 }
 const extents=([0,2] as const).map((axis,slot)=>{const radius=axis===0?3:5,before=Math.max(...a.map(l=>Math.abs(l[axis])+l[radius])),after=Math.max(...b.map(l=>Math.abs(l[axis])+l[radius]));assert(after<=Math.max([4.35,2.8][slot],before),'Horizontal margin exceeded');return {axis,before,after,canonicalLimitKm:[4.35,2.8][slot]};});
 return {lobes:a.length,ownedLobes:owner.size,groups:o.groups.length,movedLobes:changedLobes,movedGroups:changedGroups,maxRigidResidualKm,maxGroupShiftKm,extents,report,groupRows};
}

let instrumentationSHA:string|null=null;
try{
 assert.equal(SEEDS.length,305);assert.equal(new Set(SEEDS).size,305);
 for(const [path,expected] of PINS){const bytes=readFileSync(path),actual=sha(bytes);assert.equal(actual,expected,'Pinned input changed: '+path);inputHashes[path]=actual;}
 const canonical=readFileSync(PINS[0][0],'utf8'),candidate=readFileSync(PINS[1][0],'utf8');
 const observed=onceInsert(onceInsert(candidate,LEGACY,BEFORE),POST,AFTER);instrumentationSHA=sha(observed);
 phase='compile-three-prefixes';
 const traceA=createLayoutPrefix(canonical),traceLegacy=createLayoutPrefix(candidate),tracePost=createLayoutPrefix(observed,'post-attachment');checkBudget();
 for(const seed of SEEDS){
  currentSeed=seed;phase='canonical-legacy';checkBudget();const a=traceA(seed);checkBudget();
  phase='candidate-legacy';const legacy=traceLegacy(seed);checkBudget();
  equal(legacy.before,a.before,'Canonical pre-joint primitive bytes changed');equal(legacy.lobes,a.lobes,'Canonical legacy primitive bytes changed');
  equal(idShape(legacy),idShape(a),'Canonical legacy IDs/order changed');equal(legacy.beforeRng,a.beforeRng,'Canonical RNG prefix changed');equal(legacy.afterRng,a.afterRng,'Canonical RNG totals changed');
  equal(legacy.summitTuples,a.summitTuples,'Canonical summit snapshots changed');equal(legacy.foundationTuples,a.foundationTuples,'Canonical foundation snapshots changed');
  assert.equal(a.uniqueLobes,a.lobes.length);assert.equal(legacy.uniqueLobes,a.uniqueLobes);
  const canonicalSHA=tupleSHA(a.lobes);assert.equal(tupleSHA(legacy.lobes),canonicalSHA,'Canonical Float64 tuple stream differs');
  const oldJointA=assertJointLayoutContract(a),oldJointB=assertJointLayoutContract(legacy);equal(oldJointB,oldJointA,'Existing inward joint contract changed');
  phase='candidate-post-attachment';const post=tracePost(seed) as ObservedTrace;checkBudget();phase='post-invariants';const checked=verifyPost(legacy,post);
  const {report,groupRows,...compact}=checked;
  rows.push({seed,family:a.family,canonicalLegacySHA256:canonicalSHA,postSHA256:tupleSHA(post.lobes),rng:a.afterRng,...compact,statuses:report.heads.map(h=>h.attachment?.status??'dominant')});
  if([72,73,74].includes(seed))focus[String(seed)]={...rows.at(-1),oldJoint:oldJointA,report,groups:groupRows,actualIDs:post.lobes.__attachmentWitness!.updrafts};
  checkBudget();if(rows.length%25===0)console.error(JSON.stringify({completed:rows.length,total:SEEDS.length,lastSeed:seed}));
 }
 phase='reauthenticate';for(const [path,expected] of PINS)assert.equal(sha(readFileSync(path)),expected,'Input changed during witness: '+path);checkBudget();
 console.log(JSON.stringify({status:'PASS_RECIPE_ONLY',scope:'305 fixed seeds; 915 actual prefixes; no raster/detail/bake/GPU; no density or artistic conclusion',inputs:inputHashes,instrumentedSourceSHA256:instrumentationSHA,seeds:SEEDS,completed:rows.length,rows,focus,measurement:{wallSeconds:(performance.now()-start)/1000,cpu:process.cpuUsage(cpuStart),maxObservedRSSBetweenCallsBytes:maxObservedRSS},limits:{cpuSeconds:20,wallSeconds:30,rssBytes:384*1024*1024,scope:'Cooperative checks only; root outer launcher must enforce terminal/peak resource gate'}}));
}catch(error){
 console.log(JSON.stringify({status:'FAIL_STOP_NO_FALLBACK',phase,seed:currentSeed,completed:rows.length,error:error instanceof Error?{name:error.name,message:error.message,stack:error.stack}:String(error),inputs:inputHashes,instrumentedSourceSHA256:instrumentationSHA,rows,focus,measurement:{wallSeconds:(performance.now()-start)/1000,cpu:process.cpuUsage(cpuStart),maxObservedRSSBetweenCallsBytes:maxObservedRSS}}));process.exitCode=1;
}
