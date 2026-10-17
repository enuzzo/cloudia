// @vitest-environment node
import {afterEach,describe,expect,it,vi} from 'vitest';
import {webcrypto} from 'node:crypto';
import {decodeTerrainMeshAsset,encodeTerrainMeshAsset,loadTerrainMeshAsset,TERRAIN_MESH_ASSET_MAX_BYTES} from './terrainMeshAsset';
import type {TerrainMeshData} from './terrainMesh';

/** Analytic plane fixture only; never calls a terrain sampler or builder. */
function plane(countArray=false,levels=1):TerrainMeshData{
 const cells=4,positions:number[]=[],normals:number[]=[],surface:number[]=[],indices:number[]=[],vertex=new Map<string,number>();
 const first=new Uint32Array(cells*cells*levels).fill(0xffffffff),counts=new Uint8Array(first.length);
 const at=(x:number,z:number)=>{const key=`${x},${z}`;let id=vertex.get(key);if(id===undefined){id=vertex.size;vertex.set(key,id);positions.push(x*.01,0,z*.01);normals.push(0,1,0);surface.push(0,-.25);}return id;};
 for(let level=0;level<levels;level++)for(let z=-2;z<2;z++)for(let x=-2;x<2;x++){
  if(level>0&&x>=-1&&x<1&&z>=-1&&z<1)continue;
  const cell=(level*cells+z+2)*cells+x+2,step=2**level,corners=[[x,z],[x,z+1],[x+1,z+1],[x+1,z]];
  const split=level===0?-1:x===1&&z>=-1&&z<1?0:z===-2&&x>=-1&&x<1?1:x===-2&&z>=-1&&z<1?2:z===1&&x>=-1&&x<1?3:-1;
  first[cell]=indices.length;
  if(split<0){const c=corners.map(([ix,iz])=>at(ix*step,iz*step));indices.push(c[0],c[1],c[2],c[0],c[2],c[3]);counts[cell]=2;}
  else{const polygon:number[]=[];for(let e=0;e<4;e++){const a=corners[e],b=corners[(e+1)%4];polygon.push(at(a[0]*step,a[1]*step));if(e===split)polygon.push(at((a[0]+b[0])*step/2,(a[1]+b[1])*step/2));}
   const centre=at((x+.5)*step,(z+.5)*step);for(let e=0;e<5;e++)indices.push(centre,polygon[e],polygon[(e+1)%5]);counts[cell]=5;}
 }
 const data:TerrainMeshData={positions:new Float32Array(positions),normals:new Float32Array(normals),surface:new Float32Array(surface),indices:new Uint32Array(indices),cellFirstIndex:first,
  stats:{vertices:vertex.size,triangles:indices.length/3,stitchedCells:8*(levels-1),levels,cellsPerSide:4,baseSpacingKm:.01,outerExtentKm:.02*2**(levels-1),geometryBytes:positions.length*4+normals.length*4+surface.length*4+indices.length*4,
   sampleCalls:vertex.size,minimumHeightKm:0,maximumHeightKm:0,normalBlendStartRadiusKm:.512,normalBlendEndRadiusKm:1.024,normalMode:'geometry'}};
 if(countArray)data.cellTriangleCount=counts;return data;
}
const raw=(v:ArrayBufferView)=>new Uint8Array(v.buffer,v.byteOffset,v.byteLength);
function mutateMetadata(buffer:ArrayBuffer,change:(stats:Record<string,unknown>)=>void):ArrayBuffer{
 const original=new Uint8Array(buffer),view=new DataView(buffer),oldLength=view.getUint32(12,true),metadata=JSON.parse(new TextDecoder().decode(original.subarray(128,128+oldLength)));
 change(metadata.stats);const text=new TextEncoder().encode(JSON.stringify(metadata)),oldAligned=(128+oldLength+3)&~3,newAligned=(128+text.length+3)&~3,delta=newAligned-oldAligned;
 const output=new ArrayBuffer(buffer.byteLength+delta),bytes=new Uint8Array(output),out=new DataView(output);bytes.set(original.subarray(0,128));bytes.set(text,128);bytes.set(original.subarray(oldAligned),newAligned);
 out.setUint32(8,output.byteLength,true);out.setUint32(12,text.length,true);for(let i=0;i<6;i++)out.setUint32(28+i*16,view.getUint32(28+i*16,true)+delta,true);return output;
}
const hash=async(buffer:ArrayBuffer)=>Array.from(new Uint8Array(await webcrypto.subtle.digest('SHA-256',buffer)),b=>b.toString(16).padStart(2,'0')).join('');
function streamed(buffer:ArrayBuffer,chunk=73,headers:Record<string,string>={}):Response{
 let at=0;return new Response(new ReadableStream<Uint8Array>({pull(controller){if(at===buffer.byteLength){controller.close();return;}const end=Math.min(buffer.byteLength,at+chunk);controller.enqueue(new Uint8Array(buffer.slice(at,end)));at=end;}}),{status:200,headers});
}
afterEach(()=>vi.unstubAllGlobals());

describe('TMA1 static mesh codec',()=>{
 it('roundtrips original stats and all six arrays, with no per-array copy on decode',()=>{
  const original=plane(true,2),before=original.positions.slice(),buffer=encodeTerrainMeshAsset(original),result=decodeTerrainMeshAsset(buffer);
  expect(result.stats).toEqual(original.stats);expect(original.positions).toEqual(before);
  for(const name of ['positions','normals','surface','indices','cellFirstIndex','cellTriangleCount'] as const){
   expect(raw(result[name]!)).toEqual(raw(original[name]!));expect(result[name]!.buffer).toBe(buffer);
  }
  result.positions[0]=123;expect(original.positions[0]).toBe(before[0]);
  expect(result.cellFirstIndex[0]).toBe(0);expect(result.cellFirstIndex[16+5]).toBe(0xffffffff);
 });
 it('retains optional count absence and signed-zero float array bits',()=>{
  const original=plane();original.positions[0]=-0;original.normals[0]=-0;original.surface[0]=-0;
  const result=decodeTerrainMeshAsset(encodeTerrainMeshAsset(original));expect(result.cellTriangleCount).toBeUndefined();
  expect(Object.is(result.positions[0],-0)).toBe(true);expect(Object.is(result.normals[0],-0)).toBe(true);expect(Object.is(result.surface[0],-0)).toBe(true);
 });
 it('respects an aligned byteOffset and typed-array input offsets; rejects an unaligned resource',()=>{
  const original=plane(true),shifted=new Float32Array(original.positions.length+4);shifted.set(original.positions,4);original.positions=shifted.subarray(4);
  const buffer=encodeTerrainMeshAsset(original),backing=new Uint8Array(buffer.byteLength+12);backing.set(new Uint8Array(buffer),8);
  const decoded=decodeTerrainMeshAsset(backing.subarray(8,8+buffer.byteLength));expect(raw(decoded.positions)).toEqual(raw(original.positions));expect(decoded.positions.buffer).toBe(backing.buffer);
  const unaligned=new Uint8Array(buffer.byteLength+1);unaligned.set(new Uint8Array(buffer),1);expect(()=>decodeTerrainMeshAsset(unaligned.subarray(1))).toThrow(/alignment/);
 });
 it('rejects header/version/reserved/layout mutations, overlap, bogus sizes and padding',()=>{
  const original=encodeTerrainMeshAsset(plane());
  for(const [offset,value] of [[0,0],[4,2],[6,124],[16,5],[20,1],[24,99],[28,128],[32,0xffffffff],[36,4],[120,1]]){
   const bad=original.slice(0),view=new DataView(bad);if(offset===4||offset===6)view.setUint16(offset,value,true);else view.setUint32(offset,value,true);
   expect(()=>decodeTerrainMeshAsset(bad),`offset ${offset}`).toThrow();
  }
  const metadataLength=new DataView(original).getUint32(12,true),aligned=(128+metadataLength+3)&~3;
  if(aligned>128+metadataLength){const bad=original.slice(0);new Uint8Array(bad)[128+metadataLength]=1;expect(()=>decodeTerrainMeshAsset(bad)).toThrow(/padding/);}
 });
 it('rejects every truncation prefix and both declared and undeclared trailing bytes',()=>{
  const original=encodeTerrainMeshAsset(plane());
  for(const length of [0,4,127,128,129,original.byteLength-4,original.byteLength-1])expect(()=>decodeTerrainMeshAsset(original.slice(0,length))).toThrow();
  const extra=new Uint8Array(original.byteLength+4);extra.set(new Uint8Array(original));expect(()=>decodeTerrainMeshAsset(extra)).toThrow(/trailing/);
  new DataView(extra.buffer).setUint32(8,extra.byteLength,true);expect(()=>decodeTerrainMeshAsset(extra)).toThrow(/trailing/);
 });
 it('rejects fake stats, oversized counts, invalid lookup dimensions, missing refined count and non-JSON metadata',()=>{
  const original=encodeTerrainMeshAsset(plane());
  for(const change of [
   (s:Record<string,unknown>)=>{s.vertices=1_000_001;},(s:Record<string,unknown>)=>{s.triangles=2_000_001;},
   (s:Record<string,unknown>)=>{s.geometryBytes=64*1024*1024+4;},(s:Record<string,unknown>)=>{s.cellsPerSide=257;},
   (s:Record<string,unknown>)=>{s.levels=10;},(s:Record<string,unknown>)=>{s.cellsPerSide=6;},
   (s:Record<string,unknown>)=>{s.sampleCalls=999;},(s:Record<string,unknown>)=>{s.maximumHeightKm=1;},
   (s:Record<string,unknown>)=>{s.outerExtentKm=999;},(s:Record<string,unknown>)=>{s.refinement={};},
  ])expect(()=>decodeTerrainMeshAsset(mutateMetadata(original,change))).toThrow();
  const d=plane();(d.stats as unknown as Record<string,unknown>).bad=Infinity;expect(()=>encodeTerrainMeshAsset(d)).toThrow(/metadata/);
 });
 it('rejects out-of-range vertex indices, nonfinite geometry, bad normals, and gaps or overlap in lookup',()=>{
  for(const change of [
   (d:TerrainMeshData)=>{d.indices[0]=d.stats.vertices;},(d:TerrainMeshData)=>{d.positions[0]=NaN;},
   (d:TerrainMeshData)=>{d.surface[0]=-.1;},(d:TerrainMeshData)=>{d.normals[1]=0;},
   (d:TerrainMeshData)=>{d.cellFirstIndex[1]=3;},(d:TerrainMeshData)=>{d.cellTriangleCount![0]=255;},
  ]){const d=plane(true);change(d);expect(()=>encodeTerrainMeshAsset(d)).toThrow();}
  const bad=encodeTerrainMeshAsset(plane()),view=new DataView(bad),indexOffset=view.getUint32(28+3*16,true);view.setUint32(indexOffset,999,true);expect(()=>decodeTerrainMeshAsset(bad)).toThrow(/index/);
  const holes=plane(true,2);holes.cellTriangleCount![21]=1;expect(()=>encodeTerrainMeshAsset(holes)).toThrow(/hole/);
 });
 it('preserves a valid zero-split refinement and requires its exact count array',()=>{
  const d=plane(true);d.stats.sampleCalls++;
  d.stats.refinement={originalVertices:25,originalTriangles:32,probeSampleCalls:1,vertexSampleCalls:25,totalSampleCalls:26,nodesAboveThreshold:0,eligibleNodesAboveThreshold:0,markedRedFaces:0,greenFaces:0,splitEdgeCount:0,addedVertices:0,addedTriangles:0,addedGeometryBytes:0,
   sourceSpacingKm:.01,maxErrorKm:.001,selectedNodeColumns:1,selectedNodeRows:1,sourceGrid:{minXKm:0,minZKm:0,spacingKm:.01,columns:2,rows:2},selectionDomain:{minXKm:0,maxXKm:0,minZKm:0,maxZKm:0},originalFacesBySplitEdgeCount:[32,0,0,0],maximumCellTriangles:2,cellTriangleCountBytes:16,midpointVerticesOutsideDomain:0,
   boundsKm:{min:[Math.fround(-.02),0,Math.fround(-.02)],max:[Math.fround(.02),0,Math.fround(.02)]}};
  expect(decodeTerrainMeshAsset(encodeTerrainMeshAsset(d)).stats).toEqual(d.stats);
  const encoded=encodeTerrainMeshAsset(d);
  const impossibleRed=mutateMetadata(encoded,s=>{const r=s.refinement as Record<string,unknown>;r.markedRedFaces=1;r.eligibleNodesAboveThreshold=1;r.nodesAboveThreshold=1;r.greenFaces=-1;});
  expect(()=>decodeTerrainMeshAsset(impossibleRed)).toThrow(/greenFaces|refinement/);
  const emptySelection=mutateMetadata(encoded,s=>{const r=s.refinement as Record<string,unknown>;r.selectionDomain={minXKm:.001,maxXKm:.002,minZKm:.001,maxZKm:.002};});
  expect(()=>decodeTerrainMeshAsset(emptySelection)).toThrow(/selected-node/);
  d.cellTriangleCount=undefined;expect(()=>encodeTerrainMeshAsset(d)).toThrow(/needs/);
 });
});

describe('TMA1 bounded loader',()=>{
 it('checks a real SHA256 before decode and forwards signal without a builder fallback',async()=>{
  const buffer=encodeTerrainMeshAsset(plane(true)),sha=await hash(buffer),signal=new AbortController().signal;
  const fetchMock=vi.fn(async()=>streamed(buffer));vi.stubGlobal('fetch',fetchMock);vi.stubGlobal('crypto',webcrypto);
  const result=await loadTerrainMeshAsset('/test-mesh.bin',sha.toUpperCase(),signal);expect(result.stats.vertices).toBe(25);expect(fetchMock).toHaveBeenCalledExactlyOnceWith('/test-mesh.bin',{signal});
  const tampered=buffer.slice(0),tv=new DataView(tampered);tv.setUint32(tv.getUint32(28+3*16,true),999,true);fetchMock.mockImplementation(async()=>streamed(tampered));
  await expect(loadTerrainMeshAsset('/test-mesh.bin',sha)).rejects.toThrow(/SHA256 mismatch/);
 });
 it('rejects bad expected hashes, HTTP failures, missing stream, caps and short/long bodies explicitly',async()=>{
  const buffer=encodeTerrainMeshAsset(plane()),sha=await hash(buffer),fetchMock=vi.fn();vi.stubGlobal('fetch',fetchMock);vi.stubGlobal('crypto',webcrypto);
  await expect(loadTerrainMeshAsset('/x','x')).rejects.toThrow(/SHA256/);expect(fetchMock).not.toHaveBeenCalled();
  fetchMock.mockResolvedValue(new Response(null,{status:404}));await expect(loadTerrainMeshAsset('/x',sha)).rejects.toThrow(/HTTP 404/);
  fetchMock.mockResolvedValue(new Response(null,{status:200}));await expect(loadTerrainMeshAsset('/x',sha)).rejects.toThrow(/no stream/);
  fetchMock.mockImplementation(async()=>streamed(buffer,73,{'content-length':String(TERRAIN_MESH_ASSET_MAX_BYTES+1)}));await expect(loadTerrainMeshAsset('/x',sha)).rejects.toThrow(/HTTP byte cap/);
  fetchMock.mockImplementation(async()=>streamed(buffer.slice(0,-1)));await expect(loadTerrainMeshAsset('/x',sha)).rejects.toThrow(/truncated/);
  const extra=new Uint8Array(buffer.byteLength+1);extra.set(new Uint8Array(buffer));fetchMock.mockImplementation(async()=>streamed(extra.buffer));await expect(loadTerrainMeshAsset('/x',sha)).rejects.toThrow(/trailing/);
 });
 it('cancels before fetch and while an HTTP stream read is pending',async()=>{
  const buffer=encodeTerrainMeshAsset(plane()),sha=await hash(buffer),early=new AbortController(),fetchMock=vi.fn();vi.stubGlobal('fetch',fetchMock);vi.stubGlobal('crypto',webcrypto);
  early.abort();await expect(loadTerrainMeshAsset('/x',sha,early.signal)).rejects.toMatchObject({name:'AbortError'});expect(fetchMock).not.toHaveBeenCalled();
  const running=new AbortController(),cancel=vi.fn();let first=true;
  fetchMock.mockResolvedValue(new Response(new ReadableStream<Uint8Array>({pull(controller){if(first){first=false;controller.enqueue(new Uint8Array(buffer.slice(0,128)));}else return new Promise<void>(()=>{});},cancel})));
  const promise=loadTerrainMeshAsset('/x',sha,running.signal);await new Promise(resolve=>setTimeout(resolve,0));running.abort();
  await expect(promise).rejects.toMatchObject({name:'AbortError'});expect(cancel).toHaveBeenCalledOnce();
 });
});
