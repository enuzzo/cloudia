import {createHash} from 'node:crypto';
import {build,Lookup} from './data.ts';
import {trace} from './trace.ts';
import {validate} from './validate.ts';
import {NUMERIC_CONTRACT} from './gradient.ts';
import {regressions} from './regressions.ts';
const source='./landscape.source.ts';
const sha=async(path:string)=>createHash('sha256').update(await Bun.file(path).bytes()).digest('hex');
const sourceSha256=await sha(source),expected='72a15a3c6b422405324b2006d94e5074c33eb272bbbe51e123a79eb3b2b90d99';
if(sourceSha256!==expected)throw Error('Canonical source changed; do not compare different fields');
const cases=await Bun.file('./audit-cases.json').json();if(cases.rays.length!==5198)throw Error('Expected complete 5198-ray grid');
const summaries:any[]=[],byVariant:any={};
const variants=[{key:'1km',fineKm:1,outerFineKm:32},{key:'250m',fineKm:.25,outerFineKm:32},{key:'250m-outer2km',fineKm:.25,outerFineKm:2}];
for(const variant of(Bun.argv.includes('--candidate-only')?variants.slice(-1):variants)){
 const {fineKm,outerFineKm,key}=variant,pack=build({fineKm,outerFineKm}),verification=validate(pack),allRows:any={};
 for(const strategy of(outerFineKm===2?['midpoint','front']:['midpoint']))for(const cap of(outerFineKm===2?[16,32,64]:[16,32])){
  const lookup=new Lookup(pack),began=performance.now(),rows=cases.rays.map((r:any)=>({...trace(r,lookup,{maxHeightEvaluations:cap,sampleAtFront:strategy==='front'}),group:r.group,index:r.index})),traceMs=performance.now()-began;
  const counts:Record<string,number>={},groups:Record<string,Record<string,number>>={};
  for(const r of rows){counts[r.status]=(counts[r.status]??0)+1;groups[r.group]??={};groups[r.group][r.status]=(groups[r.group][r.status]??0)+1;}
  const comparisons:any[]=[],invalidWitnesses:any[]=[];
  for(let i=0;i<rows.length;i++){const r=rows[i],old=cases.rays[i].cpu;if(r.status==='hit'&&(!(r.enclosureKm<=.00100001)||!(r.witness?.upperClearance<=0))&&r.relief!==0)invalidWitnesses.push({name:r.name,status:r.status,enclosureKm:r.enclosureKm,witness:r.witness});
   if((r.status==='miss'||r.status==='outer-envelope-miss')&&old.status==='hit')comparisons.push({name:r.name,kind:'old-hit-new-miss'});
   if(r.status==='hit'&&(old.status==='miss'||old.status==='outer-envelope-miss'))comparisons.push({name:r.name,kind:old.relief===0&&old.sea!==null&&r.seaOnly?'old-sea-boundary-rounding-miss':'old-miss-new-hit',old,current:r});
   if(r.status==='hit'&&old.status==='hit'&&r.interval&&old.interval&&(r.interval[0]>old.interval[1]+1e-5||old.interval[0]>r.interval[1]+1e-5))comparisons.push({name:r.name,kind:'disjoint-entry-enclosures',old:old.interval,current:r.interval});
  }
  const sorted=(key:string)=>rows.map((r:any)=>r[key]).sort((a:number,b:number)=>a-b),calls=sorted('heightEvaluations'),visits=sorted('visits'),gradient=sorted('gradientQueries');
  const summary={variant:key,strategy,fineKm,outerFineKm,cap,nodeCount:pack.nodes.length,bytes:pack.bytes,MiB:pack.bytes/1048576,preparationMs:pack.preparationMs,traceMs,counts,groups,totalHeightCalls:calls.reduce((a:number,b:number)=>a+b,0),medianHeightCalls:calls[Math.floor(calls.length/2)],maxHeightCalls:calls.at(-1),totalVisits:visits.reduce((a:number,b:number)=>a+b,0),maxVisits:visits.at(-1),totalGradientQueries:gradient.reduce((a:number,b:number)=>a+b,0),metadataLoads:lookup.loads,invalidWitnesses,comparisons,verification};
  summaries.push(summary);allRows[strategy+'-'+cap]=rows;console.log(JSON.stringify({...summary,verification:{...verification,failures:undefined},comparisons:comparisons.slice(0,3)}));
 }
 byVariant[key]={summaries:summaries.filter(s=>s.variant===key),rows:allRows,work:pack.work};
 if(key==='250m-outer2km'){byVariant[key].regressions=regressions(pack,cases.rays.slice(0,14));await Bun.write('terrain-gradient-250m-outer2km.rgba32f.bin',pack.data);await Bun.write('terrain-gradient-250m-outer2km-descriptor.json',JSON.stringify({format:'3 RGBA32F per node',nodeCount:pack.nodes.length,byteLength:pack.bytes,coarseKm:pack.coarseKm,fineKm:pack.fineKm,outerFineKm:pack.outerFineKm,sourceSha256,contract:NUMERIC_CONTRACT},null,2));}
}
await Bun.write('results.json',JSON.stringify({sourceSha256,datasetSha256:await sha('./audit-cases.json'),datasetCount:cases.rays.length,contract:NUMERIC_CONTRACT,summaries,byVariant},null,2));
