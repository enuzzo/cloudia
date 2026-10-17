import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';

export const SEEDS=Object.freeze([74,77,80,72,73]);
export const LIMITS=Object.freeze({cpuSeconds:6,wallSeconds:10,peakRssBytes:384*1024*1024,maxKernels:4096,maxRasterVoxelVisits:256000000,maxEnvelopeBytes:16*1024*1024,maxRowSetupCount:16000000,epsilonKm:7/2048,size:256});
export const hash=value=>createHash('sha256').update(value).digest('hex');
export function layoutBytes(lobes){
 let length=4;for(const l of lobes){assert([6,7].includes(l.length));length+=4+l.length*8;}
 const out=Buffer.allocUnsafe(length);let at=0;out.writeUInt32LE(lobes.length,at);at+=4;
 for(const l of lobes){out.writeUInt32LE(l.length,at);at+=4;for(const n of l){assert(Number.isFinite(n));out.writeDoubleLE(n,at);at+=8;}}
 return out;
}
export function exactTuples(a,b,label){assert(layoutBytes(a).equals(layoutBytes(b)),label);}
export function rangeVisits(start,end){assert.equal(start.length,3);assert.equal(end.length,3);let n=1;for(let i=0;i<3;i++){assert(Number.isSafeInteger(start[i])&&Number.isSafeInteger(end[i]));n*=Math.max(0,end[i]-start[i]+1);}assert(Number.isSafeInteger(n));return n;}
export function nativeRange(min,max,size=256){const base=[-5,-.5,-3.5],span=[10,8.5,7];return {start:min.map((v,i)=>Math.max(1,Math.floor((v-base[i])/span[i]*size-.5))),end:max.map((v,i)=>Math.min(size-2,Math.ceil((v-base[i])/span[i]*size-.5)))};}
export function oldLobeVisits(lobes,ids){let visits=0;for(const id of ids){const l=lobes[id];assert(l);const b=nativeRange([0,1,2].map(i=>l[i]-l[i+3]-.35),[0,1,2].map(i=>l[i]+l[i+3]+.35));visits+=rangeVisits(b.start,b.end);}assert(Number.isSafeInteger(visits));return visits;}
export function oldShoulderVisits(bounds){assert(bounds&&bounds.min.length===3&&bounds.max.length===3);const b=nativeRange(bounds.min.map(v=>v-.35),bounds.max.map(v=>v+.35));return {bounds,range:b,visits:rangeVisits(b.start,b.end)};}

export function identicalRecipes(a,b){
 assert.equal(a.family,b.family);assert.equal(a.uniqueLobes,a.lobes.length);assert.equal(b.uniqueLobes,b.lobes.length);
 exactTuples(a.before,b.before,'A/B before-joint tuples changed');exactTuples(a.lobes,b.lobes,'A/B complete recipe tuples/order changed');
 for(const key of ['beforeRng','afterRng','summits','foundations','sharedBody','shoulders','groups','iceCores','contraction'])assert.deepEqual(a[key],b[key],'A/B recipe metadata changed: '+key);
 for(const owner of [a,b])assert.deepEqual(owner.beforeRng,owner.afterRng,'Joint or observation consumed RNG');
 for(const key of ['necks','collars','parents'])assert.deepEqual(a.audit[key],b.audit[key],'Actual append lineage changed: '+key);
 assert.equal(a.audit.contractions.length,2);assert.equal(b.audit.contractions.length,2);
 for(let j=0;j<2;j++){
  const x=a.audit.contractions[j],y=b.audit.contractions[j];
  for(const key of ['axis','radius','limit','extent','scale'])assert(Object.is(x[key],y[key]),'A/B contraction changed: '+key);
  exactTuples(x.before,y.before,'A/B pre-contraction tuples changed');exactTuples(x.after,y.after,'A/B post-contraction tuples changed');
  assert.deepEqual([x.axis,x.radius,x.limit],j===0?[0,3,4.35]:[2,5,2.8]);
 }
 return {tupleSHA256:hash(layoutBytes(a.lobes)),primitiveCount:a.lobes.length,uniquePrimitiveCount:a.uniqueLobes,rngStreams:a.afterRng,
  contraction:a.contraction,contractionTupleSHA256:a.audit.contractions.map(c=>({axis:c.axis,before:hash(layoutBytes(c.before)),after:hash(layoutBytes(c.after))}))};
}

export function retiredLineage(a,b){
 assert.equal(a.continuous,null,'Baseline must have no continuous operator');assert(b.continuous,'Candidate continuous observation missing');
 assert.deepEqual(b.continuous.necks,b.audit.necks,'Candidate neck map differs from actual turret append');
 if(a.family!=='sheared'){
  assert.equal(b.continuous.keyframes,null);assert.deepEqual(b.continuous.collars,[]);assert.deepEqual(b.continuous.retired,[]);
  return {active:false,retiredCount:0,keyframes:null};
 }
 const mature=a.summits.reduce((i,j)=>a.lobes[i][1]>a.lobes[j][1]?i:j),neck=a.audit.necks.find(n=>n.top===mature)?.neck,cap=a.iceCores[0];
 assert(Number.isInteger(neck)&&neck>=0&&Number.isInteger(cap));
 const frames=[neck,mature,cap];assert.equal(new Set(frames).size,3);assert.deepEqual(b.continuous.keyframes,frames,'Keyframes must be actual neck/mature/first ice refs');
 const collars=a.audit.collars.filter(c=>c.broadShoulder);assert.equal(collars.length,3);assert.deepEqual(collars.map(c=>c.t),[.1,.42,.78]);
 const groups=collars.map(c=>{
  assert.equal(c.top,mature);assert.equal(c.appendCount,1);assert(!a.iceCores.includes(c.core));
  const parent=a.audit.parents.find(p=>p.core===c.core);assert(parent&&!parent.isIce);assert.equal(parent.ids.length,90);
  const ids=[c.core,...parent.ids];assert.equal(new Set(ids).size,91);return {core:c.core,ids};
 });
 assert.deepEqual(b.continuous.collars,groups,'Candidate retired groups differ from actual collar descendant spans');
 const retired=groups.flatMap(g=>g.ids);assert.equal(retired.length,273);assert.equal(new Set(retired).size,273);
 assert.deepEqual(b.continuous.retired,retired,'Candidate retirement is not precisely the three actual groups');
 const forbidden=new Set([...frames,...a.summits,...a.foundations,...a.iceCores,...a.audit.necks.map(n=>n.neck)]);
 if(a.sharedBody!==null)forbidden.add(a.sharedBody);
 for(const g of a.groups)for(const id of g.ids)forbidden.add(id);
 for(const id of retired){assert(Number.isInteger(id)&&id>=0&&id<a.lobes.length);assert(!forbidden.has(id),'Retired set intrudes into preserved anatomy');}
 const keyframes=frames.map(id=>a.lobes[id].slice());
 return {active:true,keyframeIds:frames,keyframes,retiredCount:273,groups,retiredIds:retired,retiredTupleSHA256:hash(layoutBytes(retired.map(id=>a.lobes[id]))),
  oldRetiredLobeVoxelVisits:oldLobeVisits(a.lobes,retired),oldShoulder:oldShoulderVisits(a.audit.oldShoulder)};
}

export function preparedAccounting(prepared,keyframes,enumerateRows,grid){
 assert.equal(typeof enumerateRows,'function');assert.deepEqual(grid,{min:[-5,-.5,-3.5],size:[10,8.5,7],resolution:256});
 assert(prepared&&Array.isArray(prepared.kernels));const {kernels,raster,stats}=prepared;
 assert.equal(stats.kernelCount,kernels.length);assert(kernels.length>0&&kernels.length<=LIMITS.maxKernels,'Kernel count cap');
 const merge=rangeVisits(raster.start,raster.end);assert(merge>0);assert.equal(raster.voxelCount,merge);assert.equal(raster.bytes,merge*4);
 for(let i=0;i<3;i++)assert(raster.start[i]>=1&&raster.end[i]<=254&&raster.start[i]<=raster.end[i]);
 const totals={pointVisits:0,rowSetupCount:0,rowCount:0,boundaryCheckCount:0,rowFallbackCount:0,xPeakSearchComparisons:0,guardEvaluations:0,analyticRootCount:0};
 let aabbVisits=0;for(const kernel of kernels){
  assert.equal(kernel.lobe.length,6);assert(kernel.lobe.every(Number.isFinite)&&kernel.lobe.slice(3).every(r=>r>0));
  const count=rangeVisits(kernel.start,kernel.end);aabbVisits+=count;
  if(count)for(let i=0;i<3;i++)assert(kernel.start[i]>=raster.start[i]&&kernel.end[i]<=raster.end[i],'Nonempty kernel range escapes tile');
  const setups=count?(kernel.end[1]-kernel.start[1]+1)*(kernel.end[2]-kernel.start[2]+1):0;
  assert(totals.rowSetupCount+setups<=LIMITS.maxRowSetupCount,'Row setup cap before replay');
  let callbackRows=0,callbackPoints=0;
  const work=enumerateRows(kernel,grid,stats.negativeBandKm,(z,y,x0,x1)=>{
   assert([z,y,x0,x1].every(Number.isSafeInteger)&&x0<=x1);
   assert(z>=kernel.start[2]&&z<=kernel.end[2]&&y>=kernel.start[1]&&y<=kernel.end[1]&&x0>=kernel.start[0]&&x1<=kernel.end[0],'Emitted row escapes its physical kernel bounds');
   callbackRows++;callbackPoints+=x1-x0+1;
  });
  assert.equal(work.rowSetupCount,setups);assert.equal(work.rowCount,callbackRows);assert.equal(work.pointVisits,callbackPoints);
  assert.equal(work.guardEvaluations,work.rowSetupCount+work.boundaryCheckCount);assert.equal(work.analyticRootCount,work.rowCount);
  assert(work.boundaryCheckCount<=2*work.rowCount&&work.rowFallbackCount<=work.rowCount);
  for(const key of Object.keys(totals)){assert(Number.isSafeInteger(work[key])&&work[key]>=0);totals[key]+=work[key];}
 }
 const visits=totals.pointVisits,guards=totals.guardEvaluations;
 assert.equal(stats.kernelVoxelVisits,visits);assert.equal(stats.kernelAabbVoxelVisits,aabbVisits);assert.equal(stats.mergeVoxelVisits,merge);assert.equal(stats.totalRasterVoxelVisits,visits+guards+merge);
 for(const [key,stat] of Object.entries({rowSetupCount:'rowSetupCount',rowCount:'rowCount',boundaryCheckCount:'rowBoundaryCheckCount',rowFallbackCount:'rowFallbackCount',xPeakSearchComparisons:'xPeakSearchComparisons',guardEvaluations:'guardEvaluations',analyticRootCount:'rowAnalyticRootCount'}))assert.equal(stats[stat],totals[key]);
 assert.equal(stats.totalGenerationKernelEvaluations,visits+2*guards);assert.equal(stats.totalGenerationWork,visits+2*guards+merge);assert.equal(stats.totalGenerationRowSetupCount,2*totals.rowSetupCount);
 assert.equal(stats.envelopeBytes,raster.bytes);assert(stats.envelopeBytes<=LIMITS.maxEnvelopeBytes,'Local scratch cap');
 assert(stats.totalRasterVoxelVisits<=LIMITS.maxRasterVoxelVisits,'Raster visit cap');assert.equal(stats.negativeBandKm,.35);
 assert.equal(stats.fieldFloorKm,-.35);assert.equal(stats.errorScope,'clipped-field-on-native-raster-domain');assert.equal(stats.floatingPointGuardIsFormal,false);
 for(const key of ['analyticErrorBoundKm','floatingPointGuardKm','fieldErrorBoundKm'])assert(Number.isFinite(stats[key])&&stats[key]>=0);
 assert.equal(stats.fieldErrorBoundKm,stats.analyticErrorBoundKm+stats.floatingPointGuardKm);assert(stats.fieldErrorBoundKm<=LIMITS.epsilonKm,'Field certificate exceeds fixed epsilon');
 const intervals=stats.parameterIntervals;assert(Array.isArray(intervals)&&intervals.length>=2);assert.equal(1+intervals.reduce((n,p)=>n+p.steps,0),kernels.length);
 for(const segment of [0,1]){
  const rows=intervals.filter(p=>p.segment===segment);assert(rows.length>0);assert.equal(rows[0].from,0);assert.equal(rows.at(-1).to,1);
  for(let i=0;i<rows.length;i++){
   const p=rows[i];assert(p.to>p.from&&Number.isSafeInteger(p.steps)&&p.steps>=1);assert([0,1,2].includes(p.minAxis));
   if(i)assert.equal(rows[i-1].to,p.from,'Parameter interval gap/overlap');
   assert(Number.isFinite(p.derivativeBoundKm)&&p.derivativeBoundKm>=0);
   assert(Number.isFinite(p.boxDerivativeBoundKm)&&Number.isFinite(p.activeDerivativeBoundKm));
   assert.equal(p.derivativeBoundKm,Math.min(p.boxDerivativeBoundKm,p.activeDerivativeBoundKm));
   assert.equal(p.errorBoundKm,p.derivativeBoundKm*(p.to-p.from)/(2*p.steps));assert(p.errorBoundKm<=stats.analyticErrorBoundKm);
  }
 }
 for(const frame of keyframes)assert(kernels.some(k=>layoutBytes([k.lobe]).equals(layoutBytes([frame.slice(0,6)]))),'A keyframe endpoint was not preserved exactly');
 return {kernelCount:kernels.length,kernelVoxelVisits:visits,kernelAabbVoxelVisits:aabbVisits,guardEvaluations:guards,rowSetupCount:totals.rowSetupCount,mergeVoxelVisits:merge,totalRasterVoxelVisits:visits+guards+merge,envelopeBytes:raster.bytes,
  accountingReplayGuardEvaluations:guards,fieldCertificate:'Clipped H versus fixed-kernel Hgrid. Shared stateless enumerator replay evaluates guard sites and counts callback spans; no callback point-SD loop or dense raster. This is accounting, not an independent culling solver.',stats};
}
