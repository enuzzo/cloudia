import {DataUtils} from 'three/webgpu';
import {writeDisplacement,motionState,MOTION_LOOP_SECONDS,type MotionState} from './motion';
export const MOTION_FIELD_SIZE=16;
export const MOTION_PHASES=64;
export function fillMotionAtlas(data:Uint16Array,size:number,phases:number,seed:number,iceRange:readonly number[]): void {
  const stride=size**3*4;
  for(let phase=0;phase<phases;phase++) fillMotionField(data.subarray(phase*stride,(phase+1)*stride),size,motionState(phase/phases*MOTION_LOOP_SECONDS,seed),iceRange);
}
/** A flow field, not cloud density: fine density/light remain 256³ / 128³.
 * Its compact smooth thermals need far fewer samples than cloud optical detail.
 */
export function fillMotionField(data:Uint16Array,size:number,state:MotionState,iceRange:readonly number[]): void {
  const displacement=new Float64Array(4);
  for(let z=0;z<size;z++) for(let y=0;y<size;y++) for(let x=0;x<size;x++) {
    writeDisplacement(-5+(x+.5)/size*10,-.5+(y+.5)/size*8.5,-3.5+(z+.5)/size*7,state,iceRange,displacement);
    const at=((z*size+y)*size+x)*4;
    for(let channel=0;channel<3;channel++) data[at+channel]=DataUtils.toHalfFloat(displacement[channel]);
    data[at+3]=DataUtils.toHalfFloat(displacement[3]);
  }
}
