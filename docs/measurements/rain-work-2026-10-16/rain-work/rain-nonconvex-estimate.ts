/** Renderer-loop CPU work reference. Reads cached arrays; never generates a volume. */
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {sampleDetail,sampleCloudDensity,BOUNDS_MIN,BOUNDS_SIZE} from '/Users/enuzzo/Library/CloudStorage/Dropbox/Mitnick/Cloudia/src/cumulonimbus/volume.ts';
import {referencePosition} from '/Users/enuzzo/Library/CloudStorage/Dropbox/Mitnick/Cloudia/src/cumulonimbus/motion.ts';
import {sampleMotionField} from '/Users/enuzzo/Library/CloudStorage/Dropbox/Mitnick/Cloudia/src/cumulonimbus/motionField.ts';
import {precipitationSurvival,RAIN_EXTINCTION,RAIN_SAMPLE_STEP} from '/Users/enuzzo/Library/CloudStorage/Dropbox/Mitnick/Cloudia/src/cumulonimbus/precipitation.ts';
import {conservativeEmptyStep} from '/Users/enuzzo/Library/CloudStorage/Dropbox/Mitnick/Cloudia/src/cumulonimbus/emptyTraversal.ts';
import {terrainHeight} from '/Users/enuzzo/Library/CloudStorage/Dropbox/Mitnick/Cloudia/src/cumulonimbus/landscape.ts';
const base='/Users/enuzzo/Documents/Codex/Cloudia-QA-2026-10-16-cycle10/rain-work';
const repo='/Users/enuzzo/Library/CloudStorage/Dropbox/Mitnick/Cloudia';
const sha=(v:Uint8Array|string)=>createHash('sha256').update(v).digest('hex');
const manifest=JSON.parse(readFileSync(base+'/data/manifest.json','utf8'));
const pose=JSON.parse(readFileSync(base+'/input-control.json','utf8'));
const width=Number(process.argv[2]??16),height=Number(process.argv[3]??9);
if(![16,32].includes(width)||height!==width*9/16)throw new Error('Allowed grids16x9 or32x18.');
const required=['volume','motion','motionField','precipitation','emptyTraversal','landscape','cloudShader'];
const sourceHashes=Object.fromEntries(Object.keys(manifest.sourceHashesAfter).map(n=>[n,sha(readFileSync(repo+'/src/cumulonimbus/'+n+'.ts'))]));
const changedSinceBake=Object.keys(sourceHashes).filter(n=>sourceHashes[n]!==manifest.sourceHashesAfter[n]);
if(required.some(n=>changedSinceBake.includes(n)))throw new Error('A model source changed since the cached bake: '+changedSinceBake.join(','));
function binary(name:string){
 const bytes=readFileSync(base+'/data/'+name),ref=manifest.files[name];
 if(bytes.byteLength!==ref.bytes||sha(bytes)!==ref.sha256)throw new Error('Cached data mismatch: '+name);
 return bytes;
}
const macro={size:256,data:binary('macro-rgba8.bin')},detail={size:128,data:binary('detail-rgba8.bin')},rain=binary('rain-rg8.bin'),flowBytes=binary('flow-rgba16f.bin');
const field=new Uint16Array(flowBytes.buffer,flowBytes.byteOffset,flowBytes.byteLength/2),state=manifest.state;
const f=Math.fround,add=(a:number,b:number)=>f(f(a)+f(b)),sub=(a:number,b:number)=>f(f(a)-f(b)),mul=(a:number,b:number)=>f(f(a)*f(b)),div=(a:number,b:number)=>f(f(a)/f(b));
const clamp=(v:number,a=0,b=1)=>Math.max(a,Math.min(b,v));
const smooth=(a:number,b:number,x:number)=>{const t=f(clamp(div(sub(x,a),sub(b,a))));return mul(mul(t,t),sub(3,mul(2,t)));};
const fract=(v:number)=>sub(v,Math.floor(v));
const dot=(a:number[],b:number[])=>a.reduce((s,v,i)=>add(s,mul(v,b[i])),0);
const normalizeDouble=(v:number[])=>{const n=Math.hypot(...v);return v.map(x=>x/n);};
const normalizeF32=(v:number[])=>{const n=f(Math.sqrt(dot(v,v)));return v.map(x=>div(x,n));};
const cross=(a:number[],b:number[])=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const time=60,rainTime=0,windStrength=.55,seedPhase=(72%71)/71*.35;
const wind=[windStrength*(.52+.23*Math.sin(time*.055+seedPhase*3)),windStrength*.26*Math.sin(time*.031+.6)].map(f);
const drift=[windStrength*(.32*Math.sin(time*.027)+.11*Math.sin(time*.071)),Math.sin(time*.04)*.015,0].map(f);
const growth=[1/state.height,1/state.width,1/state.anvil].map(f),iceRange=manifest.iceRange.map(f);
const origin=pose.camera.origin.map(f),forwardDouble=normalizeDouble(pose.camera.target.map((v:number,i:number)=>v-pose.camera.origin[i]));
const rightDouble=normalizeDouble(cross(forwardDouble,[0,1,0])),upDouble=normalizeDouble(cross(rightDouble,forwardDouble));
const forward=forwardDouble.map(f),right=rightDouble.map(f),up=upDouble.map(f);
const resolution=pose.output,aspect=f(resolution[0]/resolution[1]),tanFov=f(.2867),inspection=f(pose.camera.approach);
if(inspection!==0||pose.weather.dispersion!==0||pose.flashCountStart!==0)throw new Error('This focused counter requires inspection0/dispersion0/no-flash.');
const stepSize=f(7/384),supportMin=pose.supportBounds.min.map(f),supportMax=pose.supportBounds.max.map(f);
const emptyStep=f(conservativeEmptyStep(7/384,state,wind,iceRange,Math.max(Math.abs(pose.supportBounds.min[0]),Math.abs(pose.supportBounds.max[0]))));
const rainBounds=manifest.rainBounds.map(f),rainAmount=f(pose.weather.rain),hasRain=rainAmount>f(.001)&&rainBounds[2]>rainBounds[0]&&rainBounds[3]>rainBounds[1];
const rainMin=[add(div(rainBounds[0],growth[1]),Math.min(mul(wind[0],2.5),0)),-4.75,add(div(rainBounds[1],growth[1]),Math.min(mul(wind[1],2.5),0))];
const rainMax=[add(div(rainBounds[2],growth[1]),Math.max(mul(wind[0],2.5),0)),2.8,add(div(rainBounds[3],growth[1]),Math.max(mul(wind[1],2.5),0))];
const worldRainMin=rainMin.map((v,i)=>add(v,drift[i])),worldRainMax=rainMax.map((v,i)=>add(v,drift[i]));
const lower=supportMin.map((v,i)=>Math.min(add(v,drift[i]),hasRain?worldRainMin[i]:add(v,drift[i])));
const upper=supportMax.map((v,i)=>Math.max(add(v,drift[i]),hasRain?worldRainMax[i]:add(v,drift[i])));
const fineInset=.5/128,flow=new Float64Array(4),ground=pose.camera.ground;
function interval(ray:number[],lo:number[],hi:number[]){
 const a=lo.map((v,i)=>mul(sub(v,origin[i]),div(1,ray[i]))),b=hi.map((v,i)=>mul(sub(v,origin[i]),div(1,ray[i])));
 return [Math.max(0,...a.map((v,i)=>Math.min(v,b[i]))),Math.min(...a.map((v,i)=>Math.max(v,b[i])))];
}
function groundDistance(ray:number[],stats:any){
 const o=[origin[0],add(origin[1],6375),origin[2]],b=dot(o,ray),c=sub(dot(o,o),f(6371*6371)),d=sub(mul(b,b),c);
 if(d<0){stats.seaMissRays++;return 10000;}
 const sea=sub(-b,f(Math.sqrt(d)));
 if(!(sea>0)||ground<=f(.001)){stats.seaMissRays++;return 10000;}
 stats.seaHitRays++;
 const relief=sub(1,smooth(90,180,sea));if(relief<=0)return sea;
 let t=sea;
 for(let i=0;i<6;i++){
  stats.terrainHeightCalls++;const p=origin.map((v,k)=>add(v,mul(ray[k],t))),rad=[p[0],add(p[1],6375),p[2]],len=f(Math.sqrt(dot(rad,rad)));
  const clearance=sub(sub(len,6371),mul(f(terrainHeight(p[0],p[2])),relief));
  const incidence=Math.min(f(-.045),dot(rad.map(v=>div(v,len)),ray));t=f(clamp(sub(t,div(clearance,incidence)),0,sea));
 }
 return t;
}
function sampleRain(u:number,v:number){
 const x=clamp(u)*64-.5,z=clamp(v)*64-.5,x0=Math.floor(x),z0=Math.floor(z),fx=x-x0,fz=z-z0;
 let r=0,g=0;
 for(let dz=0;dz<2;dz++)for(let dx=0;dx<2;dx++){
  const at=(clamp(z0+dz,0,63)*64+clamp(x0+dx,0,63))*2,w=(dx?fx:1-fx)*(dz?fz:1-fz);
  r+=rain[at]/255*w;g+=rain[at+1]/255*w;
 }
 return [f(r),f(g)];
}
// Material support octagon from cycle9; geometric opportunity only, not a new march.
const diagonalBounds=[Infinity,-Infinity,Infinity,-Infinity];
for(let z=0;z<64;z++)for(let x=0;x<64;x++)if(rain[(z*64+x)*2]>0){
 const cx=-5+(x+.5)*10/64,cz=-3.5+(z+.5)*7/64,pad=17/64;
 diagonalBounds[0]=Math.min(diagonalBounds[0],cx+cz-pad);diagonalBounds[1]=Math.max(diagonalBounds[1],cx+cz+pad);
 diagonalBounds[2]=Math.min(diagonalBounds[2],cx-cz-pad);diagonalBounds[3]=Math.max(diagonalBounds[3],cx-cz+pad);
}
function prismInterval(ray:number[],near:number,far:number){
 let lo=near,hi=far;const rp=origin.map((v,i)=>sub(v,drift[i]));
 for(let k=0;k<2;k++){
  const sign=k===0?1:-1,o=rp[0]+sign*rp[2],d=ray[0]+sign*ray[2],w=wind[0]+sign*wind[1];
  const a=diagonalBounds[k*2]/growth[1]+Math.min(0,2.5*w),b=diagonalBounds[k*2+1]/growth[1]+Math.max(0,2.5*w);
  if(d===0){if(o<a||o>b)return null;}
  else{const x=(a-o)/d,y=(b-o)/d;lo=Math.max(lo,Math.min(x,y));hi=Math.min(hi,Math.max(x,y));}
  if(hi<=lo)return null;
 }
 return [lo,hi];
}

// Extra diagnostic: conservative polygon/cell raster + exact discrete L-infinity distance.
// Geometry only; no product optimizer, native GPU arithmetic or new bake.
function hull2(points:number[][]){
 const p=points.sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
 const cross2=(a:number[],b:number[],c:number[])=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
 const lo:number[][]=[],hi:number[][]=[];
 for(const a of p){while(lo.length>=2&&cross2(lo.at(-2)!,lo.at(-1)!,a)<=0)lo.pop();lo.push(a);}
 for(const a of p.slice().reverse()){while(hi.length>=2&&cross2(hi.at(-2)!,hi.at(-1)!,a)<=0)hi.pop();hi.push(a);}
 return lo.slice(0,-1).concat(hi.slice(0,-1));
}
function overlap(poly:number[][],lo:number[],hi:number[]){
 let p=poly;
 for(let axis=0;axis<2;axis++)for(const side of [0,1]){
  const v=side?hi[axis]:lo[axis],inside=(a:number[])=>side?a[axis]<=v:a[axis]>=v;
  const out:number[][]=[];
  for(let i=0;i<p.length;i++){
   const a=p[i],b=p[(i+1)%p.length],ia=inside(a),ib=inside(b);
   if(ia)out.push(a);
   if(ia!==ib){const t=(v-a[axis])/(b[axis]-a[axis]);out.push(a.map((x,k)=>x+(b[k]-x)*t));}
  }
  p=out;if(p.length===0)return false;
 }
 return true;
}
const gridBuildStart=performance.now();
const nonconvexGrids=[64,128].map(N=>{
 const pad=.001,B=wind.map(v=>v*2.5*growth[1]); //1m material pad is diagnostic, not GPU proof.
 const lo=[rainBounds[0]+Math.min(0,B[0])-pad,rainBounds[1]+Math.min(0,B[1])-pad];
 const hi=[rainBounds[2]+Math.max(0,B[0])+pad,rainBounds[3]+Math.max(0,B[1])+pad];
 const cell=hi.map((v,k)=>(v-lo[k])/N),occ=new Uint8Array(N*N);
 let polygonCellTests=0;
 for(let z=0;z<64;z++)for(let x=0;x<64;x++)if(rain[(z*64+x)*2]>0){
  const a=[-5+Math.max(0,(x-.5)/64)*10-pad,-3.5+Math.max(0,(z-.5)/64)*7-pad];
  const b=[-5+Math.min(1,(x+1.5)/64)*10+pad,-3.5+Math.min(1,(z+1.5)/64)*7+pad];
  const corners=[[a[0],a[1]],[a[0],b[1]],[b[0],a[1]],[b[0],b[1]]];
  const poly=hull2(corners.concat(corners.map(p=>p.map((v,k)=>v+B[k]))));
  const pmin=[0,1].map(k=>Math.min(...poly.map(p=>p[k]))),pmax=[0,1].map(k=>Math.max(...poly.map(p=>p[k])));
  const imin=pmin.map((v,k)=>Math.max(0,Math.floor((v-lo[k])/cell[k]))),imax=pmax.map((v,k)=>Math.min(N-1,Math.floor((v-lo[k])/cell[k])));
  for(let j=imin[1];j<=imax[1];j++)for(let i=imin[0];i<=imax[0];i++){
   if(occ[j*N+i])continue;polygonCellTests++;
   if(overlap(poly,[lo[0]+i*cell[0],lo[1]+j*cell[1]],[lo[0]+(i+1)*cell[0],lo[1]+(j+1)*cell[1]]))occ[j*N+i]=1;
  }
 }
 const rawOccupied=occ.reduce((a,b)=>a+b,0);
 // Mark border occupied: do not infer anything about out-of-grid address mode.
 for(let i=0;i<N;i++){occ[i]=1;occ[(N-1)*N+i]=1;occ[i*N]=1;occ[i*N+N-1]=1;}
 const dist=Uint8Array.from(occ,v=>v?0:254);
 for(let y=0;y<N;y++)for(let x=0;x<N;x++)for(const [dx,dy] of [[-1,0],[-1,-1],[0,-1],[1,-1]]){
  const xx=x+dx,yy=y+dy;if(xx>=0&&xx<N&&yy>=0&&yy<N)dist[y*N+x]=Math.min(dist[y*N+x],dist[yy*N+xx]+1);
 }
 for(let y=N-1;y>=0;y--)for(let x=N-1;x>=0;x--)for(const [dx,dy] of [[1,0],[1,1],[0,1],[-1,1]]){
  const xx=x+dx,yy=y+dy;if(xx>=0&&xx<N&&yy>=0&&yy<N)dist[y*N+x]=Math.min(dist[y*N+x],dist[yy*N+xx]+1);
 }
 return {N,lo,hi,cell,dist,rawOccupied,paddedOccupied:occ.reduce((a,b)=>a+b,0),polygonCellTests,
  occupiedAreaKm2:rawOccupied*cell[0]*cell[1]/growth[1]**2,textureBytes:N*N,
  point:{queries:0,empty:0,emptyMask0:0,falsePositiveR:0,falsePositiveRain:0},
  batch:{queries:0,certificates:0,following:0,removedCalls:0,falseSamples:0,partialRejected:0,maxFollowing:0}};
});
const nonconvexGridBuildMs=performance.now()-gridBuildStart;
function gridCertificate(grid:any,rp:number[],ray:number[],H:number){
 const m=[rp[0]*growth[1],rp[2]*growth[1]],ij=m.map((v,k)=>Math.floor((v-grid.lo[k])/grid.cell[k]));
 if(ij.some(v=>v<0||v>=grid.N))return {empty:false,whole:false};
 const d=grid.dist[ij[1]*grid.N+ij[0]];if(d===0)return {empty:false,whole:false};
 const r=d-1,L=ij.map((v,k)=>grid.lo[k]+(v-r)*grid.cell[k]),U=ij.map((v,k)=>grid.lo[k]+(v+r+1)*grid.cell[k]);
 const end=[m[0]+growth[1]*ray[0]*H,m[1]+growth[1]*ray[2]*H],eps=.001;
 const whole=m.every((v,k)=>Math.min(v,end[k])>=L[k]+eps&&Math.max(v,end[k])<=U[k]-eps);
 return {empty:true,whole};
}

type Counts=Record<string,number>;
const zero=():Counts=>Object.fromEntries(['iterations','supportZero','supportPositive','rainRegion','rainOutsideUV','rainRZero','rainRPositive','rainAttachedZero','rainEvaporationZero','rainPositive','cloudWarpedPass','cloudPositive','bothPositive','bothExtinctionZero','maskZeroRainExtinctionZero','maskZeroInRain','maskZeroRainExtinctionZeroInRain','maskZeroRainEvaporationZero','rainRPositiveOutsidePrism','rainPositiveOutsidePrism','maskZeroRainRZero','maskZeroRainOutsideUV','maskZeroRainAttachedZero','visitedOutsidePrism','maskZeroOutsidePrism','opacityChanged','stepNonPositive','zeroMediumLengthKm','rainRegionLengthKm','outsidePrismLengthKm'].map(k=>[k,0]));
const lookupZero=():Counts=>Object.fromEntries(['cloudMask3D','flow3D','fineRGB3D','macroDensity3D','iceBend3D','iceDetailRGB3D','micro3D','macroLightGBA3D','sunsetRG3D','rainGuessG2D','rainColumnRG2D','rainSheetsG3D','rainStreakR3D'].map(k=>[k,0]));
const sumInto=(a:Counts,b:Counts)=>{for(const k in b)a[k]=(a[k]??0)+b[k];};
const sumValues=(a:Counts)=>Object.values(a).reduce((s,n)=>s+n,0);
const sourceHashesBefore=sourceHashes,started=performance.now();
const allCounts=zero(),allLookups=lookupZero(),rays:any[]=[];
const stats={seaMissRays:0,seaHitRays:0,terrainHeightCalls:0,noBoxHitRays:0,opacityExitRays:0,farExitRays:0,budgetExitRays:0,nonPositiveStepExitRays:0};
const batch={certificates:0,subsequentSamplesAvoidable:0,subsequentLookupsAvoidable:0,startRainLookupsAvoidable:0,certificateFalseSamples:0,maximumSubsequentSamples:0,geometricOnly:true,proposalApplied:false};
let rawSequenceHash=createHash('sha256');
for(let gy=0;gy<height;gy++)for(let gx=0;gx<width;gx++){
 const px=Math.floor((gx+.5)*resolution[0]/width),py=Math.floor((gy+.5)*resolution[1]/height);
 const uv=[f((px+.5)/resolution[0]),f((py+.5)/resolution[1])];
 const screen=[sub(mul(uv[0],2),1),sub(sub(1,mul(uv[1],2)),mul(.16,sub(1,inspection)))];
 const ray=normalizeF32(forward.map((v,i)=>add(add(v,mul(right[i],mul(mul(screen[0],aspect),tanFov))),mul(up[i],mul(screen[1],tanFov)))));
 const groundFar=groundDistance(ray,stats),box=interval(ray,lower,upper),rainBox=interval(ray,worldRainMin,worldRainMax);
 const near=box[0],far=Math.min(groundFar,box[1]),rainNear=rainBox[0],rainFar=Math.min(groundFar,rainBox[1]);
 const poly=prismInterval(ray,rainNear,rainFar),counts=zero(),lookups=lookupZero(),samples:any[]=[];
 const hashPixel=[Math.floor(mul(uv[0],resolution[0])),Math.floor(mul(uv[1],resolution[1]))];
 const jitter=fract(mul(52.9829189,fract(add(mul(hashPixel[0],.06711056),mul(hashPixel[1],.00583715)))));
 const entryStep=stepSize;
 let t=add(near,mul(Math.min(entryStep,hasRain?f(RAIN_SAMPLE_STEP):entryStep),jitter));
 if(hasRain&&near<rainNear)t=Math.min(t,rainNear);
 let T=1,exit='far',iterations=0;
 if(far<=near){stats.noBoxHitRays++;exit='no-box';}
 else for(let i=0;i<8192;i++){
  if(t>=far){exit='far';break;}if(T<f(.006)){exit='opacity';break;}
  iterations++;counts.iterations++;
  const p=origin.map((v,k)=>add(v,mul(ray[k],t))),rp=p.map((v,k)=>sub(v,drift[k]));
  const ref=referencePosition(rp,state,iceRange,wind).map(f),coord=ref.map((v,k)=>div(sub(v,BOUNDS_MIN[k]),BOUNDS_SIZE[k]));
  const support=sampleDetail(detail,...coord.map(v=>clamp(v,fineInset,1-fineInset)) as [number,number,number],3,false);
  lookups.cloudMask3D++;
  support>0?counts.supportPositive++:counts.supportZero++;
  const rainRegion=hasRain&&t>=rainNear&&t<rainFar,ordinaryStep=stepSize;
  const mediaStep=rainRegion?Math.min(ordinaryStep,f(RAIN_SAMPLE_STEP)):ordinaryStep;
  const untilRain=hasRain&&t<rainNear?sub(rainNear,t):sub(far,t),mediaBoundary=rainRegion?sub(rainFar,t):sub(far,t);
  const ds=Math.min(support<=0&&!rainRegion?emptyStep:mediaStep,mediaBoundary,untilRain);
  if(!(ds>0)){counts.stepNonPositive++;exit='non-positive-step';break;}
  const endT=add(t,ds),perLookups=lookupZero();perLookups.cloudMask3D=1;
  let rainExt=0,R:number|null=null,attached:number|null=null,evap:number|null=null,rainUvValid=false;
  const outsidePrism=rainRegion&&(poly===null||t<poly[0]||t>=poly[1]);
  if(rainRegion){
   counts.rainRegion++;counts.rainRegionLengthKm+=ds;
   if(outsidePrism){counts.visitedOutsidePrism++;counts.outsidePrismLengthKm+=ds;if(support<=0)counts.maskZeroOutsidePrism++;}
   perLookups.rainGuessG2D++;
   const guessXZ=[sub(rp[0],mul(mul(wind[0],Math.max(0,sub(1,rp[1]))),.32)),sub(rp[2],mul(mul(wind[1],Math.max(0,sub(1,rp[1]))),.32))];
   const guessUV=[div(sub(mul(guessXZ[0],growth[1]),-5),10),div(sub(mul(guessXZ[1],growth[1]),-3.5),7)];
   const guess=sampleRain(...guessUV as [number,number])[1],guessBase=add(.72,div(sub(sub(mul(guess,3),.5),.72),growth[0]));
   const descent=Math.max(0,sub(guessBase,rp[1])),shear=f(clamp(div(sub(guessBase,.72),6.2))**1.5),shift=add(mul(descent,.32),shear);
   const xz=[sub(rp[0],mul(wind[0],shift)),sub(rp[2],mul(wind[1],shift))];
   const rainUV=[div(sub(mul(xz[0],growth[1]),-5),10),div(sub(mul(xz[1],growth[1]),-3.5),7)];
   rainUvValid=rainUV.every(v=>v>0&&v<1);
   if(rainUvValid){
    perLookups.rainColumnRG2D++;const column=sampleRain(...rainUV as [number,number]);R=column[0];
    if(R>0){
     counts.rainRPositive++;if(outsidePrism)counts.rainRPositiveOutsidePrism++;
     const b=add(.72,div(sub(sub(mul(column[1],3),.5),.72),growth[0]));
     attached=sub(1,smooth(sub(b,.08),add(b,.3),rp[1]));if(attached===0)counts.rainAttachedZero++;
     perLookups.rainSheetsG3D++;
     const sheets=f(sampleDetail(detail,mul(xz[0],.20),mul(xz[1],.20),mul(add(b,mul(rainTime,.012)),.025),1));
     evap=f(precipitationSurvival(p[1],add(b,drift[1]),rainAmount,R,sheets));if(evap===0)counts.rainEvaporationZero++;
     perLookups.rainStreakR3D++;
     const streak=f(sampleDetail(detail,mul(xz[0],2.6),mul(xz[1],2.6),mul(add(rp[1],mul(rainTime,.018)),.16),0));
     const rainDensity=mul(mul(mul(R,attached),evap),mul(add(.15,mul(1.85,mul(sheets,sheets))),add(.35,mul(1.3,streak))));
     rainExt=mul(mul(rainAmount,rainDensity),RAIN_EXTINCTION);if(rainExt>0){counts.rainPositive++;if(outsidePrism)counts.rainPositiveOutsidePrism++;}
    }else counts.rainRZero++;
   }else counts.rainOutsideUV++;
  }
  let rho=0,ice=0,raw=0;
  if(support>0){
   perLookups.flow3D++;sampleMotionField(field,16,ref,flow);
   const local=ref.map((v,k)=>sub(v,f(flow[k])));ice=smooth(iceRange[0],iceRange[1],local[1]);
   perLookups.fineRGB3D++;
   const r=sampleDetail(detail,local[0]*.3,local[1]*.3,local[2]*.3,0),g=sampleDetail(detail,local[0]*.3,local[1]*.3,local[2]*.3,1),b=sampleDetail(detail,local[0]*.3,local[1]*.3,local[2]*.3,2);
   const warp=[(g-.5)*(.16-.08*ice),(b-.5)*(.12-.1*ice),(r-.5)*(.16-.06*ice)];
   perLookups.macroDensity3D++;
   raw=f(sampleDetail(macro,(local[0]+warp[0]+5)/10,(local[1]+warp[1]+.5)/8.5,(local[2]+warp[2]+3.5)/7,0,false));
   if(raw>=f(.002)){
    counts.cloudWarpedPass++;
    if(ice>0){perLookups.iceBend3D++;perLookups.iceDetailRGB3D++;}
    rho=f(sampleCloudDensity(macro,detail,local[0],local[1],local[2],ice,f(flow[3])));
    if(rho<f(.002))rho=0;
    if(rho>0){counts.cloudPositive++;perLookups.macroLightGBA3D++;if(pose.sunsetAmount>0)perLookups.sunsetRG3D++;}
   }
  }
  if(rho>0&&rainExt>0)counts.bothPositive++;
  if(rho<=0&&rainExt<=0){counts.bothExtinctionZero++;counts.zeroMediumLengthKm+=ds;}
  if(support<=0&&rainExt<=0)counts.maskZeroRainExtinctionZero++;
  if(support<=0&&rainRegion){counts.maskZeroInRain++;if(rainExt<=0)counts.maskZeroRainExtinctionZeroInRain++;if(evap===0)counts.maskZeroRainEvaporationZero++;}
  if(support<=0&&rainRegion&&R===0)counts.maskZeroRainRZero++;
  if(support<=0&&rainRegion&&!rainUvValid)counts.maskZeroRainOutsideUV++;
  if(support<=0&&rainRegion&&attached===0)counts.maskZeroRainAttachedZero++;
  const beforeT=T;
  if(rho>0||rainExt>0){
   const extinction=add(mul(rho,add(mul(18,sub(1,ice)),mul(6.5,ice))),rainExt);
   const opacity=sub(1,f(Math.exp(-mul(extinction,ds)))),cellT=sub(1,opacity);T=mul(T,cellT);
   if(T!==beforeT)counts.opacityChanged++;
  }
  // The fresh mask was already counted; add only the remaining conditional calls.
  const remaining={...perLookups};remaining.cloudMask3D=0;sumInto(lookups,remaining);
  const cloudH=Math.max(0,sub(emptyStep,stepSize)),liquidGate=add(add(ref[1],mul(growth[0],cloudH)),.001)<iceRange[0];
  const rainH=outsidePrism?(poly===null||t>=poly[1]?rainFar-t:Math.min(poly[0]-t,rainFar-t)):0;
  const certH=support<=0&&liquidGate&&outsidePrism?Math.max(0,Math.min(cloudH,rainH,far-t)):0;
  samples.push({rp,ray,liquidGate,cloudH,t,endT,ds,support,rainRegion,rho,rainExt,R,attached,outsidePrism,certEnd:t+certH,lookups:sumValues(perLookups),
    rainLookups:perLookups.rainGuessG2D+perLookups.rainColumnRG2D+perLookups.rainSheetsG3D+perLookups.rainStreakR3D});
  rawSequenceHash.update(new Uint8Array(new Float32Array([t,ds,support,rho,rainExt,T]).buffer));
  t=endT;if(i===8191)exit='budget';
 }
 if(exit==='opacity')stats.opacityExitRays++;else if(exit==='far')stats.farExitRays++;else if(exit==='budget')stats.budgetExitRays++;else if(exit==='non-positive-step')stats.nonPositiveStepExitRays++;
 for(let i=0;i<samples.length;i++){
  const a=samples[i];if(!(a.certEnd>a.endT))continue;
  let j=i+1;while(j<samples.length&&samples[j].endT<=a.certEnd){
   if(samples[j].rho>0||samples[j].rainExt>0)batch.certificateFalseSamples++;j++;
  }
  const n=j-i-1;
  if(n>0){
   if(a.rho>0||a.rainExt>0)batch.certificateFalseSamples++;
   batch.certificates++;batch.subsequentSamplesAvoidable+=n;batch.maximumSubsequentSamples=Math.max(batch.maximumSubsequentSamples,n);
   batch.startRainLookupsAvoidable+=a.rainLookups;
   for(let k=i+1;k<j;k++)batch.subsequentLookupsAvoidable+=samples[k].lookups;
   i=j-1;
  }
 }

 for(const grid of nonconvexGrids){
  for(const a of samples)if(a.rainRegion){
   grid.point.queries++;const c=gridCertificate(grid,a.rp,ray,0);
   if(c.empty){grid.point.empty++;if(a.support<=0)grid.point.emptyMask0++;if(a.R!==null&&a.R>0)grid.point.falsePositiveR++;if(a.rainExt>0)grid.point.falsePositiveRain++;}
  }
  for(let i=0;i<samples.length;i++){
   const a=samples[i];if(!a.rainRegion||a.support>0||!a.liquidGate)continue;
   grid.batch.queries++;
   const H=Math.max(0,Math.min(a.cloudH,rainFar-a.t,far-a.t)),c=gridCertificate(grid,a.rp,ray,H);
   if(!c.whole){if(c.empty)grid.batch.partialRejected++;continue;}
   let j=i+1;while(j<samples.length&&samples[j].endT<=a.t+H){if(samples[j].rho>0||samples[j].rainExt>0)grid.batch.falseSamples++;j++;}
   const n=j-i-1;if(n<=0)continue;
   if(a.rho>0||a.rainExt>0)grid.batch.falseSamples++;
   grid.batch.certificates++;grid.batch.following+=n;grid.batch.maxFollowing=Math.max(grid.batch.maxFollowing,n);grid.batch.removedCalls+=a.rainLookups;
   for(let k=i+1;k<j;k++)grid.batch.removedCalls+=samples[k].lookups;
   i=j-1;
  }
 }

 let longestCommonZero=0,run=0,runKm=0,longestCommonZeroKm=0;
 for(const s of samples){if(s.rho===0&&s.rainExt===0){run++;runKm+=s.ds;longestCommonZero=Math.max(longestCommonZero,run);longestCommonZeroKm=Math.max(longestCommonZeroKm,runKm);}else{run=0;runKm=0;}}
 sumInto(allCounts,counts);sumInto(allLookups,lookups);
 rays.push({grid:[gx,gy],pixel:[px,py],uvF32:uv,hashPixel,jitterF32:jitter,rayF32:ray,nearKm:near,farKm:far,
  rainNearKm:rainNear,rainFarKm:rainFar,prismIntervalKm:poly,exit,transmittance:T,lastTKm:t,iterations,
  longestCommonZeroSamples:longestCommonZero,longestCommonZeroKm,counts,lookups});
}
const sourceHashesAfter=Object.fromEntries(Object.keys(sourceHashes).map(n=>[n,sha(readFileSync(repo+'/src/cumulonimbus/'+n+'.ts'))]));
const changedDuringCount=Object.keys(sourceHashes).filter(n=>sourceHashes[n]!==sourceHashesAfter[n]);
const pct=(n:number,d:number)=>d?100*n/d:null;
const checks={positiveSteps:stats.nonPositiveStepExitRays===0,
 rainBranchPartition:allCounts.rainOutsideUV+allCounts.rainRZero+allCounts.rainRPositive===allCounts.rainRegion,
 mediumUnionPartition:allCounts.bothExtinctionZero===allCounts.iterations-(allCounts.cloudPositive+allCounts.rainPositive-allCounts.bothPositive),
 noPositiveRainOutsidePrism:allCounts.rainRPositiveOutsidePrism===0&&allCounts.rainPositiveOutsidePrism===0,
 noPositiveSampleInSelectedJointCertificate:batch.certificateFalseSamples===0,modelSourcesUnchanged:changedDuringCount.length===0};
const report={kind:'rain-work-renderer-loop-cpu-reference',date:new Date().toISOString(),status:Object.values(checks).every(Boolean)?'completed':'invalid',checks,
 runtime:{bun:process.versions.bun,architecture:process.arch,platform:process.platform},
 rootReportedCheckpoint:'ab2e122',bakesPerformedByCounter:0,reusedDataManifestSha256:sha(readFileSync(base+'/data/manifest.json')),
 counterScriptSha256:sha(readFileSync(import.meta.path)),sourceHashesBefore,sourceHashesAfter,changedSinceBake,changedDuringCount,
 parameters:{seed:72,time,rainTime,rainTimeProvenance:'Reconstructed from root-confirmed UI sequence: Fissa stato di confronto resets forcingTime0, then Pioggia/35ArrowUp, no Riprendi. Missing from original benchmark JSON.',
  grid:[width,height],output:resolution,camera:pose.camera,originF32:origin,forwardF32:forward,rightF32:right,upF32:up,
  stepSizeF32:stepSize,emptyStepF32:emptyStep,reportedEmptyStep:pose.emptyStepWorld,windF32:wind,driftF32:drift,growthF32:growth,
  rainAmountF32:rainAmount,rainBounds,iceRangeF32:iceRange,cutoffF32:f(.006),maximumIterations:8192},
 scope:'Full original sampling loop and branch model for a finite stratified pixel grid, with cached CPU256/128/16 arrays and rain64. No ray sources/radiance integration: RGB source cannot affect transmittance; count its conditional lookups without loading lighting channels. Not GPU execution, actual hardware fetch counts, pixel parity, instruction cost or throughput.',
 differencesFromWGSL:[
  'Explicit f32 wrapper for camera ray, jitter, interval clipping, t/ds, rain coordinates and transmittance; no model of FMA/reassociation/allowed GPU transcendental error. Texture filters use ideal CPU bilinear/trilinear weights, then selected values rounded f32; Apple sampler precision differs as cycle9 audit showed.',
  'Cloud reference uses shared referencePosition helper in JS number precision then rounds outputf32. Cloud material uses shared sampleCloudDensity helper and raw threshold; intermediate warp/erosion/pow operations are not rounded at every WGSL operation.',
  'Flow is shared CPU analytic field packed half and sampled clamp, not actual GPU compute/readback. Half conversion/native trig may change thresholds.',
  'Precipitation evaporation uses shared CPU precipitationSurvival then f32; other rain branches port shader formulas. Terrain retains original sea-gated six-pass algorithm, CPU terrainHeight; no solver correction.',
  'Sky/lighting/aerial/tone/sourceRGB are omitted because they do not affect opacity termination. Their conditional loop lookup calls are counted semantically. No gust/dispersion/micro/flash in this fixed pose.',
  'If a nonpositive step occurs, this diagnostic records an invalid result and stops that ray instead of spinning to8192 as WGSL would; positiveSteps must pass. Finite grid samples exact centres of selected output pixels, not every2560x1440 fragment. Counts cannot be multiplied into GPU time/FPS. Continuous prism/certificate counts are opportunity diagnostics, not an implemented optimizer or GPU proof.'
 ],
 stats,nonLoopWork:{skyLookup2DCalls:2*width*height,qualification:'Two original sky LUT lookups per ray; other outside-loop ALU/terrain cost is not priced.'},counts:allCounts,semanticTextureSampleCalls:allLookups,totalSemanticLoopTextureSampleCalls:sumValues(allLookups),
 fractionsPercent:{supportZero:pct(allCounts.supportZero,allCounts.iterations),rainRegion:pct(allCounts.rainRegion,allCounts.iterations),
  rainRZeroOfColumnLookups:pct(allCounts.rainRZero,allLookups.rainColumnRG2D),attachedZeroOfPositiveR:pct(allCounts.rainAttachedZero,allCounts.rainRPositive),
  bothExtinctionZero:pct(allCounts.bothExtinctionZero,allCounts.iterations),maskZeroRainExtinctionZero:pct(allCounts.maskZeroRainExtinctionZero,allCounts.iterations),
  maskZeroRainExtinctionZeroWithinRain:pct(allCounts.maskZeroRainExtinctionZeroInRain,allCounts.rainRegion),
  visitedOutsidePrismOfRain:pct(allCounts.visitedOutsidePrism,allCounts.rainRegion),maskZeroOutsidePrismOfAll:pct(allCounts.maskZeroOutsidePrism,allCounts.iterations)},
 jointPrismCloudBatchOpportunity:{...batch,
  subsequentSamplesPercent:pct(batch.subsequentSamplesAvoidable,allCounts.iterations),
  semanticCallsAvoidablePercent:pct(batch.subsequentLookupsAvoidable+batch.startRainLookupsAvoidable,sumValues(allLookups)),
  caveat:'Uses unchanged baseline point sequence, nonoverlapping selected certificates. Conservative cloudH=emptyStep-stepSize and explicit below-ice reference gate; diagonal prism float64 geometry without newly qualified GPU plane padding. Certificate checks actual subsequent CPU samples for false positives. New per-ray slab cost and batch ALU are unpriced; no optimization was applied.'},
 sequenceSha256:rawSequenceHash.digest('hex'),countWallMs:performance.now()-started,rays};

const original=JSON.parse(readFileSync(base+'/work-'+width+'x'+height+'.json','utf8'));
const summary={kind:'nonconvex-grid-opportunity-only',date:new Date().toISOString(),newBakes:0,
 scriptSha256:sha(readFileSync(import.meta.path)),counterSha256:sha(readFileSync(base+'/count-work.ts')),
 sequenceSha256:report.sequenceSha256,originalSequenceSha256:original.sequenceSha256,
 sameBaselineSequence:report.sequenceSha256===original.sequenceSha256,checks:report.checks,sourceChanges:report.changedDuringCount,
 rasterBuildMs:nonconvexGridBuildMs,diagnosticWallMs:performance.now()-started,
 caveat:'Reuses cached CPU data and baseline loop. Ideal f64 polygon/cell geometry, 1m material padding, no native GPU numeric proof/metadata quantization. No performance forecast. Single 32x18 pose.',
 grids:nonconvexGrids.map(({dist,...g})=>({...g,batch:{...g.batch,extraLookupCalls:g.batch.queries,
 grossSemanticRemovalPercent:100*g.batch.removedCalls/report.totalSemanticLoopTextureSampleCalls,
 netSemanticRemovalAfterOneLookupPercent:100*(g.batch.removedCalls-g.batch.queries)/report.totalSemanticLoopTextureSampleCalls}}))};
writeFileSync(base+'/rain-nonconvex-estimate.json',JSON.stringify(summary,null,2)+'\n');
console.log(JSON.stringify(summary));
