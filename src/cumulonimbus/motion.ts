export interface MotionState {height:number;width:number;anvil:number;time:number;thermalA:readonly number[];thermalB:readonly number[];seedPhase?:number}
// Retained only for the diagnostic atlas reference. The live GPU flow has no atlas loop.
export const MOTION_LOOP_SECONDS=68;
// Conservative occupancy bounds; the live flow saturates each axis strictly inside these.
// Legacy reference: max s(1-s²)² = .286217: .32*(1.15+1.05)*that < .202 horizontally.
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
    anvil:.58+.42*smooth(8,38,time),time,seedPhase:phase,thermalA:thermal(34,phase,1.15),thermalB:thermal(MOTION_LOOP_SECONDS,phase+.47,1.05)};
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
  if(state.seedPhase!==undefined){
    const ice=smooth(iceRange[0],iceRange[1],y),gate=smooth(.75,1.3,y)*(1-ice);
    let sx=0,sy=0,sz=0,erosion=0;
    for(let i=0;i<5;i++){
      const age=(state.time/(29.3+i*7.17)+i*.213+state.seedPhase)%1;
      const cx=[-.85,.55,-.18,1,-1.2][i]+.12*Math.sin(state.time*.013+i),cz=[.15,-.45,.65,.3,-.35][i];
      const dx=x-cx,dy=y-(.95+age*4.65),dz=z-cz,r=[1.22,1.03,.85,.78,.9][i];
      const radial=(dx*dx+dz*dz)/(r*r),w=Math.max(0,1-radial-dy*dy/(r*r));
      const a=w*w*Math.sin(Math.PI*age)**2*gate;
      sx+=dx*.48*a;sy+=(.66-.95*radial)*a;sz+=dz*.48*a;
      erosion+=.1*a*radial;
    }
    const outflow=ice*smooth(-1,1.5,x);
    sx+=outflow*.15*Math.sin(y*3.3+z*.8-state.time*.17);
    sy+=outflow*.045*Math.sin(x*2.1+z*.9-state.time*.23);
    sz+=outflow*.07*Math.sin(x*.9-y*2+state.time*.11);
    out[0]=sx/(1+Math.abs(sx)/THERMAL_DISPLACEMENT[0]);out[1]=sy/(1+Math.abs(sy)/THERMAL_DISPLACEMENT[1]);out[2]=sz/(1+Math.abs(sz)/THERMAL_DISPLACEMENT[2]);
    out[3]=Math.min(.08,erosion+outflow*.025*(.5+.5*Math.sin(x*3.4+y*5.1-state.time*.31)));return;
  }
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
  out[3]=0;
}
/** Same authored flow on the GPU: no atlas wrapping, uploads or density rebuild per frame. */
export const FLOW_WGSL=`
fn convectiveFlow(p:vec3<f32>,time:f32,seedPhase:f32,iceRange:vec2<f32>)->vec4<f32>{
  let ice=smoothstep(iceRange.x,iceRange.y,p.y);
  let gate=smoothstep(0.75,1.3,p.y)*(1.0-ice);
  let centersX=array<f32,5>(-0.85,0.55,-0.18,1.0,-1.2);
  let centersZ=array<f32,5>(0.15,-0.45,0.65,0.3,-0.35);
  let radii=array<f32,5>(1.22,1.03,0.85,0.78,0.9);
  var d=vec3<f32>(0.0);var erosion=0.0;
  for(var i=0u;i<5u;i++){
    let fi=f32(i);let age=fract(time/(29.3+fi*7.17)+fi*0.213+seedPhase);
    let delta=p-vec3<f32>(centersX[i]+0.12*sin(time*0.013+fi),0.95+age*4.65,centersZ[i]);
    let r2=radii[i]*radii[i];let radial=dot(delta.xz,delta.xz)/r2;
    let w=max(0.0,1.0-radial-delta.y*delta.y/r2);
    let a=w*w*pow(sin(3.14159265*age),2.0)*gate;
    d+=vec3<f32>(delta.x*0.48,0.66-0.95*radial,delta.z*0.48)*a;
    erosion+=0.1*a*radial;
  }
  let outflow=ice*smoothstep(-1.0,1.5,p.x);
  d+=outflow*vec3<f32>(0.15*sin(p.y*3.3+p.z*0.8-time*0.17),0.045*sin(p.x*2.1+p.z*0.9-time*0.23),0.07*sin(p.x*0.9-p.y*2.0+time*0.11));
  d=d/(vec3<f32>(1.0)+abs(d)/vec3<f32>(0.205,0.58,0.205));
  erosion=min(0.08,erosion+outflow*0.025*(0.5+0.5*sin(p.x*3.4+p.y*5.1-time*0.31)));
  return vec4<f32>(d,erosion);
}`;
export const MOTION_WGSL=`
fn cloudReference(local:vec3<f32>,growth:vec3<f32>,iceRange:vec2<f32>)->vec3<f32> {
  let y=0.72+(local.y-0.72)*growth.x;
  let ice=smoothstep(iceRange.x,iceRange.y,y);
  return vec3<f32>(local.x*mix(growth.y,growth.z,ice),y,local.z*growth.y);
}`;
