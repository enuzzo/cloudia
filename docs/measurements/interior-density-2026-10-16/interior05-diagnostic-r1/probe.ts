/** External CPU measurement only. Imports the actual hash-verified frozen modules. */
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve,dirname,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
const [variant,configFile,outputFile]=process.argv.slice(2);
if(!['A','B'].includes(variant)||!configFile||!outputFile)throw Error('Usage: bun probe.ts A|B CONFIG OUTPUT');
const config=JSON.parse(readFileSync(configFile,'utf8')),here=dirname(resolve(configFile)),spec=config.variants[variant],input=config.input;
const sha=(data:Uint8Array|string)=>createHash('sha256').update(data).digest('hex');
const root=resolve(here,spec.source),manifestBytes=readFileSync(resolve(here,spec.manifest));
if(sha(manifestBytes)!==spec.manifestSHA256)throw Error('Manifest hash mismatch');
const manifest=JSON.parse(manifestBytes.toString('utf8'));
if(Object.keys(manifest).length!==122)throw Error('Source file count');
for(const [path,hash] of Object.entries(manifest))if(sha(readFileSync(join(root,path)))!==hash)throw Error('Source mismatch '+path);
const load=(name:string)=>import(pathToFileURL(join(root,'src/cumulonimbus/'+name+'.ts')).href);
const volumeModule=await load('volume'),motion=await load('motion'),motionField=await load('motionField');
const terrainSurface=await load('terrainSurface'),landscape=await load('landscape'),terrainDem=await load('terrainDem');
const {generateVolume,sampleCloudDensity,sampleDetail,iceHeights,materialExtinction,BOUNDS_MIN,BOUNDS_SIZE}=volumeModule;
const started=performance.now();
console.log(JSON.stringify({event:'GENERATE_START',variant,pid:process.pid,source:root,seed:input.seed,macro:256,detail:128}));
let last=-1;
const volume=generateVolume(256,input.seed,(p:number)=>{const bucket=Math.floor(p*10);if(bucket!==last){last=bucket;console.log(JSON.stringify({event:'BAKE_PROGRESS',variant,fraction:p,elapsedSeconds:(performance.now()-started)/1000}));}});
if(volume.size!==256||volume.detail.size!==128)throw Error('Full-quality dimensions changed');
const digest=(data:ArrayBufferView)=>sha(new Uint8Array(data.buffer,data.byteOffset,data.byteLength));
const state=motion.motionState(input.time,input.seed);state.dispersion=0;
const iceRange=iceHeights(input.seed),phase=(input.seed%71)/71*.35,time=input.time,windStrength=.55;
const wind=[windStrength*(.52+.23*Math.sin(time*.055+phase*3)),windStrength*.26*Math.sin(time*.031+.6)];
const drift=[windStrength*(.32*Math.sin(time*.027)+.11*Math.sin(time*.071)),Math.sin(time*.04)*.015,0];
const field=new Uint16Array(motionField.MOTION_FIELD_SIZE**3*4);
motionField.fillMotionField(field,motionField.MOTION_FIELD_SIZE,state,iceRange);
const hashes={macroRGBA8:digest(volume.data),detailRGBA8:digest(volume.detail.data),sunsetRG8:digest(volume.sunsetLight),flowRGBA16F:digest(field)};
const clamp=(x:number,a=0,b=1)=>Math.max(a,Math.min(b,x));
const smooth=(a:number,b:number,x:number)=>{const t=clamp((x-a)/(b-a));return t*t*(3-2*t);};
const normalize=(v:number[])=>{const len=Math.hypot(...v);return v.map(x=>x/len);};
const origin=input.origin,target=input.target,forward=normalize(target.map((v:number,i:number)=>v-origin[i]));
const right=normalize([-forward[2],0,forward[0]]),up=[right[1]*forward[2]-right[2]*forward[1],right[2]*forward[0]-right[0]*forward[2],right[0]*forward[1]-right[1]*forward[0]];
const aspect=input.aspect[0]/input.aspect[1],tan=input.tanFov,inspection=input.inspection;
// One fixed conservative container includes both variants without holding both volumes.
const commonBounds={min:BOUNDS_MIN.map((v:number,i:number)=>v+drift[i]),max:BOUNDS_MIN.map((v:number,i:number)=>v+BOUNDS_SIZE[i]+drift[i])};
const actualBounds={min:volume.supportBounds.min.map((v:number,i:number)=>v+drift[i]),max:volume.supportBounds.max.map((v:number,i:number)=>v+drift[i])};
const demBytes=readFileSync(join(root,'src/cumulonimbus/assets/liguria-apuane-dem.bin'));
const dem=terrainDem.decodeTerrainDem(demBytes.buffer.slice(demBytes.byteOffset,demBytes.byteOffset+demBytes.byteLength));
let measuredMax=0;for(const code of dem.heights)measuredMax=Math.max(measuredMax,code*.000125);
if(measuredMax>terrainSurface.TERRAIN_SURFACE_MAX_HEIGHT_KM)throw Error('Terrain bound not valid');
const terrainMaxY=landscape.GROUND_LEVEL+terrainSurface.TERRAIN_SURFACE_MAX_HEIGHT_KM+.00001;
const terrainProof={groundLevel:landscape.GROUND_LEVEL,authoredUpperHeightKm:terrainSurface.TERRAIN_SURFACE_MAX_HEIGHT_KM,measuredMaxHeightKm:measuredMax,float32SlackKm:.00001,globalMaxWorldY:terrainMaxY,method:'DEM decoder caps each node at3.31km; authored bound3.31; convex blend and triangles do not exceed vertex upper bound; spherical curvature lowers vertices. Add explicit1cm f32 slack.'};
const point=(ray:number[],t:number)=>origin.map((v:number,i:number)=>v+ray[i]*t);
let evaluations=0;
function material(position:number[],distance:number){
 evaluations++;
 const scene=position.map((v,i)=>v-drift[i]),reference=motion.referencePosition(scene,state,iceRange,wind);
 const refCoord=reference.map((v:number,i:number)=>(v-BOUNDS_MIN[i])/BOUNDS_SIZE[i]),inset=.5/volume.detail.size;
 const support=sampleDetail(volume.detail,...refCoord.map((v:number)=>clamp(v,inset,1-inset)),3,false);
 const q=new Float64Array(4);motionField.writeFilteredSourcePosition(scene,state,iceRange,wind,field,q);
 const local=Array.from(q.slice(0,3)),ice=smooth(iceRange[0],iceRange[1],local[1]);
 const fine=[0,1,2,3].map(c=>sampleDetail(volume.detail,local[0]*.3,local[1]*.3,local[2]*.3,c));
 const warp=[(fine[1]-.5)*(.16-.08*ice),(fine[2]-.5)*(.12-.1*ice),(fine[0]-.5)*(.16-.06*ice)];
 const macroCoord=local.map((v,i)=>(v+warp[i]-BOUNDS_MIN[i])/BOUNDS_SIZE[i]);
 const microWeight=inspection*(1-smooth(.08,.3,distance))*(1-ice);
 const microValue=sampleDetail(volume.detail,local[0]*8,local[1]*8,local[2]*8,2);
 const microErosion=microWeight>.001?microWeight*(1-microValue)*.055:0;
 const outsideRenderedBox=position.some((v,i)=>v<actualBounds.min[i]||v>actualBounds.max[i]);
 let rho=support>0&&!outsideRenderedBox?sampleCloudDensity(volume,volume.detail,...local,ice,q[3]+microErosion):0;
 if(rho<.002)rho=0;
 return {rho,sigma:rho*materialExtinction(ice),ice,local,reference,refCoord,macroCoord,flowErosion:q[3],microWeight,microValue,microErosion,fine,support,outsideRenderedBox};
}
function stencil(coord:number[]){
 const size=volume.size,p=coord.map(v=>clamp(v)*size-.5),indices=p.map(Math.floor),fraction=p.map((v,i)=>v-indices[i]);
 const corners=[];
 for(let dz=0;dz<2;dz++)for(let dy=0;dy<2;dy++)for(let dx=0;dx<2;dx++){
  const xyz=[dx,dy,dz].map((offset,i)=>clamp(indices[i]+offset,0,size-1));
  const index=(xyz[2]*size+xyz[1])*size+xyz[0];
  corners.push({xyz,index,R8:volume.data[index*4],weight:(dx?fraction[0]:1-fraction[0])*(dy?fraction[1]:1-fraction[1])*(dz?fraction[2]:1-fraction[2])});
 }
 return {coord,p,indices,fraction,corners,interpolatedR:corners.reduce((s,c)=>s+c.R8/255*c.weight,0)};
}
function checkpoint(ray:number[],t:number|null){if(t===null)return null;const world=point(ray,t),m=material(world,t);return {distanceKm:t,axialDepthKm:t*ray.reduce((s,v,i)=>s+v*forward[i],0),world,...m,macroStencil:stencil(m.macroCoord)};}
function rayBox(ray:number[]){
 let near=0,far=Infinity;
 for(let i=0;i<3;i++){
  if(Math.abs(ray[i])<1e-15){if(origin[i]<commonBounds.min[i]||origin[i]>commonBounds.max[i])return null;continue;}
  const a=(commonBounds.min[i]-origin[i])/ray[i],b=(commonBounds.max[i]-origin[i])/ray[i];near=Math.max(near,Math.min(a,b));far=Math.min(far,Math.max(a,b));
 }
 return far>near?{near,far}:null;
}
function integrate(uv:number[],ds:number){
 const sx=uv[0]*2-1,sy=1-uv[1]*2-.16*(1-inspection);
 const ray=normalize(forward.map((v,i)=>v+right[i]*sx*aspect*tan+up[i]*sy*tan));
 const range=rayBox(ray);if(!range)return {uv,ray,stepKm:ds,range:null,reason:'NO_CONTAINER_INTERSECTION'};
 const minRayY=Math.min(point(ray,range.near)[1],point(ray,range.far)[1]);
 const terrain={...terrainProof,minRayY,clearanceAboveUpperBoundKm:minRayY-terrainMaxY,provenUnoccluded:minRayY>terrainMaxY};
 const first:any={rho002:null,rho025:null,tau1:null,tau3:null};
 let tau=0,T=1,sumW=0,weightedDistance=0,weightedDensity=0,samples=0,t=range.near;
 while(t<range.far&&T>=.006){
  const width=Math.min(ds,range.far-t),at=t+width/2,m=material(point(ray,at),at),before=tau,dTau=m.sigma*width;
  samples++;
  for(const [name,yes] of [['rho002',m.rho>=.002],['rho025',m.rho>.025]] as const)if(yes&&first[name]===null)first[name]={sampleDistanceKm:at,intervalKm:[t,t+width]};
  tau+=dTau;
  for(const level of [1,3])if(tau>=level&&first['tau'+level]===null)first['tau'+level]=t+(level-before)/m.sigma;
  const w=T*(-Math.expm1(-dTau));sumW+=w;weightedDistance+=w*at;weightedDensity+=w*m.rho;
  T*=Math.exp(-dTau);t+=width;
 }
 const mean=sumW>0?weightedDistance/sumW:null;
 const points={firstDensity:checkpoint(ray,first.rho002?.sampleDistanceKm??null),tau1:checkpoint(ray,first.tau1),weighted:checkpoint(ray,mean)};
 const footprint=(c:any)=>c===null?null:{axialDepthKm:c.axialDepthKm,widthKm:2*c.axialDepthKm*aspect*tan,heightKm:2*c.axialDepthKm*tan};
 return {uv,ray,screen:[sx,sy],stepKm:ds,range,terrain,first,tau,transmittance:T,opacity:1-T,sumWeights:sumW,weightIdentityError:sumW-(1-T),weighted:{distanceKm:mean,rho:sumW?weightedDensity/sumW:null},endKm:t,samples,stop:t>=range.far?'far':'T<.006',checkpoints:points,footprint:{first:footprint(points.firstDensity),tau1:footprint(points.tau1),weighted:footprint(points.weighted)}};
}
console.log(JSON.stringify({event:'TRACE_START',variant,elapsedSeconds:(performance.now()-started)/1000,hashes}));
const rays=input.uvs.map((uv:number[])=>integrate(uv,.001)),centerHalf=integrate([.5,.5],.0005);
const terrainLimited=rays.filter((r:any)=>r.terrain&&!r.terrain.provenUnoccluded).map((r:any)=>r.uv);
for(const [path,hash] of Object.entries(manifest))if(sha(readFileSync(join(root,path)))!==hash)throw Error('Source changed after generation '+path);
const result={status:terrainLimited.length?'COMPLETE_WITH_TERRAIN_OCCLUSION_UNPROVEN':'COMPLETE_CPU_DEPTH_ONLY',variant,sourceManifestSHA256:spec.manifestSHA256,volumeSourceSHA256:manifest['src/cumulonimbus/volume.ts'],inputSHA256:config.inputSHA256,seed:input.seed,time:input.time,inspection,origin,target,aspect,tanFov:tan,basis:{forward,right,up},state,wind,drift,iceRange,volume:256,detail:128,flow:16,commonBounds,actualBounds,hashes,terrainProof,terrainLimited,rays,centerHalf,evaluations,durationSeconds:(performance.now()-started)/1000,method:'Continuous CPU Float64 midpoint1m; center0.5m; actual frozen modules/R8 trilinear/fine warp/16-cubed half filtered flow/flow.a/micro inspection0.6/occupancy alpha/rendered support box. No RGB, GPU jitter/adaptive march or bitexact f32 claim. Source caches generated normally and digested, not reused across A/B.'};
writeFileSync(outputFile,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({event:'COMPLETE',variant,rays:rays.length,durationSeconds:result.durationSeconds,evaluations,output:outputFile,terrainLimited}));
