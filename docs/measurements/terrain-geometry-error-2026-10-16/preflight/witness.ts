/** UNEXECUTED preflight. Invoke only through run.py after root approves this freeze.
 * One actual v58 Float32 mesh, all fixed DEM nodes in the measured ±48km core.
 * No rays, refinement, shader, render target, app, GPU or volume construction.
 */
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildTerrainMeshData,terrainMeshHeightAt,terrainMeshSurfaceY} from '../../Cloudia-QA-2026-10-16-cycle27/source/src/cumulonimbus/terrainMesh.ts';
import {createDemTerrainSampler,decodeTerrainDem,sampleTerrainDem} from '../../Cloudia-QA-2026-10-16-cycle27/source/src/cumulonimbus/terrainDem.ts';
import {terrainSurfaceSample} from '../../Cloudia-QA-2026-10-16-cycle27/source/src/cumulonimbus/terrainSurface.ts';

const HERE=dirname(fileURLToPath(import.meta.url));
const SOURCE=resolve(HERE,'../../Cloudia-QA-2026-10-16-cycle27/source');
const PREVIOUS=resolve(HERE,'../../Cloudia-QA-2026-10-16-cycle27/positive-witness/result.json');
const EXPECTED_SOURCE='21cda2a07fdc8896b78885beac706fb81b435a659120060949e7f78dfdb86ee2';
const EXPECTED_DEM='92b28f01e75692c8fba744f6b1161df578c29daa76d8d278ee20a8ce87ba071d';
const EXPECTED_PREVIOUS='f416a5fc3aa706186cc2f08811d7a35192153297f91486e31e6202409ed034cc';
const EXPECTED_FACES=[249937,249939,358458,370841,370842,379379,379929,379930,385738,386018,386019,386020,388890,388891,389947,389948,389949];
const OPTIONS={cellsPerSide:256,levels:9,spacingKm:.032,normalMode:'geometry' as const};
const FIRST=128,LAST=896,NODES=591361,QUERY_CAP=600000,TOP_K=8;
const HIST_MIN=-5000,HIST_MAX=5000,HIST_BINS=10002;
const MAX_OUTPUT_BYTES=4*1024*1024;
const started=performance.now();
function check(condition:unknown,message:string):asserts condition{if(!condition)throw new Error(message);}
function sha(bytes:Uint8Array):string{return createHash('sha256').update(bytes).digest('hex');}
function progress(phase:string,extra:Record<string,unknown>={}):void{
 console.error(JSON.stringify({phase,elapsedSeconds:(performance.now()-started)/1000,...extra}));
}
type Face={faceIndex:number;indices:number[];vertices:number[][]};
type Previous={sourceManifestSHA256:string;assetSHA256:string;meshStats:Record<string,unknown>;rows:{id:string;receiver:Face;caster:Face;physicalSunRay:{blocker:Face|null}}[]};
type Point={order:number;grid:[number,number];xzKm:[number,number];ring:number;category:'coast>=0'|'coast<0';heightCode:number;coastCode:number;heightKm:number;meshYKm:number;demYKm:number;errorMetres:number};
class CompensatedSum{
 sum=0;correction=0;
 add(value:number):void{const y=value-this.correction,t=this.sum+y;this.correction=(t-this.sum)-y;this.sum=t;}
}
class Aggregate{
 count=0;readonly sum=new CompensatedSum();readonly sumSquares=new CompensatedSum();
 readonly histogram=new Uint32Array(HIST_BINS);
 minimum:Point|null=null;maximum:Point|null=null;maximumAbs:Point|null=null;
 minimumTies=0;maximumTies=0;maximumAbsTies=0;
 readonly positive:Point[]=[];readonly negative:Point[]=[];readonly absolute:Point[]=[];
 add(error:number,point:()=>Point):void{
  this.count++;this.sum.add(error);this.sumSquares.add(error*error);
  const bin=error<HIST_MIN?0:error>=HIST_MAX?HIST_BINS-1:Math.floor(error-HIST_MIN)+1;
  this.histogram[bin]++;
  if(!this.minimum||error<this.minimum.errorMetres){this.minimum=point();this.minimumTies=1;}else if(error===this.minimum.errorMetres)this.minimumTies++;
  if(!this.maximum||error>this.maximum.errorMetres){this.maximum=point();this.maximumTies=1;}else if(error===this.maximum.errorMetres)this.maximumTies++;
  if(!this.maximumAbs||Math.abs(error)>Math.abs(this.maximumAbs.errorMetres)){this.maximumAbs=point();this.maximumAbsTies=1;}else if(Math.abs(error)===Math.abs(this.maximumAbs.errorMetres))this.maximumAbsTies++;
  this.retain(this.absolute,Math.abs(error),point,p=>Math.abs(p.errorMetres));
  if(error>0)this.retain(this.positive,error,point,p=>p.errorMetres);
  if(error<0)this.retain(this.negative,-error,point,p=>-p.errorMetres);
 }
 private retain(list:Point[],score:number,point:()=>Point,scoreOf:(p:Point)=>number):void{
  // Ties retain earlier row-major nodes; this bounded set was declared pre-run.
  if(list.length===TOP_K&&score<=scoreOf(list[list.length-1]))return;
  const record=point();let i=0;while(i<list.length&&score<=scoreOf(list[i]))i++;
  list.splice(i,0,record);if(list.length>TOP_K)list.pop();
 }
 result():Record<string,unknown>{
  let histCount=0;for(const n of this.histogram)histCount+=n;
  check(histCount===this.count,'Histogram count mismatch');
  return {count:this.count,sumErrorMetres:this.sum.sum,sumSquaredErrorMetres2:this.sumSquares.sum,
   signedMeanMetres:this.count?this.sum.sum/this.count:null,rmsMetres:this.count?Math.sqrt(this.sumSquares.sum/this.count):null,
   minimum:this.minimum,minimumTies:this.minimumTies,maximum:this.maximum,maximumTies:this.maximumTies,
   maximumAbs:this.maximumAbs,maximumAbsTies:this.maximumAbsTies,
   top8Absolute:this.absolute,top8Positive:this.positive,top8Negative:this.negative,
   histogramCounts:Array.from(this.histogram)};
 }
}
function ringAt(x:number,z:number):number{
 const radius=Math.max(Math.abs(x),Math.abs(z));let ring=0;
 while(ring<OPTIONS.levels&&radius>Math.fround(OPTIONS.cellsPerSide/2*OPTIONS.spacingKm*2**ring))ring++;
 return ring;
}
function typedSha(array:ArrayBufferView):string{return sha(new Uint8Array(array.buffer,array.byteOffset,array.byteLength));}
function main():void{
 check(process.argv.length===3,'Usage: witness.ts NEW_OUTPUT_DIRECTORY (run.py owns the directory)');
 check(process.env.CLOUDIA_GEOMETRY_PREFLIGHT_APPROVED==='cycle28-r2','Use reviewed run.py; direct invocation is outside this protocol');
 const output=resolve(process.argv[2]);
 const manifestRaw=readFileSync(resolve(SOURCE,'../source-manifest.json'));
 check(sha(manifestRaw)===EXPECTED_SOURCE,'Frozen source manifest mismatch');
 const previousRaw=readFileSync(PREVIOUS);check(sha(previousRaw)===EXPECTED_PREVIOUS,'Previous witness mismatch');
 const previous:Previous=JSON.parse(previousRaw.toString('utf8'));
 check(previous.sourceManifestSHA256===EXPECTED_SOURCE&&previous.assetSHA256===EXPECTED_DEM,'Previous witness provenance mismatch');
 const demRaw=readFileSync(resolve(SOURCE,'src/cumulonimbus/assets/liguria-apuane-dem.bin'));
 check(sha(demRaw)===EXPECTED_DEM,'DEM hash mismatch');
 const grid=decodeTerrainDem(demRaw.buffer.slice(demRaw.byteOffset,demRaw.byteOffset+demRaw.byteLength) as ArrayBuffer);
 check(grid.side===1025&&grid.spacingKm===.125&&grid.minX===-64&&grid.minZ===-64,'Unexpected CDM1 node domain');
 check((LAST-FIRST+1)**2===NODES&&NODES<=QUERY_CAP,'Frozen query plan mismatch');
 const sourceSampler=createDemTerrainSampler(grid,terrainSurfaceSample);let buildSampleCalls=0;
 progress('mesh-build-start',{options:OPTIONS});
 const buildStart=performance.now();
 const mesh=buildTerrainMeshData((x,z)=>{buildSampleCalls++;return sourceSampler(x,z);},OPTIONS);
 const buildMs=performance.now()-buildStart;
 check(mesh.stats.vertices===465409&&mesh.stats.triangles===929792&&mesh.stats.stitchedCells===4096&&mesh.stats.geometryBytes===26050592,'Baseline mesh counts changed');
 check(buildSampleCalls===mesh.stats.sampleCalls&&buildSampleCalls===465409,'Unexpected build sampler count');
 for(const [key,value] of Object.entries(previous.meshStats))check(mesh.stats[key as keyof typeof mesh.stats]===value,`Mesh statistic differs from saved witness: ${key}`);
 const faces=new Map<number,Face>();const associations:{row:string;role:string;faceIndex:number}[]=[];
 for(const row of previous.rows){
  for(const [role,face] of [['receiver',row.receiver],['caster',row.caster],['blocker',row.physicalSunRay.blocker]] as const){
   if(!face)continue;check(face.indices.length===3&&face.vertices.length===3,'Invalid saved face');
   const prior=faces.get(face.faceIndex);
   if(prior)check(JSON.stringify(prior.indices)===JSON.stringify(face.indices)&&JSON.stringify(prior.vertices)===JSON.stringify(face.vertices),'Conflicting repeated saved face');
   faces.set(face.faceIndex,face);associations.push({row:row.id,role,faceIndex:face.faceIndex});
  }
 }
 check(JSON.stringify([...faces.keys()].sort((a,b)=>a-b))===JSON.stringify(EXPECTED_FACES),'Saved face identity set changed');
 for(const face of faces.values())for(let corner=0;corner<3;corner++){
  const index=mesh.indices[3*face.faceIndex+corner];check(index===face.indices[corner],'Saved face index mismatch');
  for(let axis=0;axis<3;axis++)check(mesh.positions[3*index+axis]===face.vertices[corner][axis],'Saved Float32 vertex mismatch');
 }
 const meshHashes={positions:typedSha(mesh.positions),normals:typedSha(mesh.normals),surface:typedSha(mesh.surface),indices:typedSha(mesh.indices),cellFirstIndex:typedSha(mesh.cellFirstIndex)};
 progress('baseline-identity-pass',{faces:faces.size,buildMs});
 const global={all:new Aggregate(),landMask:new Aggregate(),seaMask:new Aggregate()};
 const rings=Array.from({length:5},()=>({all:new Aggregate(),landMask:new Aggregate(),seaMask:new Aggregate()}));
 const errorsHash=createHash('sha256');const hashBuffer=Buffer.allocUnsafe(8192*8);let hashUsed=0;
 let queries=0;const queryStart=performance.now();let lastProgress=performance.now();
 for(let iz=FIRST;iz<=LAST;iz++)for(let ix=FIRST;ix<=LAST;ix++){
  check(queries<QUERY_CAP,'Query cap exceeded');
  const x=grid.minX+ix*grid.spacingKm,z=grid.minZ+iz*grid.spacingKm,index=iz*grid.side+ix;
  const measured=sampleTerrainDem(grid,x,z);check(measured,'Frozen DEM node unexpectedly outside domain');
  check(measured.heightKm===grid.heights[index]*.000125&&measured.coastKm===grid.coast[index]*.008,'DEM node decode mismatch');
  const yMesh=terrainMeshHeightAt(mesh,x,z);check(yMesh!==null&&Number.isFinite(yMesh),'Mesh lookup missing/nonfinite');
  const yDem=terrainMeshSurfaceY(x,z,measured.heightKm),error=1000*(yDem-yMesh),ring=ringAt(x,z);
  check(Number.isFinite(error)&&ring>=0&&ring<5,'Nonfinite error or unexpected core ring');
  const land=measured.coastKm>=0,order=queries;
  let record:Point|undefined;
  const point=():Point=>record??=( {order,grid:[ix,iz],xzKm:[x,z],ring,category:land?'coast>=0':'coast<0',heightCode:grid.heights[index],coastCode:grid.coast[index],heightKm:measured.heightKm,meshYKm:yMesh,demYKm:yDem,errorMetres:error} );
  global.all.add(error,point);(land?global.landMask:global.seaMask).add(error,point);
  rings[ring].all.add(error,point);(land?rings[ring].landMask:rings[ring].seaMask).add(error,point);
  hashBuffer.writeDoubleLE(error,hashUsed);hashUsed+=8;
  if(hashUsed===hashBuffer.length){errorsHash.update(hashBuffer);hashUsed=0;}
  queries++;
  if(ix===LAST&&performance.now()-lastProgress>=5000){progress('core-progress',{queries,total:NODES});lastProgress=performance.now();}
 }
 if(hashUsed)errorsHash.update(hashBuffer.subarray(0,hashUsed));
 check(queries===NODES&&global.all.count===NODES,'Incomplete core');
 check(global.landMask.count+global.seaMask.count===NODES,'Mask partition mismatch');
 check(rings.reduce((n,r)=>n+r.all.count,0)===NODES,'Ring partition mismatch');
 for(const ring of rings)check(ring.all.count===ring.landMask.count+ring.seaMask.count,'Ring mask partition mismatch');
 const pack=(group:typeof global)=>({all:group.all.result(),landMask:group.landMask.result(),seaMask:group.seaMask.result()});
 const result={status:'COMPLETE_CORE_GEOMETRY_REFERENCE_NOT_ART_OR_GPU_PROOF',
  scope:'All 591361 original measured DEM nodes in the closed ±48km square; one real v58 Float32 mesh, no rays or adaptive points',
  sourceManifestSHA256:EXPECTED_SOURCE,assetSHA256:EXPECTED_DEM,previousWitnessSHA256:EXPECTED_PREVIOUS,
  runtime:{bun:process.versions.bun,architecture:process.arch,platform:process.platform},
  plan:{firstSourceIndex:FIRST,lastSourceIndex:LAST,side:769,nodes:NODES,queryCap:QUERY_CAP,order:'increasing iz then ix; both inclusive',coreKm:[-48,48],options:OPTIONS},
  baselineIdentity:{savedFaces:EXPECTED_FACES,associations,allSavedIndicesAndFloat32VerticesExact:true,allSavedMeshStatsExact:true,meshHashes},
  meshStats:mesh.stats,buildSampleCalls,measurementQueries:queries,
  errorDefinition:'1000*(terrainMeshSurfaceY(x,z,sampleTerrainDem.heightKm)-terrainMeshHeightAt(actualFloat32Mesh,x,z)); metres, positive mesh below DEM',
  errorStream:{sha256:errorsHash.digest('hex'),bytes:queries*8,encoding:'one Float64LE signed error per node, no header, row-major iz/ix; stream hashed but not retained'},
  histogram:{underflowLessThan:HIST_MIN,overflowGreaterOrEqual:HIST_MAX,interiorBinWidthMetres:1,binCount:HIST_BINS,layout:'index0 underflow; index1=[-5000,-4999), ... index10000=[4999,5000); index10001 overflow'},
  maskDefinition:'Saved bilinear coast distance at original DEM nodes: landMask iff coastKm>=0, seaMask otherwise; material-mask categories, not independent physical coastline/land-cover truth',
  worstCasePolicy:{topK:TOP_K,perAggregate:['absolute','positive-only','negative-only'],ties:'ascending row-major order; exact extrema tie counts retained, tied full populations not saved'},
  aggregate:pack(global),rings:rings.map((group,ring)=>({ring,outerHalfExtentKm:Math.fround(128*.032*2**ring),...pack(group)})),
  timings:{meshBuildMs:buildMs,coreQueryMs:performance.now()-queryStart,totalProgramMs:performance.now()-started},
  limits:['Observed node errors are not a continuous maximum, areal integration, DEM accuracy certification, pixel displacement or causal shadow/art proof.','No edge/interior probe, mesh refinement, GPU, browser, render or performance qualification.','No per-node dense JSON or full mesh retained; error-stream digest cannot reconstruct omitted node values.','RSS/CPU/wall validity is decided from terminal wrapper record, not this result alone.']};
 const json=JSON.stringify(result,null,2)+'\n';check(Buffer.byteLength(json)<=MAX_OUTPUT_BYTES,'Bounded result payload exceeded');
 writeFileSync(resolve(output,'result.json'),json,{flag:'wx'});
 progress('complete',{queries,outputBytes:Buffer.byteLength(json)});
 console.log(JSON.stringify({status:result.status,measurementQueries:queries,errorStreamSHA256:result.errorStream.sha256,resultBytes:Buffer.byteLength(json)}));
}
try{main();}catch(error){console.error(error instanceof Error?error.stack:String(error));process.exitCode=1;}
