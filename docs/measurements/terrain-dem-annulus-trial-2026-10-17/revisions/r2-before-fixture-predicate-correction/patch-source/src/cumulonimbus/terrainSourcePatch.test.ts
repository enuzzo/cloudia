import {describe,expect,it} from 'vitest';
import {Vector3} from 'three/webgpu';
import {buildTerrainMeshData,terrainMeshHitAt,terrainMeshSurfaceY,type TerrainMeshData,type TerrainMeshOptions,type TerrainMeshRefinement} from './terrainMesh';
import type {TerrainSurfaceSample} from './terrainSurface';

const options={cellsPerSide:16,levels:4,spacingKm:.125,normalMode:'geometry' as const};
const sourcePatch={coreHalfExtentKm:2,outerCutKm:Math.fround(6*.5),retainedInnerHalfExtentKm:1};
function refinement(spacing=.25):TerrainMeshRefinement{
 return {sourceGrid:{minXKm:-8,minZKm:-8,spacingKm:spacing,columns:16/spacing+1,rows:16/spacing+1},
  domain:{minXKm:-2,maxXKm:2,minZKm:-2,maxZKm:2},maxErrorKm:.005,
  limits:{maxProbeCount:100000,maxVertices:100000,maxTriangles:250000,maxGeometryBytes:16*1024*1024}};
}
const sample=(x:number,z:number):TerrainSurfaceSample=>({
 heightKm:1.4+.12*Math.sin(x*3.1)*Math.cos(z*2.3)+.07*Math.cos(x*1.4+z*1.1),
 slopeX:.372*Math.cos(x*3.1)*Math.cos(z*2.3)-.098*Math.sin(x*1.4+z*1.1),
 slopeZ:-.276*Math.sin(x*3.1)*Math.sin(z*2.3)-.077*Math.sin(x*1.4+z*1.1),coastKm:.5+.2*x-.15*z,
});
const configuration=():TerrainMeshOptions=>({...options,refinement:refinement(),sourcePatch});
const point=(data:TerrainMeshData,id:number)=>new Vector3().fromArray(data.positions,id*3);
const raw=(view:ArrayBufferView)=>new Uint8Array(view.buffer,view.byteOffset,view.byteLength);

/** Independent tiny-mesh oracle: projected half-planes and a 3D plane,
 * without any runtime cell/source-patch lookup or analytic height evaluation. */
function bruteHeight(data:TerrainMeshData,x:number,z:number):number|null{
 let maximum=-Infinity;
 for(let i=0;i<data.indices.length;i+=3){
  const vertices=Array.from(data.indices.subarray(i,i+3),id=>point(data,id));
  if(vertices.some((a,j)=>{
   const b=vertices[(j+1)%3];return (b.z-a.z)*(x-a.x)-(b.x-a.x)*(z-a.z)<-1e-12;
  }))continue;
  const [a,b,c]=vertices,n=b.clone().sub(a).cross(c.clone().sub(a));
  maximum=Math.max(maximum,a.y-(n.x*(x-a.x)+n.z*(z-a.z))/n.y);
 }
 return Number.isFinite(maximum)?maximum:null;
}

/** Triangle identity by ordered corner F32 bits, independent of new vertex IDs
 * and global face ordering. Normals at new seams are intentionally excluded. */
function retainedTriangles(data:TerrainMeshData,part:'inner'|'outer'):string[]{
 const positions=new Uint32Array(data.positions.buffer,data.positions.byteOffset,data.positions.length);
 const surface=new Uint32Array(data.surface.buffer,data.surface.byteOffset,data.surface.length),result:string[]=[];
 for(let i=0;i<data.indices.length;i+=3){
  const ids=Array.from(data.indices.subarray(i,i+3));
  if(!ids.every(id=>{
   const r=Math.max(Math.abs(data.positions[id*3]),Math.abs(data.positions[id*3+2]));
   return part==='inner'?r<=1:r>=3;
  }))continue;
  result.push(ids.map(id=>[positions[id*3],positions[id*3+1],positions[id*3+2],surface[id*2],surface[id*2+1]].join(',')).join('|'));
 }
 return result.sort();
}

describe('source-node annulus with welded retained inner and outer terrain',()=>{
 it('keeps undefined OFF exactly on the original refined path, including buffers, stats and sampling',()=>{
  let implicitCalls=0,explicitCalls=0;
  const common={...options,refinement:refinement()},implicit=buildTerrainMeshData((x,z)=>{implicitCalls++;return sample(x,z);},common);
  const explicit=buildTerrainMeshData((x,z)=>{explicitCalls++;return sample(x,z);},{...common,sourcePatch:undefined});
  for(const name of ['positions','normals','surface','indices','cellFirstIndex'] as const)expect(raw(explicit[name])).toEqual(raw(implicit[name]));
  expect(explicit.cellTriangleCount).toBeDefined();expect(implicit.cellTriangleCount).toBeDefined();
  expect(raw(explicit.cellTriangleCount!)).toEqual(raw(implicit.cellTriangleCount!));
  expect(explicit.stats).toEqual(implicit.stats);expect(explicitCalls).toBe(implicitCalls);
  expect(Object.hasOwn(implicit.stats,'sourcePatch')).toBe(false);expect(Object.hasOwn(explicit.stats,'sourcePatch')).toBe(false);
 });

 it('keeps omitted and explicit undefined retained-inner options on the same uniform path',()=>{
  const uniform={coreHalfExtentKm:2,outerCutKm:3},common={...options,refinement:refinement()};
  const omitted=buildTerrainMeshData(sample,{...common,sourcePatch:uniform});
  const explicit=buildTerrainMeshData(sample,{...common,sourcePatch:{...uniform,retainedInnerHalfExtentKm:undefined}});
  for(const name of ['positions','normals','surface','indices','cellFirstIndex'] as const)expect(raw(explicit[name])).toEqual(raw(omitted[name]));
  expect(raw(explicit.cellTriangleCount!)).toEqual(raw(omitted.cellTriangleCount!));expect(explicit.stats).toEqual(omitted.stats);
  expect(omitted.stats.sourcePatch!.sourceHoleHalfExtentKm).toBeUndefined();
 });

 it('keeps the inner and outer v61 triangles and F32 corner attributes exactly',()=>{
  const plan=refinement(),base=buildTerrainMeshData(sample,{...options,refinement:plan}),patched=buildTerrainMeshData(sample,{...options,refinement:plan,sourcePatch});
  for(const part of ['inner','outer'] as const){
   const expected=retainedTriangles(base,part),actual=retainedTriangles(patched,part);
   expect(expected.length).toBeGreaterThan(0);expect(actual).toEqual(expected);
  }
  for(const [x,z] of [[0,0],[.37,-.61],[-.875,.625],[.19,.82],[3.4,.77],[6.1,-4.3]]){
   const reference=terrainMeshHitAt(base,x,z),actual=terrainMeshHitAt(patched,x,z);
   expect(reference).not.toBeNull();expect(actual).not.toBeNull();expect(actual!.y).toBe(reference!.y);
  }
 });

 it('uses unmodified source-node height/coast only in the closed source annulus outside its open hole',()=>{
  let calls=0;
  const data=buildTerrainMeshData((x,z)=>{calls++;return sample(x,z);},configuration()),used=new Set(data.indices);
  const ids=new Map<string,number>();for(const id of used){const p=point(data,id);ids.set(`${p.x},${p.z}`,id);}
  let sourceNodes=0;
  for(let z=-2;z<=2;z+=.25)for(let x=-2;x<=2;x+=.25){
   if(Math.max(Math.abs(x),Math.abs(z))<1.25)continue;
   sourceNodes++;
   const id=ids.get(`${x},${z}`);expect(id).toBeDefined();
   const value=sample(x,z),p=point(data,id!);
   expect(p.y).toBe(Math.fround(terrainMeshSurfaceY(x,z,value.heightKm)));
   expect(data.surface[id!*2]).toBe(Math.fround(value.heightKm));expect(data.surface[id!*2+1]).toBe(Math.fround(value.coastKm));
  }
  const patch=data.stats.sourcePatch!;expect(patch).toBeDefined();
  expect(patch.coreHalfExtentKm).toBe(2);expect(patch.outerCutKm).toBe(3);expect(patch.sourceSpacingKm).toBe(.25);
  expect(patch.retainedInnerHalfExtentKm).toBe(1);expect(patch.sourceHoleHalfExtentKm).toBe(1.25);
  expect(patch.sourceVertices).toBe(sourceNodes);expect(patch.innerVertices).toBeGreaterThan(0);expect(patch.outerVertices).toBeGreaterThan(0);
  expect(patch.sourceTriangles).toBeGreaterThan(0);expect(patch.innerTriangles).toBeGreaterThan(0);expect(patch.outerTriangles).toBeGreaterThan(0);
  expect(patch.innerSeamTriangles).toBeGreaterThan(0);expect(patch.outerSeamTriangles).toBeGreaterThan(0);
  expect(patch.seamTriangles).toBe(patch.innerSeamTriangles+patch.outerSeamTriangles);
  expect(patch.sourceTriangles+patch.innerTriangles+patch.outerTriangles+patch.seamTriangles).toBe(data.stats.triangles);
  expect(patch.newSampleCalls).toBeGreaterThan(0);expect(data.stats.sampleCalls).toBe(calls);
  expect(data.stats.stitchedCells).toBeLessThan(patch.prePatchStitchedCells);
 });

 it('forms one upward-facing disk, with no exposed inner edge, duplicate seam vertex or corner T-junction',()=>{
  const data=buildTerrainMeshData(sample,configuration()),edges=new Map<string,{a:number;b:number;count:number;orientation:number}>();
  const used=new Set(data.indices),coordinates=new Set<string>(),areaNormals=new Float64Array(data.normals.length);
  for(const id of used){
   const p=point(data,id),key=`${p.x},${p.z}`;expect(coordinates.has(key)).toBe(false);coordinates.add(key);
   expect(p.toArray().every(Number.isFinite)).toBe(true);
  }
  for(let i=0;i<data.indices.length;i+=3){
   const ids=Array.from(data.indices.subarray(i,i+3));expect(new Set(ids).size).toBe(3);
   for(const id of ids)expect(id).toBeLessThan(data.stats.vertices);
   const [a,b,c]=ids.map(id=>point(data,id)),n=b.clone().sub(a).cross(c.clone().sub(a));
   expect(n.y).toBeGreaterThan(0);expect(n.toArray().every(Number.isFinite)).toBe(true);
   for(const id of ids){areaNormals[id*3]+=n.x;areaNormals[id*3+1]+=n.y;areaNormals[id*3+2]+=n.z;}
   for(let side=0;side<3;side++){
    const from=ids[side],to=ids[(side+1)%3],a=Math.min(from,to),b=Math.max(from,to),key=`${a},${b}`;
    const edge=edges.get(key)??{a,b,count:0,orientation:0};edge.count++;edge.orientation+=from===a?1:-1;edges.set(key,edge);
   }
  }
  const extent=Math.fround(data.stats.outerExtentKm);expect(extent).toBe(8);let boundary=0;
  for(const edge of edges.values()){
   expect([1,2]).toContain(edge.count);
   if(edge.count===2){expect(edge.orientation).toBe(0);continue;}
   boundary++;const a=point(data,edge.a),b=point(data,edge.b);
   expect((a.x===b.x&&Math.abs(a.x)===extent)||(a.z===b.z&&Math.abs(a.z)===extent)).toBe(true);
  }
  expect(boundary).toBe(4*options.cellsPerSide);expect(used.size-edges.size+data.stats.triangles).toBe(1);
  for(const id of used){
   const normal=new Vector3().fromArray(data.normals,id*3),expected=new Vector3().fromArray(areaNormals,id*3).normalize();
   expect(normal.toArray().every(Number.isFinite)).toBe(true);expect(normal.y).toBeGreaterThan(0);expect(normal.length()).toBeCloseTo(1,6);
   expect(normal.distanceTo(expected)).toBeLessThan(2e-7);
  }
  // Actual shared seam/corner IDs must have incident triangles on both sides.
  // Counting identical coordinates alone would accept disconnected duplicate vertices.
  for(const join of [1,1.25,2,3])for(const [x,z] of [[join,join],[-join,join],[join,-join],[-join,-join],[join,0],[-join,0],[0,join],[0,-join]]){
   const id=[...used].find(id=>data.positions[id*3]===x&&data.positions[id*3+2]===z);expect(id).toBeDefined();
   let inner=false,outer=false;
   for(let i=0;i<data.indices.length;i+=3){
    const ids=Array.from(data.indices.subarray(i,i+3));if(!ids.includes(id!))continue;
    const cx=ids.reduce((sum,k)=>sum+data.positions[k*3],0)/3,cz=ids.reduce((sum,k)=>sum+data.positions[k*3+2],0)/3;
    inner ||= Math.max(Math.abs(cx),Math.abs(cz))<join;outer ||= Math.max(Math.abs(cx),Math.abs(cz))>join;
   }
   expect(inner).toBe(true);expect(outer).toBe(true);
  }
 });

 it('queries both zipper seams, the source annulus and retained near/far terrain without sampler calls',()=>{
  let calls=0;
  const data=buildTerrainMeshData((x,z)=>{calls++;return sample(x,z);},configuration()),before=calls;
  const queries:Array<[number,number]>=[[0,0],[.37,-.61],[1.11,.13],[-1.18,-1.09],[-1.875,1.625],[2.2,.31],[-2.4,-2.1],[3.4,.77],[6.1,-4.3],[8,0],[-8,8]];
  for(const boundary of [1,1.25,2,3])for(const sign of [-1,1])for(const epsilon of [-1e-5,0,1e-5]){
   queries.push([sign*boundary+epsilon,.13],[.27,sign*boundary+epsilon],[sign*boundary+epsilon,sign*boundary+epsilon]);
  }
  for(const [x,z] of queries){
   const expected=bruteHeight(data,x,z),hit=terrainMeshHitAt(data,x,z);expect(expected).not.toBeNull();expect(hit).not.toBeNull();
   expect(hit!.y).toBeCloseTo(expected!,9);
   expect(hit!.faceIndex).toBeGreaterThanOrEqual(0);expect(hit!.faceIndex).toBeLessThan(data.stats.triangles);
  }
  for(const [x,z] of [[8.001,0],[-8.001,0],[0,8.001],[0,-8.001]])expect(terrainMeshHitAt(data,x,z)).toBeNull();
  expect(calls).toBe(before);
 });

 it('requires geometric normals and refinement and rejects malformed/out-of-domain patch configurations',()=>{
  let calls=0;const counted=(x:number,z:number)=>{calls++;return sample(x,z);};
  expect(()=>buildTerrainMeshData(counted,{...options,sourcePatch})).toThrow(RangeError);
  expect(()=>buildTerrainMeshData(counted,{...configuration(),normalMode:'analytic-blend'})).toThrow(RangeError);
  expect(calls).toBe(0);
  for(const invalid of [{coreHalfExtentKm:0,outerCutKm:3},{coreHalfExtentKm:-2,outerCutKm:3},{coreHalfExtentKm:NaN,outerCutKm:3},
   {coreHalfExtentKm:2,outerCutKm:2},{coreHalfExtentKm:2,outerCutKm:1},{coreHalfExtentKm:2,outerCutKm:Infinity},{coreHalfExtentKm:2,outerCutKm:NaN},
   {coreHalfExtentKm:9,outerCutKm:10},{coreHalfExtentKm:2.125,outerCutKm:3},{coreHalfExtentKm:2,outerCutKm:3.125}])expect(()=>buildTerrainMeshData(counted,{...configuration(),sourcePatch:invalid})).toThrow(RangeError);
  const narrow=refinement();narrow.sourceGrid={minXKm:-1,minZKm:-1,spacingKm:.25,columns:9,rows:9};
  narrow.domain={minXKm:-1,maxXKm:1,minZKm:-1,maxZKm:1};
  expect(()=>buildTerrainMeshData(counted,{...options,refinement:narrow,sourcePatch})).toThrow(RangeError);
  for(const retainedInnerHalfExtentKm of [-1,NaN,Infinity,2,3,1.125]){
   expect(()=>buildTerrainMeshData(counted,{...configuration(),sourcePatch:{...sourcePatch,retainedInnerHalfExtentKm}})).toThrow(RangeError);
  }
 });

 it('fails explicitly when the replacement output exceeds each retained geometry budget',()=>{
  // A denser fixture source ensures the replacement grows; no real DEM or full mesh.
  const flat=():TerrainSurfaceSample=>({heightKm:1,slopeX:0,slopeZ:0,coastKm:2}),plan=refinement(.0625);
  const base=buildTerrainMeshData(flat,{...options,refinement:plan}),full=buildTerrainMeshData(flat,{...options,refinement:plan,sourcePatch});
  expect(full.stats.vertices).toBeGreaterThan(base.stats.vertices);expect(full.stats.triangles).toBeGreaterThan(base.stats.triangles);
  expect(full.stats.geometryBytes).toBeGreaterThan(base.stats.geometryBytes);
  for(const limits of [{...plan.limits,maxVertices:full.stats.vertices-1},{...plan.limits,maxTriangles:full.stats.triangles-1},
   {...plan.limits,maxGeometryBytes:full.stats.geometryBytes-1}]){
   expect(()=>buildTerrainMeshData(flat,{...options,sourcePatch,refinement:{...plan,limits}})).toThrow(RangeError);
  }
 });
});
