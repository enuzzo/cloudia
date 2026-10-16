import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {terrainHeight} from '/Users/enuzzo/Library/CloudStorage/Dropbox/Mitnick/Cloudia/src/cumulonimbus/landscape.ts';
import {TerrainBounds} from '../terrain-bounds/bounds.ts';
import {buildTerrainMetadata,PackedLookup} from './data.ts';
import {tracePacked} from './packed-trace.ts';
const dir=new URL('./',import.meta.url),sha=(b:Uint8Array)=>createHash('sha256').update(b).digest('hex');
const landscapePath='/Users/enuzzo/Library/CloudStorage/Dropbox/Mitnick/Cloudia/src/cumulonimbus/landscape.ts',sourceSha=sha(readFileSync(landscapePath)),expected='72a15a3c6b422405324b2006d94e5074c33eb272bbbe51e123a79eb3b2b90d99';
if(sourceSha!==expected)throw Error('Terrain source changed');
const matrix=JSON.parse(readFileSync(new URL('../terrain-bounds/matrix14.json',dir),'utf8')),failures:any[]=[],packs:any[]=[];
const began=performance.now();
for(const coarseKm of [32,16]){
 const pack=buildTerrainMetadata({coarseKm,fineKm:1,heightGuardKm:.02}),lookup=new PackedLookup(pack),builder=new TerrainBounds(),start=performance.now();
 const results=matrix.poses.map((p:any)=>tracePacked(p,builder,lookup,{budget:256,maxHeightEvaluations:16,stackCapacity:48}));
 for(const r of results)if(r.status.startsWith('unresolved')||r.heightEvaluations>16||r.visits>256||(r.status==='hit'&&(r.enclosureKm>.001+1e-12||r.witness.upperClearance>0)))failures.push({kind:'ray-contract',coarseKm,r});
 let sampleChecks=0;for(const n of pack.nodes){
  for(const [u,v] of [[0,0],[1,0],[0,1],[1,1],[.5,.5]]){const x=n.rect.x0+(n.rect.x1-n.rect.x0)*u,z=n.rect.z0+(n.rect.z1-n.rect.z0)*v,h=terrainHeight(x,z);sampleChecks++;if(h<n.bounds[0]||h>n.bounds[1])failures.push({kind:'metadata-height-bound',coarseKm,node:n.index,x,z,h,bound:n.bounds});}
 }
 const summary={statuses:results.reduce((a:any,r:any)=>{a[r.status]=(a[r.status]??0)+1;return a;},{}),heightCalls:results.reduce((a:number,r:any)=>a+r.heightEvaluations,0),maxHeightCalls:Math.max(...results.map((r:any)=>r.heightEvaluations)),visits:results.reduce((a:number,r:any)=>a+r.visits,0),maxVisits:Math.max(...results.map((r:any)=>r.visits)),maxStack:Math.max(...results.map((r:any)=>r.maxStack)),dynamicQueries:results.reduce((a:number,r:any)=>a+r.dynamicBounds,0),metadataLoads:lookup.loads,metadataTexelLoads:lookup.loads*2};
 const binaryName=`terrain-${coarseKm}km-coarse-1km-local.rgba32f.bin`;writeFileSync(new URL(binaryName,dir),new Uint8Array(pack.data.buffer));
 const descriptor={version:'terrain-bounds-packed-v1',sourceSha256:sourceSha,binary:binaryName,binarySha256:sha(new Uint8Array(pack.data.buffer)),format:'rgba32float',width:pack.width,height:pack.height,nodeCount:pack.nodes.length,nodeStrideBytes:32,byteLength:pack.data.byteLength,coarseKm,fineKm:pack.fineKm,domainKm:pack.domainKm,refinedKm:pack.refinedKm,heightGuardKm:pack.heightGuardKm,heightGuardUniversallyQualified:false,GPUQualified:false,preparationMs:pack.preparationMs,builderCounters:pack.builderCounters};
 writeFileSync(new URL(`terrain-${coarseKm}km-descriptor.json`,dir),JSON.stringify(descriptor,null,2)+'\n');packs.push({descriptor,summary,sampleChecks,traceCpuMs:performance.now()-start,results});
}
const report={passed:!failures.length,scope:'CPU serialized metadata and traversal qualification; generated WGSL has not executed on GPU',sourceSha256:sourceSha,implementation:Object.fromEntries(['data.ts','packed-trace.ts','qualify.ts'].map(name=>[name,sha(readFileSync(new URL(name,dir)))])),limits:{nodeVisits:256,heightCalls:16,stackCapacity:48,hitToleranceKm:.001},generatedVolumes:0,GPU:false,productModified:false,packs,failures,elapsedMs:performance.now()-began};writeFileSync(new URL('qualification.json',dir),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:report.passed,packs:packs.map(({descriptor,summary,sampleChecks,traceCpuMs})=>({descriptor,summary,sampleChecks,traceCpuMs})),failures:failures.slice(0,8),elapsedMs:report.elapsedMs},null,2));if(failures.length)process.exitCode=1;
