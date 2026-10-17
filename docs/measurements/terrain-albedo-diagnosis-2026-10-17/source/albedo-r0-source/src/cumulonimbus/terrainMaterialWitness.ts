import {RGBA32F_READBACK_MAX_DIMENSION,RGBA32F_READBACK_MAX_PACKED_BYTES} from './rgba32fReadback';

export interface TerrainMaterialWitnessPoint {readonly id:string;readonly uv:readonly [number,number]}
export interface TerrainMaterialWitnessRow {
 id:string;uv:[number,number];pixel:[number,number];
 rgba:[number,number,number,number];bits:[number,number,number,number];
}
const originalPixels=[
 ['L1-artifact',71.5,856.5],['L1-control',64.5,856.5],
 ['L2-artifact',431.5,849.5],['L2-control',431.5,844.5],
 ['L3-artifact',903.5,651.5],['L3-control',903.5,646.5],
 ['C1-ocean',2200.5,1100.5],['C2-coastal-lowland',1800.5,930.5],
 ['C3-plain',2200.5,700.5],['C4-ridge-L1',170.5,805.5],
 ['C5-ridge-L2',460.5,800.5],['C6-ridge-L3',925.5,610.5],
] as const;
/** Exact archived top-origin UVs from2474x1844 pixel centres. IDs are historical
 * selection labels, not current material, occlusion or artifact classifications.
 */
export const TERRAIN_MATERIAL_WITNESS_POINTS:readonly TerrainMaterialWitnessPoint[]=Object.freeze(
 originalPixels.map(([id,x,y])=>Object.freeze({id,uv:Object.freeze([x/2474,y/1844] as const)})),
);

/** Select twelve records from already PACKED WebGPU RGBA32F bytes, mip/row order
 * unchanged. Address floor(uv*dimensions), with no extra half-pixel or Y flip.
 * Decode little-endian float32 and uint32 independently: no float re-encoding,
 * quantisation, finiteness filter or whole-buffer clone. Returned rows/tuples are
 * fresh small copies. Numeric NaNs remain NaN here; JSON.stringify turns those
 * numbers into null, while bits retain the exact payload and signed-zero bits.
 */
export function selectTerrainMaterialWitness(packed:Uint8Array,width:number,height:number):TerrainMaterialWitnessRow[]{
 if(!Number.isSafeInteger(width)||!Number.isSafeInteger(height)||width<1||height<1||
  width>RGBA32F_READBACK_MAX_DIMENSION||height>RGBA32F_READBACK_MAX_DIMENSION)
  throw new RangeError('Terrain material witness dimensions must be integers in1..8192');
 const expectedBytes=width*height*16;
 if(expectedBytes>RGBA32F_READBACK_MAX_PACKED_BYTES)throw new RangeError('Terrain material witness packed input exceeds96MiB');
 if(!(packed instanceof Uint8Array))throw new TypeError('Terrain material witness needs packed Uint8Array bytes');
 if(packed.byteLength!==expectedBytes)throw new RangeError('Terrain material witness packed byte length differs from width*height*16');
 const view=new DataView(packed.buffer,packed.byteOffset,packed.byteLength);
 return TERRAIN_MATERIAL_WITNESS_POINTS.map<TerrainMaterialWitnessRow>(({id,uv})=>{
  const x=Math.floor(uv[0]*width),y=Math.floor(uv[1]*height),offset=(y*width+x)*16;
  return {id,uv:[uv[0],uv[1]],pixel:[x,y],
   rgba:[view.getFloat32(offset,true),view.getFloat32(offset+4,true),view.getFloat32(offset+8,true),view.getFloat32(offset+12,true)],
   bits:[view.getUint32(offset,true),view.getUint32(offset+4,true),view.getUint32(offset+8,true),view.getUint32(offset+12,true)]};
 });
}
