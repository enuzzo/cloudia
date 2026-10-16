import {
 ClampToEdgeWrapping,DataTexture,LinearFilter,LinearMipmapLinearFilter,
 NoColorSpace,RGBAFormat,UnsignedByteType,
} from 'three/webgpu';
import {TERRAIN_COVER_GROUP,type TerrainCover} from './terrainCover';

export interface TerrainCoverTextureStats {
 readonly gridSize:readonly [number,number];
 readonly cellKm:number;
 readonly minEdgeKm:readonly [number,number];
 readonly rowOrder:'south-to-north; v0=minZ';
 readonly sourceAssetBytes:number;
 readonly basePayloadBytes:number;
 /** Only the levels below the base, excluding driver allocation and alignment. */
 readonly nominalMipPayloadBytes:number;
 readonly totalGpuPayloadBytes:number;
 readonly retainedCpuPayloadBytes:number;
 /** Includes the base level. No CPU mip buffers are retained. */
 readonly mipLevels:number;
}

export interface TerrainCoverTextures {
 readonly coverA:DataTexture;
 readonly coverB:DataTexture;
 readonly stats:TerrainCoverTextureStats;
 dispose():void;
}

// An owner with no grid field or grid-capturing closure lets the source asset
// become collectible after conversion. Only the two new base arrays remain.
class OwnedTerrainCoverTextures implements TerrainCoverTextures {
 private disposed=false;
 constructor(readonly coverA:DataTexture,readonly coverB:DataTexture,readonly stats:TerrainCoverTextureStats){}
 dispose():void{
  if(this.disposed)return;
  this.disposed=true;
  this.coverA.dispose();this.coverB.dispose();
 }
}

function coverTexture(data:Uint8Array,side:number):DataTexture{
 const texture=new DataTexture(data,side,side,RGBAFormat,UnsignedByteType);
 texture.colorSpace=NoColorSpace;
 texture.wrapS=ClampToEdgeWrapping;texture.wrapT=ClampToEdgeWrapping;
 texture.flipY=false;
 texture.minFilter=LinearMipmapLinearFilter;texture.magFilter=LinearFilter;
 texture.generateMipmaps=true;texture.needsUpdate=true;
 return texture;
}

/** Preserve the twelve source-class sums exactly in eight material groups.
 * A = unknown, trees, low vegetation, crops; B = built, bare, snow, water.
 * Rows retain the WCV1 south-to-north order: texture v=0 is the minZ edge.
 * GPU filtering can round channels independently; normalize the eight sampled
 * weights together in the caller before the measured/fallback blend.
 */
export function createTerrainCoverTextures(grid:TerrainCover):TerrainCoverTextures{
 const {side,spacingKm,minX,minZ,fractions}=grid;
 if(!Number.isInteger(side)||side<2||side>4096||fractions.length!==side*side*12||
  ![spacingKm,minX,minZ].every(Number.isFinite)||spacingKm<=0)throw new RangeError('Invalid terrain cover texture grid');
 const cells=side*side,dataA=new Uint8Array(cells*4),dataB=new Uint8Array(cells*4);
 for(let cell=0;cell<cells;cell++){
  let sum=0;
  for(let c=0;c<12;c++){
   const value=fractions[cell*12+c],group=TERRAIN_COVER_GROUP[c];
   sum+=value;
   if(group<4)dataA[cell*4+group]+=value;else dataB[cell*4+group-4]+=value;
  }
  if(sum!==255)throw new RangeError('Invalid terrain cover cell unit sum');
 }
 const basePayloadBytes=8*cells;
 let mipLevels=1,nominalMipPayloadBytes=0;
 for(let size=Math.floor(side/2);size>=1;size=Math.floor(size/2)){
  nominalMipPayloadBytes+=8*size*size;mipLevels++;
 }
 const stats:TerrainCoverTextureStats=Object.freeze({
  gridSize:Object.freeze([side,side] as const),cellKm:spacingKm,minEdgeKm:Object.freeze([minX,minZ] as const),
  rowOrder:'south-to-north; v0=minZ',sourceAssetBytes:32+12*cells,
  basePayloadBytes,nominalMipPayloadBytes,totalGpuPayloadBytes:basePayloadBytes+nominalMipPayloadBytes,
  retainedCpuPayloadBytes:basePayloadBytes,mipLevels,
 });
 return new OwnedTerrainCoverTextures(coverTexture(dataA,side),coverTexture(dataB,side),stats);
}
