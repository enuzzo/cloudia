/** Deterministic transport references, independent of browser/GPU execution. */
import {writeFileSync} from 'node:fs';
import {integrateMediaSegment} from '../src/cumulonimbus/medium';
import {bakeOpticalDepth} from '../src/cumulonimbus/light';
import {solarDirection} from '../src/cumulonimbus/sun';
const output=process.argv[2];if(!output)throw new Error('Usage: bun scripts/qa-light-transport.ts <output.json>');
const length=5,cloudExtinction=.7,rainExtinction=.35,cloudSource=[1,.7,.4],rainSource=[.1,.3,.9];
const analyticTransmission=Math.exp(-(cloudExtinction+rainExtinction)*length);
const analyticRadiance=cloudSource.map((v,i)=>(v*cloudExtinction+rainSource[i]*rainExtinction)/(cloudExtinction+rainExtinction)*(1-analyticTransmission));
const cases=[];
for(const steps of [8,16,64,384,8192]){
 const step=length/steps,cell=integrateMediaSegment(cloudExtinction,cloudSource,rainExtinction,rainSource,step);
 const cloudOpacity=-Math.expm1(-cloudExtinction*step),rainOpacity=-Math.expm1(-rainExtinction*step);
 let transmission=1,oldTransmission=1;const light=[0,0,0],oldLight=[0,0,0];
 for(let i=0;i<steps;i++){
  for(let c=0;c<3;c++){
   light[c]+=transmission*cell.radiance[c];
   oldLight[c]+=oldTransmission*(rainSource[c]*rainOpacity+(1-rainOpacity)*cloudSource[c]*cloudOpacity);
  }
  transmission*=cell.transmittance;oldTransmission*=(1-rainOpacity)*(1-cloudOpacity);
 }
 cases.push({steps,stepKm:step,transmission,radiance:light,transmissionError:Math.abs(transmission-analyticTransmission),maxRadianceError:Math.max(...light.map((v,i)=>Math.abs(v-analyticRadiance[i]))),previousOrderedRadiance:oldLight,previousMaxRadianceError:Math.max(...oldLight.map((v,i)=>Math.abs(v-analyticRadiance[i])))});
}
// A blocker casts into genuinely empty cells, which must not default to full sun
// when density filters across a neighbouring voxel. This probes the real baker.
const size=48,dimensions=[10,8.5,7],density=new Float32Array(size**3),index=(x:number,y:number,z:number)=>(z*size+y)*size+x;
for(let z=15;z<33;z++)for(let y=15;y<33;y++)for(let x=22;x<25;x++)density[index(x,y,z)]=1;
const cacheCases=[];
for(const direction of [solarDirection(0),solarDirection(0,true),solarDirection(1,true)]){
 const depth=bakeOpticalDepth(density,size,dimensions,direction,18);
 let shadowedEmptyCells=0,maxEmptyDepth=0;
 for(let i=0;i<density.length;i++)if(density[i]===0&&depth[i]>.01){shadowedEmptyCells++;maxEmptyDepth=Math.max(maxEmptyDepth,depth[i]);}
 cacheCases.push({direction,allFinite:depth.every(Number.isFinite),shadowedEmptyCells,maxEmptyDepth});
}
const report={date:new Date().toISOString(),method:'CPU Float64 homogeneous co-located transport and Float32 real optical-depth baker. Not WGSL execution, heterogeneous convergence, browser appearance, GPU timing or presentation.',medium:{lengthKm:length,cloudExtinction,rainExtinction,cloudSource,rainSource,analyticTransmission,analyticRadiance},cases,cache:{size,dimensions,cases:cacheCases}};
writeFileSync(output,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({maxRadianceError:Math.max(...cases.map(c=>c.maxRadianceError)),previousErrorAt384:cases.find(c=>c.steps===384)?.previousMaxRadianceError,cacheCases}));
