export interface MotionState {height:number;width:number;anvil:number;time:number;thermalA:readonly number[];thermalB:readonly number[]}
export const MOTION_LOOP_SECONDS=68;
// max s(1-s²)² = .286217: .32*(1.15+1.05)*that < .202 horizontally.
// If either field is within half its radius, the other's weight is <= .408;
// otherwise both weights <= .5625. Thus vertical < .536; .58 includes rounding.
export const THERMAL_DISPLACEMENT=[.205,.58,.205] as const;
const smooth=(a:number,b:number,x:number)=>{const u=Math.max(0,Math.min(1,(x-a)/(b-a)));return u*u*(3-2*u);};
/** An authored accelerated formation, followed by asynchronous rising thermals.
 * Amplitude vanishes at both ends of each thermal's lifetime, so wrapping cannot pop.
 */
export function motionState(time:number,seed:number): MotionState {
  time=Math.max(0,time);
  const phase=(seed%71)/71*.35;
  const thermal=(period:number,offset:number,radius:number)=>{
    const age=(time/period+offset)%1;
    return [.9+age*4.5,Math.sin(Math.PI*age)**2,radius];
  };
  return {height:.68+.32*smooth(0,28,time),width:.88+.12*smooth(0,28,time),
    anvil:.58+.42*smooth(8,38,time),time,thermalA:thermal(34,phase,1.15),thermalB:thermal(MOTION_LOOP_SECONDS,phase+.47,1.05)};
}
/** Analytic reference for the material deformation. Rendering approximates this
 * through a filtered half-float flow field; density, detail and light stay registered.
 */
export function sourcePosition(position:readonly number[],state:MotionState,iceRange:readonly number[]=[5.15,5.95]): number[] {
  const y=.72+(position[1]-.72)/state.height,ice=smooth(iceRange[0],iceRange[1],y);
  const p=[position[0]*((1-ice)/state.width+ice/state.anvil),y,position[2]/state.width];
  const d=[0,0,0];writeDisplacement(p[0],p[1],p[2],state,iceRange,d);
  return p.map((v,i)=>v-d[i]);
}
/** Allocation-free flow evaluation for the small GPU field. */
export function writeDisplacement(x:number,y:number,z:number,state:MotionState,iceRange:readonly number[],out:{[index:number]:number}): void {
  const ice=smooth(iceRange[0],iceRange[1],y),gate=smooth(.75,1.3,y)*(1-ice);
  let sx=0,sy=0,sz=0;
  for(let i=0;i<2;i++) {
    const thermal=i===0?state.thermalA:state.thermalB;
    const dx=x-(i===0?-.65:.48),dy=y-thermal[0],dz=z-(i===0?.1:-.35);
    const radius2=thermal[2]*thermal[2],radial=(dx*dx+dz*dz)/radius2;
    const w=Math.max(0,1-radial-dy*dy/radius2),a=w*w*thermal[1]*gate;
    sx+=dx*.32*a;sy+=(.38-.5*radial)*a;sz+=dz*.32*a;
  }
  out[0]=sx;out[1]=sy+ice*.05*Math.sin(x*1.4-state.time*(2*Math.PI/MOTION_LOOP_SECONDS)+z*.4);out[2]=sz;
}
export const MOTION_WGSL=`
fn cloudReference(local:vec3<f32>,growth:vec3<f32>,iceRange:vec2<f32>)->vec3<f32> {
  let y=0.72+(local.y-0.72)*growth.x;
  let ice=smoothstep(iceRange.x,iceRange.y,y);
  return vec3<f32>(local.x*mix(growth.y,growth.z,ice),y,local.z*growth.y);
}`;
