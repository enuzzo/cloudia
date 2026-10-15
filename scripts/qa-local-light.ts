/** CPU potential audit. No WGSL execution, GPU cache or rendered-image claim. */
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {generateVolume,sampleCloudDensity,sampleDetail,iceHeights,BOUNDS_MIN,BOUNDS_SIZE,materialExtinction} from '../src/cumulonimbus/volume';
import {motionState} from '../src/cumulonimbus/motion';
import {fillMotionField,writeFilteredSourcePosition,MOTION_FIELD_SIZE} from '../src/cumulonimbus/motionField';
import {OrbitView} from '../src/cumulonimbus/camera';
import {solarDirection} from '../src/cumulonimbus/sun';
import {atmosphereLighting} from '../src/cumulonimbus/atmosphere';

const output=process.argv[2];if(!output)throw new Error('Usage: bun scripts/qa-local-light.ts <output.json>');
const started=performance.now(),seed=1571198069,time=60,windStrength=.55,aspect=1672/941,tanFov=.2867;
const fixedNearRadiusKm=.6045067691053366,shadowLengthKm=.128,shadowStepsKm=[.002,.004,.008];
const seedPhase=(seed%71)/71*.35;
const wind=[windStrength*(.52+.23*Math.sin(time*.055+seedPhase*3)),windStrength*.26*Math.sin(time*.031+.6)];
const drift=[windStrength*(.32*Math.sin(time*.027)+.11*Math.sin(time*.071)),Math.sin(time*.04)*.015,0];
const sourceHashes=Object.fromEntries(['volume','motion','motionField','camera','cloudShader','light','sun','atmosphere'].map(name=>[name,createHash('sha256').update(readFileSync(new URL(`../src/cumulonimbus/${name}.ts`,import.meta.url))).digest('hex')]));
const clamp=(v:number)=>Math.max(0,Math.min(1,v));
const smooth=(a:number,b:number,v:number)=>{const t=clamp((v-a)/(b-a));return t*t*(3-2*t);};
const rounded=(v:number)=>Math.round(v*1e8)/1e8;
const normalize=(v:number[])=>{const length=Math.hypot(...v);return v.map(x=>x/length);};
const luminance=(v:number[])=>v[0]*.2126+v[1]*.7152+v[2]*.0722;
const inside=(p:readonly number[])=>p.every((v,i)=>v>=BOUNDS_MIN[i]&&v<=BOUNDS_MIN[i]+BOUNDS_SIZE[i]);

// With the same finite homogeneous medium, endpoint tail plus the local integral
// is exactly the original total. Adding the local segment to the start cache
// instead would count it twice. This is an analytic check, not cache validation.
const sigma=11.7,wholeLength=.8,expectedTau=sigma*wholeLength,analyticTail=sigma*(wholeLength-shadowLengthKm);
const constantMedium=shadowStepsKm.map(step=>{
  const count=Math.round(shadowLengthKm/step);let local=0;
  for(let i=0;i<count;i++)local+=sigma*step;
  const reconstructed=analyticTail+local,error=Math.abs(reconstructed-expectedTau);
  if(error>1e-12)throw new Error('Homogeneous optical-depth identity failed');
  return {stepKm:step,expectedTau,reconstructedTau:reconstructed,absoluteError:error,doubleAdditionError:expectedTau+local-expectedTau};
});

console.log('Local-light CPU audit: generating one 256³ / 128³ baseline reference…');
const generationStarted=performance.now(),volume=generateVolume(256,seed),generationMs=performance.now()-generationStarted;
const iceRange=iceHeights(seed),state=motionState(time,seed),field=new Uint16Array(MOTION_FIELD_SIZE**3*4),local=new Float64Array(4);
fillMotionField(field,MOTION_FIELD_SIZE,state,iceRange);
const center=volume.supportBounds.min.map((v,i)=>(v+volume.supportBounds.max[i])/2);
const bounds={min:volume.supportBounds.min.map((v,i)=>v+drift[i]-[1.3,0,.65][i]),max:volume.supportBounds.max.map((v,i)=>v+drift[i]+[1.3,0,.65][i])};
const sun=solarDirection(0),lighting=atmosphereLighting(sun,1,0);
const iceAt=(y:number)=>smooth(iceRange[0],iceRange[1],y);
const cacheTau=(q:readonly number[],channel:number)=>inside(q)?sampleDetail(volume,(q[0]+5)/10,(q[1]+.5)/8.5,(q[2]+3.5)/7,channel,false)*16:0;

function material(position:number[],inspection:number,distance:number){
  writeFilteredSourcePosition(position.map((v,i)=>v-drift[i]),state,iceRange,wind,field,local);
  const q=[local[0],local[1],local[2]],flowErosion=local[3];
  if(!inside(q))return {q,density:0,ice:0,solarTau:0,skyTau:0};
  const ice=iceAt(q[1]),microWeight=inspection*(1-smooth(.08,.3,distance))*(1-ice);
  const micro=microWeight>.001?microWeight*(1-sampleDetail(volume.detail,q[0]*8,q[1]*8,q[2]*8,2))*.055:0;
  const density=sampleCloudDensity(volume,volume.detail,q[0],q[1],q[2],ice,flowErosion+micro);
  return {q,density:density<.002?0:density,ice,solarTau:cacheTau(q,1),skyTau:cacheTau(q,3)};
}

function localShadow(q:number[]){
  const endpoint=q.map((v,i)=>v+sun[i]*shadowLengthKm),tail=cacheTau(endpoint,1);
  // q is already the deformed material coordinate. The local shadow model is
  // the same static fine density that feeds the global bake; do not apply flow
  // again, or add view-dependent micro erosion / runtime flow.a along this ray.
  const segment=shadowStepsKm.map(step=>{
    const count=Math.round(shadowLengthKm/step);let depth=0;
    for(let j=0;j<count;j++){
      const p=q.map((v,i)=>v+sun[i]*(j+.5)*step);
      if(!inside(p))continue;
      const ice=iceAt(p[1]);
      depth+=sampleCloudDensity(volume,volume.detail,p[0],p[1],p[2],ice)*materialExtinction(ice)*step;
    }
    return depth;
  });
  return {tail,segment,total:segment.map(v=>tail+v)};
}

function source(tau:number,skyTau:number,phase:number){
  const direct=lighting.solar.map(v=>v*1.65*Math.exp(-tau)*phase);
  const ambient=lighting.ambient.map(v=>v*(.18+.82*Math.exp(-skyTau*.35)));
  const multiple=[1,.985,.95].map((v,i)=>v*(.27*Math.exp(-tau*.45)+.10*Math.exp(-tau*.18))+[.028,.032,.04][i]);
  return {total:luminance(direct.map((v,i)=>v+ambient[i]+multiple[i])),direct:luminance(direct),ambient:luminance(ambient),multiple:luminance(multiple)};
}
type Contribution={weight:number;distance:number;density:number;qX:number;qY:number;qZ:number;solarTau:number;skyTau:number;tailTau:number;segmentTau:number[];hybridTau:number[];baselineSource:ReturnType<typeof source>;hybridSource:ReturnType<typeof source>[]};
function statistics(samples:Contribution[],get:(s:Contribution)=>number){
  const weight=samples.reduce((sum,s)=>sum+s.weight,0),mean=samples.reduce((sum,s)=>sum+s.weight*get(s),0)/weight;
  const deviation=Math.sqrt(samples.reduce((sum,s)=>sum+s.weight*(get(s)-mean)**2,0)/weight);
  const sorted=[...samples].sort((a,b)=>get(a)-get(b));
  const quantile=(fraction:number)=>{let sum=0;for(const s of sorted){sum+=s.weight;if(sum>=weight*fraction)return get(s);}return sorted.length?get(sorted.at(-1)!):0;};
  return {mean:rounded(mean),standardDeviation:rounded(deviation),coefficientOfVariation:rounded(deviation/Math.max(1e-12,Math.abs(mean))),q10:rounded(quantile(.1)),median:rounded(quantile(.5)),q90:rounded(quantile(.9))};
}
const relative=(newValue:number,oldValue:number)=>(newValue-oldValue)/Math.max(1e-12,Math.abs(oldValue));
const view=new OrbitView();
const rays=[{name:'center',uv:[.5,.5]},{name:'left',uv:[.35,.5]},{name:'right',uv:[.65,.5]},{name:'up',uv:[.5,.35]},{name:'down',uv:[.5,.65]}];

function march(approach:number,uv:number[],step:number){
  view.setApproach(approach);const camera=view.frame(center,aspect,0,fixedNearRadiusKm),origin=camera.origin;
  const sx=uv[0]*2-1,sy=1-uv[1]*2-.16*(1-approach),ray=normalize([sx*aspect*tanFov,sy*tanFov,-1]);
  let near=0,far=Infinity;
  for(let i=0;i<3;i++){
    if(Math.abs(ray[i])<1e-12){if(origin[i]<bounds.min[i]||origin[i]>bounds.max[i])return null;continue;}
    const a=(bounds.min[i]-origin[i])/ray[i],b=(bounds.max[i]-origin[i])/ray[i];near=Math.max(near,Math.min(a,b));far=Math.min(far,Math.max(a,b));
  }
  if(far<=near)return null;
  const mu=ray.reduce((sum,v,i)=>sum+v*sun[i],0),forward=(1-.68**2)/Math.max(1+.68**2-2*.68*mu,.04)**1.5,back=(1-.25**2)/Math.max(1+.25**2+2*.25*mu,.04)**1.5,phase=.45+.55*(.82*forward+.18*back);
  let transmittance=1;const samples:Contribution[]=[];
  for(let entry=near;entry<far&&transmittance>=.006;entry+=step){
    const ds=Math.min(step,far-entry),t=entry+ds*.5,p=origin.map((v,i)=>v+ray[i]*t),m=material(p,approach,t);
    if(m.density<=0)continue;
    const opacity=-Math.expm1(-m.density*materialExtinction(m.ice)*ds),weight=transmittance*opacity,shadow=localShadow(m.q);
    samples.push({weight,distance:t,density:m.density,qX:m.q[0],qY:m.q[1],qZ:m.q[2],solarTau:m.solarTau,skyTau:m.skyTau,tailTau:shadow.tail,segmentTau:shadow.segment,hybridTau:shadow.total,
      baselineSource:source(m.solarTau,m.skyTau,phase),hybridSource:shadow.total.map(tau=>source(tau,m.skyTau,phase))});
    transmittance*=1-opacity;
  }
  if(!samples.length)return null;
  const baseline=statistics(samples,s=>s.baselineSource.total);
  return {opacity:rounded(1-transmittance),transmittance:rounded(transmittance),contributingSegments:samples.length,ray,phase,
    q:{x:statistics(samples,s=>s.qX),y:statistics(samples,s=>s.qY),z:statistics(samples,s=>s.qZ)},distanceKm:statistics(samples,s=>s.distance),density:statistics(samples,s=>s.density),
    baseline:{solarTau:statistics(samples,s=>s.solarTau),skyTau:statistics(samples,s=>s.skyTau),source:baseline,direct:statistics(samples,s=>s.baselineSource.direct),ambient:statistics(samples,s=>s.baselineSource.ambient),multiple:statistics(samples,s=>s.baselineSource.multiple)},
    endpointTailTau:statistics(samples,s=>s.tailTau),
    clippedCacheOpacityFraction:rounded(samples.filter(s=>s.solarTau>=15.99||s.tailTau>=15.99).reduce((sum,s)=>sum+s.weight,0)/(1-transmittance)),
    hybrid:shadowStepsKm.map((shadowStepKm,i)=>{const hybrid=statistics(samples,s=>s.hybridSource[i].total);return {shadowStepKm,localSegmentTau:statistics(samples,s=>s.segmentTau[i]),solarTau:statistics(samples,s=>s.hybridTau[i]),tauChange:statistics(samples,s=>s.hybridTau[i]-s.solarTau),source:hybrid,
      sourceChange:statistics(samples,s=>s.hybridSource[i].total-s.baselineSource.total),relativeSourceMeanChange:rounded(relative(hybrid.mean,baseline.mean)),
      sourceRelativeErrorAgainst2m:statistics(samples,s=>Math.abs(relative(s.hybridSource[i].total,s.hybridSource[0].total))),
      direct:statistics(samples,s=>s.hybridSource[i].direct),multiple:statistics(samples,s=>s.hybridSource[i].multiple)};}),
  };
}

function across(values:number[]){const mean=values.reduce((sum,v)=>sum+v,0)/values.length;return {mean:rounded(mean),coefficientOfVariation:rounded(Math.sqrt(values.reduce((sum,v)=>sum+(v-mean)**2,0)/values.length)/Math.max(1e-12,Math.abs(mean))),relativeRange:rounded((Math.max(...values)-Math.min(...values))/Math.max(1e-12,Math.abs(mean)))};}
const poses=[.8,.95,1].map(approach=>{
  view.setApproach(approach);const camera=view.frame(center,aspect,0,fixedNearRadiusKm);
  const results=rays.map(r=>({name:r.name,uv:r.uv,steps:[.003,.006].map(cameraStepKm=>({cameraStepKm,result:march(approach,r.uv,cameraStepKm)}))}));
  const acrossFiveRays=[.003,.006].map((cameraStepKm,j)=>{
    const values=results.map(r=>r.steps[j].result).filter((r):r is NonNullable<typeof r>=>r!==null);
    return {cameraStepKm,baseline:across(values.map(r=>r.baseline.source.mean)),hybrid:shadowStepsKm.map((shadowStepKm,i)=>({shadowStepKm,...across(values.map(r=>r.hybrid[i].source.mean))}))};
  });
  return {approach,origin:camera.origin.map(rounded),distanceFromTargetKm:rounded(camera.distance),acrossFiveRays,rays:results};
});
const report={date:new Date().toISOString(),method:'CPU potential audit only. One full256³/128³ volume, five fixed front-view rays at approach.8/.95/1, fixed near radius from the accepted baseline; same cloud time60, windStrength.55 and16³ half-float/trilinear flow. Camera quadrature3/6m, opacity weighting T_before*(1-exp(-sigma*ds)). Local solar shadow replaces first128m with midpoint integration2/4/8m plus existing green-channel cache tail at q+128m*sun. q is already the filtered material coordinate. Shadow integral uses static fine bake material with local ice/extinction, without flow.a, camera micro erosion or another flow transform. Co-deformed static-light approximation retained; not exact dynamic world-space transport. Same existing direct/ambient/multiple source response before aerial and tone mapping; sky cache stays unchanged. No GPU/WGSL, spatial near-cache interpolation, final pixels, performance or photographic claim. A changed local reconstruction may disagree with baseline due cache discretization, quantization and baked fine-density undersampling; homogeneous identity does not prove real-cache accuracy.',
  sourceHashes,seed,time,windStrength,wind:wind.map(rounded),drift:drift.map(rounded),center:center.map(rounded),fixedNearRadiusKm,volume:256,detail:volume.detail.size,motionField:MOTION_FIELD_SIZE,
  sun,lightSide:0,sunsetAmount:0,lighting,iceRange,shadowLengthKm,shadowStepsKm,constantMedium,generationMs,durationSeconds:(performance.now()-started)/1000,poses};
writeFileSync(output,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({durationSeconds:rounded(report.durationSeconds),generationMs:rounded(generationMs),summary:poses.map(p=>({approach:p.approach,acrossFiveRays:p.acrossFiveRays}))}));
