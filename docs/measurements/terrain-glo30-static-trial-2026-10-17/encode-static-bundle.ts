import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {encodeTerrainMeshAsset,decodeTerrainMeshAsset} from './candidate-source/src/cumulonimbus/terrainMeshAsset';
import type {TerrainMeshData} from './candidate-source/src/cumulonimbus/terrainMesh';
const started=performance.now(),pre=new URL('./mesh-preflight/run/',import.meta.url);
const checked=JSON.parse(readFileSync(new URL('stdout.json',pre),'utf8'));
const run=JSON.parse(readFileSync(new URL('run.json',pre),'utf8'));if(!run.gatePass)throw new Error('Model preflight did not pass');
const hash=(v:Uint8Array)=>createHash('sha256').update(v).digest('hex');
const arrays:Record<string,Float32Array|Uint32Array|Uint8Array>={};
for(const key of ['positions','normals','surface','indices','cellFirstIndex','cellTriangleCount']){
 const b=readFileSync(new URL('arrays/'+key+'.bin',pre)),expected=checked.arrays[key];
 if(b.byteLength!==expected.bytes||hash(b)!==expected.sha256)throw new Error('Preflight raw array changed: '+key);
 const raw=b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);
 arrays[key]=key==='cellTriangleCount'?new Uint8Array(raw):(key==='indices'||key==='cellFirstIndex')?new Uint32Array(raw):new Float32Array(raw);
}
const stats=JSON.parse(readFileSync(new URL('stats.json',pre),'utf8'));
const binary=encodeTerrainMeshAsset({...arrays,stats} as unknown as TerrainMeshData),encoded=performance.now(),roundtrip=decodeTerrainMeshAsset(binary);
for(const key of ['positions','normals','surface','indices','cellFirstIndex','cellTriangleCount'] as const){const v=roundtrip[key]!;if(hash(new Uint8Array(v.buffer,v.byteOffset,v.byteLength))!==checked.arrays[key].sha256)throw new Error('Bundle array mismatch: '+key);}
if(JSON.stringify(roundtrip.stats)!==JSON.stringify(stats))throw new Error('Bundle stats mismatch');
writeFileSync(new URL('./candidate-source/src/cumulonimbus/assets/liguria-apuane-glo30-mesh.bin',import.meta.url),new Uint8Array(binary));
const sha256=hash(new Uint8Array(binary));
const binding=new URL('./candidate-source/src/cumulonimbus/measuredTerrainMesh.ts',import.meta.url),before=readFileSync(binding,'utf8');if(!before.includes('PENDING_ROOT_ENCODE'))throw new Error('Expected one-time pending binding');writeFileSync(binding,before.replace('PENDING_ROOT_ENCODE',sha256));
const report={scope:'Encode one already built candidate; no mesh/model regeneration, exact6array bits and stats roundtrip. Runtime loader hashes before decode.',bytes:binary.byteLength,sha256,preflightInputs:checked.arrays,stats,roundtripSixArrayHashesExact:true,roundtripStatsExact:true,elapsedMs:{readAndEncode:encoded-started,decodeAndVerify:performance.now()-encoded,total:performance.now()-started}};
writeFileSync(new URL('./static-bundle-result.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({bytes:binary.byteLength,sha256,roundtripSixArrayHashesExact:true,elapsedMs:report.elapsedMs},null,2));
