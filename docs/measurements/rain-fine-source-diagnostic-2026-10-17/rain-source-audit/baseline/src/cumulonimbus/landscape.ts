import {AERIAL_WGSL} from './aerial';
import {terrainSurfaceHeight,TERRAIN_SURFACE_WGSL} from './terrainSurface';
/** World units are kilometres for the distant landscape: cloud datum is 4 km above sea level. */
export const EARTH_RADIUS=6371;
export const GROUND_LEVEL=-4;
export const CAMERA_TERRAIN_CLEARANCE_KM=.2;
/** Shared integer lattice hash; terrain realization changes from the legacy sine hash. */
export const TERRAIN_HASH_ID='u32-avalanche-24-v1';
const HASH_X=0x9e3779b9,HASH_Z=0x85ebca6b,HASH_SEED=0x243f6a88;
const HASH_A=0x7feb352d,HASH_B=0x846ca68b;
const f=Math.fround;
const add=(a:number,b:number)=>f(f(a)+f(b));
const sub=(a:number,b:number)=>f(f(a)-f(b));
const mul=(a:number,b:number)=>f(f(a)*f(b));
const mix=(a:number,b:number,t:number)=>add(mul(a,sub(1,t)),mul(b,t));
function terrainHash(x:number,z:number):number{
 let h=(Math.imul(x|0,HASH_X)^Math.imul(z|0,HASH_Z)^HASH_SEED)>>>0;
 h=Math.imul(h^(h>>>16),HASH_A)>>>0;
 h=Math.imul(h^(h>>>15),HASH_B)>>>0;
 h=(h^(h>>>16))>>>0;
 // The high 24 bits and their power-of-two scale are exactly representable in f32.
 return (h>>>8)/16777216;
}
/** CPU f32 reference for WGSL terrainNoise, including negative lattice coordinates.
 * Integer hashes match exactly; GPU contraction and transcendental rounding can
 * still differ slightly in the final height, so rendered parity is audited separately.
 */
export function terrainNoise(x:number,z:number):number{
 x=f(x);z=f(z);
 const ix=Math.floor(x),iz=Math.floor(z),fx=sub(x,ix),fz=sub(z,iz);
 const ux=mul(mul(fx,fx),sub(3,mul(2,fx))),uz=mul(mul(fz,fz),sub(3,mul(2,fz)));
 return mix(mix(terrainHash(ix,iz),terrainHash(ix+1,iz),ux),mix(terrainHash(ix,iz+1),terrainHash(ix+1,iz+1),ux),uz);
}
export function coastDistance(x:number,z:number):number{
 x=f(x);z=f(z);
 return add(add(add(sub(2,x),mul(z,.20)),mul(f(Math.sin(mul(z,.045))),6)),mul(sub(terrainNoise(mul(x,.055),mul(z,.055)),.5),9));
}
/** Authored near-field relief in kilometres above the local spherical sea. */
export function terrainHeight(x:number,z:number):number{
 return terrainSurfaceHeight(x,z);
}
/** Upper local hemisphere with radial, rather than vertical, terrain clearance. */
export function landscapeSurfaceY(x:number,z:number,clearanceKm=0):number{
 const radius=EARTH_RADIUS+terrainHeight(x,z)+Math.max(0,clearanceKm);
 return GROUND_LEVEL-EARTH_RADIUS+Math.sqrt(radius*radius-x*x-z*z);
}
/** Raise only camera y; preserve the chosen target, horizontal orbit and input array. */
export function clampCameraAboveLandscape(origin:readonly number[],clearanceKm=CAMERA_TERRAIN_CLEARANCE_KM,meshSurfaceY:number|null=null):[number,number,number]{
 const x=origin[0],z=origin[2];
 const minimumY=meshSurfaceY===null?landscapeSurfaceY(x,z,clearanceKm):
  GROUND_LEVEL-EARTH_RADIUS+Math.sqrt((Math.hypot(x,meshSurfaceY+EARTH_RADIUS-GROUND_LEVEL,z)+Math.max(0,clearanceKm))**2-x*x-z*z);
 return [x,Math.max(origin[1],minimumY),z];
}
export function groundIntersection(origin:readonly number[],ray:readonly number[]):number|null{
 const o=[origin[0],origin[1]+EARTH_RADIUS-GROUND_LEVEL,origin[2]];
 const b=o.reduce((sum,v,i)=>sum+v*ray[i],0),c=o.reduce((sum,v)=>sum+v*v,0)-EARTH_RADIUS**2,d=b*b-c;
 if(d<0)return null;const t=-b-Math.sqrt(d);return t>0?t:null;
}
export const LANDSCAPE_WGSL=`
${AERIAL_WGSL}
${TERRAIN_SURFACE_WGSL}
// ${TERRAIN_HASH_ID}: match the CPU lattice without transcendental hash drift.
fn terrainHash(i:vec2<i32>)->f32{
 var h=(bitcast<u32>(i.x)*0x${HASH_X.toString(16)}u)^(bitcast<u32>(i.y)*0x${HASH_Z.toString(16)}u)^0x${HASH_SEED.toString(16)}u;
 h=(h^(h>>16u))*0x${HASH_A.toString(16)}u;
 h=(h^(h>>15u))*0x${HASH_B.toString(16)}u;
 h=h^(h>>16u);
 return f32(h>>8u)*(1.0/16777216.0);
}
fn terrainNoise(p:vec2<f32>)->f32{
 let i=floor(p);let f=fract(p);let u=f*f*(3.0-2.0*f);
 let a=terrainHash(vec2<i32>(i));
 let b=terrainHash(vec2<i32>(i)+vec2<i32>(1,0));
 let c=terrainHash(vec2<i32>(i)+vec2<i32>(0,1));
 let d=terrainHash(vec2<i32>(i)+vec2<i32>(1,1));
 return mix(mix(a,b,u.x),mix(c,d,u.x),u.y);
}
// A fictional wilderness coast: wooded foothills rise into irregular ridges.
fn coastDistance(p:vec2<f32>)->f32{
 return 2.0-p.x+p.y*.20+sin(p.y*.045)*6.0+(terrainNoise(p*.055)-.5)*9.0;
}
fn terrainHeight(p:vec2<f32>)->f32{
 return terrainSurfaceHeight(p);
}
fn earthDistance(origin:vec3<f32>,ray:vec3<f32>)->f32{
 let o=origin+vec3<f32>(0,6375,0);let b=dot(o,ray);let c=dot(o,o)-6371.0*6371.0;
 let d=b*b-c;if(d<0.0){return -1.0;}let t=-b-sqrt(d);return select(-1.0,t,t>0.0);
}
// Legacy diagnostic helper only. Production samples the depth-tested mesh;
// this unbracketed refinement does not certify the first terrain intersection.
fn landscapeDistance(origin:vec3<f32>,ray:vec3<f32>,seaDistance:f32)->f32{
 if(seaDistance<=0.0){return seaDistance;}
 let relief=1.0-smoothstep(90.0,180.0,seaDistance);
 if(relief<=0.0){return seaDistance;}
 var t=seaDistance;
 for(var i=0;i<6;i++){
  let p=origin+ray*t;let radial=p+vec3<f32>(0,6375,0);
  let clearance=length(radial)-6371.0-terrainHeight(p.xz)*relief;
  let incidence=min(-.045,dot(normalize(radial),ray));
  t=clamp(t-clearance/incidence,0.0,seaDistance);
 }
 return t;
}
fn landscapeColor(point:vec3<f32>,distance:f32,sun:vec3<f32>,solar:vec3<f32>,ambient:vec3<f32>,sky:vec3<f32>,haze:f32)->vec3<f32>{
 let surface=terrainSurfaceColour(point,distance,max(.0003,distance*.0003),sun,solar,ambient);
 let transmission=aerialTransmittance(distance,haze);
 return mix(sky,surface,transmission);
}`;
