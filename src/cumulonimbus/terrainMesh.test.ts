import {describe,expect,it} from 'vitest';
import {PerspectiveCamera,Triangle,Vector3,WebGPUCoordinateSystem} from 'three/webgpu';
import {EARTH_RADIUS,GROUND_LEVEL} from './landscape';
import {buildTerrainMeshData,configureTerrainCamera,terrainMeshHeightAt,terrainMeshHitAt,terrainMeshSurfaceY,type TerrainCameraFrame,type TerrainMeshData,type TerrainMeshOptions,type TerrainMeshRefinement} from './terrainMesh';
import type {TerrainSurfaceSample} from './terrainSurface';

const flatSampler=():TerrainSurfaceSample=>({heightKm:1.25,slopeX:0,slopeZ:0,coastKm:7});

const refinementOptions={cellsPerSide:8,levels:3,spacingKm:.125,normalMode:'geometry' as const};
function isolatedPeak(sign=1){
 const x0=sign*.875,z0=sign*.125;
 const sample=(x:number,z:number):TerrainSurfaceSample=>({
  heightKm:1+.2*Math.max(0,1-Math.abs(x-x0)/.125)*Math.max(0,1-Math.abs(z-z0)/.125),
  slopeX:0,slopeZ:0,coastKm:2*x-3*z,
 });
 const refinement:TerrainMeshRefinement={
  sourceGrid:{minXKm:sign>0?.75:-1,minZKm:sign>0?0:-.25,spacingKm:.125,columns:3,rows:3},
  domain:{minXKm:x0,maxXKm:x0,minZKm:z0,maxZKm:z0},maxErrorKm:.005,
  limits:{maxProbeCount:1,maxVertices:10000,maxTriangles:10000,maxGeometryBytes:1000000},
 };
 return {sample,refinement,x0,z0};
}

/** Independent all-face vertical plane oracle for tiny test meshes only. */
function meshPlaneOracle(data:TerrainMeshData,x:number,z:number):number|null{
 let maximum=-Infinity;
 for(let offset=0;offset<data.indices.length;offset+=3){
  const corners=Array.from(data.indices.subarray(offset,offset+3),index=>vertex(data,index));
  let inside=true;
  for(let i=0;i<3;i++){
   const from=corners[i],to=corners[(i+1)%3];
   if((to.z-from.z)*(x-from.x)-(to.x-from.x)*(z-from.z)<-1e-13){inside=false;break;}
  }
  if(!inside)continue;
  const [a,b,c]=corners,normal=b.clone().sub(a).cross(c.clone().sub(a));
  maximum=Math.max(maximum,a.y-(normal.x*(x-a.x)+normal.z*(z-a.z))/normal.y);
 }
 return Number.isFinite(maximum)?maximum:null;
}
const vertex=(data:TerrainMeshData,index:number)=>new Vector3().fromArray(data.positions,index*3);
function normalOracle(data:TerrainMeshData){
 const area=Array.from({length:data.stats.vertices},()=>new Vector3()),unit=area.map(()=>new Vector3());
 for(let i=0;i<data.indices.length;i+=3){
  const ids=Array.from(data.indices.subarray(i,i+3)),triangle=new Triangle(...ids.map(index=>vertex(data,index)) as [Vector3,Vector3,Vector3]);
  const normal=triangle.getNormal(new Vector3()),size=triangle.getArea();
  for(const id of ids){area[id].addScaledVector(normal,size);unit[id].add(normal);}
 }
 return {area:area.map(normal=>normal.normalize()),unit:unit.map(normal=>normal.normalize())};
}

describe('static stitched terrain geometry',()=>{
 it('can derive all normals from actual triangles while preserving every position, surface and index',()=>{
  const sample=(x:number,z:number)=>({heightKm:1+.1*Math.sin(x*7)*Math.cos(z*5),slopeX:0,slopeZ:0,coastKm:7});
  const options={cellsPerSide:8,levels:3,spacingKm:.032},analytic=buildTerrainMeshData(sample,options),geometry=buildTerrainMeshData(sample,{...options,normalMode:'geometry'});
  expect(geometry.positions).toEqual(analytic.positions);expect(geometry.surface).toEqual(analytic.surface);expect(geometry.indices).toEqual(analytic.indices);
  const oracle=normalOracle(geometry).area;
  for(let i=0;i<geometry.stats.vertices;i++)expect(new Vector3().fromArray(geometry.normals,i*3).distanceTo(oracle[i])).toBeLessThan(1e-7);
  expect(geometry.stats.normalMode).toBe('geometry');
 });
 it.each([8,16])('forms one welded, upward-facing disk with %i cells per side',cells=>{
  const spacing=.032,data=buildTerrainMeshData(flatSampler,{cellsPerSide:cells,levels:3,spacingKm:spacing});
  const coordinateIndices=new Map<string,number>(),edges=new Map<string,{a:number;b:number;count:number;orientation:number}>();
  for(let i=0;i<data.stats.vertices;i++){
   const p=vertex(data,i),key=`${p.x},${p.z}`;
   expect(coordinateIndices.has(key)).toBe(false);coordinateIndices.set(key,i);
   expect([p.x,p.y,p.z].every(Number.isFinite)).toBe(true);
   const normal=new Vector3().fromArray(data.normals,i*3);
   expect(normal.toArray().every(Number.isFinite)).toBe(true);expect(normal.y).toBeGreaterThan(0);expect(normal.length()).toBeCloseTo(1,7);
  }
  for(let offset=0;offset<data.indices.length;offset+=3){
   const triangle=Array.from(data.indices.subarray(offset,offset+3));
   expect(new Set(triangle).size).toBe(3);
   for(const index of triangle)expect(index).toBeLessThan(data.stats.vertices);
   const [a,b,c]=triangle.map(index=>vertex(data,index));
   const cross=b.clone().sub(a).cross(c.clone().sub(a));
   expect(cross.y).toBeGreaterThan(0);expect(Number.isFinite(cross.lengthSq())).toBe(true);
   for(let side=0;side<3;side++){
    const from=triangle[side],to=triangle[(side+1)%3],a=Math.min(from,to),b=Math.max(from,to),key=`${a},${b}`;
    const edge=edges.get(key)??{a,b,count:0,orientation:0};
    edge.count++;edge.orientation+=from===a?1:-1;edges.set(key,edge);
   }
  }
  const extent=Math.fround(data.stats.outerExtentKm);let boundary=0;
  for(const edge of edges.values()){
   expect([1,2]).toContain(edge.count);
   if(edge.count===2){expect(edge.orientation).toBe(0);continue;}
   boundary++;
   const a=vertex(data,edge.a),b=vertex(data,edge.b);
   const onOuterBoundary=(a.x===b.x&&Math.abs(a.x)===extent)||(a.z===b.z&&Math.abs(a.z)===extent);
   expect(onOuterBoundary).toBe(true);
  }
  expect(boundary).toBe(4*cells);
  expect(data.stats.vertices-edges.size+data.stats.triangles).toBe(1);
  expect(data.stats.stitchedCells).toBe(4*cells);
  expect(data.indices.length).toBe(data.stats.triangles*3);

  // An odd fine-grid vertex at each join must be used on both sides of the
  // seam, rather than merely duplicated at the same coordinate.
  for(const level of [1,2])for(const side of ['north','south','east','west'] as const){
   const step=2**level,join=cells/4*step,along=(-cells/4+.5)*step;
   const ix=side==='east'?join:side==='west'?-join:along;
   const iz=side==='north'?join:side==='south'?-join:along;
   const index=coordinateIndices.get(`${Math.fround(ix*spacing)},${Math.fround(iz*spacing)}`);
   expect(index).toBeDefined();
   let inside=false,outside=false;
   for(let offset=0;offset<data.indices.length;offset+=3){
    const triangle=Array.from(data.indices.subarray(offset,offset+3));
    if(!triangle.includes(index!))continue;
    for(const neighbor of triangle){
     const p=vertex(data,neighbor),signed=side==='north'?p.z:side==='south'?-p.z:side==='east'?p.x:-p.x;
     inside ||= signed<Math.fround(join*spacing);outside ||= signed>Math.fround(join*spacing);
    }
   }
   expect(inside).toBe(true);expect(outside).toBe(true);
  }
 });

 it('samples each unique vertex once and retains its height and coast attributes',()=>{
  const calls=new Map<string,number>(),samples:TerrainSurfaceSample[]=[];
  const data=buildTerrainMeshData((x,z)=>{
   const key=`${x},${z}`;calls.set(key,(calls.get(key)??0)+1);
   const sample={heightKm:2+.25*x-.125*z,slopeX:.25,slopeZ:-.125,coastKm:x-2*z};
   samples.push(sample);return sample;
  },{cellsPerSide:8,levels:3,spacingKm:.032});
  expect(samples.length).toBe(data.stats.vertices);expect(calls.size).toBe(data.stats.vertices);
  expect([...calls.values()].every(count=>count===1)).toBe(true);
  expect(data.stats.sampleCalls).toBe(samples.length);
  for(let i=0;i<samples.length;i++){
   expect(data.surface[i*2]).toBe(Math.fround(samples[i].heightKm));
   expect(data.surface[i*2+1]).toBe(Math.fround(samples[i].coastKm));
  }
  expect(data.stats.geometryBytes).toBe(data.positions.byteLength+data.normals.byteLength+data.surface.byteLength+data.indices.byteLength);
 });

 it('retains radial analytic normals on the finely resolved flat elevation',()=>{
  const data=buildTerrainMeshData(flatSampler,{cellsPerSide:8,levels:1,spacingKm:.032}),radius=EARTH_RADIUS+1.25;
  let maximumTilt=0;
  for(let i=0;i<data.stats.vertices;i++){
   const p=vertex(data,i),normal=new Vector3().fromArray(data.normals,i*3);
   const expected=new Vector3(p.x,Math.sqrt(radius*radius-p.x*p.x-p.z*p.z),p.z).divideScalar(radius);
   expect(normal.distanceTo(expected)).toBeLessThan(7e-8);
   expect(normal.length()).toBeCloseTo(1,7);maximumTilt=Math.max(maximumTilt,Math.hypot(normal.x,normal.z));
  }
  expect(maximumTilt).toBeGreaterThan(2e-5);
 });

 it('uses area-weighted geometric normals where the analytic detail is unresolved, including shared fan vertices',()=>{
  const sample=(x:number,z:number)=>({heightKm:.6+.5*Math.cos(x*8)*Math.cos(z*11),slopeX:-4*Math.sin(x*8)*Math.cos(z*11),slopeZ:-5.5*Math.cos(x*8)*Math.sin(z*11),coastKm:1});
  const data=buildTerrainMeshData(sample,{cellsPerSide:8,levels:4,spacingKm:.2}),oracle=normalOracle(data);
  let far=0,areaWeightMatters=0,analyticDifference=0;
  for(let i=0;i<data.stats.vertices;i++){
   const point=vertex(data,i),normal=new Vector3().fromArray(data.normals,i*3);
   expect(normal.toArray().every(Number.isFinite)).toBe(true);expect(normal.y).toBeGreaterThan(0);expect(normal.length()).toBeCloseTo(1,7);
   if(Math.max(Math.abs(point.x),Math.abs(point.z))<data.stats.normalBlendEndRadiusKm)continue;
   far++;expect(normal.distanceTo(oracle.area[i])).toBeLessThan(8e-8);
   if(oracle.area[i].distanceTo(oracle.unit[i])>.001)areaWeightMatters++;
   const h=sample(point.x,point.z),radius=EARTH_RADIUS+h.heightKm,radialY=Math.sqrt(radius*radius-point.x*point.x-point.z*point.z);
   const analytic=new Vector3(-(radius*h.slopeX-point.x)/radialY,1,-(radius*h.slopeZ-point.z)/radialY).normalize();
   analyticDifference=Math.max(analyticDifference,analytic.distanceTo(normal));
  }
  expect(far).toBeGreaterThan(50);expect(areaWeightMatters).toBeGreaterThan(0);expect(analyticDifference).toBeGreaterThan(.2);
 });

 it('blends before the coarse ring using a shared normal between the analytic and geometric directions',()=>{
  const sample=(x:number,z:number)=>({heightKm:1+.3*Math.cos(x*5)*Math.cos(z*7),slopeX:-1.5*Math.sin(x*5)*Math.cos(z*7),slopeZ:-2.1*Math.cos(x*5)*Math.sin(z*7),coastKm:1});
  const data=buildTerrainMeshData(sample,{cellsPerSide:8,levels:4,spacingKm:.125}),oracle=normalOracle(data);
  const index=Array.from({length:data.stats.vertices},(_,i)=>i).find(i=>data.positions[i*3]===1.5&&data.positions[i*3+2]===0);
  expect(index).toBeDefined();
  const point=vertex(data,index!),h=sample(point.x,point.z),radius=EARTH_RADIUS+h.heightKm,radialY=Math.sqrt(radius*radius-point.x*point.x-point.z*point.z);
  const analytic=new Vector3(-(radius*h.slopeX-point.x)/radialY,1,-(radius*h.slopeZ-point.z)/radialY).normalize();
  const geometric=oracle.area[index!],normal=new Vector3().fromArray(data.normals,index!*3),endpoints=analytic.dot(geometric);
  expect(normal.dot(analytic)).toBeGreaterThan(endpoints);expect(normal.dot(geometric)).toBeGreaterThan(endpoints);
  expect(normal.distanceTo(analytic)).toBeGreaterThan(.001);expect(normal.distanceTo(geometric)).toBeGreaterThan(.001);
 });

 it('combines the sampled slopes with spherical curvature in its normals',()=>{
  const height=(x:number,z:number)=>2+.25*x-.125*z;
  const data=buildTerrainMeshData((x,z)=>({heightKm:height(x,z),slopeX:.25,slopeZ:-.125,coastKm:0}),{cellsPerSide:8,levels:3,spacingKm:.032});
  const surface=(x:number,z:number)=>terrainMeshSurfaceY(x,z,height(x,z)),epsilon=.001;
  for(let i=0;i<data.stats.vertices;i++){
   const p=vertex(data,i),normal=new Vector3().fromArray(data.normals,i*3);
   const dx=(surface(p.x+epsilon,p.z)-surface(p.x-epsilon,p.z))/(2*epsilon);
   const dz=(surface(p.x,p.z+epsilon)-surface(p.x,p.z-epsilon))/(2*epsilon);
   expect(Math.abs(normal.dot(new Vector3(1,dx,0)))).toBeLessThan(4e-8);
   expect(Math.abs(normal.dot(new Vector3(0,dz,1)))).toBeLessThan(4e-8);
   expect(normal.length()).toBeCloseTo(1,7);expect(normal.y).toBeGreaterThan(0);
  }
 });

 it('keeps the default mesh within the fixed geometry budget',()=>{
  const data=buildTerrainMeshData(flatSampler);
  expect(data.stats.vertices).toBe(130689);expect(data.stats.triangles).toBe(260864);
  expect(data.stats.stitchedCells).toBe(2304);expect(data.stats.outerExtentKm).toBe(1048.576);
  expect(data.stats.sampleCalls).toBe(130689);
  expect(data.stats.normalBlendStartRadiusKm).toBe(16.384);expect(data.stats.normalBlendEndRadiusKm).toBe(32.768);
 });

 it('queries actual triangle heights, including seam fans, without resampling the terrain',()=>{
  let calls=0;
  const elevation=(x:number,z:number)=>1.5+.2*Math.sin(x*20)*Math.cos(z*17);
  const data=buildTerrainMeshData((x,z)=>{
   calls++;return {heightKm:elevation(x,z),slopeX:4*Math.cos(x*20)*Math.cos(z*17),slopeZ:-3.4*Math.sin(x*20)*Math.sin(z*17),coastKm:0};
  },{cellsPerSide:8,levels:3,spacingKm:.032});
  const samplesBeforeQueries=calls,triangles:Array<{a:Vector3;b:Vector3;c:Vector3;normal:Vector3}>=[];
  for(let offset=0;offset<data.indices.length;offset+=3){
   const [a,b,c]=Array.from(data.indices.subarray(offset,offset+3),index=>vertex(data,index));
   triangles.push({a,b,c,normal:b.clone().sub(a).cross(c.clone().sub(a))});
  }
  // Independent oracle: test all projected triangle half-planes, then intersect
  // its 3D plane with a vertical line. It does not read the cell lookup table.
  const bruteForce=(x:number,z:number)=>{
   let height=-Infinity;
   for(const {a,b,c,normal} of triangles){
    const corners=[a,b,c];let inside=true;
    for(let i=0;i<3;i++){
     const from=corners[i],to=corners[(i+1)%3];
     if((to.z-from.z)*(x-from.x)-(to.x-from.x)*(z-from.z)<-1e-13){inside=false;break;}
    }
    if(inside)height=Math.max(height,a.y-(normal.x*(x-a.x)+normal.z*(z-a.z))/normal.y);
   }
   return Number.isFinite(height)?height:null;
  };
  const queries:Array<[number,number]>=[[0,0],[.013,.021],[-.019,.017]];
  for(const {a,b,c} of triangles)queries.push([.2*a.x+.35*b.x+.45*c.x,.2*a.z+.35*b.z+.45*c.z]);
  for(let i=0;i<data.stats.vertices;i++){const p=vertex(data,i);queries.push([p.x,p.z]);}
  for(const join of [.128,.256])for(const sign of [-1,1])for(const epsilon of [-1e-6,0,1e-6]){
   queries.push([.019,sign*Math.fround(join)+epsilon],[sign*Math.fround(join)+epsilon,-.021]);
  }
  let maximumAnalyticDifference=0;
  for(const [x,z] of queries){
   const expected=bruteForce(x,z),actual=terrainMeshHeightAt(data,x,z);
   expect(expected).not.toBeNull();expect(actual).not.toBeNull();expect(actual!).toBeCloseTo(expected!,9);
   maximumAnalyticDifference=Math.max(maximumAnalyticDifference,Math.abs(actual!-terrainMeshSurfaceY(x,z,elevation(x,z))));
  }
  expect(maximumAnalyticDifference).toBeGreaterThan(.001);
  const extent=Math.fround(data.stats.outerExtentKm);
  for(const [x,z] of [[extent+.001,0],[-extent-.001,0],[0,extent+.001],[0,-extent-.001]])expect(terrainMeshHeightAt(data,x,z)).toBeNull();
  expect(()=>terrainMeshHeightAt(data,NaN,0)).toThrow(RangeError);
  expect(()=>terrainMeshHeightAt(data,0,Infinity)).toThrow(RangeError);
  expect(calls).toBe(samplesBeforeQueries);
 });

 it.each<TerrainMeshOptions>([
  {cellsPerSide:3},{cellsPerSide:6},{cellsPerSide:8.5},{cellsPerSide:260},
  {levels:0},{levels:1.5},{levels:13},{levels:Infinity},
  {spacingKm:0},{spacingKm:-.032},{spacingKm:NaN},{spacingKm:Infinity},
  {cellsPerSide:16,levels:3,spacingKm:1000},
 ])('rejects an invalid or out-of-hemisphere grid %j',options=>{
  let calls=0;
  expect(()=>buildTerrainMeshData(()=>{calls++;return flatSampler();},options)).toThrow(RangeError);
  expect(calls).toBe(0);
 });

 it.each<Partial<TerrainSurfaceSample>>([
  {heightKm:-1},{heightKm:NaN},{heightKm:Infinity},{slopeX:NaN},{slopeZ:Infinity},{coastKm:NaN},
 ])('rejects invalid terrain sample data %j',override=>{
  expect(()=>buildTerrainMeshData(()=>({...flatSampler(),...override}),{cellsPerSide:8,levels:3,spacingKm:.032})).toThrow(RangeError);
 });
});

describe('one-pass source-node terrain refinement prototype',()=>{
 it('keeps refinement off free of probes and optional lookup/stat payload',()=>{
  let calls=0;
  const data=buildTerrainMeshData(()=>{calls++;return flatSampler();},refinementOptions);
  expect(calls).toBe(data.stats.vertices);expect(data.stats.sampleCalls).toBe(calls);
  expect(Object.hasOwn(data,'cellTriangleCount')).toBe(false);
  expect(Object.hasOwn(data.stats,'refinement')).toBe(false);
  const explicitOff=buildTerrainMeshData(flatSampler,{...refinementOptions,refinement:undefined});
  for(const name of ['positions','normals','surface','indices','cellFirstIndex'] as const){
   const a=data[name],b=explicitOff[name];
   expect(new Uint8Array(a.buffer,a.byteOffset,a.byteLength)).toEqual(new Uint8Array(b.buffer,b.byteOffset,b.byteLength));
  }
  expect(data.stats).toEqual(explicitOff.stats);
 });

 it.each([1,-1])('samples one original source node and restores its missed peak for sign %i',sign=>{
  const fixture=isolatedPeak(sign),base=buildTerrainMeshData(fixture.sample,refinementOptions),calls:Array<[number,number]>=[];
  const refined=buildTerrainMeshData((x,z)=>{calls.push([x,z]);return fixture.sample(x,z);},{...refinementOptions,refinement:fixture.refinement});
  const stats=refined.stats.refinement!,{x0,z0}=fixture,target=terrainMeshSurfaceY(x0,z0,fixture.sample(x0,z0).heightKm);
  expect(Math.abs(target-terrainMeshHeightAt(base,x0,z0)!)).toBeGreaterThan(.1);
  expect(Math.abs(target-terrainMeshHeightAt(refined,x0,z0)!)).toBeLessThan(5e-7);
  expect(stats.probeSampleCalls).toBe(1);expect(stats.markedRedFaces).toBe(1);
  expect(stats.nodesAboveThreshold).toBe(1);expect(stats.eligibleNodesAboveThreshold).toBe(1);
  expect(stats.splitEdgeCount).toBe(3);expect(stats.addedVertices).toBe(3);
  expect(stats.greenFaces).toBeGreaterThan(0);expect(stats.midpointVerticesOutsideDomain).toBeGreaterThan(0);
  expect(stats.vertexSampleCalls).toBe(refined.stats.vertices);
  expect(stats.totalSampleCalls).toBe(calls.length);expect(refined.stats.sampleCalls).toBe(calls.length);
  expect(calls.length).toBe(base.stats.vertices+1+3);
  expect(calls[base.stats.vertices]).toEqual([x0,z0]);
  expect(refined.positions.subarray(0,base.positions.length)).toEqual(base.positions);
  expect(refined.surface.subarray(0,base.surface.length)).toEqual(base.surface);
  const addedCoordinates=new Set<string>();
  for(let index=base.stats.vertices;index<refined.stats.vertices;index++){
   const point=vertex(refined,index),key=`${point.x},${point.z}`,sample=fixture.sample(point.x,point.z);
   expect(addedCoordinates.has(key)).toBe(false);addedCoordinates.add(key);
   expect(refined.surface[2*index]).toBe(Math.fround(sample.heightKm));
   expect(refined.surface[2*index+1]).toBe(Math.fround(sample.coastKm));
   expect(point.y).toBe(Math.fround(terrainMeshSurfaceY(point.x,point.z,sample.heightKm)));
  }
  expect(refined.stats.geometryBytes).toBe(32*refined.stats.vertices+12*refined.stats.triangles);
  expect(stats.addedGeometryBytes).toBe(refined.stats.geometryBytes-base.stats.geometryBytes);
  expect(refined.stats.triangles).toBeLessThanOrEqual(4*base.stats.triangles);
 });

 it('keeps shared green edges conforming and recomputes all incident-area normals',()=>{
  const {sample,refinement}=isolatedPeak(),data=buildTerrainMeshData(sample,{...refinementOptions,refinement}),edges=new Map<string,{count:number;orientation:number;a:number;b:number}>();
  const coordinates=new Set<string>();
  for(let index=0;index<data.stats.vertices;index++){
   const point=vertex(data,index),key=`${point.x},${point.z}`;
   expect(coordinates.has(key)).toBe(false);coordinates.add(key);
  }
  for(let offset=0;offset<data.indices.length;offset+=3){
   const ids=Array.from(data.indices.subarray(offset,offset+3));expect(new Set(ids).size).toBe(3);
   const [a,b,c]=ids.map(index=>vertex(data,index));
   expect(b.clone().sub(a).cross(c.clone().sub(a)).y).toBeGreaterThan(0);
   for(let edge=0;edge<3;edge++){
    const from=ids[edge],to=ids[(edge+1)%3],a=Math.min(from,to),b=Math.max(from,to),key=`${a},${b}`;
    const record=edges.get(key)??{a,b,count:0,orientation:0};record.count++;record.orientation+=from===a?1:-1;edges.set(key,record);
   }
  }
  const extent=Math.fround(data.stats.outerExtentKm);
  for(const edge of edges.values()){
   expect([1,2]).toContain(edge.count);
   if(edge.count===2){expect(edge.orientation).toBe(0);continue;}
   const a=vertex(data,edge.a),b=vertex(data,edge.b);
   expect((a.x===b.x&&Math.abs(a.x)===extent)||(a.z===b.z&&Math.abs(a.z)===extent)).toBe(true);
  }
  expect(data.stats.vertices-edges.size+data.stats.triangles).toBe(1);
  const oracle=normalOracle(data).area;
  for(let index=0;index<data.stats.vertices;index++){
   expect(new Vector3().fromArray(data.normals,index*3).distanceTo(oracle[index])).toBeLessThan(8e-8);
  }
 });

 it('keeps every original cell contiguous and looks up its actual children without sampler calls',()=>{
  const fixture=isolatedPeak();let calls=0;
  const data=buildTerrainMeshData((x,z)=>{calls++;return fixture.sample(x,z);},{...refinementOptions,refinement:fixture.refinement}),before=calls;
  expect(data.cellTriangleCount).toBeInstanceOf(Uint8Array);
  let cursor=0,maximum=0;
  for(let cell=0;cell<data.cellFirstIndex.length;cell++){
   const count=data.cellTriangleCount![cell],first=data.cellFirstIndex[cell];
   if(first===0xffffffff){expect(count).toBe(0);continue;}
   expect(first).toBe(cursor);expect(count).toBeGreaterThan(0);expect(count).toBeLessThanOrEqual(20);
   cursor+=count*3;maximum=Math.max(maximum,count);
  }
  expect(cursor).toBe(data.indices.length);expect(maximum).toBe(data.stats.refinement!.maximumCellTriangles);
  expect(data.stats.refinement!.cellTriangleCountBytes).toBe(data.cellFirstIndex.length);
  for(let offset=0;offset<data.indices.length;offset+=3){
   const [a,b,c]=Array.from(data.indices.subarray(offset,offset+3),index=>vertex(data,index));
   const x=.2*a.x+.35*b.x+.45*c.x,z=.2*a.z+.35*b.z+.45*c.z,expected=meshPlaneOracle(data,x,z),hit=terrainMeshHitAt(data,x,z);
   expect(expected).not.toBeNull();expect(hit).not.toBeNull();expect(hit!.y).toBeCloseTo(expected!,9);
   expect(hit!.faceIndex).toBe(offset/3);expect(terrainMeshHeightAt(data,x,z)).toBe(hit!.y);
  }
  expect(calls).toBe(before);
 });

 it('does not split a smaller-than-source face even when an original source node exceeds the error gate',()=>{
  const sample=(x:number,z:number)=>({heightKm:1+.2*Math.max(0,1-Math.abs(x-.0625)/.0625)*Math.max(0,1-Math.abs(z-.0625)/.0625),slopeX:0,slopeZ:0,coastKm:1});
  const refinement:TerrainMeshRefinement={sourceGrid:{minXKm:.0625,minZKm:.0625,spacingKm:.25,columns:2,rows:2},domain:{minXKm:.0625,maxXKm:.0625,minZKm:.0625,maxZKm:.0625},maxErrorKm:.005,limits:{maxProbeCount:1,maxVertices:10000,maxTriangles:10000,maxGeometryBytes:1000000}};
  const base=buildTerrainMeshData(sample,refinementOptions),data=buildTerrainMeshData(sample,{...refinementOptions,refinement});
  expect(data.stats.refinement!.nodesAboveThreshold).toBe(1);expect(data.stats.refinement!.eligibleNodesAboveThreshold).toBe(0);
  expect(data.stats.refinement!.splitEdgeCount).toBe(0);
  expect(data.positions).toEqual(base.positions);expect(data.indices).toEqual(base.indices);expect(data.normals).toEqual(base.normals);expect(data.surface).toEqual(base.surface);
 });

 it('rejects an invalid/over-budget plan before sampling and rejects geometry overflow before midpoint calls',()=>{
  const fixture=isolatedPeak();let calls=0;
  const sample=(x:number,z:number)=>{calls++;return fixture.sample(x,z);};
  expect(()=>buildTerrainMeshData(sample,{...refinementOptions,normalMode:'analytic-blend',refinement:fixture.refinement})).toThrow(RangeError);
  expect(calls).toBe(0);
  expect(()=>buildTerrainMeshData(sample,{...refinementOptions,refinement:{...fixture.refinement,domain:{minXKm:.75,maxXKm:1,minZKm:0,maxZKm:.25}}})).toThrow(RangeError);
  expect(calls).toBe(0);
  expect(()=>buildTerrainMeshData(sample,{...refinementOptions,refinement:{...fixture.refinement,domain:{minXKm:-1,maxXKm:1,minZKm:0,maxZKm:.25}}})).toThrow(RangeError);
  expect(calls).toBe(0);
  const base=buildTerrainMeshData(fixture.sample,refinementOptions);
  expect(()=>buildTerrainMeshData(sample,{...refinementOptions,refinement:{...fixture.refinement,limits:{...fixture.refinement.limits,maxVertices:base.stats.vertices+2}}})).toThrow('geometry budget exceeded');
  expect(calls).toBe(base.stats.vertices+1);
 });
});

describe('terrain elevation on a spherical sea datum',()=>{
 it('preserves height at the origin and satisfies the sphere equation away from it',()=>{
  for(const h of [0,1.25,3.31]){
   expect(terrainMeshSurfaceY(0,0,h)).toBe(GROUND_LEVEL+h);
   for(const [x,z] of [[.001,0],[18,-27],[1000,-800]]){
    const y=terrainMeshSurfaceY(x,z,h),relativeY=y-GROUND_LEVEL+EARTH_RADIUS;
    expect((relativeY*relativeY+x*x+z*z)/(EARTH_RADIUS+h)**2).toBeCloseTo(1,14);
    expect(y).toBeLessThan(GROUND_LEVEL+h);
   }
  }
  const tinySag=GROUND_LEVEL-terrainMeshSurfaceY(.001,0,0);
  expect(tinySag).toBeGreaterThan(7e-11);expect(tinySag).toBeLessThan(9e-11);
 });
 it('rejects nonfinite points and coordinates beyond the upper hemisphere',()=>{
  for(const [x,z,h] of [[NaN,0,0],[0,Infinity,0],[0,0,NaN],[EARTH_RADIUS+1,0,0]]){
   expect(()=>terrainMeshSurfaceY(x,z,h)).toThrow(RangeError);
  }
 });
});

const cameraFrame=(inspection:number):TerrainCameraFrame=>({
 origin:[0,0,0],forward:[0,0,-1],right:[1,0,0],up:[0,1,0],aspect:16/9,tanFov:.3125,inspection,
});

describe('terrain camera matching the legacy ray basis',()=>{
 it.each([0,.375,1])('projects center and corners onto their legacy coordinates at inspection %f',inspection=>{
  const camera=new PerspectiveCamera(32,1,.025,1600);camera.coordinateSystem=WebGPUCoordinateSystem;
  const frame=cameraFrame(inspection),aspect=Math.fround(frame.aspect),tan=Math.fround(frame.tanFov),shift=.16*(1-Math.fround(inspection));
  configureTerrainCamera(camera,frame,1600,900);
  expect(camera.projectionMatrix.elements[9]).toBeCloseTo(-shift,14);
  expect(new Vector3(0,0,-10).project(camera).y).toBeCloseTo(shift,14);
  for(const [x,y] of [[0,0],[-1,-1],[-1,1],[1,-1],[1,1],[.31,-.47]])for(const distance of [.1,10,1000]){
   const projected=new Vector3(x*aspect*tan,(y-shift)*tan,-1).multiplyScalar(distance).project(camera);
   expect(projected.x).toBeCloseTo(x,12);expect(projected.y).toBeCloseTo(y,12);
   expect(projected.z).toBeGreaterThan(0);expect(projected.z).toBeLessThan(1);
  }
  // Three can rebuild the depth projection without losing the principal point.
  camera.updateProjectionMatrix();
  expect(camera.projectionMatrix.elements[9]).toBeCloseTo(-shift,14);
 });

 it('applies a translated and rotated camera basis to the same ray witness',()=>{
  const camera=new PerspectiveCamera(32,1,.025,1600),frame:TerrainCameraFrame={
   ...cameraFrame(.375),origin:[2,5,-3],forward:[-1,0,0],right:[0,0,-1],up:[0,1,0],
  };
  configureTerrainCamera(camera,frame,1600,900);
  const shift=.16*(1-Math.fround(frame.inspection)),aspect=Math.fround(frame.aspect),tan=Math.fround(frame.tanFov);
  for(const [x,y] of [[0,0],[-1,-1],[1,1]]){
   const direction=new Vector3(-1,(y-shift)*tan,-x*aspect*tan),world=direction.multiplyScalar(10).add(new Vector3(2,5,-3));
   const projected=world.project(camera);
   expect(projected.x).toBeCloseTo(x,12);expect(projected.y).toBeCloseTo(y,12);
  }
 });

 it('rejects invalid image dimensions, projection values and basis components',()=>{
  for(const [width,height] of [[0,900],[1600,0],[1600.5,900],[1600,NaN]]){
   expect(()=>configureTerrainCamera(new PerspectiveCamera(),cameraFrame(0),width,height)).toThrow(RangeError);
  }
  const invalid:Partial<TerrainCameraFrame>[]=[{aspect:0},{aspect:Infinity},{tanFov:0},{tanFov:NaN},{inspection:NaN},{origin:[0,NaN,0]},{forward:[0,0,Infinity]},{right:[1,0]},{up:[0,Infinity,0]}];
  for(const override of invalid)expect(()=>configureTerrainCamera(new PerspectiveCamera(),{...cameraFrame(0),...override},1600,900)).toThrow(RangeError);
 });
});
