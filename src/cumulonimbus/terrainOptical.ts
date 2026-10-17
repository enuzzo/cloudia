import {
 ClampToEdgeWrapping,DataTexture,HalfFloatType,LinearFilter,LinearMipmapLinearFilter,
 NoColorSpace,RGBAFormat,
} from 'three/webgpu';

/** Fixed, offline-prepared WorldCover Sentinel-2 2021 composite. RGB is
 * linear reflectance multiplied by valid area; A is that same valid area.
 * This is not display RGB, a class colour palette, or a cloud-screened image.
 */
export const TERRAIN_OPTICAL_ID='esa-worldcover-2021-sentinel2-premultiplied-v1';
export const TERRAIN_OPTICAL_SIDE=2048;
export const TERRAIN_OPTICAL_BYTES=33_554_432;
// Set only to the SHA of the immutable offline pack, never to a fetched value.
export const TERRAIN_OPTICAL_SHA256='217325bcdb50dd58076b2f5068ee0b5ba524f6f076a70d4345f279f233f5dd62';

export interface TerrainOpticalTextureStats {
 readonly gridSize:readonly [number,number];
 readonly cellKm:number;
 readonly minEdgeKm:readonly [number,number];
 readonly rowOrder:'south-to-north; v0=minZ';
 readonly dataConvention:'premultiplied-linear-RGB-and-valid-area';
 readonly sourceAssetBytes:number;
 readonly basePayloadBytes:number;
 /** All mip levels below the base; excludes driver allocation/alignment. */
 readonly nominalMipPayloadBytes:number;
 readonly totalGpuPayloadBytes:number;
 readonly retainedCpuPayloadBytes:number;
 /** Includes the base level. GPU generation retains no CPU mip arrays here. */
 readonly mipLevels:number;
}

export interface TerrainOpticalTexture {
 readonly texture:DataTexture;
 readonly stats:TerrainOpticalTextureStats;
 dispose():void;
}

const stats:TerrainOpticalTextureStats=Object.freeze({
 gridSize:Object.freeze([2048,2048] as const),cellKm:.0625,
 minEdgeKm:Object.freeze([-64,-64] as const),rowOrder:'south-to-north; v0=minZ',
 dataConvention:'premultiplied-linear-RGB-and-valid-area',
 sourceAssetBytes:TERRAIN_OPTICAL_BYTES,basePayloadBytes:TERRAIN_OPTICAL_BYTES,
 nominalMipPayloadBytes:11_184_808,totalGpuPayloadBytes:44_739_240,
 retainedCpuPayloadBytes:TERRAIN_OPTICAL_BYTES,mipLevels:12,
});

class OwnedTerrainOpticalTexture implements TerrainOpticalTexture {
 private disposed=false;
 readonly stats=stats;
 constructor(readonly texture:DataTexture){}
 dispose():void{
  if(this.disposed)return;
  this.disposed=true;
  this.texture.dispose();
 }
}

function throwIfAborted(signal?:AbortSignal):void{
 if(signal?.aborted)throw signal.reason??new DOMException('Caricamento ottico annullato','AbortError');
}

/** Structural validation only. Authentication is performed by the loader
 * before this function. The returned view owns no second payload allocation;
 * callers transfer ownership of buffer and must not mutate it afterwards.
 */
export function decodeTerrainOptical(buffer:ArrayBuffer):Uint16Array{
 if(buffer.byteLength!==TERRAIN_OPTICAL_BYTES)throw new Error('Dimensioni del materiale ottico non valide');
 // WebGPU's raw half-word view uses the host's byte order. Fail explicitly on
 // an unsupported host instead of silently reversing the prepared asset.
 if(new Uint8Array(new Uint16Array([1]).buffer)[0]!==1)throw new Error('Il materiale ottico richiede byte order little-endian');
 const values=new Uint16Array(buffer);
 for(let i=0;i<values.length;i+=4){
  const a=values[i+3];
  // Positive binary16 words are ordered by value. This rejects every negative
  // encoding (including -0), NaN, Infinity and values >1 without float copies.
  if(a>0x3c00)throw new Error('Validità del materiale ottico non valida');
  if(values[i]>a||values[i+1]>a||values[i+2]>a)throw new Error('RGB premoltiplicato del materiale ottico non valido');
 }
 return values;
}

async function readExactBody(response:Response,signal?:AbortSignal):Promise<ArrayBuffer>{
 if(!response.body)throw new Error('Materiale ottico incompleto: corpo mancante');
 const reader=response.body.getReader(),buffer=new ArrayBuffer(TERRAIN_OPTICAL_BYTES),bytes=new Uint8Array(buffer);
 let offset=0;
 const onAbort=()=>{void reader.cancel().catch(()=>{});};
 signal?.addEventListener('abort',onAbort,{once:true});
 try{
  throwIfAborted(signal);
  while(true){
   const {value,done}=await reader.read();
   throwIfAborted(signal);
   if(done)break;
   if(value.byteLength>TERRAIN_OPTICAL_BYTES-offset)throw new Error('Materiale ottico troppo grande');
   bytes.set(value,offset);offset+=value.byteLength;
  }
  if(offset!==TERRAIN_OPTICAL_BYTES)throw new Error('Materiale ottico incompleto');
  return buffer;
 }catch(error){
  await reader.cancel().catch(()=>{});
  throw error;
 }finally{
  signal?.removeEventListener('abort',onAbort);
  reader.releaseLock();
 }
}

/** Load once per owner. Failure or cancellation never creates a substitute
 * palette. The caller owns dispose() and includes texture in its cache key.
 */
export async function loadTerrainOptical(signal?:AbortSignal):Promise<TerrainOpticalTexture>{
 throwIfAborted(signal);
 const response=await fetch(new URL('./assets/liguria-apuane-optical.bin',import.meta.url),{signal});
 if(signal?.aborted||!response.ok){
  await response.body?.cancel().catch(()=>{});
  throwIfAborted(signal);
  throw new Error(`Materiale ottico non disponibile (${response.status})`);
 }
 const buffer=await readExactBody(response,signal);
 throwIfAborted(signal);
 const digest=await crypto.subtle.digest('SHA-256',buffer);
 throwIfAborted(signal);
 const hash=Array.from(new Uint8Array(digest),value=>value.toString(16).padStart(2,'0')).join('');
 if(hash!==TERRAIN_OPTICAL_SHA256)throw new Error('SHA-256 del materiale ottico non corrispondente');
 const data=decodeTerrainOptical(buffer);
 const texture=new DataTexture(data,TERRAIN_OPTICAL_SIDE,TERRAIN_OPTICAL_SIDE,RGBAFormat,HalfFloatType);
 texture.colorSpace=NoColorSpace;
 texture.wrapS=ClampToEdgeWrapping;texture.wrapT=ClampToEdgeWrapping;
 texture.flipY=false;texture.premultiplyAlpha=false;
 texture.minFilter=LinearMipmapLinearFilter;texture.magFilter=LinearFilter;
 texture.generateMipmaps=true;texture.needsUpdate=true;
 return new OwnedTerrainOpticalTexture(texture);
}
