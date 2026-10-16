/** Replay the final tracer against already emitted outward metadata. This is
 * intentionally separate from expensive preparation and never starts GPU work. */
import {createHash} from 'node:crypto';
import {Lookup,type Pack,type Node} from './data.ts';
import {trace} from './trace.ts';
import {regressions} from './regressions.ts';
import {NUMERIC_CONTRACT} from './gradient.ts';
const sha=async(p:string)=>createHash('sha256').update(await Bun.file(p).bytes()).digest('hex');
const original=await Bun.file('results.json').json(),source='./landscape.source.ts';
if(await sha(source)!==original.sourceSha256)throw Error('Original terrain changed');
if(await sha('./audit-cases.json')!==original.datasetSha256)throw Error('Ray dataset changed');
const old=original.byVariant['250m-outer2km'],summary=old.summaries[0],data=new Float32Array(await Bun.file('terrain-gradient-250m-outer2km.rgba32f.bin').arrayBuffer());
const nodes:Node[]=[];for(let index=0;index<data.length/12;index++){const i=index*12,x=data[i+4],z=data[i+5],s=data[i+6];nodes.push({index,height:[data[i],data[i+1]],firstChild:data[i+2],level:data[i+3],rect:{x0:x,x1:x+s,z0:z,z1:z+s},errorKm:data[i+7],gx:[data[i+8],data[i+9]],gz:[data[i+10],data[i+11]]});}
const pack:Pack={nodes,data,bytes:data.byteLength,coarseKm:32,fineKm:.25,outerFineKm:2,preparationMs:summary.preparationMs,contract:NUMERIC_CONTRACT,work:old.work},cases=await Bun.file('./audit-cases.json').json();
const summaries:any[]=[],allRows:any={};
for(const strategy of['midpoint','front'])for(const cap of[16,32,64]){
 const lookup=new Lookup(pack),began=performance.now(),rows=cases.rays.map((r:any)=>({...trace(r,lookup,{maxHeightEvaluations:cap,sampleAtFront:strategy==='front'}),group:r.group,index:r.index})),traceMs=performance.now()-began;
 const counts:Record<string,number>={},groups:Record<string,Record<string,number>>={},comparisons:any[]=[],invalidWitnesses:any[]=[];
 for(let i=0;i<rows.length;i++){const r=rows[i],prev=cases.rays[i].cpu;counts[r.status]=(counts[r.status]??0)+1;groups[r.group]??={};groups[r.group][r.status]=(groups[r.group][r.status]??0)+1;
  if(r.status==='hit'&&(!(r.enclosureKm<=.00100001)||!(r.witness?.upperClearance<=0)))invalidWitnesses.push({name:r.name,r});
  if((r.status==='miss'||r.status==='outer-envelope-miss')&&prev.status==='hit')comparisons.push({name:r.name,kind:'old-hit-new-miss'});
  if(r.status==='hit'&&['miss','outer-envelope-miss'].includes(prev.status))comparisons.push({name:r.name,kind:prev.relief===0&&prev.sea!==null&&r.seaOnly?'old-sea-boundary-rounding-miss':'old-miss-new-hit',old:prev,current:r});
  if(r.status==='hit'&&prev.status==='hit'&&r.interval&&prev.interval&&(r.interval[0]>prev.interval[1]+1e-5||prev.interval[0]>r.interval[1]+1e-5))comparisons.push({name:r.name,kind:'disjoint-entry-enclosures',old:prev.interval,current:r.interval});
 }
 const sorted=(key:string)=>rows.map((r:any)=>r[key]).sort((a:number,b:number)=>a-b),calls=sorted('heightEvaluations'),visits=sorted('visits'),gradient=sorted('gradientQueries');
 const result={...summary,strategy,cap,traceMs,counts,groups,totalHeightCalls:calls.reduce((a:number,b:number)=>a+b,0),medianHeightCalls:calls[Math.floor(calls.length/2)],maxHeightCalls:calls.at(-1),totalVisits:visits.reduce((a:number,b:number)=>a+b,0),maxVisits:visits.at(-1),totalGradientQueries:gradient.reduce((a:number,b:number)=>a+b,0),metadataLoads:lookup.loads,invalidWitnesses,comparisons};
 summaries.push(result);allRows[strategy+'-'+cap]=rows;
 console.log(JSON.stringify({...result,verification:{...result.verification,failures:undefined},comparisons:comparisons.map(c=>({name:c.name,kind:c.kind}))}));
}
const final={sourceSha256:original.sourceSha256,datasetSha256:original.datasetSha256,datasetCount:5198,metadataSha256:await sha('terrain-gradient-250m-outer2km.rgba32f.bin'),builderCodeHashes:{gradient:await sha('gradient.ts'),data:await sha('data.ts')},tracerSha256:await sha('trace.ts'),contract:NUMERIC_CONTRACT,preparationReused:true,summaries,byVariant:{'250m-outer2km':{summaries,rows:allRows,work:old.work,regressions:regressions(pack,cases.rays.slice(0,14))}}};
await Bun.write('final-results.json',JSON.stringify(final,null,2));
