/** Small emitter-depth packet, built from existing buffers without a light bake.
 * Endpoints are static/owner-immutable; update only writes the packed B channel.
 * This is ideal CPU trilinear UNORM8, not GPU filter/f32 parity.
 */
export interface RainEmitterLightSource {size:number;data:Uint8Array;sunsetLight:Uint8Array}
export interface RainEmitterLightPacket {
 readonly size:number;
 readonly rgba:Uint8Array;
 /** Float32 normalized tau/16: dayLeft,dayRight,sunsetLeft,sunsetRight,up. */
 readonly endpoints:Float32Array;
 lightSide:number|null;
 sunsetAmount:number|null;
}
const MAX_MAP_SIDE=64,MAX_SOURCE_SIDE=256,ENDPOINTS=5;
const clampIndex=(i:number,n:number)=>Math.max(0,Math.min(n-1,i));
const packed=(value:number)=>Math.round(Math.max(0,Math.min(1,value))*255);
function requireInput(value:unknown,message:string):asserts value {if(!value)throw new Error(message);}

export function buildRainEmitterLight(rg:Uint8Array,source:RainEmitterLightSource,size=64):RainEmitterLightPacket{
 const n=source.size,cells=size*size;
 requireInput(Number.isInteger(size)&&size>=1&&size<=MAX_MAP_SIDE,'Emitter map side must be an integer in [1,64]');
 requireInput(Number.isInteger(n)&&n>=1&&n<=MAX_SOURCE_SIDE,'Emitter source side must be an integer in [1,256]');
 requireInput(rg instanceof Uint8Array&&rg.length===cells*2,'Emitter map requires exact RG8 length');
 requireInput(source.data instanceof Uint8Array&&source.data.length===n**3*4,'Emitter source requires exact macro RGBA8 length');
 requireInput(source.sunsetLight instanceof Uint8Array&&source.sunsetLight.length===n**3*2,'Emitter source requires exact sunset RG8 length');
 for(const input of [rg,source.data,source.sunsetLight]){
  requireInput(!(typeof SharedArrayBuffer!=='undefined'&&input.buffer instanceof SharedArrayBuffer),'Concurrent shared emitter input is unsupported');
 }
 const rgba=new Uint8Array(cells*4),endpoints=new Float32Array(cells*ENDPOINTS);
 for(let z=0;z<size;z++)for(let x=0;x<size;x++){
  const i=z*size+x,u=(x+.5)/size,v=(z+.5)/size,w=3*(rg[i*2+1]/255)/8.5;
  // Texture XYZ=(u,w,v): height belongs on Y, never on the horizontal Z axis.
  const px=u*n-.5,py=w*n-.5,pz=v*n-.5;
  const ix=Math.floor(px),iy=Math.floor(py),iz=Math.floor(pz),fx=px-ix,fy=py-iy,fz=pz-iz;
  let dayLeft=0,dayRight=0,lowLeft=0,lowRight=0,up=0;
  for(let dz=0;dz<2;dz++)for(let dy=0;dy<2;dy++)for(let dx=0;dx<2;dx++){
   const weight=(dx?fx:1-fx)*(dy?fy:1-fy)*(dz?fz:1-fz);
   const voxel=(clampIndex(iz+dz,n)*n+clampIndex(iy+dy,n))*n+clampIndex(ix+dx,n);
   const macro=voxel*4,low=voxel*2;
   dayLeft+=source.data[macro+1]/255*weight;dayRight+=source.data[macro+2]/255*weight;
   lowLeft+=source.sunsetLight[low]/255*weight;lowRight+=source.sunsetLight[low+1]/255*weight;
   up+=source.data[macro+3]/255*weight;
  }
  const at=i*ENDPOINTS;
  endpoints[at]=dayLeft;endpoints[at+1]=dayRight;endpoints[at+2]=lowLeft;endpoints[at+3]=lowRight;endpoints[at+4]=up;
  rgba[i*4]=rg[i*2];rgba[i*4+1]=rg[i*2+1];
  // Every R0 texel is sampled too; no artificial zero-depth halo or bright edge.
  rgba[i*4+3]=packed(endpoints[at+4]);
 }
 // B is uninitialized for light until update is called; initial texture upload
 // must happen even if that first update reports no changed B bytes.
 return {size,rgba,endpoints,lightSide:null,sunsetAmount:null};
}

/** Return true iff at least one B byte changed. Keys still advance when the
 * scalars change inside the same quantization bin. No mass factor is packed.
 * Caller must not mutate endpoints or RG/A after build, nor reuse a packet for
 * another volume; install a new packet and perform the initial texture upload.
 */
export function updateRainEmitterLight(packet:RainEmitterLightPacket,lightSide:number,sunsetAmount:number):boolean{
 requireInput(Number.isFinite(lightSide)&&lightSide>=0&&lightSide<=1&&Number.isFinite(sunsetAmount)&&sunsetAmount>=0&&sunsetAmount<=1,'Emitter lightSide/sunsetAmount must be finite in [0,1]');
 requireInput(Number.isInteger(packet.size)&&packet.size>=1&&packet.size<=MAX_MAP_SIDE&&
  packet.rgba instanceof Uint8Array&&packet.rgba.length===packet.size**2*4&&
  packet.endpoints instanceof Float32Array&&packet.endpoints.length===packet.size**2*ENDPOINTS,'Invalid emitter packet dimensions');
 if(Object.is(packet.lightSide,lightSide)&&Object.is(packet.sunsetAmount,sunsetAmount))return false;
 let changed=false;
 for(let i=0;i<packet.size**2;i++){
  const at=i*ENDPOINTS;
  const day=packet.endpoints[at]+(packet.endpoints[at+1]-packet.endpoints[at])*lightSide;
  const low=packet.endpoints[at+2]+(packet.endpoints[at+3]-packet.endpoints[at+2])*lightSide;
  const byte=packed(day+(low-day)*sunsetAmount),index=i*4+2;
  if(packet.rgba[index]!==byte){packet.rgba[index]=byte;changed=true;}
 }
 packet.lightSide=lightSide;packet.sunsetAmount=sunsetAmount;
 return changed;
}
