import { BOUNDS_SIZE, DETAIL_RESOLUTION, VOLUME_RESOLUTION } from './volume';
import { THERMAL_DISPLACEMENT, type MotionState } from './motion';

// Gap between a zero filtered mask sample and displaced raw support. A macro
// center can lie a quarter mask texel beyond its assigned mask center. Include
// raw interpolation, fine warp, saturated flow and a small rounding guard.
export const EMPTY_REFERENCE_MARGIN = BOUNDS_SIZE.map((extent,axis)=>{
  const macro=extent/VOLUME_RESOLUTION,mask=extent/DETAIL_RESOLUTION;
  const displacement=[.08,.06,.08][axis]+THERMAL_DISPLACEMENT[axis];
  const radius=Math.ceil((displacement+macro)/mask);
  return (radius+.5+.5*DETAIL_RESOLUTION/VOLUME_RESOLUTION)*mask-displacement-macro-.001;
});

/** Bounds the inverse growth/shear Jacobian over the ray box. Dispersion is
 * covered by the saturated flow halo. Integer advances preserve sample phase.
 */
export function conservativeEmptyStep(step:number,state:MotionState,wind:readonly number[],iceRange:readonly number[],maxAbsX:number):number {
  const gy=1/state.height,gx=1/state.width,ga=1/state.anvil;
  const horizontal=Math.max(gx,ga),shearSlope=1.5/6.2;
  const transitionSlope=1.5*gy/(iceRange[1]-iceRange[0]);
  const crossX=horizontal*Math.abs(wind[0])*shearSlope+
    (maxAbsX+Math.abs(wind[0]))*Math.abs(ga-gx)*transitionSlope;
  const rates=[Math.hypot(horizontal,crossX),gy,Math.hypot(gx,gx*Math.abs(wind[1])*shearSlope)];
  const safe=Math.min(...EMPTY_REFERENCE_MARGIN.map((margin,axis)=>margin/rates[axis]));
  if(!Number.isFinite(safe)||step<=0) return step;
  return step*Math.max(1,Math.floor(safe/step));
}
