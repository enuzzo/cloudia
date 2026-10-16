import {bakeOccupancy,DETAIL_RESOLUTION,VOLUME_RESOLUTION,type CloudVolume,type DetailVolume} from './volume';

export interface NarrowCloudMask {size:number;data:Uint8Array}
export type NarrowCloudVolume=CloudVolume & {narrowMask?:NarrowCloudMask};
export const NARROW_CLOUD_RESOLUTION=DETAIL_RESOLUTION;
export const NARROW_CLOUD_GUARD_KM=.001;

/** A point-only certificate in post-flow material coordinates. The verified
 * 256/128 ratio includes every positive raw corner, macro interpolation and
 * the bounded fine warp. Other dimensions stay fully occupied, preserving the
 * original rendering path. Broad alpha and empty traversal are unchanged.
 */
export function buildNarrowCloudMask(envelope:DetailVolume,size=NARROW_CLOUD_RESOLUTION):NarrowCloudMask{
  if(!Number.isSafeInteger(size)||size<1)throw new RangeError('Narrow mask size must be a positive integer.');
  const data=new Uint8Array(size**3);
  if(envelope.size!==VOLUME_RESOLUTION||size!==DETAIL_RESOLUTION||envelope.size!==size*2||
    envelope.data.length!==envelope.size**3*4){
    data.fill(255);return {size,data};
  }
  // Scratch RGBA is discarded after extraction; only one R8 array persists.
  const scratch={size,data:new Uint8Array(size**3*4)};
  bakeOccupancy(envelope,scratch,[NARROW_CLOUD_GUARD_KM,NARROW_CLOUD_GUARD_KM,NARROW_CLOUD_GUARD_KM]);
  for(let i=0;i<data.length;i++)data[i]=scratch.data[i*4+3];
  return {size,data};
}
