export interface SupportR8 {size:number;data:Uint8Array}
/** Exact broad-support bytes; old packets retain the original detail-alpha path. */
export interface SupportR8Packet {supportR8?:SupportR8}

const voxelCount=(size:number)=>Number.isSafeInteger(size)&&size>0&&Number.isSafeInteger(size**3*4)?size**3:null;

/** Copy the completed occupancy alpha only; no field, filter or quantization change. */
export function extractSupportR8(detail:{size:number;data:Uint8Array}):SupportR8{
  const count=voxelCount(detail.size);
  if(count===null)throw new RangeError('Support R8 size must be a positive integer with a safe RGBA voxel count.');
  if(!(detail.data instanceof Uint8Array))throw new TypeError('Detail support must use Uint8Array RGBA bytes.');
  if(detail.data.length!==count*4)throw new RangeError('Detail RGBA payload length does not match its dimensions.');
  const data=new Uint8Array(count);
  for(let i=0;i<count;i++)data[i]=detail.data[i*4+3];
  return {size:detail.size,data};
}

/** Invalid/legacy input keeps the original filtered alpha, never a fabricated support. */
export function readSupportR8(source:{detail:{size:number;data:Uint8Array};supportR8?:unknown}):SupportR8|null{
  const detail=source.detail,payload=source.supportR8;
  if(!detail||typeof detail!=='object')return null;
  const count=voxelCount(detail.size);
  if(count===null||!(detail.data instanceof Uint8Array)||detail.data.length!==count*4||!payload||typeof payload!=='object')return null;
  const candidate=payload as Partial<SupportR8>;
  if(candidate.size!==detail.size||!(candidate.data instanceof Uint8Array)||candidate.data.length!==count)return null;
  if(candidate.data.buffer===detail.data.buffer)return null;
  return candidate as SupportR8;
}
