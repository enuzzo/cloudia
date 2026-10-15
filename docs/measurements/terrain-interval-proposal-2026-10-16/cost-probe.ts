import {terrainHeight,groundIntersection,EARTH_RADIUS,GROUND_LEVEL,clampCameraAboveLandscape} from '/Users/enuzzo/Library/CloudStorage/Dropbox/Mitnick/Cloudia/src/cumulonimbus/landscape.ts';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
// Tiny CPU cost experiment only. No volume generation, GPU, browser or product edit.
// Mathematical bounds are applied to the existing f32 CPU height reference as a
// diagnostic. This script DOES NOT certify WGSL rounding or interval arithmetic.
const R=EARTH_RADIUS,CY=R-GROUND_LEVEL,HMAX=3.25,LH=5.72;
const expected='72a15a3c6b422405324b2006d94e5074c33eb272bbbe51e123a79eb3b2b90d99';
const sha=(data:Uint8Array)=>createHash('sha256').update(data).digest('hex');
if(sha(readFileSync('/Users/enuzzo/Library/CloudStorage/Dropbox/Mitnick/Cloudia/src/cumulonimbus/landscape.ts'))!==expected)throw Error('Source provenance changed');
const dot=(a:number[],b:number[])=>a.reduce((v,x,i)=>v+x*b[i],0);
const norm=(a:number[])=>Math.hypot(...a);
const ray=(a:number[])=>a.map(v=>v/norm(a));
const smooth=(a:number,b:number,x:number)=>{const u=Math.max(0,Math.min(1,(x-a)/(b-a)));return u*u*(3-2*u);};
type Pose={name:string,origin:number[],ray:number[]};
function solve(pose:Pose,budget=4096,tolerance=.001){
 const {origin:o,ray:d}=pose,radial=[o[0],o[1]+CY,o[2]],tc=-dot(radial,d),sea=groundIntersection(o,d);
 // Exact preservation of current relief for sea-hit rays. Proposed continuity
 // extension for no-sea rays uses closest approach; this is a design choice.
 const relief=1-smooth(90,180,sea??Math.max(0,tc));
 const boundRadius=R+HMAX*relief,disc=boundRadius*boundRadius-(dot(radial,radial)-tc*tc);
 if(disc<0||tc+Math.sqrt(Math.max(0,disc))<=0)return {...pose,sea,relief,state:'outer-envelope-miss',nodes:0,evaluations:0};
 const start=Math.max(0,tc-Math.sqrt(disc)),end=sea??tc+Math.sqrt(disc);
 let evaluations=0;const at=(t:number)=>{evaluations++;const p=o.map((v,i)=>v+d[i]*t);return {h:terrainHeight(p[0],p[2]),alt:norm([p[0],p[1]+CY,p[2]])-R};};
 const f=(t:number)=>{const v=at(t);return v.alt-relief*v.h;};
 const v0=at(start),v1=at(end);let nodes=0,maxStack=1,discarded=0,earliestUnresolved=null;
 let knownNonpositive=v1.alt-relief*v1.h<=0?end:Infinity;
 const stack=[{a:start,b:end,va:v0,vb:v1}];
 while(stack.length&&nodes<budget){
  const q=stack.pop()!;nodes++;const {a,b,va,vb}=q,m=(a+b)/2,vm=at(m),dt=b-a;
  if(vm.alt-relief*vm.h<=0)knownNonpositive=Math.min(knownNonpositive,m);
  if(knownNonpositive>=a&&knownNonpositive-a<=tolerance){earliestUnresolved={state:'first-root-enclosure-diagnostic',interval:[a,knownNonpositive],clearanceEnds:[va.alt-relief*va.h,f(knownNonpositive)],clearanceMid:vm.alt-relief*vm.h};break;}
  const closest=Math.max(a,Math.min(b,tc)),pc=o.map((v,i)=>v+d[i]*closest);
  const radialMin=norm([pc[0],pc[1]+CY,pc[2]])-R;
  const alongH=LH*Math.hypot(d[0],d[2]);
  const hUpper=Math.min(HMAX,va.h+alongH*dt,vb.h+alongH*dt,vm.h+alongH*dt/2);
  if(radialMin-relief*hUpper>0){discarded++;continue;}
  if(dt<=1e-7){
   const fa=va.alt-relief*va.h,fb=vb.alt-relief*vb.h;
   const state=fa>0&&fb<=0?'first-crossing-bracket-diagnostic':'unresolved-possible-contact';
   earliestUnresolved={state,interval:[a,b],clearanceEnds:[fa,fb],clearanceMid:vm.alt-relief*vm.h};break;
  }
  // Near half first. Never jump to a later sign bracket over unknown intervals.
  stack.push({a:m,b,va:vm,vb});stack.push({a,b:m,va,vb:vm});maxStack=Math.max(maxStack,stack.length);
 }
 return {...pose,sea,relief,search:[start,end],state:earliestUnresolved?.state??(stack.length?'budget-exhausted':'certified-miss-in-mathematical-model-only'),nodes,evaluations,discarded,maxStack,firstPotential:earliestUnresolved,remaining:stack.length,endpointClearance:[v0.alt-relief*v0.h,v1.alt-relief*v1.h]};
}
const witness:Pose={name:'documented-six-pass-failure',origin:[16.4296875,2.9365234375,9.797174393178826e-16],ray:[-.9641481825534892,-.26536443258056197,-5.903704928339342e-17]};
const poses:Pose[]=[witness,{name:'profile-reachable-level-ray',origin:[16,-3,9.797174393178826e-16],ray:[-1,0,-6.123233995736766e-17]}];
// Deliberately small local low-altitude set to find above-sea-horizon terrain.
for(const x of [-16,-8,0,8]){
 const o=clampCameraAboveLandscape([x,-3.8,0]);
 for(const y of [0,.02,.05])poses.push({name:`low-x${x}-dy${y}`,origin:o,ray:ray([-1,y,.1])});
}
const began=performance.now();const results=poses.map(p=>solve(p));
// Dense scan is a witness finder only, not a certificate against thinner roots.
const scan=poses.filter(p=>groundIntersection(p.origin,p.ray)===null).map(p=>{
 let previous=0;for(let t=.025;t<=60;t+=.025){const q=p.origin.map((v,i)=>v+p.ray[i]*t);const f=norm([q[0],q[1]+CY,q[2]])-R-terrainHeight(q[0],q[2]);if(f<0)return {name:p.name,firstDetectedSignBracket:[previous,t],sea:null};previous=t;}return {name:p.name,firstDetectedSignBracket:null,sea:null};});
const report={reachableLevelPose:{target:[0,-3,0],yaw:Math.PI/2,pitch:0,approach:0,aspect:16/9,tanFov:.2867,inspection:0,uv:[.5,.42],comparisonURL:'?seed=72&profile=1&surface=0.4&target=0,-3,0',notes:'Origin and direction constructed from the current OrbitView framing and integrateCloud projection. CPU only; no browser screenshot or GPU confirmation. The other low-x rays are radial-clearance probes, not verified OrbitView framing.'},landscapeSha256:expected,generatedVolumes:0,gpu:false,mathBound:{HMAX,LH,roundingCertified:false},method:'Near-first interval pruning using exact radial minimum plus global mathematical terrain gradient bound; all near leaves without sign proof reported unresolved. Applied to current CPU f32 height only as diagnostic. 1m first-root enclosure tolerance, 0.1mm minimum interval, 4096 node budget. A known nonpositive endpoint/midpoint proves existence only in the continuous mathematical model; prior intervals must be rejected, and earliest unresolved front plus this endpoint enclose the first root. Never equate small residual with root existence.',elapsedMs:performance.now()-began,results,aboveHorizonSignScan:scan};
writeFileSync(new URL('./cost-probe.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({elapsedMs:report.elapsedMs,rays:results.length,counts:results.map(({name,state,nodes,evaluations,firstPotential})=>({name,state,nodes,evaluations,firstPotential})),aboveHorizonScan:scan},null,2));
