/** A single wilderness height field, in kilometres above the spherical sea.
 * This is authored ridge/tributary structure, not a hydraulic erosion simulation.
 * Geometry is deliberately separated from the hit-only material evaluation.
 */
export const TERRAIN_SURFACE_ID='hierarchical-ridges-matte-v1';
export const TERRAIN_SURFACE_HASH_ID='u32-avalanche-24-v1';
export const TERRAIN_SURFACE_MAX_HEIGHT_KM=3.31;
/** Bound on the underlying continuous field, not on f32 quantisation jumps. */
export const TERRAIN_SURFACE_MAX_SLOPE=9;
export const TERRAIN_SURFACE_AUDIT_EXTENT_KM=256;
const f=Math.fround;
const add=(a:number,b:number)=>f(f(a)+f(b));
const sub=(a:number,b:number)=>f(f(a)-f(b));
const mul=(a:number,b:number)=>f(f(a)*f(b));
const mix=(a:number,b:number,t:number)=>add(mul(a,sub(1,t)),mul(b,t));
type D=readonly [number,number,number];
const constant=(v:number):D=>[f(v),0,0];
const plus=(a:D,b:D):D=>[add(a[0],b[0]),add(a[1],b[1]),add(a[2],b[2])];
const scale=(a:D,b:number):D=>[mul(a[0],b),mul(a[1],b),mul(a[2],b)];
const product=(a:D,b:D):D=>[mul(a[0],b[0]),add(mul(a[1],b[0]),mul(a[0],b[1])),add(mul(a[2],b[0]),mul(a[0],b[2]))];
const shifted=(a:D,b:number):D=>[add(a[0],b),a[1],a[2]];
const smoothValue=(a:number,b:number,v:number)=>{
 const t=Math.max(0,Math.min(1,f(sub(v,a)/sub(b,a))));
 return mul(mul(t,t),sub(3,mul(2,t)));
};
function smooth(a:number,b:number,v:D):D{
 const t=Math.max(0,Math.min(1,f(sub(v[0],a)/sub(b,a))));
 const d=t>0&&t<1?f(mul(6,mul(t,sub(1,t)))/sub(b,a)):0;
 return [mul(mul(t,t),sub(3,mul(2,t))),mul(v[1],d),mul(v[2],d)];
}
function hash(x:number,z:number):number{
 let h=(Math.imul(x|0,0x9e3779b9)^Math.imul(z|0,0x85ebca6b)^0x243f6a88)>>>0;
 h=Math.imul(h^(h>>>16),0x7feb352d)>>>0;
 h=Math.imul(h^(h>>>15),0x846ca68b)>>>0;
 return ((h^(h>>>16))>>>8)/16777216;
}
/** Cubic value noise plus its analytic gradient in the input coordinates. */
function noise(px:D,pz:D):D{
 const x=px[0],z=pz[0],ix=Math.floor(x),iz=Math.floor(z),tx=sub(x,ix),tz=sub(z,iz);
 const u=mul(mul(tx,tx),sub(3,mul(2,tx))),v=mul(mul(tz,tz),sub(3,mul(2,tz)));
 const a=hash(ix,iz),b=hash(ix+1,iz),c=hash(ix,iz+1),d=hash(ix+1,iz+1);
 const row0=mix(a,b,u),row1=mix(c,d,u);
 const dx=mul(mul(6,mul(tx,sub(1,tx))),mix(sub(b,a),sub(d,c),v));
 const dz=mul(mul(6,mul(tz,sub(1,tz))),sub(row1,row0));
 return [mix(row0,row1,v),add(mul(dx,px[1]),mul(dz,pz[1])),add(mul(dx,px[2]),mul(dz,pz[2]))];
}
const ridge=(a:D):D=>{
 const centred=sub(mul(a[0],2),1),d=centred===0?0:centred<0?2:-2;
 return [sub(1,Math.abs(centred)),mul(a[1],d),mul(a[2],d)];
};
const rotate=(x:D,z:D):readonly [D,D]=>[plus(scale(x,.8),scale(z,-.6)),plus(scale(x,.6),scale(z,.8))];
function coast(x:D,z:D):D{
 const angle=mul(z[0],.045),sine:D=[f(Math.sin(angle)),mul(f(Math.cos(angle)),mul(z[1],.045)),mul(f(Math.cos(angle)),mul(z[2],.045))];
 return plus(plus(plus(plus(constant(2),scale(x,-1)),scale(z,.20)),scale(sine,6)),scale(shifted(noise(scale(x,.055),scale(z,.055)),-.5),9));
}
export interface TerrainSurfaceSample {heightKm:number;slopeX:number;slopeZ:number;coastKm:number}
/** CPU f32 reference. Hashes are exact; WGSL FMA/transcendentals need GPU audit. */
export function terrainSurfaceSample(x:number,z:number):TerrainSurfaceSample{
 const px:D=[f(x),1,0],pz:D=[f(z),0,1],c=coast(px,pz);
 const wx=plus(px,scale(shifted(noise(shifted(scale(px,.032),17.1),shifted(scale(pz,.032),9.2)),-.5),3.8));
 const wz=plus(pz,scale(shifted(noise(shifted(scale(px,.032),-7.7),shifted(scale(pz,.032),31.4)),-.5),3.8));
 let [qx,qz]=rotate(wx,wz);qx=shifted(scale(qx,.125),4.1);qz=shifted(scale(qz,.125),-8.3);
 const r0=ridge(noise(qx,qz));
 [qx,qz]=rotate(qx,qz);qx=shifted(scale(qx,2.13),17.4);qz=shifted(scale(qz,2.13),9.2);
 const r1=ridge(noise(qx,qz));
 [qx,qz]=rotate(qx,qz);qx=shifted(scale(qx,2.13),-11.7);qz=shifted(scale(qz,2.13),23.1);
 const r2=ridge(noise(qx,qz));
 // Children modulate the same parent ridge: small massifs do not float in valleys.
 const spines=plus(plus(scale(product(r0,r0),2.15),scale(product(r0,product(r1,r1)),.55)),scale(product(product(r0,r1),product(r2,r2)),.22));
 const region=shifted(scale(noise(shifted(scale(px,.021),-23.4),shifted(scale(pz,.021),1.7)),.4),.6);
 const hills=noise(shifted(scale(wx,.35),3),shifted(scale(wz,.35),7));
 const body=plus(shifted(scale(hills,.30),.08),product(region,spines));
 const h=product(smooth(0,14,c),body);
 return {heightKm:h[0],slopeX:h[1],slopeZ:h[2],coastKm:c[0]};
}
export function terrainSurfaceHeight(x:number,z:number):number{return terrainSurfaceSample(x,z).heightKm;}
/** Analytic real-arithmetic bounds, with explicit slack in the public constants.
 * Cubic noise |grad|<=1.5*sqrt(2); the warp Jacobian norm<=1+3.8*.032*3.
 * Ridge cusps are Lipschitz; the reported derivative chooses zero at the cusp.
 */
const noiseSlope=1.5*Math.SQRT2,warpJacobian=1+3.8*.032*3;
const l0=2*noiseSlope*.125*warpJacobian,l1=l0*2.13,l2=l1*2.13;
const coastSlope=Math.hypot(1,.2+6*.045)+9*.055*noiseSlope;
export const TERRAIN_SURFACE_BOUND_DERIVATION=Object.freeze({
 idealHeightKm:.08+.30+2.15+.55+.22,
 idealSlope:3.30*(1.5/14)*coastSlope+.30*.35*warpJacobian*noiseSlope+2.92*.4*.021*noiseSlope+5.07*l0+1.32*l1+.44*l2,
});
export interface TerrainSurfaceBiomes {forest:number;rock:number;snow:number}
/** Authored biome weights, not a climate or snow-transport model. */
export function terrainSurfaceBiomes(heightKm:number,slope:number,coldAspect:number,patch:number):TerrainSurfaceBiomes{
 const forest=mul(sub(1,smoothValue(1.1,1.85,heightKm)),sub(1,smoothValue(.55,1.2,slope)));
 const line=add(sub(2.75,mul(.35,Math.max(0,Math.min(1,coldAspect)))),mul(.12,sub(patch,.5)));
 const snow=mul(mul(mul(smoothValue(line,add(line,.25),heightKm),sub(1,smoothValue(.45,.95,slope))),smoothValue(.62,.82,patch)),.72);
 return {forest:mul(forest,sub(1,snow)),rock:mul(sub(1,forest),sub(1,snow)),snow};
}

/** No ray solver, fog or tone mapping here. Raster paths must reuse vertex H,
 * coast and normal; terrainSurfaceColour is only a fallback for analytic hits.
 */
export const TERRAIN_SURFACE_WGSL=`
// ${TERRAIN_SURFACE_ID}; ${TERRAIN_SURFACE_HASH_ID}. Units: km above spherical sea.
fn tsHash(i:vec2<i32>)->f32{
 var h=(bitcast<u32>(i.x)*0x9e3779b9u)^(bitcast<u32>(i.y)*0x85ebca6bu)^0x243f6a88u;
 h=(h^(h>>16u))*0x7feb352du;h=(h^(h>>15u))*0x846ca68bu;h=h^(h>>16u);
 return f32(h>>8u)*(1.0/16777216.0);
}
fn tsNoise(p:vec2<f32>)->vec3<f32>{
 let i=floor(p);let t=fract(p);let u=t*t*(3.0-2.0*t);let du=6.0*t*(1.0-t);
 let a=tsHash(vec2<i32>(i));let b=tsHash(vec2<i32>(i)+vec2<i32>(1,0));
 let c=tsHash(vec2<i32>(i)+vec2<i32>(0,1));let d=tsHash(vec2<i32>(i)+vec2<i32>(1,1));
 let row0=mix(a,b,u.x);let row1=mix(c,d,u.x);
 return vec3<f32>(mix(row0,row1,u.y),du.x*mix(b-a,d-c,u.y),du.y*(row1-row0));
}
fn tsScale(a:vec3<f32>,b:f32)->vec3<f32>{return a*b;}
fn tsShift(a:vec3<f32>,b:f32)->vec3<f32>{return vec3<f32>(a.x+b,a.yz);}
fn tsProduct(a:vec3<f32>,b:vec3<f32>)->vec3<f32>{return vec3<f32>(a.x*b.x,a.yz*b.x+a.x*b.yz);}
fn tsN(x:vec3<f32>,z:vec3<f32>)->vec3<f32>{
 let n=tsNoise(vec2<f32>(x.x,z.x));return vec3<f32>(n.x,n.y*x.yz+n.z*z.yz);
}
fn tsRidge(n:vec3<f32>)->vec3<f32>{let c=2.0*n.x-1.0;return vec3<f32>(1.0-abs(c),-2.0*sign(c)*n.yz);}
fn tsSmooth(a:f32,b:f32,v:vec3<f32>)->vec3<f32>{
 let t=clamp((v.x-a)/(b-a),0.0,1.0);return vec3<f32>(t*t*(3.0-2.0*t),v.yz*(6.0*t*(1.0-t)/(b-a)));
}
fn tsCoast(x:vec3<f32>,z:vec3<f32>)->vec3<f32>{
 let angle=z.x*.045;let s=vec3<f32>(sin(angle),cos(angle)*z.yz*.045);
 return vec3<f32>(2,0,0)-x+z*.20+s*6.0+tsShift(tsN(x*.055,z*.055),-.5)*9.0;
}
fn terrainSurfaceSample(p:vec2<f32>)->vec4<f32>{
 let px=vec3<f32>(p.x,1,0);let pz=vec3<f32>(p.y,0,1);let coast=tsCoast(px,pz);
 let wx=px+tsShift(tsN(tsShift(px*.032,17.1),tsShift(pz*.032,9.2)),-.5)*3.8;
 let wz=pz+tsShift(tsN(tsShift(px*.032,-7.7),tsShift(pz*.032,31.4)),-.5)*3.8;
 var qx=tsShift((wx*.8-wz*.6)*.125,4.1);var qz=tsShift((wx*.6+wz*.8)*.125,-8.3);
 let r0=tsRidge(tsN(qx,qz));
 let x1=tsShift((qx*.8-qz*.6)*2.13,17.4);qz=tsShift((qx*.6+qz*.8)*2.13,9.2);qx=x1;
 let r1=tsRidge(tsN(qx,qz));
 let x2=tsShift((qx*.8-qz*.6)*2.13,-11.7);qz=tsShift((qx*.6+qz*.8)*2.13,23.1);qx=x2;
 let r2=tsRidge(tsN(qx,qz));
 let spines=tsProduct(r0,r0)*2.15+tsProduct(r0,tsProduct(r1,r1))*.55+tsProduct(tsProduct(r0,r1),tsProduct(r2,r2))*.22;
 let region=tsShift(tsN(tsShift(px*.021,-23.4),tsShift(pz*.021,1.7))*.4,.6);
 let hills=tsN(tsShift(wx*.35,3.0),tsShift(wz*.35,7.0));
 let body=tsShift(hills*.30,.08)+tsProduct(region,spines);
 let h=tsProduct(tsSmooth(0.0,14.0,coast),body);
 return vec4<f32>(h,coast.x);
}
fn terrainSurfaceHeight(p:vec2<f32>)->f32{return terrainSurfaceSample(p).x;}
fn terrainSurfaceCoast(p:vec2<f32>)->f32{return tsCoast(vec3<f32>(p.x,1,0),vec3<f32>(p.y,0,1)).x;}
fn terrainSurfaceBiomes(h:f32,slope:f32,cold:f32,patchiness:f32)->vec3<f32>{
 let forest=(1.0-smoothstep(1.1,1.85,h))*(1.0-smoothstep(.55,1.2,slope));
 let line=2.75-.35*clamp(cold,0.0,1.0)+.12*(patchiness-.5);
 let snow=smoothstep(line,line+.25,h)*(1.0-smoothstep(.45,.95,slope))*smoothstep(.62,.82,patchiness)*.72;
 return vec3<f32>(forest*(1.0-snow),(1.0-forest)*(1.0-snow),snow);
}
// Filter detail towards its mean as its wavelength approaches the pixel footprint.
fn tsFilteredNoise(p:vec2<f32>,frequency:f32,footprint:f32)->vec3<f32>{
 let weight=1.0-smoothstep(.12,.50,max(0.0,footprint)*frequency);
 let n=tsNoise(p*frequency);return vec3<f32>(mix(.5,n.x,weight),n.yz*weight);
}
// Mesh-friendly material. H/coast/normal are the actual geometry attributes.
// Returns unfogged diffuse radiance; caller retains shared aerial transport.
fn terrainSurfaceMaterial(point:vec3<f32>,hKm:f32,coastKm:f32,macroNormal:vec3<f32>,distanceKm:f32,pixelKm:f32,sun:vec3<f32>,solar:vec3<f32>,ambient:vec3<f32>,solarVisibility:f32)->vec3<f32>{
 let p=point.xz+vec2<f32>(hKm*.37,-hKm*.21);let normal=normalize(macroNormal);
 let slope=length(normal.xz)/max(.12,normal.y);
 let broad=tsFilteredNoise(p,2.2,pixelKm);let grain=tsFilteredNoise(p+vec2<f32>(7.1,-3.2),12.0,pixelKm);
 let fine=tsFilteredNoise(p+vec2<f32>(-11.3,4.8),43.0,pixelKm);
 let canopyField=tsFilteredNoise(p+vec2<f32>(1.7,13.6),33.0,pixelKm);let canopy=canopyField.x;
 // Rotated 2km cover combines with the existing 450m field. No axis-aligned
 // parcels or binary clearings; this is a moisture/stand proxy, not drainage.
 let vegetationPoint=vec2<f32>(p.x*.8-p.y*.6,p.x*.6+p.y*.8)+vec2<f32>(37.2,-17.6);
 let vegetation=tsFilteredNoise(vegetationPoint,.48,pixelKm).x;
 let cold=smoothstep(-.15,.7,normal.z);let biome=terrainSurfaceBiomes(hKm,slope,cold,broad.x);
 let lowSlopeMoisture=(1.0-smoothstep(.30,1.25,hKm))*(1.0-smoothstep(.10,.60,slope));
 let stand=.65*vegetation+.35*broad.x+.12*lowSlopeMoisture-.08*smoothstep(.8,1.6,hKm);
 let denseCover=smoothstep(.24,.74,stand);
 let denseForest=mix(vec3<f32>(.019,.042,.027),vec3<f32>(.039,.075,.035),canopy);
 let openForest=mix(vec3<f32>(.054,.062,.032),vec3<f32>(.075,.083,.039),broad.x);
 let forest=mix(openForest,denseForest,denseCover)*(1.0-.12*lowSlopeMoisture);
 let mineral=clamp(.55*broad.x+.30*grain.x+.15*fine.x,0.0,1.0);
 let rock=mix(vec3<f32>(.085,.087,.077),vec3<f32>(.185,.172,.145),mineral);
 let snow=mix(vec3<f32>(.37,.40,.41),vec3<f32>(.55,.57,.57),grain.x);
 let albedo=forest*biome.x+rock*biome.y+snow*biome.z;
 let rough=(.045*grain.yz+.025*fine.yz)*biome.y+.018*canopyField.yz*biome.x;
 let n=normalize(normal-vec3<f32>(rough.x,0,rough.y));
 // Authored skylight/horizon proxy, not a baked visibility or cast-shadow solve.
 let valley=(1.0-smoothstep(.35,1.2,hKm))*(1.0-smoothstep(.15,.65,slope));
 let skyVisibility=clamp(.62+.38*max(0.0,n.y)-.12*valley,.45,1.0);
 let diffuse=max(0.0,dot(n,sun));
 let ground=albedo*(solar*(.90*diffuse)*clamp(solarVisibility,0.0,1.0)+ambient*(1.12*skyVisibility));
 let shallows=exp(-max(0.0,-coastKm)*.55);
 let sea=mix(vec3<f32>(.016,.048,.075),vec3<f32>(.026,.11,.115),shallows)*(solar*.4+ambient*1.5);
 // The measured shoreline mask is in km. Filter its edge at the projected
 // footprint rather than spreading a uniform 400m material band inland.
 let coastBlendWidth=max(.016,pixelKm*1.5);
 return mix(sea,ground,smoothstep(-coastBlendWidth,coastBlendWidth,coastKm));
}
fn terrainSurfaceColour(point:vec3<f32>,distanceKm:f32,pixelKm:f32,sun:vec3<f32>,solar:vec3<f32>,ambient:vec3<f32>)->vec3<f32>{
 let field=terrainSurfaceSample(point.xz);let radial=normalize(point+vec3<f32>(0,6375,0));
 let normal=normalize(radial-vec3<f32>(field.y,0,field.z));
 return terrainSurfaceMaterial(point,field.x,field.w,normal,distanceKm,pixelKm,sun,solar,ambient,1.0);
}
`;
