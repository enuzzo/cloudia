import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {buildTerrainMeshData} from '../crease-source/src/cumulonimbus/terrainMesh';
import {applyTerrainCreaseNormals} from '../crease-source/src/cumulonimbus/terrainCreaseNormals';
import {decodeTerrainDem,createDemTerrainSampler} from '../crease-source/src/cumulonimbus/terrainDem';
import {terrainSurfaceSample} from '../crease-source/src/cumulonimbus/terrainSurface';
const started=performance.now();
const bytes=readFileSync(new URL('../crease-source/src/cumulonimbus/assets/liguria-apuane-dem.bin',import.meta.url));
const grid=decodeTerrainDem(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));
const sample=createDemTerrainSampler(grid,terrainSurfaceSample);
const base=buildTerrainMeshData(sample,{cellsPerSide:256,levels:9,normalMode:'geometry',refinement:{sourceGrid:{minXKm:grid.minX,minZKm:grid.minZ,spacingKm:grid.spacingKm,columns:grid.side,rows:grid.side},domain:{minXKm:-48,maxXKm:48,minZKm:-48,maxZKm:48},maxErrorKm:.005,limits:{maxProbeCount:600000,maxVertices:1000000,maxTriangles:2000000,maxGeometryBytes:64*1024*1024}}});
const built=performance.now();
const hash=(v:ArrayBufferView)=>createHash('sha256').update(new Uint8Array(v.buffer,v.byteOffset,v.byteLength)).digest('hex');
const expectedBase={positions:'4c7e3f0b92c294850dad4014d3c260e0cb922ba5ade13a952722240a2e5ecc64',normals:'3cb820d4d203c89f61e8e26809ddbdcd2f8ce2645dce0842b758a1b0ea6dcbfd',surface:'7595b45c14d4d249df98d99145fcaa485b21d62e419764b99ce4fedc780c76f2',indices:'87e1b8d5b569577c291efefb1698ca66b657ecb3f9c73dcf6ddc73316a1030ae'};
for(const key of Object.keys(expectedBase) as Array<keyof typeof expectedBase>)if(hash(base[key])!==expectedBase[key])throw new Error('Base geometry differs from actual v59 historical mesh: '+key);

const output=applyTerrainCreaseNormals(base,45,{maxVertices:700000,maxTriangles:1300000,maxIncidentFaces:128});
const creased=performance.now();
const posBits=new Uint32Array(base.positions.buffer,base.positions.byteOffset,base.positions.length),outPosBits=new Uint32Array(output.positions.buffer,output.positions.byteOffset,output.positions.length);
const surfBits=new Uint32Array(base.surface.buffer,base.surface.byteOffset,base.surface.length),outSurfBits=new Uint32Array(output.surface.buffer,output.surface.byteOffset,output.surface.length);
let cornerPositionMismatch=0,cornerSurfaceMismatch=0,maxNormalUnitError=0,nonfiniteNormals=0;
if(output.indices.length!==base.indices.length)throw new Error('Triangle count changed');
for(let i=0;i<base.indices.length;i++){
 const a=base.indices[i],b=output.indices[i];
 for(let axis=0;axis<3;axis++)if(posBits[a*3+axis]!==outPosBits[b*3+axis])cornerPositionMismatch++;
 for(let axis=0;axis<2;axis++)if(surfBits[a*2+axis]!==outSurfBits[b*2+axis])cornerSurfaceMismatch++;
}
for(let i=0;i<output.normals.length;i+=3){const x=output.normals[i],y=output.normals[i+1],z=output.normals[i+2];if(![x,y,z].every(Number.isFinite))nonfiniteNormals++;maxNormalUnitError=Math.max(maxNormalUnitError,Math.abs(Math.hypot(x,y,z)-1));}
if(cornerPositionMismatch||cornerSurfaceMismatch||nonfiniteNormals||maxNormalUnitError>1e-6)throw new Error('Crease geometry/normal invariants failed');
for(const key of Object.keys(expectedBase) as Array<keyof typeof expectedBase>)if(hash(base[key])!==expectedBase[key])throw new Error('Input mutated: '+key);
console.log(JSON.stringify({scope:'One actual v59 base mesh build and fixed45degree crease pass. All triangle corners compared bitwise for position/surface; no new DEM fitting, renderer/GPU/FPS proof.',base:{stats:base.stats,positionSHA256:hash(base.positions),normalSHA256:hash(base.normals),surfaceSHA256:hash(base.surface),indexSHA256:hash(base.indices)},output:{stats:output.stats,vertices:output.positions.length/3,geometryBytes:output.positions.byteLength+output.normals.byteLength+output.surface.byteLength+output.indices.byteLength,positionSHA256:hash(output.positions),normalSHA256:hash(output.normals),surfaceSHA256:hash(output.surface),indexSHA256:hash(output.indices)},invariants:{cornerPositionMismatch,cornerSurfaceMismatch,nonfiniteNormals,maxNormalUnitError,triangleCornersCompared:base.indices.length,baseHistoricalHashesExact:true,inputArraysUnchanged:true},elapsedMs:{build:built-started,crease:creased-built,total:performance.now()-started}},null,2));
