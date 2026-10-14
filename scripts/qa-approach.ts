/** CPU-only regression/performance audit. No browser, GPU or visual acceptance. */
import {writeFileSync} from 'node:fs';
import {generateVolume,sampleCloudDensity,iceHeights,BOUNDS_MIN,BOUNDS_SIZE} from '../src/cumulonimbus/volume';
import {motionState,sourcePosition} from '../src/cumulonimbus/motion';
import {OrbitView,probeApproach} from '../src/cumulonimbus/camera';
const output=process.argv[2];if(!output)throw new Error('Usage: bun scripts/qa-approach.ts <output.json>');
const seed=1571198069,time=60,start=performance.now();
console.log('Generating full 256³ / 128³ CPU reference…');
const volume=generateVolume(256,seed),ice=iceHeights(seed),state=motionState(time,seed);
const center=volume.supportBounds.min.map((v,i)=>(v+volume.supportBounds.max[i])/2);
const wind=[.3,.1],drift=[.2,0,0];
const bounds={min:volume.supportBounds.min.map((v,i)=>v+drift[i]),max:volume.supportBounds.max.map((v,i)=>v+drift[i])};
const density=(p:number[])=>{
 const q=sourcePosition(p.map((v,i)=>v-drift[i]),state,ice,wind);
 if(q.some((v,i)=>v<BOUNDS_MIN[i]||v>BOUNDS_MIN[i]+BOUNDS_SIZE[i]))return 0;
 const h=Math.max(0,Math.min(1,(q[1]-ice[0])/(ice[1]-ice[0]))),amount=h*h*(3-2*h);
 return sampleCloudDensity(volume,volume.detail,q[0],q[1],q[2],amount);
};
function reference(home:number[],steps:number){
 const delta=home.map((v,i)=>v-center[i]),length=Math.hypot(...delta),d=delta.map(v=>v/length);
 let outside=length,samples=0;
 const sample=(t:number)=>{samples++;return density(center.map((v,i)=>v+d[i]*t))>.025;};
 for(let i=1;i<=steps;i++){
  const inside=length*(1-i/steps);
  if(sample(inside)){let lo=inside,hi=outside;for(let j=0;j<10;j++){const mid=(lo+hi)/2;if(sample(mid))lo=mid;else hi=mid;}
   return {found:true,distance:Math.min(length,hi+.003),samples};}
  outside=inside;
 }
 return {found:false,distance:Math.min(length,.4),samples};
}
const cases=[];
for(const aspect of [16/9,390/844])for(const yaw of [-.8,0,.8])for(const pitch of [-.35,0,.35]){
 const view=new OrbitView();view.yaw=yaw;view.pitch=pitch;const home=view.frame(center,aspect,0).origin;
 const old=reference(home,192),dense=reference(home,Math.ceil(Math.hypot(...home.map((v,i)=>v-center[i]))/.0025));
 const probe=probeApproach(center,home,density,bounds),timings=[];
 for(let i=0;i<6;i++){const begin=performance.now();probeApproach(center,home,density,bounds);if(i)timings.push(performance.now()-begin);}
 cases.push({aspect,yaw,pitch,old,dense,probe,oldErrorMetres:1000*Math.abs(old.distance-dense.distance),errorMetres:1000*Math.abs(probe.distance-dense.distance),cpuMs:timings});
}
const timings=cases.flatMap(c=>c.cpuMs).sort((a,b)=>a-b);
const report={date:new Date().toISOString(),method:'CPU only, 18 camera poses, fixed material state; 2.5m dense CPU search reference. No GPU/compositor/visual claim.',seed,time,wind,drift,volume:256,detail:volume.detail.size,durationSeconds:(performance.now()-start)/1000,
 summary:{cases:cases.length,maxOldErrorMetres:Math.max(...cases.map(c=>c.oldErrorMetres)),maxErrorMetres:Math.max(...cases.map(c=>c.errorMetres)),medianCpuMs:timings[Math.floor(timings.length/2)],p95CpuMs:timings[Math.floor(timings.length*.95)],maxCpuMs:timings.at(-1),maxSamples:Math.max(...cases.map(c=>c.probe.samples))},cases};
writeFileSync(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report.summary));
