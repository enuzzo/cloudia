import {AERIAL_WGSL} from './aerial';
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
const smooth=(a:number,b:number,v:number)=>{
 const t=Math.max(0,Math.min(1,f(sub(v,a)/sub(b,a))));
 return mul(mul(t,t),sub(3,mul(2,t)));
};
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
 x=f(x);z=f(z);
 let qx=mul(x,.065),qz=mul(z,.065),h=0,a=f(.58);
 for(let j=0;j<4;j++){
  const ridge=sub(1,Math.abs(sub(mul(terrainNoise(qx,qz),2),1)));
  h=add(h,mul(mul(a,ridge),ridge));
  const nextX=add(mul(sub(mul(qx,.8),mul(qz,.6)),2.17),13.4);
  const nextZ=add(mul(add(mul(qx,.6),mul(qz,.8)),2.17),13.4);
  qx=nextX;qz=nextZ;a=mul(a,.43);
 }
 const inland=smooth(0,13,coastDistance(x,z));
 const range=add(.55,mul(.45,terrainNoise(add(mul(x,.018),3),add(mul(z,.018),7))));
 return mul(inland,add(.12,mul(mul(3.2,f(Math.pow(h,f(1.3)))),range)));
}
/** Upper local hemisphere with radial, rather than vertical, terrain clearance. */
export function landscapeSurfaceY(x:number,z:number,clearanceKm=0):number{
 const radius=EARTH_RADIUS+terrainHeight(x,z)+Math.max(0,clearanceKm);
 return GROUND_LEVEL-EARTH_RADIUS+Math.sqrt(radius*radius-x*x-z*z);
}
/** Raise only camera y; preserve the chosen target, horizontal orbit and input array. */
export function clampCameraAboveLandscape(origin:readonly number[],clearanceKm=CAMERA_TERRAIN_CLEARANCE_KM):[number,number,number]{
 return [origin[0],Math.max(origin[1],landscapeSurfaceY(origin[0],origin[2],clearanceKm)),origin[2]];
}
export function groundIntersection(origin:readonly number[],ray:readonly number[]):number|null{
 const o=[origin[0],origin[1]+EARTH_RADIUS-GROUND_LEVEL,origin[2]];
 const b=o.reduce((sum,v,i)=>sum+v*ray[i],0),c=o.reduce((sum,v)=>sum+v*v,0)-EARTH_RADIUS**2,d=b*b-c;
 if(d<0)return null;const t=-b-Math.sqrt(d);return t>0?t:null;
}
export const LANDSCAPE_WGSL=`
${AERIAL_WGSL}
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
 var q=p*.065;var h=0.0;var a=.58;
 for(var j=0;j<4;j++){
  let ridge=1.0-abs(terrainNoise(q)*2.0-1.0);
  h+=a*ridge*ridge;q=vec2<f32>(q.x*.8-q.y*.6,q.x*.6+q.y*.8)*2.17+13.4;a*=.43;
 }
 let inland=smoothstep(0.0,13.0,coastDistance(p));
 let range=.55+.45*terrainNoise(p*.018+vec2<f32>(3,7));
 return inland*(.12+3.2*pow(h,1.3)*range);
}
fn earthDistance(origin:vec3<f32>,ray:vec3<f32>)->f32{
 let o=origin+vec3<f32>(0,6375,0);let b=dot(o,ray);let c=dot(o,o)-6371.0*6371.0;
 let d=b*b-c;if(d<0.0){return -1.0;}let t=-b-sqrt(d);return select(-1.0,t,t>0.0);
}
// Refine the sea-sphere hit against kilometre-scale relief. Far relief fades
// before the horizon to keep grazing rays stable; no extra cloud march steps.
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
 let p=point.xz;
 let coast=coastDistance(p);let land=smoothstep(-.15,.25,coast);
 let h=terrainHeight(p);
 let slope=vec2<f32>(terrainHeight(p+vec2<f32>(.08,0))-terrainHeight(p-vec2<f32>(.08,0)),terrainHeight(p+vec2<f32>(0,.08))-terrainHeight(p-vec2<f32>(0,.08)))/.16;
 let normal=normalize(vec3<f32>(-slope.x,1.0,-slope.y));
 let canopy=terrainNoise(p*2.4)*.55+terrainNoise(p*8.5)*.45;
 let forest=mix(vec3<f32>(.025,.062,.033),vec3<f32>(.070,.115,.049),canopy);
 let rock=mix(vec3<f32>(.19,.18,.16),vec3<f32>(.30,.29,.26),terrainNoise(p*.7));
 let exposed=max(smoothstep(.8,1.65,h),smoothstep(.3,.85,length(slope)));
 var albedo=mix(forest,rock,exposed);
 albedo=mix(albedo,vec3<f32>(.53,.56,.55),smoothstep(1.65,2.3,h)*.65);
 let shade=.16+.84*max(0.0,dot(normal,sun));
 let ground=albedo*(solar*shade*.9+ambient*1.45);
 let shallows=exp(-max(0.0,-coast)*.55);
 let sea=mix(vec3<f32>(.016,.048,.075),vec3<f32>(.026,.11,.115),shallows)*(solar*.4+ambient*1.5);
 let surface=mix(sea,ground,land);
 let transmission=aerialTransmittance(distance,haze);
 return mix(sky,surface,transmission);
}`;
