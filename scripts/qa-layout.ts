/** Opt-in projected-shoulder prefix audit. Never rasterizes or bakes a volume. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {endianness} from 'node:os';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createLayoutPrefix,assertJointLayoutContract} from '../src/cumulonimbus/layoutPrefix.test-helper';
type Check=ReturnType<typeof assertJointLayoutContract>;
type Row=Check&{seed:number;family:string;lobes:number;layoutSHA256:string;baselineSHA256?:string;baselineExact?:boolean;r3ProjectedDeltaKm?:number;projectedDeltaKm?:number;r3FullAxisRecenterKm?:number};
type Reference={lobes:number[][];rngStreams:{initialSeed:number;calls:number}[];lobeCount:number};
type Prefix=(seed:number)=>Reference;
const [output,baselineFile,r3File]=process.argv.slice(2);
if(!output||Boolean(baselineFile)!==Boolean(r3File))throw new Error('Usage: bun scripts/qa-layout.ts <output.json> [baseline-prefix.mjs r3-prefix.mjs]');
const source=readFileSync(new URL('../src/cumulonimbus/volume.ts',import.meta.url),'utf8');
const sha=(data:string|Uint8Array)=>createHash('sha256').update(data).digest('hex');
const trace=createLayoutPrefix(source),refs:Prefix[]=[],referenceInputs:{path:string;sha256:string}[]=[];
for(const filename of baselineFile?[baselineFile,r3File!]:[]){
 const path=resolve(filename),module=await import(pathToFileURL(path).href) as {traceLayout:Prefix};assert.equal(typeof module.traceLayout,'function');
 for(const forbidden of ['new Float32Array','new Uint8Array','generateDetail(','bakeOccupancy('])assert(!module.traceLayout.toString().includes(forbidden),forbidden);
 refs.push(module.traceLayout);referenceInputs.push({path,sha256:sha(readFileSync(path))});
}
assert.equal(endianness(),'LE');
function layoutBytes(lobes:readonly (readonly (number|undefined)[])[]){
 let count=1;for(const lobe of lobes)count+=1+lobe.length;
 const data=new Float64Array(count);let at=0;data[at++]=lobes.length;
 for(const lobe of lobes){data[at++]=lobe.length;for(const value of lobe){assert(Number.isFinite(value));data[at++]=value!;}}
 return Buffer.from(data.buffer);
}
const cpu=()=>{const value=process.cpuUsage();return value.user+value.system;};
const rows:Row[]=[];let incomplete=false,maxR3ProjectedDeltaDifferenceKm=0;
const counts={congestus:0,multicell:0,sheared:0,inwardProjectionR3Matched:0,outwardBaselineExact:0,otherFamilyBaselineExact:0,wholeBaselineExact:0,beforeJointBaselineExact:0,shearedBodyBaselineExact:0,allNonXZBaselineExact:0,outsideSelectedBaselineExact:0,r3ReferenceLayoutsEvaluated:0};
for(let seed=0;seed<=1023;seed++){
 if(cpu()>4_500_000){incomplete=true;break;}
 const t=trace(seed),check=assertJointLayoutContract(t),bytes=layoutBytes(t.lobes);counts[t.family]++;
 const row:Row={seed,family:t.family,lobes:t.lobes.length,...check,layoutSHA256:sha(bytes)};
 if(refs.length){
  const a=refs[0](seed),aBytes=layoutBytes(a.lobes);assert.equal(a.lobeCount,t.lobes.length);assert.deepEqual(t.afterRng,a.rngStreams);
  assert(layoutBytes(t.before).equals(aBytes),'Before-joint layout differs from baseline seed '+seed);counts.beforeJointBaselineExact++;
  const aExact=bytes.equals(aBytes);if(aExact)counts.wholeBaselineExact++;
  // The observed helper checks exact body/outside/non-XZ tuples against before;
  // the before stream above is independently identical to the real baseline.
  if(t.family==='sheared'){assert(check.bodyExact);counts.shearedBodyBaselineExact++;}
  assert(t.family!=='sheared'||check.allNonXZExact&&check.outsideSelectedExact);
  counts.allNonXZBaselineExact++;counts.outsideSelectedBaselineExact++;
  if(check.mode==='inward-projected'){
   const r3=refs[1](seed);counts.r3ReferenceLayoutsEvaluated++;assert.equal(r3.lobeCount,t.lobes.length);assert.deepEqual(t.afterRng,r3.rngStreams);
   const core=check.selectedCore!,unit=check.inwardUnitXZ!,delta=check.recenterDeltaXZ!;
   const oldDelta:[number,number]=[r3.lobes[core][0]-a.lobes[core][0],r3.lobes[core][2]-a.lobes[core][2]];
   const projected=delta[0]*unit[0]+delta[1]*unit[1],r3Projected=oldDelta[0]*unit[0]+oldDelta[1]*unit[1],difference=Math.abs(projected-r3Projected);
   assert(difference<1e-12,'Projected component differs from R3 seed '+seed);maxR3ProjectedDeltaDifferenceKm=Math.max(maxR3ProjectedDeltaDifferenceKm,difference);
   counts.inwardProjectionR3Matched++;Object.assign(row,{projectedDeltaKm:projected,r3ProjectedDeltaKm:r3Projected,r3FullAxisRecenterKm:Math.hypot(...oldDelta)});
  }else if(check.mode==='outward-unchanged'){assert(aExact,'Outward layout changed seed '+seed);counts.outwardBaselineExact++;}
  else{assert(aExact,'Other family changed seed '+seed);counts.otherFamilyBaselineExact++;}
  Object.assign(row,{baselineSHA256:sha(aBytes),baselineExact:aExact});
 }
 rows.push(row);
}
const topFiveInwardRecenterKm=rows.filter(row=>row.mode==='inward-projected').sort((a,b)=>b.recenterKm!-a.recenterKm!||a.seed-b.seed).slice(0,5).map(({seed,recenterKm,recenterDeltaXZ,projection,r3FullAxisRecenterKm})=>({seed,recenterKm,recenterDeltaXZ,projection,r3FullAxisRecenterKm}));
const report={status:incomplete?'INCOMPLETE_CPU_BUDGET':'PASS_PROJECTED_SHOULDER_LAYOUT_CONTRACTS',rangeInclusive:[0,1023],checked:rows.length,sourceSHA256:sha(source),references:referenceInputs,counts,topFiveInwardRecenterKm,maxR3ProjectedDeltaDifferenceKm,
 runtime:{node:process.version,bun:process.versions.bun??null,arch:process.arch},cpuUs:cpu(),rows,layoutEncoding:'Float64LE stream: lobe count, tuple lengths, every component; signed zero retained',
 scope:'Three actual prefixes: baseline/R3/final. R3 evaluated only for inward projections. Unchanged-family/outward layouts, sheared bodies and all non-XZ/outside tuples are baseline-exact; component/perpendicular/relative-offset properties use1e-12km precision. No density/bake/GPU/artistic/FPS proof.'};
writeFileSync(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({...report,rows:undefined}));
if(incomplete||report.cpuUs>5_000_000)process.exitCode=1;
