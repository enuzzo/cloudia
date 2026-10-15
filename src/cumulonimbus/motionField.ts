import {DataUtils} from 'three/webgpu';
import {writeDisplacement,motionState,referencePosition,MOTION_LOOP_SECONDS,type MotionState} from './motion';
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

/** Match the GPU's normalized linear/clamp sampling, including half-texel centers.
 * The reusable output contains displacement xyz and the erosion coefficient.
 */
export function sampleMotionField(data:Uint16Array,size:number,position:readonly number[],out:{[index:number]:number}):void{
  const px=(position[0]+5)/10*size-.5,py=(position[1]+.5)/8.5*size-.5,pz=(position[2]+3.5)/7*size-.5;
  const ix=Math.floor(px),iy=Math.floor(py),iz=Math.floor(pz),fx=px-ix,fy=py-iy,fz=pz-iz;
  const clamp=(v:number)=>Math.max(0,Math.min(size-1,v));
  for(let c=0;c<4;c++)out[c]=0;
  for(let dz=0;dz<2;dz++)for(let dy=0;dy<2;dy++)for(let dx=0;dx<2;dx++){
    const at=((clamp(iz+dz)*size+clamp(iy+dy))*size+clamp(ix+dx))*4;
    const weight=(dx?fx:1-fx)*(dy?fy:1-fy)*(dz?fz:1-fz);
    for(let c=0;c<4;c++)out[c]+=DataUtils.fromHalfFloat(data[at+c])*weight;
  }
}

/** Material coordinates and erosion from the same filtered field as rendering.
 * Position is scene-local (subtract cloud drift before calling).
 */
export function writeFilteredSourcePosition(position:readonly number[],state:MotionState,iceRange:readonly number[],wind:readonly number[],field:Uint16Array,out:{[index:number]:number}):void{
  const reference=referencePosition(position,state,iceRange,wind);
  sampleMotionField(field,MOTION_FIELD_SIZE,reference,out);
  for(let axis=0;axis<3;axis++)out[axis]=reference[axis]-out[axis];
}
