/** CPU-only canonical bilinear heightfield + min/max hierarchy experiment.
 * This is a new sampled surface, not a conservative bound on procedural terrain.
 * No cloud volume, renderer, dependency install or project source edits. */
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {landscapeSurfaceY,groundIntersection,terrainHeight,coastDistance} from './landscape-source-copy';
const sourcePath='/Users/enuzzo/Library/CloudStorage/Dropbox/Mitnick/Cloudia/src/cumulonimbus/landscape.ts';
const sha=(v:Uint8Array)=>createHash('sha256').update(v).digest('hex');
const expectedLandscapeSha256='72a15a3c6b422405324b2006d94e5074c33eb272bbbe51e123a79eb3b2b90d99';
const landscapeSha256=sha(readFileSync(sourcePath));
const copiedLandscapeSha256=sha(readFileSync(new URL('./landscape-source-copy.ts',import.meta.url)));
if(copiedLandscapeSha256!==landscapeSha256)throw new Error('Pinned local source copy differs from original');
if(landscapeSha256!==expectedLandscapeSha256)throw new Error('Source drift; inspect/re-pin before rerun');
type V=number[];type Range={near:number;far:number};type Level={width:number;lo:Float32Array;hi:Float32Array};
const normalize=(v:V)=>{const r=Math.hypot(...v);return v.map(x=>x/r);};
const cross=(a:V,b:V)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
function slab(origin:V,ray:V,lo:V,hi:V,near=0,far=Infinity):Range|null{
 for(let i=0;i<3;i++){
  if(Math.abs(ray[i])<1e-14){if(origin[i]<lo[i]||origin[i]>hi[i])return null;continue;}
  const a=(lo[i]-origin[i])/ray[i],b=(hi[i]-origin[i])/ray[i];near=Math.max(near,Math.min(a,b));far=Math.min(far,Math.max(a,b));if(far<near)return null;
 }return {near,far};
}
class Grid{
 readonly data:Float32Array;readonly levels:Level[]=[];readonly step:number;authoringHeightEvaluations=0;
 constructor(readonly cells:number,readonly min:number,readonly max:number,author:(x:number,z:number)=>number){
  this.step=(max-min)/cells;this.data=new Float32Array((cells+1)**2);
  for(let z=0;z<=cells;z++)for(let x=0;x<=cells;x++){this.authoringHeightEvaluations++;this.data[z*(cells+1)+x]=author(min+x*this.step,min+z*this.step);}
  let width=cells,lo=new Float32Array(width*width),hi=new Float32Array(width*width);
  for(let z=0;z<width;z++)for(let x=0;x<width;x++){const a=this.corners(x,z);lo[z*width+x]=Math.min(...a);hi[z*width+x]=Math.max(...a);}
  this.levels.push({width,lo,hi});
  while(width>1){const next=width/2,nlo=new Float32Array(next*next),nhi=new Float32Array(next*next);for(let z=0;z<next;z++)for(let x=0;x<next;x++){const a=[z*2*width+x*2,z*2*width+x*2+1,(z*2+1)*width+x*2,(z*2+1)*width+x*2+1];nlo[z*next+x]=Math.min(...a.map(i=>lo[i]));nhi[z*next+x]=Math.max(...a.map(i=>hi[i]));}width=next;lo=nlo;hi=nhi;this.levels.push({width,lo,hi});}
 }
 corners(x:number,z:number){const a=z*(this.cells+1)+x;return [this.data[a],this.data[a+1],this.data[a+this.cells+1],this.data[a+this.cells+2]];}
 sample(x:number,z:number){const gx=(x-this.min)/this.step,gz=(z-this.min)/this.step,ix=Math.max(0,Math.min(this.cells-1,Math.floor(gx))),iz=Math.max(0,Math.min(this.cells-1,Math.floor(gz))),u=gx-ix,v=gz-iz,[a,b,c,d]=this.corners(ix,iz);return a*(1-u)*(1-v)+b*u*(1-v)+c*(1-u)*v+d*u*v;}
 cellHit(origin:V,ray:V,x:number,z:number,range:Range):number|null{
  const p=origin.map((v,i)=>v+ray[i]*range.near),u=(p[0]-this.min)/this.step-x,v=(p[2]-this.min)/this.step-z,du=ray[0]/this.step,dv=ray[2]/this.step;
  const [h00,h10,h01,h11]=this.corners(x,z),b=h10-h00,c=h01-h00,d=h11-h10-h01+h00;
  const A=-d*du*dv,B=ray[1]-b*du-c*dv-d*(u*dv+v*du),C=p[1]-h00-b*u-c*v-d*u*v,span=range.far-range.near;
  const roots:number[]=[];
  if(Math.abs(A)<1e-13*Math.max(1,Math.abs(B),Math.abs(C))){if(Math.abs(B)>1e-14)roots.push(-C/B);else if(Math.abs(C)<1e-10)roots.push(0);}
  else{let disc=B*B-4*A*C;const tol=1e-13*(B*B+Math.abs(4*A*C)+1);if(disc>=-tol){disc=Math.max(0,disc);const q=-.5*(B+(B>=0?1:-1)*Math.sqrt(disc));if(q===0)roots.push(-B/(2*A));else roots.push(q/A,C/q);}}
  const good=roots.filter(s=>s>=-1e-8&&s<=span+1e-8).sort((a,b)=>a-b);
  return good.length?range.near+Math.max(0,Math.min(span,good[0])):null;
 }
 trace(origin:V,ray:V,budget=4096){
  const top=this.levels.length-1,L=this.levels[top],root=slab(origin,ray,[this.min,L.lo[0],this.min],[this.max,L.hi[0],this.max]);
  const stats={boundChecks:1,visitedNodes:0,leafTests:0,queryTerrainHeightEvaluations:0,fieldCornerReads:0,maxStack:0};
  if(!root)return {status:'miss-in-domain',distance:null,unresolvedNear:null,stats};
  const stack=[{level:top,x:0,z:0,...root}];let best:number|null=null;
  while(stack.length){
   stack.sort((a,b)=>b.near-a.near);const n=stack.pop()!;if(best!==null&&n.near>best+1e-8)continue;
   if(stats.visitedNodes>=budget)return {status:'unresolved',distance:null,provisionalHit:best,unresolvedNear:n.near,stats};
   stats.visitedNodes++;stats.maxStack=Math.max(stats.maxStack,stack.length+1);
   if(n.level===0){stats.leafTests++;stats.fieldCornerReads+=4;const hit=this.cellHit(origin,ray,n.x,n.z,n);if(hit!==null&&(best===null||hit<best))best=hit;continue;}
   const next=this.levels[n.level-1],span=this.step*2**(n.level-1);
   for(let dz=0;dz<2;dz++)for(let dx=0;dx<2;dx++){
    const x=n.x*2+dx,z=n.z*2+dz,index=z*next.width+x;stats.boundChecks++;
    const r=slab(origin,ray,[this.min+x*span,next.lo[index],this.min+z*span],[this.min+(x+1)*span,next.hi[index],this.min+(z+1)*span],n.near,Math.min(n.far,best??Infinity));
    if(r)stack.push({level:n.level-1,x,z,...r});
   }
  }
  return {status:best===null?'miss-in-domain':'hit',distance:best,unresolvedNear:null,stats};
 }
 referenceDDA(origin:V,ray:V){
  const box=slab(origin,ray,[this.min,-Infinity,this.min],[this.max,Infinity,this.max]);if(!box)return {distance:null,leafTests:0};
  let entry=box.near,count=0;const p=origin.map((v,i)=>v+ray[i]*entry),gx=(p[0]-this.min)/this.step,gz=(p[2]-this.min)/this.step;
  let x=Math.floor(gx),z=Math.floor(gz);if(ray[0]<0&&Math.abs(gx-Math.round(gx))<1e-10)x=Math.round(gx)-1;if(ray[2]<0&&Math.abs(gz-Math.round(gz))<1e-10)z=Math.round(gz)-1;
  x=Math.max(0,Math.min(this.cells-1,x));z=Math.max(0,Math.min(this.cells-1,z));
  while(x>=0&&x<this.cells&&z>=0&&z<this.cells&&entry<=box.far&&count<=this.cells*2+2){
   const tx=Math.abs(ray[0])<1e-14?Infinity:(this.min+(x+(ray[0]>0?1:0))*this.step-origin[0])/ray[0];
   const tz=Math.abs(ray[2])<1e-14?Infinity:(this.min+(z+(ray[2]>0?1:0))*this.step-origin[2])/ray[2];
   const exit=Math.min(tx,tz,box.far);count++;const hit=this.cellHit(origin,ray,x,z,{near:entry,far:exit});if(hit!==null)return {distance:hit,leafTests:count};
   if(!Number.isFinite(exit))break;entry=exit;if(tx<=tz+1e-10)x+=ray[0]>0?1:-1;if(tz<=tx+1e-10)z+=ray[2]>0?1:-1;
  }
  return {distance:null,leafTests:count};
 }
}
const requestedCells=Number(process.argv[3]??512);if(!Number.isInteger(requestedCells)||requestedCells<16||requestedCells>1024||(requestedCells&(requestedCells-1)))throw new Error('Expected power-of-two grid16..1024');
const start=performance.now(),gridStart=performance.now(),grid=new Grid(requestedCells,-32,32,(x,z)=>landscapeSurfaceY(x,z)),buildMs=performance.now()-gridStart;
const cases=[
 {name:'six-pass-regression',origin:[16.4296875,2.9365234375,9.797174393178826e-16],ray:[-.9641481825534892,-.26536443258056197,-5.903704928339342e-17]},
 {name:'mountain-with-no-sea-hit',origin:[16.4296875,-3.8,0],ray:[-1,0,0]},
 {name:'negative-cell-vertical',origin:[-5,2.9365234375,0],ray:[0,-1,0]},
 {name:'grid-boundary-vertical',origin:[0,2.9365234375,0],ray:[0,-1,0]},
 {name:'upward-miss-domain-only',origin:[16,2.9365234375,0],ray:[0,1,0]},
].map(c=>{const hit=grid.trace(c.origin,c.ray),reference=grid.referenceDDA(c.origin,c.ray),budgeted=grid.trace(c.origin,c.ray,8);if(hit.status==='unresolved'||(hit.distance===null)!==(reference.distance===null)||hit.distance!==null&&Math.abs(hit.distance-reference.distance!)>1e-6)throw new Error('Hierarchy/DDA mismatch '+c.name);return {...c,seaDistance:groundIntersection(c.origin,c.ray),hit,reference,budget8:budgeted,analyticSurfaceClearanceMetres:hit.distance===null?null:(()=>{const p=c.origin.map((v,i)=>v+c.ray[i]*hit.distance!);return (Math.hypot(p[0],p[1]+6375,p[2])-6371-terrainHeight(p[0],p[2]))*1000;})()};});
const saddle=new Grid(1,0,1,(x,z)=>-x*z),twoRootRay=normalize([1,-1,1]),twoRootOrigin=[0,.1875,0],twoRoot=saddle.trace(twoRootOrigin,twoRootRay),tangent=saddle.trace([0,.25,0],twoRootRay);
if(twoRoot.distance===null||Math.abs(twoRoot.distance-Math.sqrt(3)*.25)>1e-8||tangent.distance===null||Math.abs(tangent.distance-Math.sqrt(3)*.5)>1e-8)throw new Error('Bilinear root self-check failed');
const probeStart=performance.now(),probes:any[]=[];
for(const origin of [[.4296875,2.9365234375,16],[16.4296875,2.9365234375,0],[-15.5703125,2.9365234375,0],[16.4296875,-3.8,0]]){
 const target=origin[1]<0?[-10,-3.8,0]:[.4296875,2.9365234375,0],forward=normalize(target.map((v,i)=>v-origin[i])),right=normalize(cross(forward,[0,1,0])),up=normalize(cross(right,forward));
 for(let y=0;y<9;y++)for(let x=0;x<9;x++){const sx=(x/8*2-1),sy=(1-y/8*2)-.16,ray=normalize(forward.map((v,i)=>v+right[i]*sx*(16/9)*.2867+up[i]*sy*.2867)),hit=grid.trace(origin,ray,4096),reference=grid.referenceDDA(origin,ray),budget64=grid.trace(origin,ray,64);if(hit.status==='unresolved'||(hit.distance===null)!==(reference.distance===null)||hit.distance!==null&&Math.abs(hit.distance-reference.distance!)>1e-6)throw new Error('Probe hierarchy/DDA mismatch');probes.push({origin,uv:[x/8,y/8],status:hit.status,stats:hit.stats,referenceLeafTests:reference.leafTests,budget64Status:budget64.status});}
}
const measure=(key:string)=>{const v=probes.map(p=>p.stats[key]).sort((a,b)=>a-b);return {mean:v.reduce((s,x)=>s+x,0)/v.length,p95:v[Math.floor(.95*(v.length-1))],max:v[v.length-1]};};
const probeMs=performance.now()-probeStart,errorStarted=performance.now();
const halton=(index:number,base:number)=>{let value=0,scale=1;while(index>0){scale/=base;value+=(index%base)*scale;index=Math.floor(index/base);}return value;};
const errors:{x:number;z:number;errorMetres:number;coastKm:number;group:string}[]=[];
const appendError=(x:number,z:number,group:string)=>{x=Math.fround(x);z=Math.fround(z);errors.push({x,z,errorMetres:(grid.sample(x,z)-landscapeSurfaceY(x,z))*1000,coastKm:coastDistance(x,z),group});};
for(let i=1;i<=10000;i++){appendError(grid.min+(grid.max-grid.min)*halton(i,2),grid.min+(grid.max-grid.min)*halton(i,3),'interior64km-halton');appendError(-16+32*halton(i,2),-16+32*halton(i,3),'interior32km-halton');}
for(let i=0;i<2048;i++){const q=grid.min+(i+.5)/2048*(grid.max-grid.min);appendError(q,q,'diagonal-plus');appendError(q,-q,'diagonal-minus');}
function errorStats(values:typeof errors){if(!values.length)return null;const a=values.map(v=>Math.abs(v.errorMetres)).sort((x,y)=>x-y);return {count:values.length,meanSignedMetres:values.reduce((s,v)=>s+v.errorMetres,0)/values.length,rmsMetres:Math.sqrt(values.reduce((s,v)=>s+v.errorMetres**2,0)/values.length),maxAbsoluteMetres:a.at(-1),p95AbsoluteMetres:a[Math.floor(.95*(a.length-1))],p99AbsoluteMetres:a[Math.floor(.99*(a.length-1))]};}
const representationError={method:'Canonical R32F bilinear world-Y minus original procedural radial surface converted to world-Y. Same quantized-f32 query x/z in both. Deterministic Halton2/3 points plus two diagonals. This measures approximation, not certified analytic containment, image fidelity or GPU precision.',analyticHeightEvaluations:errors.length,all:errorStats(errors),interior64km:errorStats(errors.filter(v=>v.group==='interior64km-halton')),interior32km:errorStats(errors.filter(v=>v.group==='interior32km-halton')),diagonalPlus:errorStats(errors.filter(v=>v.group==='diagonal-plus')),diagonalMinus:errorStats(errors.filter(v=>v.group==='diagonal-minus')),coastTransition:errorStats(errors.filter(v=>v.coastKm>=0&&v.coastKm<=13)),shoreline:errorStats(errors.filter(v=>Math.abs(v.coastKm)<=1)),deepInland:errorStats(errors.filter(v=>v.coastKm>13)),sea:errorStats(errors.filter(v=>v.coastKm<0)),worst:errors.toSorted((a,b)=>Math.abs(b.errorMetres)-Math.abs(a.errorMetres)).slice(0,10)};
const errorMs=performance.now()-errorStarted;
const report={copiedLandscapeSha256,representationError,errorMs,method:'CPU-only prototype. Canonical sampled R32F world-Y grid, bilinear within cells; source analytic terrain is only used for authoring and model-error reporting. Quadtree min/max bounds are exact for that sampled interpolant, not bounds for the original analytic function. Front-to-back bounds, both quadratic roots, nearest eligible root, and explicit unresolved on budget exhaustion. Finite local patch only; a miss-in-domain is not a global planet miss. DDA reference enumerates cells using the same leaf solver, so agreement validates hierarchy/traversal, not an independent leaf-root implementation. Independent closed forms cover two-root/tangent fixtures only. No cloud/GPU/performance/sharpness claim.',landscapeSha256,scriptSha256:sha(readFileSync(import.meta.path)),generatedCloudVolumes:0,grid:{cells:grid.cells,min:grid.min,max:grid.max,stepKm:grid.step,authoringHeightEvaluations:grid.authoringHeightEvaluations,heightBytes:grid.data.byteLength,hierarchyBytes:grid.levels.reduce((s,l)=>s+l.lo.byteLength+l.hi.byteLength,0),levels:grid.levels.length},buildMs,probeMs,cases,mathChecks:{twoForwardRootsExpected:[Math.sqrt(3)*.25,Math.sqrt(3)*.75],nearest:twoRoot.distance,tangentExpected:Math.sqrt(3)*.5,tangent:tangent.distance},probeSummary:{rays:probes.length,hits:probes.filter(p=>p.status==='hit').length,missesInDomain:probes.filter(p=>p.status==='miss-in-domain').length,unresolved:probes.filter(p=>p.status==='unresolved').length,budget64Unresolved:probes.filter(p=>p.budget64Status==='unresolved').length,boundChecks:measure('boundChecks'),visitedNodes:measure('visitedNodes'),leafTests:measure('leafTests'),maxStack:measure('maxStack'),referenceDDAmeanLeafTests:probes.reduce((s,p)=>s+p.referenceLeafTests,0)/probes.length},durationMs:performance.now()-start};
const output=process.argv[2]??new URL('./terrain-heightfield-prototype.json',import.meta.url);writeFileSync(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({output:String(output),grid:report.grid,buildMs,probeMs,errorMs,durationMs:report.durationMs,representationError,cases:cases.map(c=>({name:c.name,seaDistance:c.seaDistance,hit:c.hit,reference:c.reference,analyticSurfaceClearanceMetres:c.analyticSurfaceClearanceMetres})),probeSummary:report.probeSummary},null,2));
