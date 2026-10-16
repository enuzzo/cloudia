/** Read-only, bounded audit of already-installed UNORM8 optical-depth buffers.
 * No light bake, shader, GPU query, texture update, full-buffer copy or hash.
 * Texture coordinates are XYZ=(horizontalU,baseHeightW,horizontalV).
 */
export interface RainEmitterAuditSource {size:number;data:Uint8Array;sunsetLight:Uint8Array}
export interface RainEmitterAppliedLighting {lightSide:number;sunsetAmount:number;massFactor:number}
const MAX_MAP_SIDE=64,MAX_SOURCE_SIDE=256,ENDPOINTS=5,MAX_JSON_BYTES=128*1024;
const endpointNames=['dayLeft','dayRight','sunsetLeft','sunsetRight','zenith'] as const;
const quantiles=[['p00',0],['p05',.05],['p25',.25],['p50',.5],['p75',.75],['p95',.95],['p100',1]] as const;
const clampIndex=(i:number,n:number)=>Math.max(0,Math.min(n-1,i));
const packed=(v:number)=>Math.round(Math.max(0,Math.min(1,v))*255);
function requireInput(value:unknown,message:string):asserts value {if(!value)throw new Error(message);}
const now=()=>typeof performance==='undefined'?Date.now():performance.now();

export function auditRainEmitterLight(rg:Uint8Array,source:RainEmitterAuditSource,size=64,appliedLighting?:RainEmitterAppliedLighting){
 const started=now(),n=source.size,cells=size*size;
 requireInput(Number.isInteger(size)&&size>=1&&size<=MAX_MAP_SIDE,'Rain audit map side must be an integer in [1,64]');
 requireInput(Number.isInteger(n)&&n>=1&&n<=MAX_SOURCE_SIDE,'Rain audit source side must be an integer in [1,256]');
 requireInput(rg instanceof Uint8Array&&rg.length===cells*2,'Rain audit requires exact RG8 map length');
 requireInput(source.data instanceof Uint8Array&&source.data.length===n**3*4,'Rain audit requires exact macro RGBA8 length');
 requireInput(source.sunsetLight instanceof Uint8Array&&source.sunsetLight.length===n**3*2,'Rain audit requires exact sunset RG8 length');
 for(const input of [rg,source.data,source.sunsetLight]){
  requireInput(!(typeof SharedArrayBuffer!=='undefined'&&input.buffer instanceof SharedArrayBuffer),'Shared concurrent input is outside this audit contract');
 }
 if(appliedLighting)for(const value of [appliedLighting.lightSide,appliedLighting.sunsetAmount,appliedLighting.massFactor]){
  requireInput(Number.isFinite(value)&&value>=0&&value<=1,'Applied lightSide/sunsetAmount/massFactor must be finite in [0,1]');
 }
 const table=new Float32Array(cells*ENDPOINTS),region=new Uint8Array(cells);
 // 0 positive; 1 R0 with an in-domain positive 3x3 neighbour; 2 remaining R0.
 const counts=[0,0,0];
 for(let z=0;z<size;z++)for(let x=0;x<size;x++){
  const i=z*size+x;
  let category=rg[i*2]>0?0:2;
  if(category===2){
   for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++){
    const xx=x+dx,zz=z+dz;
    if(xx>=0&&xx<size&&zz>=0&&zz<size&&rg[(zz*size+xx)*2]>0)category=1;
   }
  }
  region[i]=category;counts[category]++;
  const u=(x+.5)/size,v=(z+.5)/size,w=3*(rg[i*2+1]/255)/8.5;
  const px=u*n-.5,py=w*n-.5,pz=v*n-.5;
  const ix=Math.floor(px),iy=Math.floor(py),iz=Math.floor(pz),fx=px-ix,fy=py-iy,fz=pz-iz;
  let dayLeft=0,dayRight=0,lowLeft=0,lowRight=0,up=0;
  for(let dz=0;dz<2;dz++)for(let dy=0;dy<2;dy++)for(let dx=0;dx<2;dx++){
   const weight=(dx?fx:1-fx)*(dy?fy:1-fy)*(dz?fz:1-fz);
   const voxel=(clampIndex(iz+dz,n)*n+clampIndex(iy+dy,n))*n+clampIndex(ix+dx,n);
   const macro=voxel*4,low=voxel*2;
   dayLeft+=source.data[macro+1]/255*weight;dayRight+=source.data[macro+2]/255*weight;
   lowLeft+=source.sunsetLight[low]/255*weight;lowRight+=source.sunsetLight[low+1]/255*weight;
   up+=source.data[macro+3]/255*weight;
  }
  const at=i*ENDPOINTS;
  table[at]=dayLeft;table[at+1]=dayRight;table[at+2]=lowLeft;table[at+3]=lowRight;table[at+4]=up;
 }
 requireInput(Array.from(counts).reduce((a,b)=>a+b,0)===cells,'Internal region partition');
 // One reusable Uint16 ordering vector; never clone any source volume or table.
 const order=new Uint16Array(cells);
 function indices(category:number){
  let count=0;
  for(let i=0;i<cells;i++)if(category===3?region[i]!==2:region[i]===category)order[count++]=i;
  return order.subarray(0,count);
 }
 function endpointStats(ids:Uint16Array,endpoint:number,weighted:boolean,readQ?:(i:number)=>number,massFactor=1){
  const qFor=(i:number)=>readQ?readQ(i):table[i*ENDPOINTS+endpoint];
  ids.sort((a,b)=>qFor(a)-qFor(b)||a-b);
  const bins=new Array<number>(256).fill(0),weightedBins=weighted?new Array<number>(256).fill(0):null;
  let sum=0,weightSum=0,weightedSum=0,visibilitySum=0,weightedVisibilitySum=0,responseDistinct=0,previousResponse:number|null=null;
  const visibility=(q:number)=>endpoint===4?.18+.82*Math.exp(-.35*16*q*massFactor):Math.exp(-16*q*massFactor);
  for(const i of ids){
   const q=qFor(i),bin=packed(q),weight=rg[i*2],response=visibility(q);
   if(previousResponse===null||response!==previousResponse)responseDistinct++;previousResponse=response;
   requireInput(Number.isFinite(q)&&q>=0&&q<=1,'Nonfinite/out-of-range stored endpoint');
   bins[bin]++;sum+=q;visibilitySum+=response;
   if(weightedBins){weightedBins[bin]+=weight;weightSum+=weight;weightedSum+=weight*q;weightedVisibilitySum+=weight*response;}
  }
  const distinct=bins.filter(v=>v>0).length;
  function quantileValue(probability:number,useWeights=false,response=false):number|null{
   if(ids.length===0)return null;
   const index=(rank:number)=>ids[response?ids.length-1-rank:rank];
   const value=(i:number)=>response?visibility(qFor(i)):qFor(i)*16;
   if(!useWeights)return value(index(Math.max(0,Math.ceil(probability*ids.length)-1)));
   if(weightSum===0)return null;
   const target=probability*weightSum;let cumulative=0;
   for(let rank=0;rank<ids.length;rank++){const i=index(rank);cumulative+=rg[i*2];if(cumulative>=target)return value(i);}
   return value(index(ids.length-1));
  }
  const min=ids.length?qFor(ids[0]):null,max=ids.length?qFor(ids[ids.length-1]):null;
  return {
   samples:ids.length,
   tau:{min:min===null?null:min*16,max:max===null?null:max*16,mean:ids.length?sum*16/ids.length:null,
    quantiles:Object.fromEntries(quantiles.map(([name,p])=>[name,quantileValue(p)]))},
   packedUNORM8:{bins,distinct,min:distinct?bins.findIndex(v=>v>0):null,
    max:distinct?255-[...bins].reverse().findIndex(v=>v>0):null,
    zeroCount:bins[0],fullCount:bins[255],
    endpointCodeMeaning:'Codes0/255 include values rounded to the endpoint; not proof that original 3D bake was exactly0 or clipped16.'},
   visibility:{massFactor,distinct:responseDistinct,min:max===null?null:visibility(max),max:min===null?null:visibility(min),mean:ids.length?visibilitySum/ids.length:null,
    quantiles:Object.fromEntries(quantiles.map(([name,p])=>[name,quantileValue(p,false,true)]))},
   rWeighted:weightedBins?{weightSumRCode:weightSum,weightUnit:'R byte code; divide by255 for sum of normalized source strengths, not physical water mass.',
    meanTau:weightSum?weightedSum*16/weightSum:null,
    quantilesTau:Object.fromEntries(quantiles.map(([name,p])=>[name,quantileValue(p,true)])),
    packedWeightBins:weightedBins,meanVisibility:weightSum?weightedVisibilitySum/weightSum:null,
    visibilityQuantiles:Object.fromEntries(quantiles.map(([name,p])=>[name,quantileValue(p,true,true)]))}:null,
  };
 }
 function summarize(category:number){
  const ids=indices(category);let sourceRCodeSum=0;
  for(const i of ids)sourceRCodeSum+=rg[i*2];
  return {cells:ids.length,sourceRCodeSum,endpoints:Object.fromEntries(endpointNames.map((name,e)=>[name,endpointStats(ids,e,category===0)]))};
 }
 const positive=summarize(0),haloZero=summarize(1),remainingZero=summarize(2),support=summarize(3);
 const supportFields=endpointNames.map(name=>support.endpoints[name]);
 const zenith=support.endpoints.zenith;
 const endpointPairGates=Object.fromEntries(endpointNames.slice(0,4).map(name=>[name,{
  bDistinctPacked:support.endpoints[name].packedUNORM8.distinct,aDistinctPacked:zenith.packedUNORM8.distinct,
  identicalBAAtThisEndpoint:support.cells>0?support.endpoints[name].packedUNORM8.distinct===1&&zenith.packedUNORM8.distinct===1:null,
 }]));
 const state=appliedLighting?{lightSide:appliedLighting.lightSide,sunsetAmount:appliedLighting.sunsetAmount,massFactor:appliedLighting.massFactor}:null;
 const mix=(a:number,b:number,t:number)=>a+(b-a)*t;
 const solarBeforePacking=(i:number)=>{
  const at=i*ENDPOINTS,light=state!;
  return mix(mix(table[at],table[at+1],light.lightSide),mix(table[at+2],table[at+3],light.lightSide),light.sunsetAmount);
 };
 function currentSummary(category:number){
  const ids=indices(category),pairs=new Set<number>();
  let sunMin=Infinity,sunMax=-Infinity,upMin=Infinity,upMax=-Infinity;
  for(const i of ids){
   const sun=solarBeforePacking(i),up=table[i*ENDPOINTS+4];
   sunMin=Math.min(sunMin,sun);sunMax=Math.max(sunMax,sun);upMin=Math.min(upMin,up);upMax=Math.max(upMax,up);
   pairs.add(packed(sun)*256+packed(up));
  }
  return {cells:ids.length,distinctPackedBAPairs:pairs.size,
   sourceTauBeforePacking:{sun:{min:ids.length?sunMin*16:null,max:ids.length?sunMax*16:null},up:{min:ids.length?upMin*16:null,max:ids.length?upMax*16:null}},
   sun:endpointStats(ids,0,category===0,i=>packed(solarBeforePacking(i))/255,state!.massFactor),
   sky:endpointStats(ids,4,category===0,i=>packed(table[i*ENDPOINTS+4])/255,state!.massFactor)};
 }
 const current=state?{
  appliedLighting:state,
  scope:'CPU hypothetical current RGBA8 emitter-map packing, from the installed 3D buffers: Float32 endpoint table, Float64 scalar mix, Math.round UNORM8, then decode B/A before visibility. NOT installed rainMap BA or GPU readback.',
  regions:{positive:currentSummary(0),haloZero:currentSummary(1),remainingZero:currentSummary(2)},support:currentSummary(3),
 }:null;
 const currentGate=current?{
  supportCells:current.support.cells,positiveCells:positive.cells,
  distinctPackedBAPairs:current.support.distinctPackedBAPairs,
  identicalPackedBAOnSupport:current.support.cells>0?current.support.distinctPackedBAPairs===1:null,
  constantVisibilityOnSupport:current.support.cells>0?current.support.sun.visibility.distinct===1&&current.support.sky.visibility.distinct===1:null,
  stopForCurrentLighting:positive.cells===0||current.support.distinctPackedBAPairs<=1||(current.support.sun.visibility.distinct===1&&current.support.sky.visibility.distinct===1),
  conclusion:positive.cells===0?'STOP_NO_POSITIVE_SOURCE':current.support.distinctPackedBAPairs<=1||(current.support.sun.visibility.distinct===1&&current.support.sky.visibility.distinct===1)?'STOP_NO_SPATIAL_SIGNAL':'VARIATION_ONLY_NOT_ART_PASS',
  limitation:'Variation only in the R0 halo or tiny response differences do not establish useful positive-source contrast or native quality.',
 }:null;
 // Fixed 4x4 stratification, chosen from coordinates only; no source/case search.
 const witnesses=[];const selected=new Set<number>();
 for(let row=0;row<4;row++)for(let column=0;column<4;column++){
  const x=Math.min(size-1,Math.floor((column+.5)*size/4)),z=Math.min(size-1,Math.floor((row+.5)*size/4)),i=z*size+x;
  if(selected.has(i))continue;selected.add(i);
  const q=Array.from(table.subarray(i*ENDPOINTS,(i+1)*ENDPOINTS));
  witnesses.push({x,z,rCode:rg[i*2],gCode:rg[i*2+1],region:['positive','haloZero','remainingZero'][region[i]],
   textureXYZ:[(x+.5)/size,3*(rg[i*2+1]/255)/8.5,(z+.5)/size],normalizedTau5:q,tau5:q.map(v=>v*16),packed5:q.map(packed)});
 }
 const elapsedMs=now()-started;requireInput(Number.isFinite(elapsedMs)&&elapsedMs>=0,'Invalid local elapsed time');
 const report={
  schema:'cloudia-rain-emitter-light-audit-v1',status:'COMPLETE_CPU_AUDIT_ONLY',
  scope:'Read-only ideal CPU trilinear sampling of installed buffers, then one Float32 round per stored endpoint. No GPU filter parity, light/model bake, rendering, mutation or artistic acceptance.',
  input:{mapSide:size,sourceSide:n,rgBytes:rg.byteLength,macroBytes:source.data.byteLength,sunsetBytes:source.sunsetLight.byteLength,
   sha256:{rg:null,macro:null,sunset:null,scope:'Not computed here. Owner may attach previously verified identities separately; byte lengths are not content hashes.'}},
  coordinates:{textureXYZ:'[(x+.5)/mapSide, 3*(Gcode/255)/8.5, (z+.5)/mapSide]',
   channelOrder:endpointNames,encoding:'MacroRGBA8:G/B/A=dayLeft/dayRight/up; SunsetRG8:R/G=lowLeft/lowRight; all normalized tau/16.',
   filter:'Ideal trilinear UNORM8, clamp-to-edge, mip0, half-texel coordinate p=uvw*N-.5. No repeat, flow, growth, drift or second warp.'},
  statistics:{quantiles:'Inverse empirical CDF, nearest rank ceil(p*n)-1 clamped at0. Weighted CDF uses integer positive R codes and first cumulative weight>=p*total. No quantile interpolation.',
   previewMassFactor:1,solarVisibility:'exp(-16*qSun*massFactor)',skyResponse:'.18+.82*exp(-.35*16*qUp*massFactor)',
   currentSolarDepth:'mix(mix(dayLeft,dayRight,lightSide),mix(sunsetLeft,sunsetRight,lightSide),sunsetAmount); optional current preview is separately packed before visibility.',
   normalization:'None. No histogram fit, threshold, gain or physical precipitation calibration.'},
  regions:{positive,haloZero,remainingZero},support,current,
  gate:{noPositiveSource:positive.cells===0,supportDefinition:'Positive R cells plus R0 cells with an in-domain positive Chebyshev1 neighbour, including diagonals. Not AABB or cloud supportBounds.',
   endpointPairGates,
   allStoredEndpointFieldsConstantOnSupport:support.cells>0?supportFields.every(s=>s.tau.min===s.tau.max):null,
   allPackedEndpointFieldsConstantOnSupport:support.cells>0?supportFields.every(s=>s.packedUNORM8.distinct===1):null,
   interpretation:'No positive source: no rain-light trial. Identical BA at the selected endpoint: stop for that endpoint; it adds no spatial light signal. All stored raw fields constant: no spatial signal for any scalar blend. Merely constant packed endpoint fields do NOT prove constancy after intermediate blending. Variation is necessary, never sufficient for native/art PASS.',
   currentIntermediateBAEvaluated:current!==null,current:currentGate},
  witnesses,
  resources:{elapsedMs,tableBytes:table.byteLength,regionBytes:region.byteLength,orderingBytes:order.byteLength,
   logicalSourceChannelReads:cells*8*5,maximumMapSide:MAX_MAP_SIDE,maximumSourceSide:MAX_SOURCE_SIDE,
   maximumTableBytes:MAX_MAP_SIDE**2*5*4,maximumJSONBytes:MAX_JSON_BYTES,
   memoryScope:'Borrowed source buffers, no full-buffer copies/hashes. Additional bounded 256-bin count arrays, at most4096 distinct packed BA pairs per summary, and compact report JSON; terminal process RSS is not measured by this helper.'},
  limitations:['CPU values are not actual WebGPU texture-filter readback or f32 ALU proof.',
   'Source/base64 field resolution and tau16 clipping are inherited; no information is reconstructed below that resolution.',
   'Quantile variation does not establish credible rain shading; emitter visibility is not physical visibility at a descended droplet.',
   'Fixed witnesses may all be empty or miss important patterns; they are not an adaptive selected-case guarantee.',
   state?'Current state is owner-submitted CPU metadata, not GPU f32 uniform/filter readback. Packed BA is a hypothetical cache representation, not installed data.':'No applied lighting supplied: endpoint preview at massFactor1 is not current draw BA.'],
 };
 // All emitted strings and numbers are ASCII, so character length equals UTF-8 bytes.
 requireInput(JSON.stringify(report).length<MAX_JSON_BYTES,'Compact audit JSON exceeded128KiB; refusing an oversized result');
 return report;
}
