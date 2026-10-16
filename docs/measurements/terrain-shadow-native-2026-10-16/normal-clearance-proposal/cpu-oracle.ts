import assert from 'node:assert/strict';
import {Box3,Vector3} from 'three/webgpu';
import {terrainShadowFrame,terrainShadowLookupPoint,terrainShadowProject,terrainShadowCompare} from './after/src/cumulonimbus/TerrainShadow';

const frame=terrainShadowFrame([0,1,0],new Box3(new Vector3(-64,-5,-64),new Vector3(64,4,64)));
const E=frame.radiusKm/frame.resolution;
const rows:any[]=[];
let assertions=0,oldRadialCounterexamples=0,maxDoubleError=0,maxF32Error=0;
function check(value:boolean,label:string){assertions++;assert(value,label);}
function near(a:number,b:number,tol:number,label:string){check(Number.isFinite(a)&&Math.abs(a-b)<=tol,`${label}: ${a} != ${b} ±${tol}`);}
const dot=(a:number[],b:number[])=>a.reduce((s,v,i)=>s+v*b[i],0);
const sub=(a:number[],b:number[])=>a.map((v,i)=>v-b[i]);
const len=(a:number[])=>Math.hypot(...a);
// Independent geometric oracle: signed distance to y=p.y+slopeX*(x-p.x)+slopeZ*(z-p.z).
const planeDistance=(q:number[],p:number[],sx:number,sz:number)=>(q[1]-p[1]-sx*(q[0]-p[0])-sz*(q[2]-p[2]))/Math.hypot(sx,1,sz);

// A deliberately labelled ALU surrogate; not execution of GPU derivatives/WGSL.
const f=Math.fround;
const add=(a:number,b:number)=>f(f(a)+f(b));
const mul=(a:number,b:number)=>f(f(a)*f(b));
const div=(a:number,b:number)=>f(f(a)/f(b));
const dF=(a:number[],b:number[])=>add(add(mul(a[0],b[0]),mul(a[1],b[1])),mul(a[2],b[2]));
const cF=(a:number[],b:number[])=>[f(mul(a[1],b[2])-mul(a[2],b[1])),f(mul(a[2],b[0])-mul(a[0],b[2])),f(mul(a[0],b[1])-mul(a[1],b[0]))];
const scaleF=(a:number[],s:number)=>a.map(v=>mul(v,s));
const nF=(a:number[])=>scaleF(a,f(1/Math.sqrt(dF(a,a))));
function f32Lookup(point:number[],dx:number[],dy:number[]){
 const p=point.map(f),r=nF([p[0],add(p[1],6375),p[2]]);
 const scaled=(v:number[])=>{const a=v.map(f),m=Math.max(...a.map(Math.abs),f(1e-20));return a.map(x=>div(x,m));};
 const g=cF(scaled(dx),scaled(dy)),g2=dF(g,g);
 const raw=scaleF(g,f(1/Math.sqrt(Math.max(g2,f(1e-20))))),a=dF(raw,r),valid=g2>f(1e-20);
 const n=valid?raw.map(v=>a>=0?v:f(-v)):r;
 const c=valid?Math.max(0,Math.min(1,Math.abs(a))):1;
 const extra=mul(f(E),f(1-c));
 return p.map((v,i)=>add(add(v,mul(r[i],f(E))),mul(n[i],extra)));
}

for(const degrees of [0,15,30,45,60,80,89])for(const azimuth of [0,.7,1.8]){
 const sx=Math.tan(degrees*Math.PI/180)*Math.cos(azimuth),sz=Math.tan(degrees*Math.PI/180)*Math.sin(azimuth);
 for(const p of [[0,-4,0],[15,-3,2]])for(const factor of [1,-3,1e30]){
  const dx=[factor,factor*sx,0],dy=[0,factor*sz,factor];
  const actual=terrainShadowLookupPoint(p,frame,dx,dy).toArray(),old=terrainShadowLookupPoint(p,frame).toArray();
  const distance=planeDistance(actual,p,sx,sz),error=Math.abs(distance-E),offset=len(sub(actual,p));
  maxDoubleError=Math.max(maxDoubleError,error);
  near(distance,E,1e-11,'independent plane clearance');
  check(offset<=E*Math.SQRT2+1e-11,'bounded total offset');
  const reversed=terrainShadowLookupPoint(p,frame,dy,dx).toArray();
  check(actual.every((v,i)=>Math.abs(v-reversed[i])<1e-11),'derivative winding invariance');
  const oldDistance=planeDistance(old,p,sx,sz);if(Math.abs(oldDistance-E)>1e-5)oldRadialCounterexamples++;
  const q=f32Lookup(p,dx,dy),f32error=Math.abs(planeDistance(q,p,sx,sz)-E);
  maxF32Error=Math.max(maxF32Error,f32error);
  check(q.every(Number.isFinite),'f32 finite');near(planeDistance(q,p,sx,sz),E,2e-6,'representative local f32 clearance');
  rows.push({degrees,azimuth,point:p,derivativeScale:factor,oldPlaneDistanceKm:oldDistance,newPlaneDistanceKm:distance,offsetKm:offset,f32Lookup:q,f32ErrorKm:f32error});
 }
}
// The tangent plane is radial here: preserve the historical lookup exactly.
const flat=[0,-4,0];
check(JSON.stringify(terrainShadowLookupPoint(flat,frame,[1,0,0],[0,0,1]).toArray())===JSON.stringify(terrainShadowLookupPoint(flat,frame).toArray()),'flat radial exact');
for(const [label,dx,dy] of [
 ['zero',[0,0,0],[0,0,0]],['parallel',[1,2,3],[2,4,6]],['tiny',[1e-30,0,0],[0,0,1e-30]],
] as const){
 const q=terrainShadowLookupPoint(flat,frame,dx,dy).toArray();
 check(JSON.stringify(q)===JSON.stringify(terrainShadowLookupPoint(flat,frame).toArray()),`${label} radial fallback`);
 check(f32Lookup(flat,[...dx],[...dy]).every(Number.isFinite),`${label} f32 finite fallback`);
}
// No all-finite claim depends on an unscaled f32 cross: test extremes through actual safe path.
for(const factor of [1e-38,1e-20,1e-10,1,1e10,1e30,1e38]){
 const dx=[factor,0,0],dy=[0,0,factor];
 const q=f32Lookup([64,-3,-64],dx,dy);
 check(q.every(Number.isFinite),`extreme finite derivative ${factor}`);
}
// Independent two-face crease: each face gets its own one-sided screen basis.
for(const sx of [-4,4]){
 const p=[0,-4,0],q=terrainShadowLookupPoint(p,frame,[1,sx,0],[0,0,1]).toArray();
 near(planeDistance(q,p,sx,0),E,1e-11,'one-sided crease plane clearance');
}
// Projection witness: both UV and solar q come from the same displaced point.
const tilted=terrainShadowFrame([-.668126592347077,.7126683651702156,.21380050955106467],new Box3(new Vector3(-64,-5,-64),new Vector3(64,4,64)));
const p=[0,-4,0],dx=[1,4,0],dy=[0,0,1],q=terrainShadowLookupPoint(p,tilted,dx,dy),projected=terrainShadowProject(q,tilted),relative=sub(q.toArray(),tilted.center.toArray());
near(projected.u,.5+dot(relative,tilted.right.toArray())/128,1e-14,'joint U');
near(projected.v,.5-dot(relative,tilted.up.toArray())/128,1e-14,'joint V');
near(projected.heightKm,dot(relative,tilted.sun.toArray()),1e-14,'joint solar height');
check(Math.abs(projected.u-terrainShadowProject(terrainShadowLookupPoint(p,tilted),tilted).u)>1e-8,'UV genuinely moves');

// Real contact limitation: a horizontal blocker covers both old/new lookup XY.
const slopedPoint=[0,-4,0],d45=[1,1,0],dz=[0,0,1];
const oldPoint=terrainShadowLookupPoint(slopedPoint,frame),newPoint=terrainShadowLookupPoint(slopedPoint,frame,d45,dz);
const oldQ=terrainShadowProject(oldPoint,frame).heightKm,newQ=terrainShadowProject(newPoint,frame).heightKm;
const tall=terrainShadowCompare(newQ,.200-.001,0);
check(tall===0,'separate 200m blocker remains shadowed');
const oldContact=terrainShadowCompare(oldQ,.035-.001,0),newContact=terrainShadowCompare(newQ,.035-.001,0);
check(oldContact===0&&newContact===1,'35m real contact loss is explicit negative evidence');
// A distinct flat face at a different X can win one texel although this receiver is unoccluded.
// This is a declared unresolved multi-face texel counterexample, not a PASS of shadow correctness.
check(terrainShadowCompare(terrainShadowProject(terrainShadowLookupPoint(flat,frame,[1,0,0],[0,0,1]),frame).heightKm,.100-.001,0)===0,'unresolved multi-face texel false shadow remains possible');
check(oldRadialCounterexamples>0,'historical radial control really fails the new geometric plane property');

console.log(JSON.stringify({status:'PASS_NUMERICAL_SCOPE_ONLY',scope:'actual candidate CPU helper + independent planar distance oracle; f32 ALU surrogate is not GPU/WGSL execution',assertions,planeRows:rows.length,maxDoublePlaneErrorKm:maxDoubleError,maxF32PlaneErrorKm:maxF32Error,oldRadialCounterexamples,limits:{real35mContactErased:true,separate200mBlockerPreserved:true,multiFaceTexelFalseShadowNotSolved:true,derivativesUniformityNotCompiled:true,artOrPerformancePass:false},contactWitness:{oldLookup:oldPoint.toArray(),newLookup:newPoint.toArray(),oldQ,newQ,blockerTopKm:.035,storedKm:.034,oldContact,newContact},rows},null,2));
