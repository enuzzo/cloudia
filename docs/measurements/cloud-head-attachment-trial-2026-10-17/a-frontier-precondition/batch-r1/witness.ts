import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {dirname,resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const here=dirname(fileURLToPath(import.meta.url)),out=resolve(here,'run');
const hash=(v:Uint8Array|string)=>createHash('sha256').update(v).digest('hex');
const check=(v:unknown,s:string)=>{if(!v)throw new Error(s);};
async function main(){
 check(process.env.CLOUDIA_HEAD_A==='cycle45-root-authorized','Use frozen launcher');
 const f=JSON.parse(readFileSync(resolve(here,'PRE-RUN-FREEZE.json'),'utf8'));
 const canonical=await import(pathToFileURL(resolve(f.canonicalRoot,'src/cumulonimbus/volume.ts')).href);
 const observer=await import(pathToFileURL(resolve(f.candidateRoot,'src/cumulonimbus/layoutPrefix.test-helper.ts')).href);
 const source=readFileSync(resolve(f.canonicalRoot,'src/cumulonimbus/volume.ts'),'utf8');
 const trace=observer.createLayoutPrefix(source,'legacy');
 const cases=[];let allPass=true;
 for(const seed of f.seeds as number[]){
  const layout=trace(seed),heads=layout.summits.map((id:number)=>layout.lobes[id]);
  const start=performance.now(),volume=canonical.generateVolume(64,seed);
  const result=observer.observeHeadDensityFrontiers(volume,heads);
  const highest=result.heads.map((h:any)=>h.highestFrontierYKm),indices=result.heads.map((h:any)=>h.highestFrontierIndex);
  const order=heads.map((h:number[],i:number)=>({i,y:h[1]})).sort((a:any,b:any)=>b.y-a.y);
  const checks={everyHeadHasUpperFrontier:result.heads.every((h:any)=>h.frontierVoxels>0&&Number.isFinite(h.highestFrontierYKm)),distinctAssignedFrontiers:new Set(indices).size===indices.length,
   multicellAgeDifference:canonical.morphologyFamily(seed)!=='multicell'||highest[order[0].i]-highest[order[1].i]>.25};
  const pass=Object.values(checks).every(Boolean);allPass=allPass&&pass;
  cases.push({seed,family:canonical.morphologyFamily(seed),generatedSize:volume.size,detailSize:volume.detail.size,allFiveLightBakes:true,layoutLobes:layout.lobes.length,layoutSHA256:hash(JSON.stringify(layout.lobes)),rng:layout.afterRng,macroRGBASHA256:hash(volume.data),detailRGBASHA256:hash(volume.detail.data),sunsetSHA256:hash(volume.sunsetLight),observer:result,checks,pass,wallMs:performance.now()-start});
 }
 const result={status:allPass?'PASS_A_PRECONDITION_ONLY':'FAIL_STOP_BEFORE_B',scope:'Canonical A64 actual full generations only; frozen raw density-frontier observer, no candidate model/GPU/acceptance',seeds:f.seeds,cases};
 writeFileSync(resolve(out,'result.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify({status:result.status,cases:cases.map(c=>({seed:c.seed,pass:c.pass,checks:c.checks}))}));
 if(!allPass)process.exitCode=2;
}
main().catch(e=>{console.error(e.stack||String(e));process.exitCode=1;});
