import {describe,expect,it} from 'vitest';
import {
 Box3,BufferAttribute,BufferGeometry,FrontSide,InterpolationSamplingMode,InterpolationSamplingType,
 LessEqualDepth,Mesh,MeshBasicNodeMaterial,NoBlending,Scene,StorageBufferAttribute,Vector3,type Node,
} from 'three/webgpu';
import {cameraProjectionMatrix,cameraViewMatrix,uniform} from 'three/tsl';
import {TerrainShadowCaster,TERRAIN_SHADOW_CASTER_ATTRIBUTES as attributes} from './TerrainShadowCaster';

function source(){
 const geometry=new BufferGeometry();
 geometry.setAttribute('position',new BufferAttribute(new Float32Array([2,-3,4, 5,-2,4, 2,-1,7, 8,-4,9]),3));
 geometry.setAttribute('normal',new BufferAttribute(new Float32Array([0,1,0, 0,1,0, 0,1,0, 0,1,0]),3));
 geometry.setIndex(new BufferAttribute(new Uint32Array([2,0,1, 2,1,3]),1));
 return geometry;
}
function options(scene?:Scene){return {center:uniform(new Vector3(0,-4,0)),sun:uniform(new Vector3(0,1,0)),scene};}
function nodes(root:Node):Set<Node>{const found=new Set<Node>();root.traverse(node=>found.add(node));return found;}
function scope(node:Node):string|undefined{return (node as Node & {scope?:string}).scope;}

describe('owned terrain triangle caster',()=>{
 it('keeps exact source indices, winding and xyz while owning independent storage and real three-vertex draw',()=>{
  const input=source();input.computeBoundingBox();
  const position=input.getAttribute('position'),index=input.getIndex()!,normal=input.getAttribute('normal'),box=input.boundingBox;
  const positionBytes=Array.from(new Uint8Array(position.array.buffer)),indexBytes=Array.from(new Uint8Array(index.array.buffer));
  const caster=new TerrainShadowCaster(input,options());
  const ownedIndex=caster.geometry.getAttribute(attributes.indices) as StorageBufferAttribute;
  const ownedPosition=caster.geometry.getAttribute(attributes.positions) as StorageBufferAttribute;
  expect(ownedIndex.isStorageBufferAttribute).toBe(true);expect(ownedPosition.isStorageBufferAttribute).toBe(true);
  expect(ownedIndex).not.toBe(index);expect(ownedIndex.array).not.toBe(index.array);
  expect(ownedPosition).not.toBe(position);expect(ownedPosition.array).not.toBe(position.array);
  expect(Array.from(ownedIndex.array)).toEqual([2,0,1,2,1,3]);
  expect(ownedIndex.itemSize).toBe(1);expect(ownedPosition.itemSize).toBe(4);
  expect(Array.from(ownedPosition.array)).toEqual([2,-3,4,1,5,-2,4,1,2,-1,7,1,8,-4,9,1]);
  const read=(i:number)=>new Vector3(ownedPosition.getX(i),ownedPosition.getY(i),ownedPosition.getZ(i));
  const winding=read(0).sub(read(2)).cross(read(1).sub(read(2)));
  expect(winding.toArray()).toEqual([3,-9,6]);
  expect(caster.geometry.getAttribute('position').count).toBe(3);
  expect(caster.geometry.getAttribute('position').array.byteLength).toBe(36);
  expect(caster.geometry.getIndex()).toBeNull();expect(caster.geometry.instanceCount).toBe(2);
  expect(caster.geometry.drawRange).toEqual({start:0,count:3});
  expect(caster.mesh.frustumCulled).toBe(false);expect(caster.mesh.matrixWorld.elements).toEqual([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);
  expect(input.getAttribute('position')).toBe(position);expect(input.getIndex()).toBe(index);expect(input.getAttribute('normal')).toBe(normal);
  expect(input.boundingBox).toBe(box);expect(position.itemSize).toBe(3);
  expect(Array.from(new Uint8Array(position.array.buffer))).toEqual(positionBytes);
  expect(Array.from(new Uint8Array(index.array.buffer))).toEqual(indexBytes);
  expect('isStorageBufferAttribute' in position).toBe(false);expect('isStorageBufferAttribute' in index).toBe(false);
  (position.array as Float32Array)[0]=100;(index.array as Uint32Array)[0]=3;
  expect(ownedPosition.getX(0)).toBe(2);expect(ownedIndex.getX(0)).toBe(2);
  caster.dispose();input.dispose();
 });

 it('clones supplied original bounds and computes missing bounds without mutating the source',()=>{
  const input=source();const caster=new TerrainShadowCaster(input,options());
  expect(input.boundingBox).toBeNull();expect(caster.bounds.min.toArray()).toEqual([2,-4,4]);expect(caster.bounds.max.toArray()).toEqual([8,-1,9]);
  expect(caster.geometry.boundingBox).toEqual(caster.bounds);expect(caster.geometry.boundingBox).not.toBe(caster.bounds);
  input.boundingBox=new Box3(new Vector3(-10,-10,-10),new Vector3(10,10,10));
  const expanded=new TerrainShadowCaster(input,options());expect(expanded.bounds).toEqual(input.boundingBox);expect(expanded.bounds).not.toBe(input.boundingBox);
  expanded.bounds.min.x=-99;expect(input.boundingBox.min.x).toBe(-10);
  caster.dispose();expanded.dispose();input.dispose();
 });

 it('uses the provided shadow scene and removes only its own mesh on idempotent dispose',()=>{
  const input=source(),scene=new Scene(),other=new Mesh(new BufferGeometry(),new MeshBasicNodeMaterial());scene.add(other);
  let inputDisposals=0,geometryDisposals=0,materialDisposals=0;
  input.addEventListener('dispose',()=>inputDisposals++);
  const caster=new TerrainShadowCaster(input,options(scene));
  caster.geometry.addEventListener('dispose',()=>{geometryDisposals++;expect(caster.geometry.getAttribute(attributes.indices)).toBeDefined();expect(caster.geometry.getAttribute(attributes.positions)).toBeDefined();});
  caster.material.addEventListener('dispose',()=>materialDisposals++);
  expect(caster.scene).toBe(scene);expect(scene.children).toEqual([other,caster.mesh]);
  caster.dispose();caster.dispose();
  expect(scene.children).toEqual([other]);expect(caster.mesh.parent).toBeNull();
  expect(geometryDisposals).toBe(1);expect(materialDisposals).toBe(1);expect(inputDisposals).toBe(0);
  expect(input.getIndex()!.count).toBe(6);input.dispose();other.geometry.dispose();(other.material as MeshBasicNodeMaterial).dispose();
 });

 it('keeps FrontSide and ordinary raw-depth rasterization while exposing flat per-instance UVQ',()=>{
  const input=source(),bindings=options(),caster=new TerrainShadowCaster(input,bindings);
  expect(caster.material.side).toBe(FrontSide);expect(caster.material.depthTest).toBe(true);expect(caster.material.depthWrite).toBe(true);
  expect(caster.material.depthFunc).toBe(LessEqualDepth);expect(caster.material.depthNode).toBeNull();expect(caster.material.vertexNode).toBeNull();
  expect(caster.material.blending).toBe(NoBlending);expect(caster.material.toneMapped).toBe(false);
  expect(caster.cornersUVQ).toHaveLength(3);expect(Object.isFrozen(caster.cornersUVQ)).toBe(true);
  for(const corner of caster.cornersUVQ){
   const varying=corner as Node & {isVaryingNode:boolean;interpolationType:string;interpolationSampling:string};
   expect(varying.isVaryingNode).toBe(true);expect(varying.interpolationType).toBe(InterpolationSamplingType.FLAT);expect(varying.interpolationSampling).toBe(InterpolationSamplingMode.EITHER);
   const graph=nodes(corner);
   expect(graph.has(bindings.center)).toBe(true);expect(graph.has(bindings.sun)).toBe(true);
   expect(graph.has(cameraProjectionMatrix)).toBe(true);expect(graph.has(cameraViewMatrix)).toBe(true);
   // Every carrier vertex gets the same three corners: a corner must depend on
   // instance_index only, never on which vertex of this instance carries it.
   expect([...graph].some(node=>scope(node)==='instance')).toBe(true);
   expect([...graph].some(node=>scope(node)==='vertex')).toBe(false);
   const storage=[...graph].filter(node=>(node as Node & {isStorageBufferNode?:boolean}).isStorageBufferNode) as (Node & {value:StorageBufferAttribute;access:string})[];
   expect(new Set(storage.map(node=>node.value))).toEqual(new Set([caster.geometry.getAttribute(attributes.indices),caster.geometry.getAttribute(attributes.positions)]));
   expect(storage.every(node=>node.access==='readOnly')).toBe(true);
  }
  const positionGraph=nodes(caster.material.positionNode!);
  expect([...positionGraph].some(node=>scope(node)==='vertex')).toBe(true);expect([...positionGraph].some(node=>scope(node)==='instance')).toBe(true);
  caster.dispose();input.dispose();
 });

 it('reports exact extra payload with honest ownership scope and terminal state',()=>{
  const input=source(),caster=new TerrainShadowCaster(input,options()),before=caster.stats();
  expect(before).toMatchObject({sourceVertices:4,triangles:2,instances:2,vertexInvocations:6,indexBytes:24,positionBytes:64,dummyPositionBytes:36,extraCpuPayloadBytes:124,extraGpuPayloadBytes:124,disposed:false});
  expect(before.indexOwnership).toContain('no source alias');expect(before.payloadScope).toContain('excludes driver');expect(Object.isFrozen(before)).toBe(true);
  caster.dispose();expect(caster.stats().disposed).toBe(true);expect(before.disposed).toBe(false);input.dispose();
 });

 it('rejects incomplete, mis-typed or out-of-range triangle sources instead of truncating them',()=>{
  for(const bad of [new Uint16Array([0,1,2]),new Uint32Array([0,1]),new Uint32Array([0,1,4])]){
   const input=source();input.setIndex(new BufferAttribute(bad,1));expect(()=>new TerrainShadowCaster(input,options())).toThrow(RangeError);input.dispose();
  }
  const missing=source();missing.setIndex(null);expect(()=>new TerrainShadowCaster(missing,options())).toThrow(RangeError);missing.dispose();
 });

 it('rejects nonfinite positions and stale bounds without changing source attributes',()=>{
  const nonfinite=source();(nonfinite.getAttribute('position').array as Float32Array)[2]=NaN;
  const original=nonfinite.getAttribute('position');expect(()=>new TerrainShadowCaster(nonfinite,options())).toThrow(RangeError);expect(nonfinite.getAttribute('position')).toBe(original);
  const stale=source();stale.boundingBox=new Box3(new Vector3(0,0,0),new Vector3(1,1,1));
  expect(()=>new TerrainShadowCaster(stale,options())).toThrow(RangeError);expect(stale.boundingBox.max.toArray()).toEqual([1,1,1]);
  nonfinite.dispose();stale.dispose();
 });
});
