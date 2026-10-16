import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import type {Node,Pack} from './baseline/data.ts';
import {NUMERIC_CONTRACT} from './baseline/gradient.ts';
import {SOURCE_SHA} from './compact.ts';
export const FROZEN_ROOT='/Users/enuzzo/Documents/Codex/Cloudia-QA-2026-10-16-cycle10';
export const FIXTURE_SHA='cfad064c4dbe4b100294222c8c12a4fbcd98cf8f5316f0f1a3a10494543800a1';
export const METADATA_SHA='69b2b49c06eddb8c582b9f1b14cdb944f707488fd73a4f5f17d6e261f62b12c4';
export const sha=(b:Uint8Array)=>createHash('sha256').update(b).digest('hex');
export async function loadFrozen(){
 const source=await readFile(new URL('./baseline/landscape.source.ts',import.meta.url));if(sha(source)!==SOURCE_SHA)throw Error('Original terrain source hash mismatch');
 const raysBytes=await readFile(FROZEN_ROOT+'/terrain-gpu/audit-cases.json');if(sha(raysBytes)!==FIXTURE_SHA)throw Error('Frozen ray fixture hash mismatch');
 const bytes=await readFile(FROZEN_ROOT+'/terrain-gradient/terrain-gradient-250m-outer2km.rgba32f.bin');if(sha(bytes)!==METADATA_SHA)throw Error('Frozen outward metadata hash mismatch');
 const data=new Float32Array(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)),nodes:Node[]=[];
 for(let index=0;index<data.length/12;index++){const i=index*12,x=data[i+4],z=data[i+5],s=data[i+6];nodes.push({index,height:[data[i],data[i+1]],firstChild:data[i+2],level:data[i+3],rect:{x0:x,x1:x+s,z0:z,z1:z+s},errorKm:data[i+7],gx:[data[i+8],data[i+9]],gz:[data[i+10],data[i+11]]});}
 if(nodes.length!==109141)throw Error('Frozen node count mismatch');
 const pack:Pack={nodes,data,bytes:data.byteLength,coarseKm:32,fineKm:.25,outerFineKm:2,preparationMs:0,contract:NUMERIC_CONTRACT,work:{reusedFrozenMetadata:true}};
 const fixture=JSON.parse(raysBytes.toString());if(fixture.rays.length!==5198)throw Error('Frozen fixture must have exactly 5198 rays');return{pack,fixture,provenance:{sourceSha256:SOURCE_SHA,datasetSha256:FIXTURE_SHA,metadataSha256:METADATA_SHA,nodeCount:nodes.length,originalBytes:bytes.length}};
}
