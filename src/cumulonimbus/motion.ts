export interface MotionState {height:number;width:number;anvil:number;time:number;thermalA:readonly number[];thermalB:readonly number[];seedPhase?:number;family?:number;dispersion?:number}
// Retained only for the diagnostic atlas reference. The live GPU flow has no atlas loop.
export const MOTION_LOOP_SECONDS=68;
// Conservative occupancy bounds; the live flow saturates each axis strictly inside these.
// Legacy reference: max s(1-s²)² = .286217: .32*(1.15+1.05)*that < .202 horizontally.
// If either field is within half its radius, the other's weight is <= .408;
// otherwise both weights <= .5625. Thus vertical < .536; .58 includes rounding.
export const THERMAL_DISPLACEMENT=[.42,.82,.34] as const;
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
    anvil:.58+.42*smooth(8,38,time),time,seedPhase:phase,family:seed%3,thermalA:thermal(34,phase,1.15),thermalB:thermal(MOTION_LOOP_SECONDS,phase+.47,1.05)};
}
/** Analytic reference for the material deformation. Rendering approximates this
 * through a filtered half-float flow field; density, detail and light stay registered.
 */
export function sourcePosition(position:readonly number[],state:MotionState,iceRange:readonly number[]=[5.15,5.95],wind:readonly number[]=[0,0]): number[] {
  const p=referencePosition(position,state,iceRange,wind);
  const d=[0,0,0];writeDisplacement(p[0],p[1],p[2],state,iceRange,d);
  return p.map((v,i)=>v-d[i]);
}
/** CPU reference for cloudReference, before the bounded local flow. */
export function referencePosition(position:readonly number[],state:MotionState,iceRange:readonly number[],wind:readonly number[]):number[] {
  const y=.72+(position[1]-.72)/state.height,ice=smooth(iceRange[0],iceRange[1],y);
  const shear=Math.max(0,Math.min(1,(position[1]-.72)/6.2))**1.5;
  return [(position[0]-wind[0]*shear)*((1-ice)/state.width+ice/state.anvil),y,(position[2]-wind[1]*shear)/state.width];
}
/** Allocation-free flow evaluation for the small GPU field. */
export function writeDisplacement(x:number,y:number,z:number,state:MotionState,iceRange:readonly number[],out:{[index:number]:number}): void {
  if(state.seedPhase!==undefined){
    const ice=smooth(iceRange[0],iceRange[1],y),gate=smooth(.75,1.3,y)*(1-ice),scatterGate=smooth(.75,1.5,y);
    const dispersion=state.dispersion??0,spread=state.family===1?1.35:1;
    let sx=0,sy=0,sz=0,erosion=0;
    for(let i=0;i<5;i++){
      const age=(state.time/(18.7+i*4.23)+i*.213+state.seedPhase)%1;
      const cx=[-.85,.55,-.18,1,-1.2][i]*spread+.2*Math.sin(state.time*.037+i),cz=[.15,-.45,.65,.3,-.35][i];
      const dx=x-cx,dy=y-(.95+age*(iceRange[0]-.45)),dz=z-cz,r=[1.28,1.15,.95,.90,1.05][i];
      const radial=(dx*dx+dz*dz)/(r*r),w=Math.max(0,1-radial-dy*dy/(r*r));
      const a=w*w*Math.sin(Math.PI*age)**2*gate;
      sx+=dx*.9*a;sy+=(1.1-1.6*radial)*a;sz+=dz*.85*a;
      erosion+=.14*a*radial;
    }
    const age=(state.time/23.7+state.seedPhase+.37)%1;
    const dx=x-(1.45+.18*Math.sin(state.time*.13)),dz=z+.1;
    const dy=y-(iceRange[0]-(iceRange[0]-1.05)*age),w=Math.max(0,1-(dx*dx+dz*dz)/1.05**2-dy*dy/1.4**2);
    const sink=w*w*Math.sin(Math.PI*age)**2*scatterGate;
    sy-=.95*sink;sx+=dx*.45*sink;sz+=dz*.45*sink;erosion+=.06*sink;
    const outflow=ice*smooth(-1,1.5,x);
    sx+=outflow*.22*Math.sin(y*3.3+z*.8-state.time*.31);
    sy+=outflow*.055*Math.sin(x*2.1+z*.9-state.time*.37);
    sz+=outflow*.1*Math.sin(x*.9-y*2+state.time*.17);
    sx+=dispersion*x*.4*scatterGate;sy+=dispersion*.28*scatterGate;sz+=dispersion*z*.4*scatterGate;
    out[0]=sx/(1+Math.abs(sx)/THERMAL_DISPLACEMENT[0]);out[1]=sy/(1+Math.abs(sy)/THERMAL_DISPLACEMENT[1]);out[2]=sz/(1+Math.abs(sz)/THERMAL_DISPLACEMENT[2]);
    out[3]=Math.min(.18,erosion+outflow*.035*(.5+.5*Math.sin(x*3.4+y*5.1-state.time*.43))+dispersion*.1*scatterGate);return;
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
fn convectiveFlow(p:vec3<f32>,time:f32,seedPhase:f32,family:f32,dispersion:f32,iceRange:vec2<f32>)->vec4<f32>{
  let ice=smoothstep(iceRange.x,iceRange.y,p.y);
  let gate=smoothstep(0.75,1.3,p.y)*(1.0-ice);let scatterGate=smoothstep(0.75,1.5,p.y);
  let spread=select(1.0,1.35,family>0.5&&family<1.5);
  let centersX=array<f32,5>(-0.85,0.55,-0.18,1.0,-1.2);
  let centersZ=array<f32,5>(0.15,-0.45,0.65,0.3,-0.35);
  let radii=array<f32,5>(1.28,1.15,0.95,0.90,1.05);
  var d=vec3<f32>(0.0);var erosion=0.0;
  for(var i=0u;i<5u;i++){
    let fi=f32(i);let age=fract(time/(18.7+fi*4.23)+fi*0.213+seedPhase);
    let delta=p-vec3<f32>(centersX[i]*spread+0.2*sin(time*0.037+fi),0.95+age*(iceRange.x-0.45),centersZ[i]);
    let r2=radii[i]*radii[i];let radial=dot(delta.xz,delta.xz)/r2;
    let w=max(0.0,1.0-radial-delta.y*delta.y/r2);
    let a=w*w*pow(sin(3.14159265*age),2.0)*gate;
    d+=vec3<f32>(delta.x*0.9,1.1-1.6*radial,delta.z*0.85)*a;
    erosion+=0.14*a*radial;
  }
  let downAge=fract(time/23.7+seedPhase+0.37);
  let delta=p-vec3<f32>(1.45+0.18*sin(time*0.13),iceRange.x-(iceRange.x-1.05)*downAge,-0.1);
  let w=max(0.0,1.0-dot(delta.xz,delta.xz)/(1.05*1.05)-delta.y*delta.y/(1.4*1.4));
  let sink=w*w*pow(sin(3.14159265*downAge),2.0)*scatterGate;
  d+=vec3<f32>(delta.x*0.45,-0.95,delta.z*0.45)*sink;erosion+=0.06*sink;
  let outflow=ice*smoothstep(-1.0,1.5,p.x);
  d+=outflow*vec3<f32>(0.22*sin(p.y*3.3+p.z*0.8-time*0.31),0.055*sin(p.x*2.1+p.z*0.9-time*0.37),0.1*sin(p.x*0.9-p.y*2.0+time*0.17));
  d+=dispersion*scatterGate*vec3<f32>(p.x*0.4,0.28,p.z*0.4);
  d=d/(vec3<f32>(1.0)+abs(d)/vec3<f32>(0.42,0.82,0.34));
  erosion=min(0.18,erosion+outflow*0.035*(0.5+0.5*sin(p.x*3.4+p.y*5.1-time*0.43))+dispersion*0.1*scatterGate);
  return vec4<f32>(d,erosion);
}`;
export const MOTION_WGSL=`
fn cloudReference(local:vec3<f32>,growth:vec3<f32>,iceRange:vec2<f32>,wind:vec2<f32>)->vec3<f32> {
  let y=0.72+(local.y-0.72)*growth.x;
  let ice=smoothstep(iceRange.x,iceRange.y,y);
  let shear=pow(clamp((local.y-0.72)/6.2,0.0,1.0),1.5);
  return vec3<f32>((local.x-wind.x*shear)*mix(growth.y,growth.z,ice),y,(local.z-wind.y*shear)*growth.y);
}`;
