import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {terrainHeight,terrainNoise,coastDistance,clampCameraAboveLandscape} from '/Users/enuzzo/Library/CloudStorage/Dropbox/Mitnick/Cloudia/src/cumulonimbus/landscape.ts';
import {TerrainBounds,LazyMetadata,NUMERIC_CONTRACT,nextF32,type Rect,type I} from './bounds.ts';
import {trace,type Pose,type TraceMode} from './trace.ts';
const dir=new URL('./',import.meta.url),sourcePath='/Users/enuzzo/Library/CloudStorage/Dropbox/Mitnick/Cloudia/src/cumulonimbus/landscape.ts';
const sha=(data:Uint8Array)=>createHash('sha256').update(data).digest('hex'),expected='72a15a3c6b422405324b2006d94e5074c33eb272bbbe51e123a79eb3b2b90d99',sourceSha=sha(readFileSync(sourcePath));
if(sourceSha!==expected)throw Error('Unexpected terrain source hash');
const began=performance.now();let state=20261016;
const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/2**32;};
const failures:any[]=[],groups:any[]=[];
function assertContains(value:number,interval:I,context:any){if(value<interval[0]||value>interval[1]||!Number.isFinite(value))failures.push({kind:'containment',value,interval,...context});}
const builder=new TerrainBounds();
let samples=0,rectangles=0,noiseSamples=0,subsetChecks=0,subsetNestingWithinTolerance=0,widestPoint=0;
const widths:number[]=[];
function sampleRect(rect:Rect,label:string,n=5){
 rectangles++;const bound=builder.evaluate(rect);if(bound.height[0]<0||bound.height[1]>3.25)failures.push({kind:'outer-envelope-height-limit',rect,height:bound.height});
 for(let iz=0;iz<n;iz++)for(let ix=0;ix<n;ix++){
  const x=rect.x0+(rect.x1-rect.x0)*ix/(n-1),z=rect.z0+(rect.z1-rect.z0)*iz/(n-1);
  assertContains(terrainHeight(x,z),bound.height,{label,x,z,component:'height',rect});
  assertContains(coastDistance(x,z),bound.coast,{label,x,z,component:'coast',rect});samples++;
 }
 for(let i=0;i<3;i++){
  const ax=rect.x0+(rect.x1-rect.x0)*random(),bx=rect.x0+(rect.x1-rect.x0)*random(),az=rect.z0+(rect.z1-rect.z0)*random(),bz=rect.z0+(rect.z1-rect.z0)*random();
  const child={x0:Math.min(ax,bx),x1:Math.max(ax,bx),z0:Math.min(az,bz),z1:Math.max(az,bz)},sub=builder.evaluate(child);subsetChecks++;
  // Parent and child are separately valid enclosures. Outward operation rounding
  // may prevent bitwise nesting at a degenerate endpoint; test actual samples,
  // and report rather than assume a mathematical min/max pyramid was built.
  if(sub.height[0]<bound.height[0]-1e-6||sub.height[1]>bound.height[1]+1e-6)failures.push({kind:'child-not-nested',rect,child,parent:bound.height,childBound:sub.height});
  else if(sub.height[0]<bound.height[0]||sub.height[1]>bound.height[1])subsetNestingWithinTolerance++;
 }
 widths.push(bound.height[1]-bound.height[0]);
}
for(const size of [0,2**-16,.001,.0625,.25,1,8,32,256])for(let i=0;i<32;i++){
 const x=-512+random()*1024,z=-512+random()*1024;sampleRect({x0:x,x1:x+size,z0:z,z1:z+size},`random-size-${size}`);
}
groups.push({name:'random-rectangles-and-subsets',rectangles,samples,subsetChecks});
const beforeRect=rectangles,beforeSamples=samples;
for(const x of [-32,-24,-16,-1,-0,0,1,2,16,24,32])for(const z of [-128,-70,-69.8131700798,-1,0,1,69.8131700798,70,128]){
 sampleRect({x0:nextF32(x,-1),x1:nextF32(x,1),z0:nextF32(z,-1),z1:nextF32(z,1)},'boundaries');
}
groups.push({name:'negative-coast-tile-and-f32-boundaries',rectangles:rectangles-beforeRect,samples:samples-beforeSamples});
// Direct noise query tests isolate negative lattice cells and ridge=.5 crossings.
for(let i=0;i<1000;i++){
 const x=-48+random()*96,z=-48+random()*96,dx=i%5===0?0:random()*2,dz=i%7===0?0:random()*2;
 const bound=builder.noise([x,x+dx],[z,z+dz]);
 for(let j=0;j<9;j++){
  const xx=x+dx*(j%3)/2,zz=z+dz*Math.floor(j/3)/2;assertContains(terrainNoise(xx,zz),bound,{component:'noise',x:xx,z:zz});noiseSamples++;
 }
}
groups.push({name:'noise-lattice-and-ridge-inputs',noiseRectangles:1000,noiseSamples});
// Inspect original octave coordinate order independently at sampled points.
// qx and qz both use the previous octave, including negative coefficients.
let transformChecks=0,ridgeChecks=0;
const f=Math.fround,fa=(a:number,b:number)=>f(f(a)+f(b)),fs=(a:number,b:number)=>f(f(a)-f(b)),fm=(a:number,b:number)=>f(f(a)*f(b));
for(let i=0;i<64;i++){
 const x=-64+random()*128,z=-64+random()*128,size=i%3===0?0:.125,rect={x0:x,x1:x+size,z0:z,z1:z+size},bound=builder.evaluate(rect);
 for(let k=0;k<9;k++){
  const px=x+size*(k%3)/2,pz=z+size*Math.floor(k/3)/2;let qx=fm(f(px),.065),qz=fm(f(pz),.065),a=f(.58),h=0;
  for(let j=0;j<4;j++){
   const n=terrainNoise(qx,qz),ridge=fs(1,Math.abs(fs(fm(n,2),1))),term=fm(fm(a,ridge),ridge),bo=bound.octaves[j];
   for(const [value,interval,component] of [[qx,bo.qx,'qx'],[qz,bo.qz,'qz'],[n,bo.noise,'noise'],[ridge,bo.ridge,'ridge'],[term,bo.term,'term']] as const)assertContains(value,interval,{component:`octave-${j}-${component}`,px,pz});
   transformChecks+=2;ridgeChecks+=3;h=fa(h,term);
   const nx=fa(fm(fs(fm(qx,.8),fm(qz,.6)),2.17),13.4),nz=fa(fm(fa(fm(qx,.6),fm(qz,.8)),2.17),13.4);qx=nx;qz=nz;a=fm(a,.43);
  }
  assertContains(h,bound.ridgeSum,{component:'ridge-sum',px,pz});
 }
}
groups.push({name:'simultaneous-octave-transforms-negative-coefficients-and-ridge-squares',transformChecks,ridgeChecks});

for(let i=0;i<100;i++){
 const x=-64+random()*128,z=-64+random()*128,bound=builder.evaluate({x0:x,x1:x,z0:z,z1:z});widestPoint=Math.max(widestPoint,bound.height[1]-bound.height[0]);
}
groups.push({name:'point-interval-width',points:100,widestHeightIntervalKm:widestPoint});
// Shader-portable coast policy deliberately discards unqualified sine accuracy;
// it still must contain the current CPU points, but is not a full GPU proof.
const conservativeCoast=new TerrainBounds(64,'unknown-outside-wgsl-range');let unknownSamples=0;
for(const z of [-512,-128,-70,70,128,512])for(const x of [-32,0,32]){
 const rect={x0:x-.5,x1:x+.5,z0:z-.5,z1:z+.5},b=conservativeCoast.evaluate(rect);
 for(let i=0;i<9;i++){const xx=rect.x0+i%3*.5,zz=rect.z0+Math.floor(i/3)*.5;assertContains(terrainHeight(xx,zz),b.height,{component:'unknown-coast-policy',x:xx,z:zz});unknownSamples++;}
}
groups.push({name:'coast-unknown-outside-wgsl-range',samples:unknownSamples,unknownRectangles:conservativeCoast.counters.coastUnknown});
const reference=JSON.parse(readFileSync(new URL('matrix14.json',dir),'utf8'));
if(reference.landscapeSha256!==sourceSha)throw Error('Matrix landscape provenance changed');
const poses:Pose[]=reference.poses;
if(poses.length!==14)throw Error('Expected prior 14-ray matrix');
const traces:any[]=[];
for(const mode of ['global','analytic','metadata'] as TraceMode[]){
 const b=new TerrainBounds(),m=new LazyMetadata(b,-512,1024,1),start=performance.now();
 const results=poses.map(p=>trace(p,mode,b,m));
 traces.push({mode,elapsedMs:performance.now()-start,results,metadata:{nodes:m.size,loads:m.loads,misses:m.misses},totals:results.reduce((sum:any,r:any)=>{for(const k of ['visits','heightEvaluations','discarded','dynamicBounds','tileLoads','metadataMisses'])sum[k]=(sum[k]??0)+r[k];return sum;},{})});
}
const summaries=traces.map(({mode,elapsedMs,results,totals,metadata})=>({mode,elapsedMs,statuses:results.reduce((a:any,r:any)=>{a[r.status]=(a[r.status]??0)+1;return a;},{}),totals,metadata,maxHeightEvaluations:Math.max(...results.map((r:any)=>r.heightEvaluations)),medianHeightEvaluations:results.map((r:any)=>r.heightEvaluations).sort((a:number,b:number)=>a-b)[7],maxVisits:Math.max(...results.map((r:any)=>r.visits))}));

const metadataVariants:any[]=[];
for(const leafKm of [2,1,.25,.0625]){
 const b=new TerrainBounds(),m=new LazyMetadata(b,-512,1024,leafKm),coldStart=performance.now(),cold=poses.map(p=>trace(p,'metadata',b,m)),coldMs=performance.now()-coldStart;
 const warmStart=performance.now(),warm=poses.map(p=>trace(p,'metadata',b,m)),warmMs=performance.now()-warmStart;
 const limited=poses.map(p=>trace(p,'metadata',b,m,{budget:128,maxHeightEvaluations:16}));
 const expanded=poses.map(p=>trace(p,'metadata',b,m,{budget:256,maxHeightEvaluations:16}));
 const sum=(rs:any[])=>({statuses:rs.reduce((a:any,r:any)=>{a[r.status]=(a[r.status]??0)+1;return a;},{}),heightEvaluations:rs.reduce((n,r)=>n+r.heightEvaluations,0),maxHeightEvaluations:Math.max(...rs.map(r=>r.heightEvaluations)),visits:rs.reduce((n,r)=>n+r.visits,0),maxVisits:Math.max(...rs.map(r=>r.visits)),dynamicBounds:rs.reduce((n,r)=>n+r.dynamicBounds,0),metadataLoads:rs.reduce((n,r)=>n+r.tileLoads,0),rectQueries:rs.reduce((n,r)=>n+r.builderWork.rectQueries,0),hashCalls:rs.reduce((n,r)=>n+r.builderWork.hashCalls,0)});
 metadataVariants.push({leafKm,coldMs,warmMs,metadataNodes:m.size,cold:sum(cold),warm:sum(warm),limited:sum(limited),expanded256:sum(expanded),limitedResults:limited,expanded256Results:expanded,results:warm});
 for(const r of limited)if(r.heightEvaluations>16||r.visits>128)failures.push({kind:'budget-exceeded',leafKm,name:r.name,heights:r.heightEvaluations,visits:r.visits});
 for(const r of expanded)if(r.status.startsWith('unresolved')||r.heightEvaluations>16||r.visits>256)failures.push({kind:'expanded-budget-not-qualified',leafKm,name:r.name,status:r.status,heights:r.heightEvaluations,visits:r.visits});
}


// Regression for a real precheck bug found by independent review: the outer
// quadratic uses sqrt(discriminant)/dot(d,d), not /length(d). The selected ray
// starts inside the outer shell and points upwards enough that the old precheck
// falsely rejected it when its direction was scaled by 0.5. Its fade is 1 for
// every tested scale, so this test isolates geometric t scaling.
const nonunitCases:any[]=[];
{
 const base=poses.find(p=>p.name==='low-x0-dy0.05')!,b=new TerrainBounds(),m=new LazyMetadata(b),unit=trace(base,'metadata',b,m),D=base.ray.reduce((n,v)=>n+v*v,0),R=6371,CY=6375,H=3.25;
 for(const scale of [.5,2]){
  const p={...base,name:`nonunit-${scale}`,ray:base.ray.map(v=>v*scale)},actual=trace(p,'metadata',b,m),rad=[p.origin[0],p.origin[1]+CY,p.origin[2]],a=p.ray.reduce((n,v)=>n+v*v,0),bb=rad.reduce((n,v,i)=>n+v*p.ray[i],0),cc=rad.reduce((n,v)=>n+v*v,0)-(R+H)**2,disc=bb*bb-a*cc,tc=-bb/a;
  const oldPrecheckExit=tc+Math.sqrt(disc)/Math.sqrt(a),correctPrecheckExit=tc+Math.sqrt(disc)/a;
  const transformedInterval=actual.interval?.map((t:number)=>t*scale),expected=unit.interval;
  if(actual.status!=='hit'||unit.status!=='hit'||transformedInterval[1]<expected[0]||transformedInterval[0]>expected[1]||actual.enclosureKm>.001+1e-12)failures.push({kind:'nonunit-precheck-or-scale',scale,actual,unit});
  nonunitCases.push({scale,oldPrecheckExit,correctPrecheckExit,status:actual.status,interval:actual.interval,physicalInterval:transformedInterval,referencePhysicalInterval:expected,enclosureKm:actual.enclosureKm,heightEvaluations:actual.heightEvaluations,visits:actual.visits});
 }
}
groups.push({name:'nonunit-outer-envelope-precheck-and-geometric-scale',cases:nonunitCases.length});
// A separate dense prefix scan catches traversal mistakes; it is NOT a proof
// against all sub-5m features, nor a replacement for interval certificates.
const prefixScan:any[]=[];let prefixSamples=0;
for(const r of traces[2].results){
 const pose=poses.find(p=>p.name===r.name)!,R=6371,CY=6375,dt=.005/Math.hypot(...pose.ray),limit=r.status==='hit'?r.interval[0]:r.search[1];let firstUnexpected:null|number=null;
 for(let t=0;t<limit;t+=dt){const p=pose.origin.map((v,i)=>v+pose.ray[i]*t),clear=Math.hypot(p[0],p[1]+CY,p[2])-R-r.relief*terrainHeight(p[0],p[2]);prefixSamples++;if(clear<=0){firstUnexpected=t;break;}}
 prefixScan.push({name:r.name,status:r.status,limitKm:limit,firstUnexpected});if(firstUnexpected!==null)failures.push({kind:'dense-prefix-occupancy',name:r.name,t:firstUnexpected});
 if(r.status==='hit'&&(!(r.enclosureKm<=.001+1e-12)||r.witness.upperClearance>0))failures.push({kind:'invalid-hit-contract',name:r.name,r});
}
groups.push({name:'5m-prefix-scan-independent-point-checks',samples:prefixSamples,note:'Finite sample bug detector, not a first-hit certificate'});
// Compare every completed hit against the original global reference intervals.
// This is a consistency test; the global trace is not an independent GPU oracle.
for(const t of traces.slice(1))for(let i=0;i<poses.length;i++){
 const base=traces[0].results[i],actual=t.results[i];
 if(base.status==='miss'&&actual.status==='hit')failures.push({kind:'status-mismatch',name:poses[i].name,mode:t.mode,base:base.status,actual:actual.status});
 if(base.status==='hit'&&actual.status==='hit'&&(actual.interval[1]<base.interval[0]||actual.interval[0]>base.interval[1]))failures.push({kind:'hit-interval-disjoint',name:poses[i].name,mode:t.mode,base:base.interval,actual:actual.interval});
}
const report={generatedAt:new Date().toISOString(),implementation:Object.fromEntries(['bounds.ts','trace.ts','run.ts','matrix14.json'].map(name=>[name,sha(readFileSync(new URL(name,dir)))])),productModified:false,generatedVolumes:0,GPU:false,source:{path:sourcePath,sha256:sourceSha},numericContract:NUMERIC_CONTRACT,qualification:'Finite CPU tests only. No universal host-libm bound or GPU interval certificate. Point field error defaults to zero for comparison with the imported CPU reference; builder guards are explicit and not a portable GPU error ledger.',seed:20261016,passed:failures.length===0,groups,failures,qualificationCounters:builder.counters,subsetNestingWithinTolerance,summaries,traces,metadataVariants,prefixScan,nonunitCases,elapsedMs:performance.now()-began};
writeFileSync(new URL('results.json',dir),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({passed:report.passed,groups,failures:failures.slice(0,15),summaries,metadataVariants:metadataVariants.map(({leafKm,coldMs,warmMs,metadataNodes,cold,warm,limited,expanded256})=>({leafKm,coldMs,warmMs,metadataNodes,cold,warm,limited,expanded256})),elapsedMs:report.elapsedMs},null,2));
if(failures.length)process.exitCode=1;
