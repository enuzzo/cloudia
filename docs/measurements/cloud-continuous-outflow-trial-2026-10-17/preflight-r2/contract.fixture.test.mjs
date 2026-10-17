import test from 'node:test';
import assert from 'node:assert/strict';
import {layoutBytes,exactTuples,rangeVisits,identicalRecipes,retiredLineage,preparedAccounting} from './contract.mjs';

// Pure tiny contract fixtures only: no volume/helper import, noise, dense field,
// guard-kernel evaluation, recipe or raster. Prepared, not yet authorized to run.
test('tuple encoding preserves signed zero, optional blend and append order',()=>{
 const x=[[0,1,2,3,4,5]],y=[[-0,1,2,3,4,5]];assert(!layoutBytes(x).equals(layoutBytes(y)));assert.throws(()=>exactTuples(x,y,'changed'));
 assert.throws(()=>exactTuples(x,[[0,1,2,3,4,5,.2]],'changed'));assert.throws(()=>layoutBytes([[NaN,1,2,3,4,5]]));
});
test('local integer visits include only actual intersection; fractional ranges rejected',()=>{
 assert.equal(rangeVisits([1,2,3],[3,5,7]),60);assert.equal(rangeVisits([4,2,3],[3,5,7]),0);assert.throws(()=>rangeVisits([1.5,2,3],[3,5,7]));
});
function lineageFixture(){
 const lobes=Array.from({length:283},(_,i)=>[i*.001,1,0,1,1,1]);
 const groups=[10,101,192].map(core=>({core,ids:Array.from({length:91},(_,i)=>core+i)}));
 const necks=[{top:1,neck:0},{top:4,neck:8}];
 const trace={family:'sheared',lobes,before:structuredClone(lobes),uniqueLobes:lobes.length,beforeRng:[{initialSeed:1,calls:0}],afterRng:[{initialSeed:1,calls:0}],summits:[1,4],foundations:[5,6],sharedBody:7,shoulders:[],groups:[{core:7,ids:[7]}],iceCores:[2,3],contraction:[{axis:0,extent:1,scale:1},{axis:2,extent:1,scale:1}],continuous:null,audit:{necks,collars:groups.map((g,i)=>({core:g.core,top:1,cap:2,broadShoulder:true,t:[.1,.42,.78][i],appendCount:1})),parents:groups.map(g=>({core:g.core,isIce:false,ids:g.ids.slice(1)})),contractions:[{axis:0,radius:3,limit:4.35,extent:1,scale:1,before:structuredClone(lobes),after:structuredClone(lobes)},{axis:2,radius:5,limit:2.8,extent:1,scale:1,before:structuredClone(lobes),after:structuredClone(lobes)}],oldShoulder:{min:[0,0,0],max:[1,1,1]}}};
 lobes[1][1]=2;trace.before=structuredClone(lobes);for(const c of trace.audit.contractions)c.before=c.after=structuredClone(lobes);
 const candidate=structuredClone(trace);candidate.continuous={keyframes:[0,1,2],necks:structuredClone(necks),collars:structuredClone(groups),retired:groups.flatMap(g=>g.ids)};
 return {a:trace,b:candidate};
}
test('identity rejects RNG and post-contraction changes independently',()=>{
 const {a,b}=lineageFixture();identicalRecipes(a,b);b.afterRng[0].calls++;assert.throws(()=>identicalRecipes(a,b));
 const x=lineageFixture();x.b.audit.contractions[0].after[0][0]+=.01;assert.throws(()=>identicalRecipes(x.a,x.b));
});
test('retirement proves actual273 lineage and excludes kept anatomy',()=>{
 const {a,b}=lineageFixture();assert.equal(retiredLineage(a,b).retiredCount,273);
 b.continuous.retired[0]=0;assert.throws(()=>retiredLineage(a,b));
 const x=lineageFixture();x.b.continuous.keyframes[2]=3;assert.throws(()=>retiredLineage(x.a,x.b));
});
function preparedFixture(){
 const l=[0,1,0,1,1,1],kernels=[0,1,2].map(()=>({lobe:[...l],start:[1,1,1],end:[1,1,1]}));
 return {frames:[l,l,l],prepared:{kernels,raster:{start:[1,1,1],end:[1,1,1],voxelCount:1,bytes:4},stats:{kernelCount:3,kernelVoxelVisits:3,kernelAabbVoxelVisits:3,rowSetupCount:3,rowCount:3,rowBoundaryCheckCount:0,rowFallbackCount:0,xPeakSearchComparisons:6,guardEvaluations:3,rowAnalyticRootCount:3,totalGenerationKernelEvaluations:9,totalGenerationWork:10,totalGenerationRowSetupCount:6,mergeVoxelVisits:1,totalRasterVoxelVisits:7,envelopeBytes:4,analyticErrorBoundKm:0,floatingPointGuardKm:1e-6,fieldErrorBoundKm:1e-6,negativeBandKm:.35,fieldFloorKm:-.35,errorScope:'clipped-field-on-native-raster-domain',floatingPointGuardIsFormal:false,parameterIntervals:[0,1].map(segment=>({segment,from:0,to:1,minAxis:0,derivativeBoundKm:0,boxDerivativeBoundKm:0,activeDerivativeBoundKm:0,steps:1,errorBoundKm:0}))}}};
}
const grid={min:[-5,-.5,-3.5],size:[10,8.5,7],resolution:256};
const fixtureRows=(kernel,grid,band,visit)=>{visit(1,1,1,1);return {rowSetupCount:1,rowCount:1,pointVisits:1,boundaryCheckCount:0,rowFallbackCount:0,xPeakSearchComparisons:2,guardEvaluations:1,analyticRootCount:1};};
test('accounting includes guards, endpoints and error; shared enumerator replay is not a solver',()=>{
 const {prepared,frames}=preparedFixture();assert.equal(preparedAccounting(prepared,frames,fixtureRows,grid).totalRasterVoxelVisits,7);
 prepared.stats.totalRasterVoxelVisits=4;assert.throws(()=>preparedAccounting(prepared,frames,fixtureRows,grid));
 const x=preparedFixture();x.prepared.stats.fieldErrorBoundKm=.01;assert.throws(()=>preparedAccounting(x.prepared,x.frames,fixtureRows,grid));
 const y=preparedFixture();y.prepared.kernels.forEach(k=>k.lobe[0]=.1);assert.throws(()=>preparedAccounting(y.prepared,y.frames,fixtureRows,grid));
});
