import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {buildTerrainMeshData,terrainMeshHitAt,terrainMeshSurfaceY,type TerrainMeshData} from '../candidate-source/src/cumulonimbus/terrainMesh';
import {decodeTerrainDem,createDemTerrainSampler,sampleTerrainDem} from '../candidate-source/src/cumulonimbus/terrainDem';
import {terrainSurfaceSample} from '../candidate-source/src/cumulonimbus/terrainSurface';
const started=performance.now();
const read=(url:URL)=>{const b=readFileSync(url);return b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);};
const oldGrid=decodeTerrainDem(read(new URL('../candidate-source/src/cumulonimbus/assets/liguria-apuane-dem.bin',import.meta.url)));
const newGrid=decodeTerrainDem(read(new URL('../glo30-dem/glo30-62_5m-recomputed-coast.cdm1.bin',import.meta.url)));
if(oldGrid.side!==1025||oldGrid.spacingKm!==.125||newGrid.side!==2049||newGrid.spacingKm!==.0625||newGrid.minX!==-64||newGrid.minZ!==-64)throw new Error('Unexpected DEM coordinates');
const oldSample=createDemTerrainSampler(oldGrid,terrainSurfaceSample),newMeasured=createDemTerrainSampler(newGrid,terrainSurfaceSample);
// Preserve the exact old continuous coast function at every CPU sample; only height/gradient change.
const newSample=(x:number,z:number)=>{const next=newMeasured(x,z);next.coastKm=oldSample(x,z).coastKm;return next;};
const options=(grid:typeof newGrid)=>({cellsPerSide:256,levels:9,normalMode:'geometry' as const,refinement:{sourceGrid:{minXKm:grid.minX,minZKm:grid.minZ,spacingKm:grid.spacingKm,columns:grid.side,rows:grid.side},domain:{minXKm:-48,maxXKm:48,minZKm:-48,maxZKm:48},maxErrorKm:.005,limits:{maxProbeCount:2400000,maxVertices:1000000,maxTriangles:2000000,maxGeometryBytes:64*1024*1024}}});
const hash=(v:ArrayBufferView)=>createHash('sha256').update(new Uint8Array(v.buffer,v.byteOffset,v.byteLength)).digest('hex');
const baseline=buildTerrainMeshData(oldSample,options(oldGrid));
const oldDone=performance.now();
const expected={positions:'4c7e3f0b92c294850dad4014d3c260e0cb922ba5ade13a952722240a2e5ecc64',normals:'3cb820d4d203c89f61e8e26809ddbdcd2f8ce2645dce0842b758a1b0ea6dcbfd',surface:'7595b45c14d4d249df98d99145fcaa485b21d62e419764b99ce4fedc780c76f2',indices:'87e1b8d5b569577c291efefb1698ca66b657ecb3f9c73dcf6ddc73316a1030ae'};
for(const k of Object.keys(expected) as Array<keyof typeof expected>)if(hash(baseline[k])!==expected[k])throw new Error('Historical canonical geometry mismatch '+k);
const candidate=buildTerrainMeshData(newSample,options(newGrid));
const built=performance.now();
const invariant=(data:TerrainMeshData)=>{
 let maxNormalUnitError=0,minimumWinding=Infinity;const p=data.positions;
 for(let i=0;i<p.length;i++)if(!Number.isFinite(p[i]))throw new Error('Nonfinite position');
 for(let i=0;i<data.surface.length;i++)if(!Number.isFinite(data.surface[i]))throw new Error('Nonfinite surface');
 for(let i=0;i<data.normals.length;i+=3){const x=data.normals[i],y=data.normals[i+1],z=data.normals[i+2],e=Math.abs(Math.hypot(x,y,z)-1);if(!Number.isFinite(e)||y<=0||e>1e-6)throw new Error('Invalid normal');maxNormalUnitError=Math.max(maxNormalUnitError,e);}
 for(let i=0;i<data.indices.length;i+=3){const a=data.indices[i]*3,b=data.indices[i+1]*3,c=data.indices[i+2]*3;if(a>=p.length||b>=p.length||c>=p.length)throw new Error('Index range');const y=(p[b+2]-p[a+2])*(p[c]-p[a])-(p[b]-p[a])*(p[c+2]-p[a+2]);if(!(y>0))throw new Error('Degenerate/reversed triangle');minimumWinding=Math.min(minimumWinding,y);}
 let cursor=0,maximumCellTriangles=0,holes=0;
 for(let i=0;i<data.cellFirstIndex.length;i++){const first=data.cellFirstIndex[i],n=data.cellTriangleCount![i];if(first===0xffffffff){if(n!==0)throw new Error('Hole has triangles');holes++;continue;}if(first!==cursor||n<2||n>20)throw new Error('Noncontiguous cell');cursor+=n*3;maximumCellTriangles=Math.max(maximumCellTriangles,n);}
 if(cursor!==data.indices.length)throw new Error('Cell total');
 return {maxNormalUnitError,minimumWinding,maximumCellTriangles,holes,cellIndicesContiguous:true};
};
const invariants=invariant(candidate);
// Fixed holdout uses native GLO30 bilinear heights, independent of the62.5m raster samples.
const holdoutBytes=read(new URL('../glo30-dem/holdout-native-m.f64le.bin',import.meta.url));
if(holdoutBytes.byteLength!==147456*8)throw new Error('Unexpected holdout shape');
const refs=new DataView(holdoutBytes);
const stats=()=>({n:0,sum:0,sumSq:0,min:Infinity,max:-Infinity,maxAbs:0});
const accum=(s:ReturnType<typeof stats>,e:number)=>{s.n++;s.sum+=e;s.sumSq+=e*e;s.min=Math.min(s.min,e);s.max=Math.max(s.max,e);s.maxAbs=Math.max(s.maxAbs,Math.abs(e));};
const finish=(s:ReturnType<typeof stats>)=>({...s,meanMetres:s.sum/s.n,rmsMetres:Math.sqrt(s.sumSq/s.n)});
const oldError=stats(),newError=stats(),rasterError=stats();let improved=0,worsened=0,equal=0,n=0;
for(let iz=0;iz<384;iz++)for(let ix=0;ix<384;ix++){
 const x=-48+(4*ix+.5)*.0625,z=-48+(4*iz+.5)*.0625,native=refs.getFloat64(n*8,true);n++;
 if(!Number.isFinite(native))throw new Error('Nonfinite native holdout');
 // Land selection fixed from canonical coast; no favourable new land mask selection.
 if(oldSample(x,z).coastKm<=0)continue;
 const target=terrainMeshSurfaceY(x,z,Math.max(0,native)*.001),a=terrainMeshHitAt(baseline,x,z),b=terrainMeshHitAt(candidate,x,z),r=sampleTerrainDem(newGrid,x,z)!;
 if(!a||!b)throw new Error('Missing holdout mesh hit');
 const ea=(a.y-target)*1000,eb=(b.y-target)*1000;accum(oldError,ea);accum(newError,eb);accum(rasterError,(r.heightKm-Math.max(0,native)*.001)*1000);
 const diff=Math.abs(eb)-Math.abs(ea);if(diff<0)improved++;else if(diff>0)worsened++;else equal++;
}
const checked=performance.now();
const out=new URL('./run/arrays/',import.meta.url);mkdirSync(out,{recursive:true});
const arrays:Record<string,unknown>={};
for(const k of ['positions','normals','surface','indices','cellFirstIndex','cellTriangleCount'] as const){const v=candidate[k]!;const bytes=new Uint8Array(v.buffer,v.byteOffset,v.byteLength);writeFileSync(new URL(k+'.bin',out),bytes);arrays[k]={bytes:v.byteLength,length:v.length,sha256:hash(v),type:v.constructor.name};}
writeFileSync(new URL('./run/stats.json',import.meta.url),JSON.stringify(candidate.stats,null,2)+'\n');
const result={scope:'One canonical baseline build, verified against four historical buffers, and one GLO30-62.5m one-pass candidate built offline. Canonical continuous coast sampled directly; rendered interpolation may change with triangulation. No GPU/FPS/photorealism claim.',base:baseline.stats,candidate:candidate.stats,invariants,arrays,holdout:{coordinates:'384x384, x/z=-48+(4*i+.5)*.0625km, Z then X; native GLO30 bilinear before mask/quantization, nonnegative height, canonical coast>0 selection',allPoints:n,landPoints:oldError.n,baseline:finish(oldError),candidate:finish(newError),rasterOnly:finish(rasterError),improved,worsened,equal,scope:'Source retention comparison; native DSM is not independent geographic ground truth. Not a maximum-error certificate.'},elapsedMs:{baseline:oldDone-started,candidate:built-oldDone,checks:checked-built,total:performance.now()-started}};
console.log(JSON.stringify(result,null,2));
