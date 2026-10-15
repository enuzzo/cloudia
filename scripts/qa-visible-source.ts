/** Joint visible-density / source diagnostic. One baseline bake, no GPU or images. */
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {generateVolume,sampleCloudDensity,sampleDetail,iceHeights,materialExtinction,VOLUME_RESOLUTION,DETAIL_RESOLUTION,BOUNDS_MIN,BOUNDS_SIZE} from '../src/cumulonimbus/volume';
import {motionState} from '../src/cumulonimbus/motion';
import {fillMotionField,writeFilteredSourcePosition,MOTION_FIELD_SIZE} from '../src/cumulonimbus/motionField';
import {OrbitView} from '../src/cumulonimbus/camera';
import {solarDirection} from '../src/cumulonimbus/sun';
import {atmosphereLighting} from '../src/cumulonimbus/atmosphere';

const output=process.argv[2];
if(!output||output==='--help'){
  console.log('Usage: bun scripts/qa-visible-source.ts <output.json> | --check\nOne full256³/128³ bake; coordinate CPU/GPU measurements before running.');
  process.exit(output?0:1);
}
const clamp=(v:number)=>Math.max(0,Math.min(1,v));
const smooth=(a:number,b:number,v:number)=>{const t=clamp((v-a)/(b-a));return t*t*(3-2*t);};
const rounded=(v:number)=>Math.round(v*1e9)/1e9;
const normalize=(v:number[])=>{const length=Math.hypot(...v);return v.map(x=>x/length);};
const luminance=(v:number[])=>v[0]*.2126+v[1]*.7152+v[2]*.0722;
const sha=(data:Uint8Array)=>createHash('sha256').update(data).digest('hex');
type Weighted={weight:number};
function moments<T extends Weighted>(values:T[],get:(value:T)=>number){
  const total=values.reduce((sum,v)=>sum+v.weight,0);if(total<=0)return null;
  const mean=values.reduce((sum,v)=>sum+v.weight*get(v),0)/total;
  const variance=values.reduce((sum,v)=>sum+v.weight*(get(v)-mean)**2,0)/total;
  return {mean:rounded(mean),standardDeviation:rounded(Math.sqrt(variance)),coefficientOfVariation:rounded(Math.sqrt(variance)/Math.max(1e-12,Math.abs(mean)))};
}
function joint<T extends Weighted>(values:T[],x:(v:T)=>number,y:(v:T)=>number){
  const total=values.reduce((s,v)=>s+v.weight,0);if(total<=0)return null;
  const mx=values.reduce((s,v)=>s+v.weight*x(v),0)/total,my=values.reduce((s,v)=>s+v.weight*y(v),0)/total;
  let vx=0,vy=0,cov=0;for(const v of values){const a=x(v)-mx,b=y(v)-my;vx+=v.weight*a*a;vy+=v.weight*b*b;cov+=v.weight*a*b;}
  vx/=total;vy/=total;cov/=total;
  return {covariance:rounded(cov),pearson:vx>1e-20&&vy>1e-20?rounded(cov/Math.sqrt(vx*vy)):null,xStandardDeviation:rounded(Math.sqrt(vx)),yStandardDeviation:rounded(Math.sqrt(vy)),effectiveSamples:rounded(total*total/values.reduce((s,v)=>s+v.weight*v.weight,0))};
}
/** Return local-linear residuals on a fixed physical window, not a Fourier band.
 * Spatial weights are segment length, not opacity. All marched segments count,
 * including empty ones; fit at endpoints is one-sided rather than zero-padded. */
function residuals<T extends {distanceKm:number;dsKm:number}>(values:T[],get:(v:T)=>number,widthKm:number){
  return values.map((value,index)=>{
    const radius=widthKm/2;let sw=0,sx=0,sxx=0,sy=0,sxy=0;
    for(let j=index;j>=0&&value.distanceKm-values[j].distanceKm<=radius;j--){
      const p=values[j],x=p.distanceKm-value.distanceKm,w=p.dsKm,y=get(p);sw+=w;sx+=w*x;sxx+=w*x*x;sy+=w*y;sxy+=w*x*y;
    }
    for(let j=index+1;j<values.length&&values[j].distanceKm-value.distanceKm<=radius;j++){
      const p=values[j],x=p.distanceKm-value.distanceKm,w=p.dsKm,y=get(p);sw+=w;sx+=w*x;sxx+=w*x*x;sy+=w*y;sxy+=w*x*y;
    }
    const denominator=sw*sxx-sx*sx,trend=denominator>1e-30?(sy*sxx-sx*sxy)/denominator:sy/sw;
    return get(value)-trend;
  });
}
function verifyMath(){
  const values=Array.from({length:31},(_,i)=>({weight:1+i%3,distanceKm:i*.003,dsKm:.003,x:i*.2,y:3+i*.6}));
  const corr=joint(values,v=>v.x,v=>v.y),r=residuals(values,v=>v.y,.032);
  if(corr?.pearson!==1||Math.max(...r.map(Math.abs))>1e-10)throw new Error('Joint/local-linear diagnostic self-check failed');
  if(joint(values,v=>v.x,()=>.5)?.pearson!==null)throw new Error('Constant source must not produce a Pearson coefficient');
  let t=1,sum=0;for(const sigma of [0,2,7,13,0,4]){const opacity=-Math.expm1(-sigma*.003);sum+=t*opacity;t*=1-opacity;}
  if(Math.abs(sum-(1-t))>1e-12)throw new Error('Opacity-kernel mass identity failed');
  return {linearCorrelation:1,linearResidualMax:Math.max(...r.map(Math.abs)),constantSourceCorrelation:null,kernelMassError:Math.abs(sum-(1-t))};
}
const selfChecks=verifyMath();
if(output==='--check'){console.log(JSON.stringify({passed:true,selfChecks,generatedVolumes:0}));process.exit(0);}

const started=performance.now(),seed=1571198069,time=60,windStrength=.55,aspect=1672/941,tanFov=.2867;
const fixedTargetKm=[.4296875,2.9365234375,0],fixedNearRadiusKm=.6045067691053366;
const cameraStepsKm=[.0015,.003,.006],residualWindowsKm=[.016,.032,.064],gridStepKm=.003;
const seedPhase=(seed%71)/71*.35;
const wind=[windStrength*(.52+.23*Math.sin(time*.055+seedPhase*3)),windStrength*.26*Math.sin(time*.031+.6)];
const drift=[windStrength*(.32*Math.sin(time*.027)+.11*Math.sin(time*.071)),Math.sin(time*.04)*.015,0];
const names=['volume','motion','motionField','camera','cloudShader','light','sun','atmosphere'];
const hashes=()=>Object.fromEntries(names.map(name=>[name,sha(readFileSync(new URL(`../src/cumulonimbus/${name}.ts`,import.meta.url)))]));
const sourceHashes=hashes(),scriptSha256=sha(readFileSync(new URL(import.meta.url)));
console.log('Visible-source CPU diagnostic: one baseline256³/128³ bake…');
const generationStarted=performance.now(),volume=generateVolume(VOLUME_RESOLUTION,seed),generationMs=performance.now()-generationStarted;
if(volume.size!==256||volume.detail.size!==128)throw new Error('Unexpected baseline resolution');
const samplingStarted=performance.now(),iceRange=iceHeights(seed),state=motionState(time,seed),field=new Uint16Array(MOTION_FIELD_SIZE**3*4),local=new Float64Array(4);
fillMotionField(field,MOTION_FIELD_SIZE,state,iceRange);
const sun=solarDirection(0),lighting=atmosphereLighting(sun,1,0),ambientLuminance=luminance(lighting.ambient),multipleTint=luminance([1,.985,.95]);
const ambientFloor=ambientLuminance*.18,multipleFloor=luminance([.028,.032,.04]),floor=ambientFloor+multipleFloor;
const bounds={min:volume.supportBounds.min.map((v,i)=>v+drift[i]-[1.3,0,.65][i]),max:volume.supportBounds.max.map((v,i)=>v+drift[i]+[1.3,0,.65][i])};
const inside=(p:readonly number[])=>p.every((v,i)=>v>=BOUNDS_MIN[i]&&v<=BOUNDS_MIN[i]+BOUNDS_SIZE[i]);
function material(position:number[],inspection:number,distance:number){
  writeFilteredSourcePosition(position.map((v,i)=>v-drift[i]),state,iceRange,wind,field,local);
  const q=[local[0],local[1],local[2]],flowErosion=local[3];if(!inside(q))return null;
  const ice=smooth(iceRange[0],iceRange[1],q[1]),detail=volume.detail;
  const r=sampleDetail(detail,q[0]*.3,q[1]*.3,q[2]*.3,0),g=sampleDetail(detail,q[0]*.3,q[1]*.3,q[2]*.3,1),b=sampleDetail(detail,q[0]*.3,q[1]*.3,q[2]*.3,2);
  const warp=[(g-.5)*(.16-.08*ice),(b-.5)*(.12-.1*ice),(r-.5)*(.16-.06*ice)];
  const raw=sampleDetail(volume,(q[0]+warp[0]+5)/10,(q[1]+warp[1]+.5)/8.5,(q[2]+warp[2]+3.5)/7,0,false);
  const microWeight=inspection*(1-smooth(.08,.3,distance))*(1-ice);
  const microErosion=microWeight>.001?microWeight*(1-sampleDetail(detail,q[0]*8,q[1]*8,q[2]*8,2))*.055:0;
  const noMicro=raw<.002?0:sampleCloudDensity(volume,detail,q[0],q[1],q[2],ice,flowErosion);
  const density=raw<.002?0:sampleCloudDensity(volume,detail,q[0],q[1],q[2],ice,flowErosion+microErosion);
  return {q,ice,raw,rho:density<.002?0:density,rhoNoMicro:noMicro<.002?0:noMicro,microErosion,flowErosion,
    solarTau:sampleDetail(volume,(q[0]+5)/10,(q[1]+.5)/8.5,(q[2]+3.5)/7,1,false)*16,
    skyTau:sampleDetail(volume,(q[0]+5)/10,(q[1]+.5)/8.5,(q[2]+3.5)/7,3,false)*16};
}
function source(solarTau:number,skyTau:number,phase:number){
  const direct=luminance(lighting.solar)*1.65*Math.exp(-solarTau)*phase;
  const ambientVariable=ambientLuminance*.82*Math.exp(-skyTau*.35);
  const multipleVariable=multipleTint*(.27*Math.exp(-solarTau*.45)+.10*Math.exp(-solarTau*.18));
  const ambient=ambientVariable+ambientFloor,multiple=multipleVariable+multipleFloor,total=direct+ambient+multiple;
  if(Math.abs(total-(direct+ambientVariable+multipleVariable+floor))>1e-12)throw new Error('Source decomposition is not additive');
  return {source:total,direct,ambient,ambientVariable,ambientFloor,multiple,multipleVariable,multipleFloor,floor,withoutFloor:total-floor};
}
type Sample=Weighted&{distanceKm:number;dsKm:number;transmittanceBefore:number;rho:number;rhoNoMicro:number;raw:number;q:number[];microErosion:number;flowErosion:number;solarTau:number;skyTau:number}&ReturnType<typeof source>;
const componentNames=['source','direct','ambient','ambientVariable','ambientFloor','multiple','multipleVariable','multipleFloor','floor','withoutFloor'] as const;
function summarize(samples:Sample[],transmittance:number){
  const visible=samples.filter(s=>s.weight>0);if(!visible.length)return null;
  const opacity=1-transmittance,totalWeight=visible.reduce((s,v)=>s+v.weight,0);
  if(Math.abs(opacity-totalWeight)>1e-12)throw new Error('Visible weights do not sum to cloud opacity');
  const componentMoments=Object.fromEntries(componentNames.map(key=>[key,moments(visible,s=>s[key])!])) as Record<typeof componentNames[number],NonNullable<ReturnType<typeof moments>>>;
  const componentsIntegrated=Object.fromEntries(componentNames.map(key=>[key,visible.reduce((sum,s)=>sum+s.weight*s[key],0)])) as Record<typeof componentNames[number],number>;
  const meanRho=moments(visible,s=>s.rho)!,meanSource=componentMoments.source;
  const residualBands=residualWindowsKm.map(windowKm=>{
    const rho=residuals(samples,s=>s.rho,windowKm),signal=residuals(samples,s=>s.source,windowKm),direct=residuals(samples,s=>s.direct,windowKm),ambient=residuals(samples,s=>s.ambient,windowKm),multiple=residuals(samples,s=>s.multiple,windowKm);
    const entries=samples.map((s,i)=>({weight:s.weight,rho:rho[i],source:signal[i],direct:direct[i],ambient:ambient[i],multiple:multiple[i]})).filter(s=>s.weight>0);
    const rms=(get:(s:typeof entries[number])=>number)=>Math.sqrt(entries.reduce((sum,s)=>sum+s.weight*get(s)**2,0)/totalWeight);
    return {windowMetres:windowKm*1000,rhoRMS:rounded(rms(s=>s.rho)),rhoRMSRelativeToMean:rounded(rms(s=>s.rho)/meanRho.mean),sourceRMS:rounded(rms(s=>s.source)),sourceRMSRelativeToMean:rounded(rms(s=>s.source)/meanSource.mean),directRMS:rounded(rms(s=>s.direct)),ambientRMS:rounded(rms(s=>s.ambient)),multipleRMS:rounded(rms(s=>s.multiple)),rhoSource:joint(entries,s=>s.rho,s=>s.source)};
  });
  return {opacity:rounded(opacity),transmittance:rounded(transmittance),contributingSegments:visible.length,marchedSegments:samples.length,
    distanceKm:moments(visible,s=>s.distanceKm),density:meanRho,raw:moments(visible,s=>s.raw),solarTau:moments(visible,s=>s.solarTau),skyTau:moments(visible,s=>s.skyTau),components:componentMoments,componentsIntegrated,
    sourceFractions:Object.fromEntries(['direct','ambient','multiple','floor'].map(key=>[key,rounded(componentMoments[key as keyof typeof componentMoments].mean/meanSource.mean)])),
    rawCorrelation:{rhoSource:joint(visible,s=>s.rho,s=>s.source),rhoDirect:joint(visible,s=>s.rho,s=>s.direct),rhoAmbient:joint(visible,s=>s.rho,s=>s.ambient),rhoMultiple:joint(visible,s=>s.rho,s=>s.multiple)},residualBands,
    microDensityDifference:{mean:moments(visible,s=>s.rho-s.rhoNoMicro),rms:rounded(Math.sqrt(visible.reduce((sum,s)=>sum+s.weight*(s.rho-s.rhoNoMicro)**2,0)/totalWeight))},
    constantSourceControl:{unitSourceIntegrated:rounded(opacity),actualKernelSum:rounded(totalWeight),identityError:Math.abs(opacity-totalWeight),explanation:'A spatially constant unit source integrates to cloud opacity regardless of internal density rearrangement when that opacity is held fixed; this is an algebraic control, not a new physical lighting model.'}};
}
const view=new OrbitView(),cached=new Map<string,{origin:number[];ray:number[];phase:number;summary:ReturnType<typeof summarize>;samples:Sample[]}>();
function march(approach:number,uv:number[],stepKm:number){
  const key=[approach,...uv,stepKm].join('/'),previous=cached.get(key);if(previous)return previous;
  view.setApproach(approach);const camera=view.frame(fixedTargetKm,aspect,0,fixedNearRadiusKm),origin=camera.origin;
  if(approach===.8&&Math.abs(origin[2]-1.1639784268955404)>1e-14)throw new Error('Fixed comparison camera drifted');
  const sx=uv[0]*2-1,sy=1-uv[1]*2-.16*(1-approach),ray=normalize([sx*aspect*tanFov,sy*tanFov,-1]);
  let near=0,far=Infinity;
  for(let axis=0;axis<3;axis++){
    if(Math.abs(ray[axis])<1e-12){if(origin[axis]<bounds.min[axis]||origin[axis]>bounds.max[axis])return {origin,ray,phase:0,summary:null,samples:[]};continue;}
    const a=(bounds.min[axis]-origin[axis])/ray[axis],b=(bounds.max[axis]-origin[axis])/ray[axis];near=Math.max(near,Math.min(a,b));far=Math.min(far,Math.max(a,b));
  }
  const mu=ray.reduce((sum,v,i)=>sum+v*sun[i],0),f=(1-.68**2)/Math.max(1+.68**2-2*.68*mu,.04)**1.5,b=(1-.25**2)/Math.max(1+.25**2+2*.25*mu,.04)**1.5,phase=.45+.55*(.82*f+.18*b);
  let transmittance=1;const samples:Sample[]=[];
  for(let entry=near;entry<far&&transmittance>=.006;entry+=stepKm){
    const dsKm=Math.min(stepKm,far-entry),distanceKm=entry+dsKm*.5,p=origin.map((v,i)=>v+ray[i]*distanceKm),m=material(p,approach,distanceKm);
    if(!m)continue;
    const opacity=-Math.expm1(-m.rho*materialExtinction(m.ice)*dsKm),weight=transmittance*opacity;
    samples.push({distanceKm,dsKm,weight,transmittanceBefore:transmittance,rho:m.rho,rhoNoMicro:m.rhoNoMicro,raw:m.raw,q:m.q,microErosion:m.microErosion,flowErosion:m.flowErosion,solarTau:m.solarTau,skyTau:m.skyTau,...source(m.solarTau,m.skyTau,phase)});
    transmittance*=1-opacity;
  }
  const result={origin,ray,phase,summary:summarize(samples,transmittance),samples};cached.set(key,result);return result;
}
function across(values:number[]){return moments(values.map(value=>({weight:1,value})),v=>v.value);}
const primaryRays=[{name:'center',uv:[.5,.5]},{name:'left',uv:[.35,.5]},{name:'right',uv:[.65,.5]},{name:'up',uv:[.5,.35]},{name:'down',uv:[.5,.65]}];
const poses=[.8,.95,1].map(approach=>{
  const primary=primaryRays.map(r=>({name:r.name,uv:r.uv,steps:cameraStepsKm.map(stepKm=>{const result=march(approach,r.uv,stepKm);return {stepKm,summary:result.summary,...(stepKm===.003?{contributions:result.samples.filter(s=>s.weight>0)}:{})};})}));
  const grid=Array.from({length:81},(_,index)=>{
    const uv=[.35+(index%9)*.3/8,.35+Math.floor(index/9)*.3/8],result=march(approach,uv,gridStepKm);
    return {uv,summary:result.summary};
  });
  const valid=grid.flatMap(r=>r.summary?[r.summary]:[]),equal=valid.map(value=>({weight:1,value}));
  return {approach,origin:march(approach,[.5,.5],.003).origin,primaryRays:primary,
    grid:{stepKm:gridStepKm,gridSize:[9,9],uvRange:[.35,.65],contributingRays:valid.length,
      acrossRays:{opacity:across(valid.map(v=>v.opacity)),densityMean:across(valid.map(v=>v.density.mean)),sourceMean:across(valid.map(v=>v.components.source.mean)),sourceIntegrated:across(valid.map(v=>v.componentsIntegrated.source)),sourceWithoutFloorIntegrated:across(valid.map(v=>v.componentsIntegrated.withoutFloor)),unitConstantSourceIntegrated:across(valid.map(v=>v.opacity)),directIntegrated:across(valid.map(v=>v.componentsIntegrated.direct)),ambientIntegrated:across(valid.map(v=>v.componentsIntegrated.ambient)),multipleIntegrated:across(valid.map(v=>v.componentsIntegrated.multiple)),floorIntegrated:across(valid.map(v=>v.componentsIntegrated.floor))},
      correlations:{densityMeanToSourceMean:joint(equal,v=>v.value.density.mean,v=>v.value.components.source.mean),densityMeanToIntegratedSource:joint(equal,v=>v.value.density.mean,v=>v.value.componentsIntegrated.source)},rays:grid}};
});
const sourceHashesAfter=hashes(),changedSourceFiles=names.filter(name=>sourceHashes[name]!==sourceHashesAfter[name]);
const report={date:new Date().toISOString(),method:'CPU joint diagnostic, not WGSL execution/readback, rendered pixels, image contrast, sharpness or photographic acceptance. Exactly one baseline256³/128³ volume. Filtered16³ half-float flow and flow.a, camera micro erosion, clear day left sun, time60/wind.55, mature growth, no gust/dispersion/rain/flash. Target and near radius pinned independently of support bounds, no ordinary surface probe. Five reference UV rays use1.5/3/6m midpoint quadrature; full positive opacity contributions retained at3m. Additional9x9 UV nodes in [.35,.65]^2 use3m summaries, not a rendered image. Weight=T_before*(1-exp(-rho*extinction*ds)), cutoff.006; source cache sampled at the unwarped filtered local coordinate, retaining existing co-deformed static-light approximation. Luminance before aerial/tone. Floor is ambientColor*.18 plus [.028,.032,.04]; ambient/multiple totals include their floor and are not added to floor again. Residuals subtract a segment-length-weighted local linear fit over stated physical window widths, then use opacity-weighted RMS/correlation; these windows are detrending filters, not exact Fourier bands. High raw Pearson alone can arise from shared depth trends. Useful fine coupling requires nonnegligible residual amplitudes as well as stable correlation/convergence; correlations are not causal, do not measure projected texture contrast, and do not imply photographic quality. Metre-scale erosion may alias at3/6m: use1.5m comparison without assuming complete resolution.',
  sourceHashes,sourceHashesAfter,changedSourceFiles,scriptSha256,selfChecks,seed,time,windStrength,wind,drift,fixedTargetKm,fixedNearRadiusKm,aspect,tanFov,cameraStepsKm,residualWindowsKm,volume:VOLUME_RESOLUTION,detail:DETAIL_RESOLUTION,motionField:MOTION_FIELD_SIZE,sun,lighting,iceRange,sourceFloorLuminance:{ambientFloor,multipleFloor,total:floor},generationMs,samplingMs:performance.now()-samplingStarted,durationSeconds:(performance.now()-started)/1000,poses};
writeFileSync(output,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({output,generationMs:rounded(generationMs),samplingMs:rounded(report.samplingMs),durationSeconds:rounded(report.durationSeconds),changedSourceFiles,summary:poses.map(p=>({approach:p.approach,origin:p.origin,grid:p.grid.acrossRays,center:p.primaryRays[0].steps.find(s=>s.stepKm===.0015)?.summary}))}));
