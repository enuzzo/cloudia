import {describe,it,expect} from 'vitest';
import {applyTerrainCreaseNormals,type TerrainCreaseNormalInput} from './terrainCreaseNormals';

const bits=(array:Float32Array)=>Array.from(new Uint32Array(array.buffer,array.byteOffset,array.length));
function mesh(positions:number[],indices:number[]):TerrainCreaseNormalInput{
 const p=new Float32Array(positions),ix=new Uint32Array(indices),sum=new Float64Array(p.length);
 for(let i=0;i<ix.length;i+=3){
  const a=ix[i]*3,b=ix[i+1]*3,c=ix[i+2]*3;
  const ab=[p[b]-p[a],p[b+1]-p[a+1],p[b+2]-p[a+2]],ac=[p[c]-p[a],p[c+1]-p[a+1],p[c+2]-p[a+2]];
  const area=[ab[1]*ac[2]-ab[2]*ac[1],ab[2]*ac[0]-ab[0]*ac[2],ab[0]*ac[1]-ab[1]*ac[0]];
  for(const v of [a,b,c])for(let axis=0;axis<3;axis++)sum[v+axis]+=area[axis];
 }
 const normals=new Float32Array(p.length),surface=new Float32Array(p.length/3*2);
 for(let v=0;v<p.length/3;v++){
  const i=v*3,length=Math.hypot(sum[i],sum[i+1],sum[i+2]);
  normals.set(length?[sum[i]/length,sum[i+1]/length,sum[i+2]/length]:[0,1,0],i);
  surface.set([v+.125,Object.is(p[i],-0)?-0:v-.5],v*2);
 }
 return {positions:p,normals,surface,indices:ix};
}
function cornerPreserved(before:TerrainCreaseNormalInput,after:TerrainCreaseNormalInput){
 expect(after.indices.length).toBe(before.indices.length);
 const bp=new Uint32Array(before.positions.buffer),ap=new Uint32Array(after.positions.buffer);
 const bs=new Uint32Array(before.surface.buffer),as=new Uint32Array(after.surface.buffer);
 for(let corner=0;corner<before.indices.length;corner++){
  const a=before.indices[corner],b=after.indices[corner];
  expect(Array.from(ap.subarray(b*3,b*3+3))).toEqual(Array.from(bp.subarray(a*3,a*3+3)));
  expect(Array.from(as.subarray(b*2,b*2+2))).toEqual(Array.from(bs.subarray(a*2,a*2+2)));
 }
 for(let v=0;v<after.normals.length/3;v++){
  const n=after.normals.subarray(v*3,v*3+3);expect(Array.from(n).every(Number.isFinite)).toBe(true);
  expect(Math.hypot(...n)).toBeCloseTo(1,6);
 }
}
const wedge=(rise:number)=>mesh([-0,0,0, 0,0,1, -1,0,0, 1,rise,0],[0,2,1, 0,1,3]);

describe('edge-connected terrain crease normals (tiny geometry only)',()=>{
 it('keeps a planar unequal-area fan byte exact, including signed zero and all input buffers',()=>{
  const input=mesh([-0,0,0, 0,0,1, -2,0,0, 1,0,0],[0,2,1,0,1,3]);
  const snapshots=[bits(input.positions),bits(input.normals),bits(input.surface),Array.from(input.indices)];
  const result=applyTerrainCreaseNormals(input);
  expect(result.positions).toBe(input.positions);expect(result.normals).toBe(input.normals);expect(result.surface).toBe(input.surface);expect(result.indices).toBe(input.indices);
  expect(result.stats.addedVertices).toBe(0);expect(result.stats.addedGeometryBytes).toBe(0);
  expect([bits(input.positions),bits(input.normals),bits(input.surface),Array.from(input.indices)]).toEqual(snapshots);
  cornerPreserved(input,result);
 });
 it('splits a >45-degree shared edge into exact face normals without moving any triangle corner',()=>{
  const input=wedge(2),originalNormals=bits(input.normals),originalIndices=Array.from(input.indices);
  const result=applyTerrainCreaseNormals(input);
  expect(result.stats.splitSourceVertices).toBe(2);expect(result.stats.addedVertices).toBe(2);
  expect(result.stats.outputVertices).toBe(6);expect(result.stats.addedGeometryBytes).toBe(64);
  expect(result.indices[0]).not.toBe(result.indices[3]);expect(result.indices[2]).not.toBe(result.indices[4]);
  const a=result.indices[0]*3,b=result.indices[3]*3;
  expect(result.normals[a]).toBeCloseTo(0,12);expect(result.normals[a+1]).toBe(1);expect(result.normals[a+2]).toBeCloseTo(0,12);
  expect(result.normals[b]).toBeCloseTo(-2/Math.sqrt(5),6);expect(result.normals[b+1]).toBeCloseTo(1/Math.sqrt(5),6);
  expect(result.stats.sharpEdgeEndpointPairs).toBe(2);expect(result.stats.edgeEndpointPairs).toBe(2);
  expect(bits(input.normals)).toEqual(originalNormals);expect(Array.from(input.indices)).toEqual(originalIndices);
  cornerPreserved(input,result);
 });
 it('includes the exact45-degree boundary and rejects the same edge with a lower frozen test angle',()=>{
  const input=wedge(1),boundary=applyTerrainCreaseNormals(input,45),hard=applyTerrainCreaseNormals(input,44);
  expect(boundary.normals).toBe(input.normals);expect(boundary.stats.addedVertices).toBe(0);
  expect(hard.stats.addedVertices).toBe(2);cornerPreserved(input,hard);
 });
 it('does not merge faces that share only one vertex even when their normals are equal',()=>{
  const input=mesh([0,0,0, 0,0,1, -1,0,0, 2,0,0, 0,0,-2],[0,2,1,0,3,4]);
  const result=applyTerrainCreaseNormals(input);
  expect(result.stats.addedVertices).toBe(1);expect(result.stats.maximumGroups).toBe(2);
  expect(result.indices[0]).not.toBe(result.indices[3]);expect(result.stats.edgeEndpointPairs).toBe(0);
  cornerPreserved(input,result);
 });
 it('uses transitive edge connectivity rather than grouping solely against the first face normal',()=>{
  // Adjacent turns are45 and35.264 degrees; endpoints differ54.735 degrees.
  const input=mesh([0,0,0, 1,0,0, 0,0,1, -1,1,0, 0,1,-1],[0,2,1, 0,3,2, 0,4,3]);
  const result=applyTerrainCreaseNormals(input,45);
  expect(result.indices[0]).toBe(result.indices[3]);expect(result.indices[3]).toBe(result.indices[6]);
  expect(bits(result.normals.subarray(0,3))).toEqual(bits(input.normals.subarray(0,3)));
  cornerPreserved(input,result);
 });
 it('counts a hard adjacency even when an alternate smooth fan reconnects its central endpoint',()=>{
  const input=mesh([0,0,0, 1,1.1,0, 0,.6,1, -1,0,0, 0,.6,-1],[0,2,1,0,3,2,0,4,3,0,1,4]);
  const result=applyTerrainCreaseNormals(input);
  expect(result.stats.sharpEdgeEndpointPairs).toBe(2);
  expect(result.stats.splitSourceVertices).toBe(1);expect(result.stats.addedVertices).toBe(1);
  expect([result.indices[0],result.indices[3],result.indices[6],result.indices[9]]).toEqual([0,0,0,0]);
  expect(bits(result.normals.subarray(0,3))).toEqual(bits(input.normals.subarray(0,3)));
  cornerPreserved(input,result);
 });
 it('fails before truncation at geometry/valence caps and leaves every input byte intact',()=>{
  const input=wedge(2),before=[bits(input.positions),bits(input.normals),bits(input.surface),Array.from(input.indices)];
  expect(()=>applyTerrainCreaseNormals(input,45,{maxVertices:5})).toThrow(/output vertex limit/);
  expect(()=>applyTerrainCreaseNormals(input,45,{maxIncidentFaces:1})).toThrow(/incident-face limit/);
  expect(()=>applyTerrainCreaseNormals(input,45,{maxTriangles:1})).toThrow(/input exceeds/);
  expect([bits(input.positions),bits(input.normals),bits(input.surface),Array.from(input.indices)]).toEqual(before);
 });
 it('rejects invalid indices, degenerate faces, nonfinite values and unsafe limits explicitly',()=>{
  const invalid=wedge(2);invalid.indices[0]=99;
  expect(()=>applyTerrainCreaseNormals(invalid)).toThrow(/index out of bounds/);
  const degenerate=wedge(2);degenerate.indices[2]=degenerate.indices[1];
  expect(()=>applyTerrainCreaseNormals(degenerate)).toThrow(/Degenerate/);
  const nonfinite=wedge(2);nonfinite.positions[0]=NaN;
  expect(()=>applyTerrainCreaseNormals(nonfinite)).toThrow(/Nonfinite/);
  expect(()=>applyTerrainCreaseNormals(wedge(2),45,{maxVertices:700001})).toThrow(/maxVertices/);
  expect(()=>applyTerrainCreaseNormals(wedge(2),NaN)).toThrow(/angle/);
 });
});
