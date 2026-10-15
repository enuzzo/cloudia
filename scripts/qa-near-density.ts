/** CPU-only opacity-weighted material/light diagnostic. No GPU or visual acceptance. */
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {generateVolume,sampleCloudDensity,sampleDetail,iceHeights,materialExtinction} from '../src/cumulonimbus/volume';
import {motionState} from '../src/cumulonimbus/motion';
import {fillMotionField,writeFilteredSourcePosition,MOTION_FIELD_SIZE} from '../src/cumulonimbus/motionField';
import {OrbitView,probeApproach,comparisonSurfaceDistance} from '../src/cumulonimbus/camera';
import {solarDirection} from '../src/cumulonimbus/sun';
import {atmosphereLighting} from '../src/cumulonimbus/atmosphere';

const output=process.argv[2];if(!output)throw new Error('Usage: bun scripts/qa-near-density.ts <output.json> [fixed-surface-km]');
const comparisonSurface=process.argv[3]===undefined?null:comparisonSurfaceDistance(`?profile=1&surface=${encodeURIComponent(process.argv[3])}`);
if(process.argv[3]!==undefined&&comparisonSurface===null)throw new Error('Invalid fixed comparison surface');
const seed=1571198069,time=60,windStrength=.55,aspect=1672/941,tanFov=.2867;
const seedPhase=(seed%71)/71*.35;
const wind=[windStrength*(.52+.23*Math.sin(time*.055+seedPhase*3)),windStrength*.26*Math.sin(time*.031+.6)];
const drift=[windStrength*(.32*Math.sin(time*.027)+.11*Math.sin(time*.071)),Math.sin(time*.04)*.015,0];
const sourceHashes=Object.fromEntries(['volume','motion','motionField','camera','cloudShader'].map(name=>[name,createHash('sha256').update(readFileSync(new URL(`../src/cumulonimbus/${name}.ts`,import.meta.url))).digest('hex')]));
const clamp=(v:number)=>Math.max(0,Math.min(1,v));
const smooth=(a:number,b:number,v:number)=>{const t=clamp((v-a)/(b-a));return t*t*(3-2*t);};
const rounded=(v:number)=>Math.round(v*1e7)/1e7;
const normal=(v:number[])=>{const length=Math.hypot(...v);return v.map(x=>x/length);};
const luminance=(v:number[])=>v[0]*.2126+v[1]*.7152+v[2]*.0722;
console.log('Generating one full 256³ / 128³ density and light reference…');
const volume=generateVolume(256,seed),ice=iceHeights(seed),state=motionState(time,seed),field=new Uint16Array(MOTION_FIELD_SIZE**3*4),local=new Float64Array(4);
fillMotionField(field,MOTION_FIELD_SIZE,state,ice);
const center=volume.supportBounds.min.map((v,i)=>(v+volume.supportBounds.max[i])/2);
const bounds={min:volume.supportBounds.min.map((v,i)=>v+drift[i]-[1.3,0,.65][i]),max:volume.supportBounds.max.map((v,i)=>v+drift[i]+[1.3,0,.65][i])};
const sun=solarDirection(0),lighting=atmosphereLighting(sun,1,0);
function material(position:number[],inspection=0,distance=Infinity){
 writeFilteredSourcePosition(position.map((v,i)=>v-drift[i]),state,ice,wind,field,local);
 const [x,y,z,flowErosion]=local;
 if(x< -5||x>5||y< -.5||y>8||z< -3.5||z>3.5)return {density:0,raw:0,solarTau:0,skyTau:0,ice:0};
 const amount=smooth(ice[0],ice[1],y),d=volume.detail;
 const r=sampleDetail(d,x*.3,y*.3,z*.3,0),g=sampleDetail(d,x*.3,y*.3,z*.3,1),b=sampleDetail(d,x*.3,y*.3,z*.3,2);
 const wx=(g-.5)*(.16-.08*amount),wy=(b-.5)*(.12-.1*amount),wz=(r-.5)*(.16-.06*amount);
 const raw=sampleDetail(volume,(x+wx+5)/10,(y+wy+.5)/8.5,(z+wz+3.5)/7,0,false);
 const microWeight=inspection*(1-smooth(.08,.3,distance))*(1-amount);
 const microErosion=microWeight>.001?microWeight*(1-sampleDetail(d,x*8,y*8,z*8,2))*.055:0;
 let density=raw<.002?0:sampleCloudDensity(volume,d,x,y,z,amount,flowErosion+microErosion);
 if(density<.002)density=0;
 return {density,raw,solarTau:sampleDetail(volume,(x+5)/10,(y+.5)/8.5,(z+3.5)/7,1,false)*16,skyTau:sampleDetail(volume,(x+5)/10,(y+.5)/8.5,(z+3.5)/7,3,false)*16,ice:amount};
}
const view=new OrbitView(),home=view.frame(center,aspect,0).origin;
const probe=probeApproach(center,home,p=>material(p).density,bounds);
const rays=[{name:'center',uv:[.5,.5]},{name:'left',uv:[.35,.5]},{name:'right',uv:[.65,.5]},{name:'up',uv:[.5,.35]},{name:'down',uv:[.5,.65]}];
type VisibleSample={weight:number;distance:number;density:number;raw:number;solarTau:number;skyTau:number;source:number};
function statistics(samples:VisibleSample[],key:keyof Omit<VisibleSample,'weight'>){
 const weight=samples.reduce((sum,s)=>sum+s.weight,0),mean=samples.reduce((sum,s)=>sum+s.weight*s[key],0)/weight;
 const deviation=Math.sqrt(samples.reduce((sum,s)=>sum+s.weight*(s[key]-mean)**2,0)/weight);
 const sorted=[...samples].sort((a,b)=>a[key]-b[key]);
 const quantile=(fraction:number)=>{let sum=0;for(const s of sorted){sum+=s.weight;if(sum>=weight*fraction)return s[key];}return sorted.at(-1)?.[key]??0;};
 return {mean:rounded(mean),standardDeviation:rounded(deviation),coefficientOfVariation:rounded(deviation/Math.max(1e-12,Math.abs(mean))),q10:rounded(quantile(.1)),median:rounded(quantile(.5)),q90:rounded(quantile(.9))};
}
function histogram(samples:VisibleSample[],key:'raw'|'density',edges:number[]){
 const bins=new Array(edges.length-1).fill(0),total=samples.reduce((sum,s)=>sum+s.weight,0);
 for(const s of samples){const at=Math.max(0,Math.min(bins.length-1,edges.findIndex((edge,i)=>i>0&&s[key]<edge)-1));bins[at]+=s.weight;}
 return {edges,opacityFractions:bins.map(v=>rounded(v/total))};
}
function march(approach:number,uv:number[],step:number){
 view.setApproach(approach);const camera=view.frame(center,aspect,0,comparisonSurface??probe.distance),origin=camera.origin;
 const sx=uv[0]*2-1,sy=1-uv[1]*2-.16*(1-approach),ray=normal([sx*aspect*tanFov,sy*tanFov,-1]);
 let near=0,far=Infinity;
 for(let i=0;i<3;i++){
  if(Math.abs(ray[i])<1e-12){if(origin[i]<bounds.min[i]||origin[i]>bounds.max[i])return {hit:false};continue;}
  const a=(bounds.min[i]-origin[i])/ray[i],b=(bounds.max[i]-origin[i])/ray[i];near=Math.max(near,Math.min(a,b));far=Math.min(far,Math.max(a,b));
 }
 if(far<=near)return {hit:false};
 const mu=ray.reduce((sum,v,i)=>sum+v*sun[i],0),forward=(1-.68**2)/Math.max(1+.68**2-2*.68*mu,.04)**1.5,back=(1-.25**2)/Math.max(1+.25**2+2*.25*mu,.04)**1.5,phase=.45+.55*(.82*forward+.18*back);
 let transmittance=1;const samples:VisibleSample[]=[];
 for(let entry=near;entry<far&&transmittance>=.006;entry+=step){
  const distance=Math.min(step,far-entry),t=entry+distance*.5,p=origin.map((v,i)=>v+ray[i]*t),m=material(p,approach,t);
  if(m.density<=0)continue;
  const opacity=-Math.expm1(-m.density*materialExtinction(m.ice)*distance),weight=transmittance*opacity;
  const color=lighting.solar.map((solar,c)=>solar*1.65*Math.exp(-m.solarTau)*phase+lighting.ambient[c]*(.18+.82*Math.exp(-m.skyTau*.35))+[1,.985,.95][c]*(.27*Math.exp(-m.solarTau*.45)+.10*Math.exp(-m.solarTau*.18))+[.028,.032,.04][c]);
  samples.push({weight,distance:t,density:m.density,raw:m.raw,solarTau:m.solarTau,skyTau:m.skyTau,source:luminance(color)});
  transmittance*=1-opacity;
 }
 if(!samples.length)return {hit:true,opacity:0,transmittance:1};
 const opacity=1-transmittance,saturated=samples.filter(s=>s.raw>=.98).reduce((sum,s)=>sum+s.weight,0),exact=samples.filter(s=>s.raw>=1-1e-7).reduce((sum,s)=>sum+s.weight,0);
 return {hit:true,opacity:rounded(opacity),transmittance:rounded(transmittance),contributingSegments:samples.length,rawSaturatedOpacityFraction:rounded(saturated/opacity),rawExactlyOneOpacityFraction:rounded(exact/opacity),distanceKm:statistics(samples,'distance'),density:statistics(samples,'density'),solarTau:statistics(samples,'solarTau'),skyTau:statistics(samples,'skyTau'),macroSourceLuminance:statistics(samples,'source'),densityDistribution:histogram(samples,'density',[0,.025,.1,.25,.5,.75,.9,.98,1.000001]),rawDistribution:histogram(samples,'raw',[0,.25,.5,.75,.9,.98,1.000001])};
}
const poses=[.8,.95,1].map(approach=>{
 view.setApproach(approach);const camera=view.frame(center,aspect,0,comparisonSurface??probe.distance);
 const results=rays.map(r=>({name:r.name,uv:r.uv,steps:[.003,.006].map(stepKm=>({stepKm,...march(approach,r.uv,stepKm)}))}));
 const means=results.map(r=>r.steps[0]).filter(r=>'macroSourceLuminance'in r).map(r=>(r as any).macroSourceLuminance.mean),average=means.reduce((a,b)=>a+b,0)/means.length;
 return {approach,origin:camera.origin.map(rounded),distanceFromTargetKm:rounded(camera.distance),estimatedCentralClearanceMetres:rounded((camera.distance-(probe.distance-.003))*1000),macroSourceAcrossFiveRays:{mean:rounded(average),coefficientOfVariation:rounded(Math.sqrt(means.reduce((sum,v)=>sum+(v-average)**2,0)/means.length)/average),relativeRange:rounded((Math.max(...means)-Math.min(...means))/average)},rays:results};
});
const report={date:new Date().toISOString(),method:'CPU diagnostic, not WGSL execution, GPU readback, final pixel rendering or photographic validation. One existing 256³ macro/128³ detail volume; current16³ half-float clamp/trilinear motion reference. Corrected probe uses filtered field+flow.a, with camera micro erosion omitted conservatively. Runtime default windStrength=.55 at cloud time60; no gust/dispersion/rain/flash; mature growth. Five specified UV rays, front yaw/pitch0,1672x941 aspect,FOV tan .2867. Fixed midpoint quadrature at3m and6m with exponential integration and transmittance cutoff.006. Density includes existing camera micro erosion; opacity weights are T_before*(1-exp(-sigma*ds)). Cache depths decoded as stored UNORM8*16 at unwarped local coordinates. Source is existing clear/day direct+ambient+multiple lighting before aerial mixing and tone mapping. Density and cached lighting use the current source model and its recorded hashes; a fixed comparison radius, when supplied, is not recomputed from this material. Histograms and moments use visible opacity weights, not radiance weights. Raw>=.98 flags nearly saturated macro samples; exact raw1 is immune to normalized subtractive erosion.',sourceHashes,comparisonSurfaceKm:comparisonSurface,seed,time,windStrength,wind:wind.map(rounded),drift:drift.map(rounded),center:center.map(rounded),volume:256,detail:volume.detail.size,motionField:MOTION_FIELD_SIZE,iceRange:ice,probe,lighting,poses};
writeFileSync(output,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(poses.map(p=>({approach:p.approach,centralClearanceMetres:p.estimatedCentralClearanceMetres,sourceAcrossRays:p.macroSourceAcrossFiveRays,rays:p.rays.map(r=>({name:r.name,...Object.fromEntries(['rawSaturatedOpacityFraction','rawExactlyOneOpacityFraction','transmittance','density','solarTau','skyTau','macroSourceLuminance'].map(key=>[key,(r.steps[0] as any)[key]]))}))}))));
