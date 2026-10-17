// Preparation only. Root launches this scalar counterfactual once after frozen review.
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {gzipSync,gunzipSync} from 'node:zlib';
const HERE=dirname(fileURLToPath(import.meta.url)),started=performance.now();let phase='inputs';
const sha=(x:Uint8Array)=>createHash('sha256').update(x).digest('hex');
const json=(p:string)=>JSON.parse(readFileSync(p,'utf8'));
function check(x:unknown,message:string):asserts x{if(!x)throw new Error(message);}
async function main(){
 check(process.env.CLOUDIA_DEM_SCALAR==='cycle44-root-authorized','Use frozen launcher');
 const f=json(resolve(HERE,'PRE-RUN-FREEZE.json')),p=json(f.pointsPath),ar=readFileSync(f.aResultPath),a=json(f.aResultPath),run=json(f.aRunPath);
 check(process.argv.length===3&&resolve(process.argv[2])===resolve(HERE,'run'),'Unexpected output');const out=resolve(process.argv[2]);
 check(process.platform==='darwin'&&process.arch==='arm64','Darwin arm64 required');
 check(run.status==='PASS_EXECUTION_AND_PARITY_ONLY'&&run.resultSHA256===sha(ar)&&a.mode==='A'&&a.historicalAAuthenticated,'A provenance mismatch');
 check(a.pointPlanSHA256===sha(readFileSync(f.pointsPath))&&a.demSHA256===f.expectedDemSHA256,'A points/DEM mismatch');
 for(const [key,value] of Object.entries(f.expectedAMeshHashes))check(a.meshHashes[key]===value,'A mesh hash differs: '+key);
 check(p.holdout.side===768&&p.holdout.count===589824&&p.sourceNodeSpacingKm===.125&&p.holdoutOffsetBytes===4730888&&p.totalCount===1181185,'Point plan differs');
 const old=gunzipSync(readFileSync(f.aStreamPath),{maxOutputLength:9449480});
 check(old.length===9449480&&sha(old)===a.errorStream.rawSHA256,'A complete raw stream mismatch');
 const baseline=old.subarray(p.holdoutOffsetBytes);check(baseline.length===589824*8,'A holdout length differs');
 const url=(n:string)=>pathToFileURL(resolve(f.sourceRoot,'src/cumulonimbus',n)).href;
 const {terrainMeshSurfaceY}=await import(url('terrainMesh.ts'));
 const {decodeTerrainDem,sampleTerrainDem}=await import(url('terrainDEM.ts'));
 const bytes=readFileSync(f.demPath);check(sha(bytes)===f.expectedDemSHA256,'DEM changed');
 const grid=decodeTerrainDem(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));
 check(grid.side===1025&&grid.spacingKm===.125&&grid.minX===-64&&grid.minZ===-64,'Unexpected grid');
 const count=p.holdout.count,errors=Buffer.alloc(count*8),mask=new Uint8Array(count);
 const changes={global:{improved:0,worsened:0,equal:0},land:{improved:0,worsened:0,equal:0}};let order=0;
 phase='scalar-centres';const scalarStarted=performance.now();
 for(let iz=0;iz<768;iz++)for(let ix=0;ix<768;ix++){
  const x0=-48+ix*.125,z0=-48+iz*.125,x=x0+.0625,z=z0+.0625;
  const sw=sampleTerrainDem(grid,x0,z0),ne=sampleTerrainDem(grid,x0+.125,z0+.125),c=sampleTerrainDem(grid,x,z);
  check(sw&&ne&&c,'Point outside DEM');
  const ySW=Math.fround(terrainMeshSurfaceY(x0,z0,sw.heightKm)),yNE=Math.fround(terrainMeshSurfaceY(x0+.125,z0+.125,ne.heightKm));
  const error=1000*(terrainMeshSurfaceY(x,z,c.heightKm)-(ySW+yNE)*.5),previous=baseline.readDoubleLE(order*8);
  check(Number.isFinite(error)&&Number.isFinite(previous),'Nonfinite error');errors.writeDoubleLE(error,order*8);mask[order]=Number(c.coastKm>=0);
  const key=Math.abs(error)<Math.abs(previous)?'improved':Math.abs(error)>Math.abs(previous)?'worsened':'equal';
  changes.global[key]++;if(mask[order])changes.land[key]++;order++;
 }
 check(order===count,'Incomplete holdout');const scalarMs=performance.now()-scalarStarted;phase='statistics';
 function stats(stream:Buffer,land:boolean){
  const absolute=new Float64Array(count);let n=0,sum=0,correction=0,min=Infinity,max=-Infinity;
  for(let i=0;i<count;i++){if(land&&!mask[i])continue;const e=stream.readDoubleLE(i*8);check(Number.isFinite(e),'Nonfinite stored scalar');
   absolute[n++]=Math.abs(e);const v=e*e-correction,t=sum+v;correction=(t-sum)-v;sum=t;min=Math.min(min,e);max=Math.max(max,e);}
  check(n>0,'Empty statistic set');const sorted=absolute.subarray(0,n).sort(),rank=Math.floor(.99*(n-1));
  return {count:n,sumSquaredMetres2:sum,rmsMetres:Math.sqrt(sum/n),p99AbsMetres:sorted[rank],p99Rank:rank,maxAbsMetres:sorted[n-1],minSignedMetres:min,maxSignedMetres:max};
 }
 const A={global:stats(baseline,false),land:stats(baseline,true)},B={global:stats(errors,false),land:stats(errors,true)};
 const checks={landRMSStrictlyLower:B.land.rmsMetres<A.land.rmsMetres,globalP99NotHigher:B.global.p99AbsMetres<=A.global.p99AbsMetres,globalMaxNotHigher:B.global.maxAbsMetres<=A.global.maxAbsMetres};
 const pass=Object.values(checks).every(Boolean);phase='lossless-save';const packed=gzipSync(errors,{level:6,mtime:0} as any);
 writeFileSync(resolve(out,'errors.f64le.gz'),packed,{flag:'wx'});
 const result={status:'COMPLETE_SCALAR_HOLDOUT_ONLY',scope:'Necessary centre-cell potential only. No mesh/seam/frame/normal/lookup/GPU/model build.',
  runtime:{bun:process.versions.bun,platform:process.platform,arch:process.arch},pointsSHA256:sha(readFileSync(f.pointsPath)),demSHA256:sha(bytes),
  diagonal:'SW-to-NE',endpointY:'Math.fround(canonical terrainMeshSurfaceY(node))',centreY:'mean of two endpoint Y Float32 values; centre reference canonical bilinear then canonical sphere',
  A:{resultSHA256:sha(ar),sourceStreamRawSHA256:a.errorStream.rawSHA256,holdoutRawSHA256:sha(baseline),holdoutOffsetBytes:p.holdoutOffsetBytes,stats:A},
  B:{stats:B},maskSHA256:sha(mask),changes,gate:{checks,pass,status:pass?'PASS_NECESSARY_HOLDOUT_ONLY':'FAIL_STOP_BEFORE_TOPOLOGY'},
  errorStream:{path:'errors.f64le.gz',count,rawBytes:errors.length,rawSHA256:sha(errors),gzipBytes:packed.length,gzipSHA256:sha(packed),encoding:'Float64LE 1000*(referenceY-triangleY), row-major Z then X'},
  timings:{scalarMs,totalMs:performance.now()-started},limitations:['No fit/continuous-error or photorealism qualification','No alternate diagonal, spacing or retry after FAIL','Quantile floor(.99*(n-1)); Float64 compensated square sum; full errors retained']};
 const encoded=JSON.stringify(result,null,2)+'\n';check(Buffer.byteLength(encoded)<128*1024,'Oversized result');writeFileSync(resolve(out,'result.json'),encoded,{flag:'wx'});
 console.log(JSON.stringify({status:result.status,gate:result.gate,rawSHA256:result.errorStream.rawSHA256}));
}
main().catch(error=>{console.error(JSON.stringify({phase,error:error instanceof Error?error.stack:String(error)}));process.exitCode=1;});
