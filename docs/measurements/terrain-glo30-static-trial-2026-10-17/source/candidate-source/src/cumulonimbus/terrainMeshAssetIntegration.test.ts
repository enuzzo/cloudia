import {describe,expect,it} from 'vitest';
import {vec3} from 'three/tsl';
import {buildTerrainMeshData,TerrainMesh,terrainMeshHeightAt,type TerrainMeshConfiguration} from './terrainMesh';
const make=()=>buildTerrainMeshData(()=>({heightKm:1.25,slopeX:0,slopeZ:0,coastKm:-2}),{cellsPerSide:4,levels:1,normalMode:'geometry'});
describe('prevalidated static terrain integration',()=>{
 it('binds the loaded arrays and CPU lookup directly without regenerating default geometry',()=>{
  const data=make(),mesh=new TerrainMesh({data,shade:()=>vec3(.1)});
  try{
   expect(mesh.geometry.getAttribute('position').array).toBe(data.positions);
   expect(mesh.geometry.getAttribute('normal').array).toBe(data.normals);
   expect(mesh.geometry.getAttribute('terrainSurface').array).toBe(data.surface);
   expect(mesh.geometry.index!.array).toBe(data.indices);
   expect(mesh.stats().vertices).toBe(data.stats.vertices);
   expect(mesh.surfaceY(.012,.019)).toBe(terrainMeshHeightAt(data,.012,.019));
  }finally{mesh.dispose();}
 });
 it('rejects ambiguous static data plus any builder input before allocating a raster',()=>{
  const data=make();
  const conflicts:Partial<TerrainMeshConfiguration>[]=[{sample:()=>({heightKm:0,slopeX:0,slopeZ:0,coastKm:0})},{cellsPerSide:4},{levels:1},{spacingKm:.032},{normalMode:'geometry'},
   {refinement:{sourceGrid:{minXKm:-1,minZKm:-1,spacingKm:1,columns:3,rows:3},domain:{minXKm:0,maxXKm:0,minZKm:0,maxZKm:0},maxErrorKm:.005,limits:{maxProbeCount:1,maxVertices:100,maxTriangles:100,maxGeometryBytes:10000}}}];
  for(const extra of conflicts)expect(()=>new TerrainMesh({data,shade:()=>vec3(.1),...extra})).toThrow('cannot be combined');
 });
});
