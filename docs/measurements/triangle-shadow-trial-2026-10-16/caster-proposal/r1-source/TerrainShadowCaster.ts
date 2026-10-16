import {
 Box3,BufferAttribute,BufferGeometry,FrontSide,InstancedBufferGeometry,InterpolationSamplingMode,
 InterpolationSamplingType,Mesh,MeshBasicNodeMaterial,NoBlending,Scene,StorageBufferAttribute,type Node,
} from 'three/webgpu';
import {cameraProjectionMatrix,cameraViewMatrix,instanceIndex,positionWorld,select,storage,uint,varying,vec3,vec4,vertexIndex} from 'three/tsl';

export const TERRAIN_SHADOW_CASTER_ATTRIBUTES=Object.freeze({
 indices:'terrainShadowCasterIndices',positions:'terrainShadowCasterPositions',
});

export interface TerrainShadowCasterOptions {
 readonly center:Node<'vec3'>;
 readonly sun:Node<'vec3'>;
 /** Must be a shadow-only scene. Its other children remain owned by the caller. */
 readonly scene?:Scene;
}

export interface TerrainShadowCasterStats {
 readonly sourceVertices:number;
 readonly triangles:number;
 readonly instances:number;
 readonly vertexInvocations:number;
 readonly indexBytes:number;
 readonly positionBytes:number;
 readonly dummyPositionBytes:number;
 readonly extraCpuPayloadBytes:number;
 readonly extraGpuPayloadBytes:number;
 readonly indexOwnership:'copied Uint32Array; no source alias';
 readonly positionLayout:'own Float32 vec4 per source vertex; xyz unchanged, w=1';
 readonly payloadScope:'Nominal owned arrays/buffers only; excludes driver, uniforms, shader varyings and construction temporaries';
 readonly disposed:boolean;
}

/** One real triangle per instance, preserving the source index order and winding.
 * Input positions are world coordinates of the static identity-transform terrain.
 * This owner prepares flat corner UVQ; the caller supplies the clipping fragment.
 */
export class TerrainShadowCaster {
 readonly scene:Scene;
 readonly bounds:Box3;
 readonly geometry:InstancedBufferGeometry;
 readonly mesh:Mesh;
 readonly material:MeshBasicNodeMaterial;
 readonly cornersUVQ:readonly [Node<'vec3'>,Node<'vec3'>,Node<'vec3'>];
 private readonly payload:Omit<TerrainShadowCasterStats,'disposed'>;
 private disposed=false;

 constructor(sourceGeometry:BufferGeometry,options:TerrainShadowCasterOptions){
  const sourcePosition=sourceGeometry.getAttribute('position'),sourceIndex=sourceGeometry.getIndex();
  if(!(sourcePosition instanceof BufferAttribute)||!(sourcePosition.array instanceof Float32Array)||
   sourcePosition.itemSize!==3||sourcePosition.normalized||!Number.isInteger(sourcePosition.count)||sourcePosition.count<3){
   throw new RangeError('Terrain caster requires finite Float32 xyz positions');
  }
  if(!(sourceIndex instanceof BufferAttribute)||!(sourceIndex.array instanceof Uint32Array)||sourceIndex.itemSize!==1||
   sourceIndex.normalized||sourceIndex.count<3||sourceIndex.count%3!==0){
   throw new RangeError('Terrain caster requires complete Uint32 triangle indices');
  }
  const vertexCount=sourcePosition.count,indices=new Uint32Array(sourceIndex.array),packed=new Float32Array(vertexCount*4);
  const computedBounds=new Box3();
  for(let i=0;i<vertexCount;i++){
   const x=sourcePosition.array[i*3],y=sourcePosition.array[i*3+1],z=sourcePosition.array[i*3+2];
   if(!Number.isFinite(x)||!Number.isFinite(y)||!Number.isFinite(z))throw new RangeError('Nonfinite terrain caster position');
   packed[i*4]=x;packed[i*4+1]=y;packed[i*4+2]=z;packed[i*4+3]=1;
   computedBounds.min.x=Math.min(computedBounds.min.x,x);computedBounds.min.y=Math.min(computedBounds.min.y,y);computedBounds.min.z=Math.min(computedBounds.min.z,z);
   computedBounds.max.x=Math.max(computedBounds.max.x,x);computedBounds.max.y=Math.max(computedBounds.max.y,y);computedBounds.max.z=Math.max(computedBounds.max.z,z);
  }
  for(const index of indices)if(index>=vertexCount)throw new RangeError('Terrain caster index outside position buffer');
  const sourceBounds=sourceGeometry.boundingBox;
  if(sourceBounds&&(sourceBounds.isEmpty()||![...sourceBounds.min.toArray(),...sourceBounds.max.toArray()].every(Number.isFinite)||!sourceBounds.containsBox(computedBounds))){
   throw new RangeError('Terrain caster source bounds do not enclose its vertices');
  }
  this.bounds=(sourceBounds??computedBounds).clone();

  const indexAttribute=new StorageBufferAttribute(indices,1),positionAttribute=new StorageBufferAttribute(packed,4);
  this.geometry=new InstancedBufferGeometry();
  this.geometry.setAttribute('position',new BufferAttribute(new Float32Array(9),3));
  // The geometry owns both binding-only buffers. Three r186 deletes all its
  // registered attributes at geometry.dispose(), even when absent from vertex inputs.
  this.geometry.setAttribute(TERRAIN_SHADOW_CASTER_ATTRIBUTES.indices,indexAttribute);
  this.geometry.setAttribute(TERRAIN_SHADOW_CASTER_ATTRIBUTES.positions,positionAttribute);
  this.geometry.instanceCount=indices.length/3;this.geometry.setDrawRange(0,3);
  this.geometry.boundingBox=this.bounds.clone();
  const indexBuffer=storage(indexAttribute,'uint',indices.length).toReadOnly();
  const positionBuffer=storage(positionAttribute,'vec4',vertexCount).toReadOnly();
  const corner=(k:number)=>positionBuffer.element(indexBuffer.element(instanceIndex.mul(uint(3)).add(uint(k)))).xyz.toVar(`shadowCorner${k}`);
  const points=[corner(0),corner(1),corner(2)] as const;
  const uvq=(point:Node<'vec3'>,k:number)=>{
   // Use this draw's actual light-camera matrices for XY, not an independently
   // rounded light basis. Orthographic depth selection remains the normal raster path.
   const clip=cameraProjectionMatrix.mul(cameraViewMatrix.mul(vec4(point,1))).toVar(`shadowCornerClip${k}`);
   return varying(vec3(clip.x.div(clip.w).mul(.5).add(.5),clip.y.div(clip.w).mul(-.5).add(.5),point.sub(options.center).dot(options.sun)),`shadowCornerUVQ${k}`)
    .setInterpolation(InterpolationSamplingType.FLAT,InterpolationSamplingMode.EITHER);
  };
  this.cornersUVQ=Object.freeze([uvq(points[0],0),uvq(points[1],1),uvq(points[2],2)] as const);
  this.material=new MeshBasicNodeMaterial();this.material.name='Cloudia terrain triangle caster';
  this.material.side=FrontSide;this.material.blending=NoBlending;this.material.fog=false;
  this.material.premultipliedAlpha=false;this.material.toneMapped=false;this.material.depthTest=true;this.material.depthWrite=true;
  this.material.positionNode=select(vertexIndex.equal(uint(0)),points[0],select(vertexIndex.equal(uint(1)),points[1],points[2]));
  // Default is raw q only. Root replaces this with its fragment clipping policy;
  // neither path assigns depthNode or moves the rasterized source vertices.
  this.material.fragmentNode=positionWorld.sub(options.center).dot(options.sun);
  this.mesh=new Mesh(this.geometry,this.material);this.mesh.name='Cloudia terrain triangle caster';
  this.mesh.frustumCulled=false;this.mesh.matrixAutoUpdate=false;this.mesh.matrixWorldAutoUpdate=false;
  this.scene=options.scene??new Scene();this.scene.add(this.mesh);
  const dummyPositionBytes=this.geometry.getAttribute('position').array.byteLength;
  this.payload=Object.freeze({sourceVertices:vertexCount,triangles:indices.length/3,instances:indices.length/3,vertexInvocations:indices.length,
   indexBytes:indices.byteLength,positionBytes:packed.byteLength,dummyPositionBytes,
   extraCpuPayloadBytes:indices.byteLength+packed.byteLength+dummyPositionBytes,extraGpuPayloadBytes:indices.byteLength+packed.byteLength+dummyPositionBytes,
   indexOwnership:'copied Uint32Array; no source alias',positionLayout:'own Float32 vec4 per source vertex; xyz unchanged, w=1',
   payloadScope:'Nominal owned arrays/buffers only; excludes driver, uniforms, shader varyings and construction temporaries'});
 }

 stats():Readonly<TerrainShadowCasterStats>{return Object.freeze({...this.payload,disposed:this.disposed});}

 dispose():void{
  if(this.disposed)return;this.disposed=true;
  this.scene.remove(this.mesh);this.geometry.dispose();this.material.dispose();
 }
}
