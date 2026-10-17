// PREPARED ONLY: root reviews/finalizes the freeze before run.py may launch A/B.
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {gzipSync,gunzipSync} from 'node:zlib';

const HERE=dirname(fileURLToPath(import.meta.url));
const phaseStart=performance.now();let phase='inputs';
const sha=(b:Uint8Array)=>createHash('sha256').update(b).digest('hex');
const hashArray=(a:ArrayBufferView)=>sha(new Uint8Array(a.buffer,a.byteOffset,a.byteLength));
function check(value:unknown,message:string):asserts value{if(!value)throw new Error(message);}
function inputJSON(path:string){return JSON.parse(readFileSync(path,'utf8'));}
async function run():Promise<void>{
 check(process.env.CLOUDIA_GRID_AUDIT==='cycle44-mesh-root-authorized','Use the frozen authorized launcher');
 check(process.argv.length===4,'Usage: witness.ts A|B EXISTING_EXCLUSIVE_OUTPUT');
 const mode=process.argv[2];check(mode==='A'||mode==='B','Unknown mesh mode');
 const output=resolve(process.argv[3]);check(output===resolve(HERE,'run',mode),'Unexpected output path');
 const freeze=inputJSON(resolve(HERE,'PRE-RUN-FREEZE.json')),points=inputJSON(resolve(HERE,'POINTS.json'));
 check(points.fit.side===769&&points.fit.count===591361&&points.holdout.side===768&&points.holdout.count===589824
  &&points.totalCount===1181185&&points.streamRawBytes===9449480&&points.holdoutOffsetBytes===4730888,'Frozen point plan differs');
 check(process.platform==='darwin'&&process.arch==='arm64','Requires Darwin arm64');
 const historical=JSON.parse(gunzipSync(readFileSync(freeze.historicalReport),{maxOutputLength:4*1024*1024}).toString('utf8'));
 check(historical.status==='ON_FIT_COMPLETE_NODES_ONLY'&&historical.errorStream.bytes===points.holdoutOffsetBytes
  &&historical.errorStream.sha256===freeze.expectedHistoricalFitSHA256,'Historical A fit pin differs');
 // Canonical imports only; no TerrainMesh/renderer constructor or GPU operation.
 const url=(name:string)=>pathToFileURL(resolve(freeze.sourceRoot,'src/cumulonimbus',name)).href;
 const {buildTerrainMeshData,terrainMeshHeightAt,terrainMeshSurfaceY}=await import(url('terrainMesh.ts'));
 const {decodeTerrainDem,createDemTerrainSampler,sampleTerrainDem}=await import(url('terrainDEM.ts'));
 const {terrainSurfaceSample}=await import(url('terrainSurface.ts'));
 const demBytes=readFileSync(freeze.demPath);
 check(sha(demBytes)===freeze.expectedDemSHA256,'DEM digest mismatch');
 const grid=decodeTerrainDem(demBytes.buffer.slice(demBytes.byteOffset,demBytes.byteOffset+demBytes.byteLength));
 check(grid.side===1025&&grid.spacingKm===.125&&grid.minX===-64&&grid.minZ===-64,'Unexpected canonical DEM');
 const sample=createDemTerrainSampler(grid,terrainSurfaceSample);let buildSampleCalls=0;
 const limits={maxProbeCount:600000,maxVertices:1000000,maxTriangles:2000000,maxGeometryBytes:64*1024*1024};
 const options={cellsPerSide:256,levels:9,spacingKm:.032,normalMode:'geometry',sourcePatch:mode==='B'?{coreHalfExtentKm:48,outerCutKm:Math.fround(94*.512)}:undefined,
  refinement:{sourceGrid:{minXKm:-64,minZKm:-64,spacingKm:.125,columns:1025,rows:1025},
   domain:{minXKm:-48,maxXKm:48,minZKm:-48,maxZKm:48},maxErrorKm:.005,limits}};
 phase='build';const buildStarted=performance.now();
 const mesh=buildTerrainMeshData((x:number,z:number)=>{buildSampleCalls++;return sample(x,z);},options);
 const buildMs=performance.now()-buildStarted;phase='invariants';
 const arrays=['positions','normals','surface','indices','cellFirstIndex','cellTriangleCount'] as const;
 const hashes=Object.fromEntries(arrays.map(key=>{check(mesh[key],'Missing mesh array '+key);return [key,hashArray(mesh[key])];}));
 check(mesh.stats.vertices<=limits.maxVertices&&mesh.stats.triangles<=limits.maxTriangles
  &&mesh.stats.geometryBytes<=limits.maxGeometryBytes&&buildSampleCalls===mesh.stats.sampleCalls,'Builder budget/counter mismatch');
 check(mesh.positions.length===3*mesh.stats.vertices&&mesh.normals.length===mesh.positions.length
  &&mesh.surface.length===2*mesh.stats.vertices&&mesh.indices.length===3*mesh.stats.triangles,'Geometry dimensions mismatch');
 check(mesh.cellFirstIndex.length===9*256*256&&mesh.cellTriangleCount.length===mesh.cellFirstIndex.length,'Lookup dimensions mismatch');
 for(const key of ['positions','normals','surface'])for(const v of mesh[key])check(Number.isFinite(v),'Nonfinite '+key);
 let maxNormalUnitError=0,minimumWinding=Infinity,cursor=0;
 for(let i=0;i<mesh.normals.length;i+=3){const n=mesh.normals,e=Math.abs(Math.hypot(n[i],n[i+1],n[i+2])-1);
  check(n[i+1]>0&&e<=1e-6,'Invalid terrain normal');maxNormalUnitError=Math.max(maxNormalUnitError,e);}
 for(let i=0;i<mesh.indices.length;i+=3){const p=mesh.positions,a=mesh.indices[i]*3,b=mesh.indices[i+1]*3,c=mesh.indices[i+2]*3;
  check(a<p.length&&b<p.length&&c<p.length,'Out-of-range vertex index');
  const up=(p[b+2]-p[a+2])*(p[c]-p[a])-(p[b]-p[a])*(p[c+2]-p[a+2]);check(up>0,'Reversed or degenerate face');minimumWinding=Math.min(minimumWinding,up);}
 for(let i=0;i<mesh.cellFirstIndex.length;i++){const first=mesh.cellFirstIndex[i],n=mesh.cellTriangleCount[i];
  if(first===0xffffffff){check(n===0,'Hole has triangles');continue;}
  check(first===cursor&&n>=1&&n<=20,'Outer lookup is not contiguous/bounded');cursor+=3*n;}
 if(mode==='A')check(cursor===mesh.indices.length,'Lookup does not cover every triangle');
 else check(cursor>0&&cursor<mesh.indices.length,'Patch must retain a bounded outerlookup pluscore/seam');
 if(mode==='A'){
  const expected={...historical.identity.meshHashes,cellTriangleCount:historical.identity.cellTriangleCountSHA256};
  for(const key of arrays)check(hashes[key]===expected[key],'Historical A geometry differs: '+key);
  check(mesh.stats.vertices===historical.meshStats.vertices&&mesh.stats.triangles===historical.meshStats.triangles,'Historical A counts differ');
 }
 phase='topology-and-outer';
 const used=new Uint8Array(mesh.stats.vertices),edgeCodes=new Float64Array(mesh.indices.length);
 let outerTriangles=0,outerHashInput:Float32Array,outerWrite=0;
 const cut=Math.fround(94*.512),radius=(i:number)=>Math.max(Math.abs(mesh.positions[i*3]),Math.abs(mesh.positions[i*3+2]));
 for(let i=0;i<mesh.indices.length;i+=3){const ids=[mesh.indices[i],mesh.indices[i+1],mesh.indices[i+2]],rs=ids.map(radius);
  for(let j=0;j<3;j++){const a=ids[j],b=ids[(j+1)%3];used[a]=1;edgeCodes[i+j]=2*(Math.min(a,b)*mesh.stats.vertices+Math.max(a,b))+Number(a<b);}
  if(Math.max(...rs)>cut){check(Math.min(...rs)>=cut,'Triangle crosses preservedoutercut');outerTriangles++;}
 }
 check(used.every(v=>v===1),'Unused vertex in result');edgeCodes.sort();let boundaryEdges=0,uniqueEdges=0;
 for(let i=0;i<edgeCodes.length;){const key=Math.floor(edgeCodes[i]/2);let j=i+1;while(j<edgeCodes.length&&Math.floor(edgeCodes[j]/2)===key)j++;
  uniqueEdges++;check(j-i===1||j-i===2,'Nonmanifold edge incidence');
  if(j-i===2)check(edgeCodes[j-1]-edgeCodes[i]===1,'Shared edge orientation mismatch');
  else{const a=Math.floor(key/mesh.stats.vertices),b=key-a*mesh.stats.vertices,p=mesh.positions,extent=Math.fround(mesh.stats.outerExtentKm);
   check((Math.abs(p[a*3])===extent&&p[a*3]===p[b*3])||(Math.abs(p[a*3+2])===extent&&p[a*3+2]===p[b*3+2]),'Internal open edge / Tjunction');boundaryEdges++;}
  i=j;
 }
 check(boundaryEdges===1024&&mesh.stats.vertices-uniqueEdges+mesh.stats.triangles===1,'Terrain disk topology differs');
 outerHashInput=new Float32Array(outerTriangles*15);
 for(let i=0;i<mesh.indices.length;i+=3){const ids=[mesh.indices[i],mesh.indices[i+1],mesh.indices[i+2]];if(!ids.some(v=>radius(v)>cut))continue;
  for(const v of ids){outerHashInput.set(mesh.positions.subarray(v*3,v*3+3),outerWrite);outerWrite+=3;outerHashInput.set(mesh.surface.subarray(v*2,v*2+2),outerWrite);outerWrite+=2;}
 }
 check(outerWrite===outerHashInput.length,'Outer hash stream incomplete');
 const outerIdentity={triangles:outerTriangles,xyzSurfaceTriangleSHA256:hashArray(outerHashInput)};
 const outerProbes=freeze.outerProbes.map(([x,z]:number[])=>({x,z,y:terrainMeshHeightAt(mesh,x,z)}));check(outerProbes.every((p:any)=>p.y!==null&&Number.isFinite(p.y)),'Missing preservedouter query');
 const seamOracle:Array<{x:number;z:number;actual:number;oracle:number;deltaKm:number}>=[];
 if(mode==='B')for(const [x,z] of freeze.seamProbes as Array<[number,number]>){
  let oracle=-Infinity;
  for(let i=0;i<mesh.indices.length;i+=3){const p=mesh.positions,a=mesh.indices[i]*3,b=mesh.indices[i+1]*3,c=mesh.indices[i+2]*3;
   if(x<Math.min(p[a],p[b],p[c])-1e-9||x>Math.max(p[a],p[b],p[c])+1e-9||z<Math.min(p[a+2],p[b+2],p[c+2])-1e-9||z>Math.max(p[a+2],p[b+2],p[c+2])+1e-9)continue;
   const abx=p[b]-p[a],aby=p[b+1]-p[a+1],abz=p[b+2]-p[a+2],acx=p[c]-p[a],acy=p[c+1]-p[a+1],acz=p[c+2]-p[a+2];
   const nx=aby*acz-abz*acy,ny=abz*acx-abx*acz,nz=abx*acy-aby*acx;
   const side=(u:number,v:number)=>((p[v+2]-p[u+2])*(x-p[u])-(p[v]-p[u])*(z-p[u+2]))/ny;
   if(Math.min(side(a,b),side(b,c),side(c,a))>=-1e-7)oracle=Math.max(oracle,p[a+1]-(nx*(x-p[a])+nz*(z-p[a+2]))/ny);
  }
  const actual=terrainMeshHeightAt(mesh,x,z);check(actual!==null&&Number.isFinite(oracle)&&Math.abs(actual-oracle)<=1e-9,'Routed seam lookup differs from independent fullmesh plane oracle');
  seamOracle.push({x,z,actual,oracle,deltaKm:actual-oracle});
 }
 phase='fixed-point-errors';const queryStarted=performance.now(),errors=Buffer.alloc(points.streamRawBytes);let order=0;
 const summaries:any={};
 for(const name of ['fit','holdout'] as const){const spec=points[name],offset=name==='fit'?0:.5;
  const first=order;let min=Infinity,max=-Infinity,sumSquares=0;
  for(let iz=0;iz<spec.side;iz++)for(let ix=0;ix<spec.side;ix++){
   const x=-48+(ix+offset)*.125,z=-48+(iz+offset)*.125,reference=sampleTerrainDem(grid,x,z);
   check(reference,'Point outside frozen DEM');const y=terrainMeshHeightAt(mesh,x,z);check(y!==null&&Number.isFinite(y),'Missing mesh hit');
   const error=1000*(terrainMeshSurfaceY(x,z,reference.heightKm)-y);check(Number.isFinite(error),'Nonfinite error');
   errors.writeDoubleLE(error,order*8);order++;min=Math.min(min,error);max=Math.max(max,error);sumSquares+=error*error;
  }
  check(order-first===spec.count,'Point count differs');summaries[name]={count:spec.count,minSignedMetres:min,maxSignedMetres:max,rmsMetres:Math.sqrt(sumSquares/spec.count)};
 }
 check(order===points.totalCount,'Incomplete combined error stream');
 const fitSHA256=sha(errors.subarray(0,points.holdoutOffsetBytes));
 if(mode==='A')check(fitSHA256===freeze.expectedHistoricalFitSHA256,'Historical A complete fit stream differs');
 if(mode==='A')check(sha(errors)===freeze.expectedACombinedErrorSHA256,'A fullfit+holdout stream differs');
 if(mode==='B')check(sha(errors.subarray(points.holdoutOffsetBytes))===freeze.expectedScalarHoldoutSHA256,'B coreholdout differs from scalar proof');
 const queryMs=performance.now()-queryStarted;phase='lossless-save';
 const compressed=gzipSync(errors,{level:6,mtime:0} as any);writeFileSync(resolve(output,'errors.f64le.gz'),compressed,{flag:'wx'});
 const result={status:'COMPLETE_CPU_ONLY',mode,scope:'One canonical mesh; fixed fit+holdout errors. No visual/GPU/FPS acceptance.',
  runtime:{bun:process.versions.bun,platform:process.platform,arch:process.arch},sourceRoot:freeze.sourceRoot,
  pointPlanSHA256:sha(readFileSync(resolve(HERE,'POINTS.json'))),demSHA256:sha(demBytes),options,
  meshStats:mesh.stats,meshHashes:hashes,buildSampleCalls,invariants:{maxNormalUnitError,minimumWinding,completeCellLookup:true},
  historicalAAuthenticated:mode==='A',fitStreamSHA256:fitSHA256,summaryOnly:summaries,topology:{uniqueEdges,boundaryEdges,euler:1,allVerticesUsed:true},outerIdentity,outerProbes,seamOracle,
  errorStream:{path:'errors.f64le.gz',rawBytes:errors.length,rawSHA256:sha(errors),gzipBytes:compressed.length,gzipSHA256:sha(compressed),
   fitCount:points.fit.count,holdoutCount:points.holdout.count,holdoutOffsetBytes:points.holdoutOffsetBytes,encoding:points.streamEncoding},
  timings:{buildMs,queryMs,totalMs:performance.now()-phaseStart},statisticsScope:'Small summaries use ordinary Float64 sums; independent analysis reads the full saved F64 stream and fixed physical bands.'};
 const json=JSON.stringify(result,null,2)+'\n';check(Buffer.byteLength(json)<128*1024,'Result exceeds 128KiB');
 writeFileSync(resolve(output,'result.json'),json,{flag:'wx'});console.log(JSON.stringify({status:result.status,mode,fitSHA256,rawSHA256:result.errorStream.rawSHA256}));
}
run().catch(error=>{console.error(JSON.stringify({phase,error:error instanceof Error?error.stack:String(error)}));process.exitCode=1;});
