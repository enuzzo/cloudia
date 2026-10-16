export interface DensityR8 {size:number;data:Uint8Array}
/** Derived render payload; legacy packets retain the original RGBA sampling path. */
export interface DensityR8Packet {densityR8?:DensityR8}

const voxelCount=(size:number)=>Number.isSafeInteger(size)&&size>0&&Number.isSafeInteger(size**3)?size**3:null;

/** Copy bytes only: no new quantization, density model, filtering or bake. */
export function extractDensityR8(source:{size:number;data:Uint8Array}):DensityR8{
  const count=voxelCount(source.size);
  if(count===null)throw new RangeError('Density R8 size must be a positive integer with a safe voxel count.');
  if(!(source.data instanceof Uint8Array))throw new TypeError('Macro density must use Uint8Array RGBA bytes.');
  if(source.data.length!==count*4)throw new RangeError('Macro RGBA payload length does not match its dimensions.');
  const data=new Uint8Array(count);
  for(let i=0;i<count;i++)data[i]=source.data[i*4];
  return {size:source.size,data};
}

/** Invalid/legacy input selects the unchanged macro shader, never a constant density. */
export function readDensityR8(source:{size:number;data?:Uint8Array;densityR8?:unknown}):DensityR8|null{
  const count=voxelCount(source.size),payload=source.densityR8;
  if(count===null||!payload||typeof payload!=='object')return null;
  const candidate=payload as Partial<DensityR8>;
  if(candidate.size!==source.size||!(candidate.data instanceof Uint8Array)||candidate.data.length!==count)return null;
  if(source.data&&candidate.data.buffer===source.data.buffer)return null;
  return candidate as DensityR8;
}
