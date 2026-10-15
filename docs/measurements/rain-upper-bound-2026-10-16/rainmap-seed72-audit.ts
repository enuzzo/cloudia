/** One real CPU bake; rain-map statistics only. No GPU, browser, ray scan or product writes. */
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {generateVolume,VOLUME_RESOLUTION,DETAIL_RESOLUTION,BOUNDS_MIN,BOUNDS_SIZE,cloudParameters} from '/Users/enuzzo/Library/CloudStorage/Dropbox/Mitnick/Cloudia/src/cumulonimbus/volume.ts';
import {precipitationFootprint,precipitationSourceBounds,RAIN_MAP_SIZE,RAIN_WIND_DISPLACEMENT_BOUND} from '/Users/enuzzo/Library/CloudStorage/Dropbox/Mitnick/Cloudia/src/cumulonimbus/precipitation.ts';
import {motionState} from '/Users/enuzzo/Library/CloudStorage/Dropbox/Mitnick/Cloudia/src/cumulonimbus/motion.ts';

const output='/Users/enuzzo/Documents/Codex/Cloudia-QA-2026-10-16-cycle9';
const project='/Users/enuzzo/Library/CloudStorage/Dropbox/Mitnick/Cloudia';
const sha=(value:Uint8Array|string)=>createHash('sha256').update(value).digest('hex');
const sourceNames=['volume','precipitation','motion','light','sun','cloudShader','GPUSceneEngine'];
const hashes=()=>Object.fromEntries(sourceNames.map(name=>[name,sha(readFileSync(`${project}/src/cumulonimbus/${name}.ts`))]));
const sourceHashesBefore=hashes(),seed=72,time=60,windStrength=.55,started=performance.now();
writeFileSync(`${output}/rainmap-seed72-status.json`,JSON.stringify({status:'running',startedAt:new Date().toISOString(),seed,size:256,bakesRequested:1,noGPU:true},null,2)+'\n');
let lastProgress=-1;
console.log('One CPU generateVolume(256,72), detail128; outer process limit120s.');
const volume=generateVolume(VOLUME_RESOLUTION,seed,fraction=>{
  const bucket=Math.floor(fraction*10);
  if(bucket>lastProgress){lastProgress=bucket;console.log(JSON.stringify({stage:'volume',fraction,elapsedSeconds:(performance.now()-started)/1000}));}
});
if(volume.size!==256||volume.detail.size!==128||VOLUME_RESOLUTION!==256||DETAIL_RESOLUTION!==128)throw new Error('Unexpected baseline resolution; do not rerun automatically.');
const generationMs=performance.now()-started,mapStarted=performance.now(),map=precipitationFootprint(volume),n=RAIN_MAP_SIZE;
const mapFile=`${output}/rainmap-seed72-rg8.bin`;writeFileSync(mapFile,map);
const emission=new Uint8Array(n*n),halo=new Uint8Array(n*n);
for(let i=0;i<n*n;i++)if(map[i*2]>0){
  emission[i]=1;const x=i%n,z=Math.floor(i/n);
  for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++){
    const xx=x+dx,zz=z+dz;if(xx>=0&&xx<n&&zz>=0&&zz<n)halo[zz*n+xx]=1;
  }
}
const decoded=(g:number)=>g/255*3-.5;
function region(mask:Uint8Array|null){
  let count=0,min=256,max=-1,maxR=0,sentinel=0,sentinelRPositive=0;
  const witnesses:number[]=[],histogram:Record<string,number>={};
  const bounds={minX:n,minZ:n,maxX:-1,maxZ:-1};
  for(let i=0;i<n*n;i++){
    if(mask&&!mask[i])continue;
    const r=map[i*2],g=map[i*2+1],x=i%n,z=Math.floor(i/n);count++;min=Math.min(min,g);maxR=Math.max(maxR,r);
    histogram[g]=(histogram[g]??0)+1;
    if(g===255){sentinel++;if(r>0)sentinelRPositive++;}
    bounds.minX=Math.min(bounds.minX,x);bounds.minZ=Math.min(bounds.minZ,z);bounds.maxX=Math.max(bounds.maxX,x);bounds.maxZ=Math.max(bounds.maxZ,z);
    if(g>max){max=g;witnesses.length=0;}if(g===max)witnesses.push(i);
  }
  return {count,bounds,countAtMaximum:witnesses.length,maximumGByte:max,maximumGNormalized:max/255,maximumDecodedBaseKm:decoded(max),minimumGByte:min,
    maxRByte:maxR,G255Count:sentinel,G255WithPositiveRCount:sentinelRPositive,histogram,witnessIndices:witnesses.slice(0,8)};
}
const all=region(null),positive=region(emission),halo1=region(halo),state=motionState(time,seed);
const growth=[1/state.height,1/state.width,1/state.anvil],phase=(seed%71)/71*.35;
const drift=[windStrength*(.32*Math.sin(time*.027)+.11*Math.sin(time*.071)),Math.sin(time*.04)*.015,0];
const wind=[windStrength*(.52+.23*Math.sin(time*.055+phase*3)),windStrength*.26*Math.sin(time*.031+.6)];
const toWorldBase=(base:number)=>.72+(base-.72)/growth[0]+drift[1];
function witness(index:number){
  const x=index%n,z=Math.floor(index/n),r=map[index*2],g=map[index*2+1];
  const positiveNeighbours=[];
  for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++){
    const xx=x+dx,zz=z+dz;if(xx<0||xx>=n||zz<0||zz>=n||!emission[zz*n+xx])continue;
    positiveNeighbours.push({x:xx,z:zz,RByte:map[(zz*n+xx)*2],GByte:map[(zz*n+xx)*2+1],offset:[dx,dz]});
  }
  return {x,z,index,RByte:r,GByte:g,decodedBaseKm:decoded(g),materialTexelCentreKm:[BOUNDS_MIN[0]+(x+.5)/n*BOUNDS_SIZE[0],BOUNDS_MIN[2]+(z+.5)/n*BOUNDS_SIZE[2]],worldBaseAt60Km:toWorldBase(decoded(g)),attachedZeroAtWorldYKm:toWorldBase(decoded(g))+.3,inEmission:!!emission[index],inHalo1:!!halo[index],positiveNeighbours};
}
const enrich=(value:ReturnType<typeof region>)=>({...value,witnesses:value.witnessIndices.map(witness)});
const sourceBounds=precipitationSourceBounds(map),sourceHashesAfter=hashes();
const changedSources=sourceNames.filter(name=>sourceHashesBefore[name]!==sourceHashesAfter[name]);
const rainMin=sourceBounds?[sourceBounds[0]/growth[1]+Math.min(wind[0]*RAIN_WIND_DISPLACEMENT_BOUND,0)+drift[0],sourceBounds[1]/growth[1]+Math.min(wind[1]*RAIN_WIND_DISPLACEMENT_BOUND,0)+drift[2]]:null;
const rainMax=sourceBounds?[sourceBounds[2]/growth[1]+Math.max(wind[0]*RAIN_WIND_DISPLACEMENT_BOUND,0)+drift[0],sourceBounds[3]/growth[1]+Math.max(wind[1]*RAIN_WIND_DISPLACEMENT_BOUND,0)+drift[2]]:null;
const cappedWorldY=toWorldBase(halo1.maximumDecodedBaseKm)+.3,oldWorldY=2.8+drift[1];
const report={kind:'actual-rainmap-max-G-halo1',date:new Date().toISOString(),status:'completed',seed,time,windStrength,bakesPerformed:1,
  volumeSize:volume.size,detailSize:volume.detail.size,mapSize:n,mapFormat:'RG8 UNORM, linear clamp-to-edge; raw interleaved R,G bytes',mapSha256:sha(map),mapFile,
  sourceHashesBefore,sourceHashesAfter,changedSources,scriptSha256:sha(readFileSync(import.meta.path)),
  method:'One actual full generateVolume(256,72) including detail128 and all visibility caches, then production precipitationFootprint(volume,64). Only4096 map-texel statistics and a one-texel Chebyshev dilation of positive quantized R. No GPU execution/readback, pixel/ray integration, visual equivalence or speedup claim.',
  haloDefinition:'Union of each RByte>0 texel and its in-domain8 neighbours. If a bilinear sample has R>0, at least one contributing R texel is positive and every other contributing G texel is within Chebyshev distance1 of it; therefore the filtered G cannot exceed maxG of this halo under ideal convex filtering. GPU f32 arithmetic requires a separately chosen outward numerical margin.',
  shaderQualification:'Bound applies to the final column.r>0 lookup and attached fade ending at base+.3. The first guessUV G lookup can still read a remote sentinel255 and influences lateral source lookup; it is not itself bounded by the emission halo. Statistics do not validate that inverse source mapping.',
  originalAllG:enrich(all),positiveR:enrich(positive),maxGHalo1:enrich(halo1),
  motionAt60:{state,growth,wind,drift},
  worldYUpperAt60:{formula:'.72 + (GmaxByte/255*3-.5-.72)/growth.x + .3 + drift.y',halo1MaxBaseLocalKm:halo1.maximumDecodedBaseKm,halo1BaseWorldKm:toWorldBase(halo1.maximumDecodedBaseKm),rainAttachmentZeroAtWorldYKm:cappedWorldY,oldRainBoxUpperWorldYKm:oldWorldY,reductionKm:oldWorldY-cappedWorldY,numericalGuardKm:0,guardNote:'Raw CPU formula only; no GPU numerical padding applied or claimed.'},
  emissionColumnBounds:{materialPositiveTexelGridInclusive:positive.bounds,materialLinearSupportKm:sourceBounds,worldConservativeAt60:{minXZ:rainMin,maxXZ:rainMax,windDisplacementBound:RAIN_WIND_DISPLACEMENT_BOUND},cloudSupport:volume.supportBounds,shape:cloudParameters(seed)},
  operationalTiming:{generationMs,mapAndStatisticsMs:performance.now()-mapStarted,qualification:'Elapsed execution accounting only, not a performance benchmark.'}};
writeFileSync(`${output}/rainmap-seed72-audit.json`,JSON.stringify(report,null,2)+'\n');
writeFileSync(`${output}/rainmap-seed72-status.json`,JSON.stringify({status:'completed',bakesPerformed:1,report:'rainmap-seed72-audit.json',changedSources},null,2)+'\n');
console.log(JSON.stringify({status:'completed',allMaxG:all.maximumGByte,positiveMaxG:positive.maximumGByte,halo1MaxG:halo1.maximumGByte,halo1Count:halo1.count,halo1Witness:report.maxGHalo1.witnesses[0],worldYUpperAt60:report.worldYUpperAt60,sourceBounds,changedSources}));
