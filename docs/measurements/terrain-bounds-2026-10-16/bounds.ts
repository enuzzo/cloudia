/** EXTERNAL CPU REFERENCE ONLY. This file does not replace terrain geometry.
 * Bounds target the current explicit-fround CPU expression, with two declared
 * host-libm allowances. They are NOT universal WGSL/Metal bounds.
 */
export type I=readonly [number,number];
export interface Rect {x0:number;x1:number;z0:number;z1:number}
export interface BoundResult {height:I;coast:I;inland:I;ridgeSum:I;range:I;octaves:{qx:I;qz:I;noise:I;ridge:I;term:I}[]}
export interface Counters {rectQueries:number;noiseQueries:number;noiseCells:number;hashCalls:number;globalNoiseFallbacks:number;coastUnknown:number;cacheHits:number}
const f=Math.fround,buf=new ArrayBuffer(4),fv=new Float32Array(buf),uv=new Uint32Array(buf);
export function nextF32(x:number,direction:-1|1):number{
 x=f(x);if(Number.isNaN(x)||x===direction*Infinity)return x;
 if(x===0)return direction*2**-149;fv[0]=x;uv[0]+=x>0?direction:-direction;return fv[0];
}
// These are interval bounds for the *same CPU rounded operations*, not bounds
// for ideal real expressions. JS binary64 +,-,* and Math.fround are monotone in
// each argument on the finite domains used here; evaluate extrema in that same
// order and round those endpoints. Do not infer a WGSL numeric contract from it.
const out=(lo:number,hi:number):I=>[f(lo),f(hi)];
const c=(x:number):I=>[f(x),f(x)];
const roundedInput=(x:I):I=>[f(x[0]),f(x[1])];
const add=(a:I,b:I):I=>out(a[0]+b[0],a[1]+b[1]);
const sub=(a:I,b:I):I=>out(a[0]-b[1],a[1]-b[0]);
const mul=(a:I,b:I):I=>{const v=[a[0]*b[0],a[0]*b[1],a[1]*b[0],a[1]*b[1]];return out(Math.min(...v),Math.max(...v));};
const divPositive=(a:I,b:I):I=>{if(b[0]<=0)throw Error('Positive divisor required');const v=[a[0]/b[0],a[0]/b[1],a[1]/b[0],a[1]/b[1]];return out(Math.min(...v),Math.max(...v));};
const square=(a:I):I=>out(a[0]<=0&&a[1]>=0?0:Math.min(a[0]**2,a[1]**2),Math.max(a[0]**2,a[1]**2));
const abs=(a:I):I=>a[0]<=0&&a[1]>=0?[0,Math.max(-a[0],a[1])]:[Math.min(Math.abs(a[0]),Math.abs(a[1])),Math.max(Math.abs(a[0]),Math.abs(a[1]))];
const clamp=(a:I,lo:number,hi:number):I=>[Math.max(lo,Math.min(hi,a[0])),Math.max(lo,Math.min(hi,a[1]))];
const hull=(a:I,b:I):I=>[Math.min(a[0],b[0]),Math.max(a[1],b[1])];
const smoothReal=(t:number)=>t*t*(3-2*t);
/** For t in [0,1], the exact cubic is monotone. The source expression has
 * 3 multiplies + a subtraction; 2^-20 is a conservative CPU f32 absolute error
 * allowance (> sum of their worst absolute rounding errors in this domain).
 * We do not clamp its output: the source may overshoot 1 by rounding.
 */
export const CUBIC_F32_ABS_GUARD=2**-20;
export const MIX_F32_ABS_GUARD=2**-21;
export const HOST_SIN_ABS_GUARD=2**-23;
export const HOST_POW_ABS_GUARD=2**-22;
export const NUMERIC_CONTRACT={input:'CPU explicit fround expression',basicOps:'monotone endpoint evaluation using the original CPU binary64 operation followed by fround; zero extra ULPs' ,cubicAbsGuard:CUBIC_F32_ABS_GUARD,mixAbsGuard:MIX_F32_ABS_GUARD,hostSinAbsGuard:HOST_SIN_ABS_GUARD,hostPowAbsGuard:HOST_POW_ABS_GUARD,hostLibmUniversallyProven:false,GPUQualified:false};
function smooth01(a:I):I{a=clamp(a,0,1);return out(Math.max(0,smoothReal(a[0])-CUBIC_F32_ABS_GUARD),smoothReal(a[1])+CUBIC_F32_ABS_GUARD);}
// Source mix = fl(fl(a*fl(1-u))+fl(b*u)). For |a|,|b| <=1.00001,
// u in [-1e-6,1.000001], 2^-21 comfortably covers these rounded operations.
function mixInterval(a:I,b:I,u:I):I{
 const vals:number[]=[];for(const x of a)for(const y of b)for(const t of u)vals.push(x*(1-t)+y*t);
 return out(Math.min(...vals)-MIX_F32_ABS_GUARD,Math.max(...vals)+MIX_F32_ABS_GUARD);
}
function sinRange(a:I):I{
 let lo=Math.min(Math.sin(a[0]),Math.sin(a[1])),hi=Math.max(Math.sin(a[0]),Math.sin(a[1]));
 if(a[1]-a[0]>=2*Math.PI)return out(-1-HOST_SIN_ABS_GUARD,1+HOST_SIN_ABS_GUARD);
 const k0=Math.ceil((a[0]-Math.PI/2)/Math.PI),k1=Math.floor((a[1]-Math.PI/2)/Math.PI);
 for(let k=k0;k<=k1;k++){const v=k%2===0?1:-1;lo=Math.min(lo,v);hi=Math.max(hi,v);}
 return out(lo-HOST_SIN_ABS_GUARD,hi+HOST_SIN_ABS_GUARD);
}
function pow13(a:I):I{
 const lo=Math.pow(Math.max(0,a[0]),f(1.3)),hi=Math.pow(Math.max(0,a[1]),f(1.3));
 return out(Math.max(0,lo-HOST_POW_ABS_GUARD),hi+HOST_POW_ABS_GUARD);
}
function hash(x:number,z:number):number{
 let h=(Math.imul(x|0,0x9e3779b9)^Math.imul(z|0,0x85ebca6b)^0x243f6a88)>>>0;
 h=Math.imul(h^(h>>>16),0x7feb352d)>>>0;h=Math.imul(h^(h>>>15),0x846ca68b)>>>0;h=(h^(h>>>16))>>>0;
 return (h>>>8)/16777216;
}
export class TerrainBounds {
 counters:Counters={rectQueries:0,noiseQueries:0,noiseCells:0,hashCalls:0,globalNoiseFallbacks:0,coastUnknown:0,cacheHits:0};
 private cache=new Map<string,BoundResult>();
 constructor(public maxEnumeratedCells=64,public coastPolicy:'cpu-libm'|'unknown-outside-wgsl-range'='cpu-libm'){}
 clearCache(){this.cache.clear();}
 resetCounters(){for(const k in this.counters)this.counters[k as keyof Counters]=0;}
 noise(x:I,z:I):I{
  this.counters.noiseQueries++;x=roundedInput(x);z=roundedInput(z);
  if(![...x,...z].every(Number.isFinite)||Math.max(...x.map(Math.abs),...z.map(Math.abs))>2**23)throw Error('Noise bound domain exceeded');
  const ix0=Math.floor(x[0]),ix1=Math.floor(x[1]),iz0=Math.floor(z[0]),iz1=Math.floor(z[1]);
  const cells=(ix1-ix0+1)*(iz1-iz0+1);
  if(cells>this.maxEnumeratedCells){this.counters.globalNoiseFallbacks++;return [-(2**-17),1+2**-17];}
  let range:I=[Infinity,-Infinity];
  for(let iz=iz0;iz<=iz1;iz++)for(let ix=ix0;ix<=ix1;ix++){
   this.counters.noiseCells++;this.counters.hashCalls+=4;
   const fx=clamp(sub([Math.max(x[0],ix),Math.min(x[1],ix+1)],c(ix)),0,1),fz=clamp(sub([Math.max(z[0],iz),Math.min(z[1],iz+1)],c(iz)),0,1);
   const u=smooth01(fx),v=smooth01(fz),a=c(hash(ix,iz)),b=c(hash(ix+1,iz)),cc=c(hash(ix,iz+1)),d=c(hash(ix+1,iz+1));
   const value=mixInterval(mixInterval(a,b,u),mixInterval(cc,d,u),v);range=hull(range,value);
  }
  return range;
 }
 evaluate(rect:Rect,useCache=true):BoundResult{
  if(rect.x0>rect.x1||rect.z0>rect.z1||![rect.x0,rect.x1,rect.z0,rect.z1].every(Number.isFinite))throw Error('Invalid rectangle');
  const key=`${rect.x0},${rect.x1},${rect.z0},${rect.z1}`;
  if(useCache&&this.cache.has(key)){this.counters.cacheHits++;return this.cache.get(key)!;}
  this.counters.rectQueries++;
  const x=roundedInput([rect.x0,rect.x1]),z=roundedInput([rect.z0,rect.z1]);
  let qx=mul(x,c(.065)),qz=mul(z,c(.065)),h=c(0),a=c(.58);const octaves:BoundResult['octaves']=[];
  for(let j=0;j<4;j++){
   const n=this.noise(qx,qz),ridge=sub(c(1),abs(sub(mul(n,c(2)),c(1))));
   // Source a*ridge*ridge is not fl(a*fl(ridge*ridge)). Enclose both
   // dependency and original order via the interval expression, then intersect
   // with a tighter squared-real enclosure + a declared basic-rounding bound.
   const raw=mul(mul(a,ridge),ridge),sq=square(ridge);
   const tighter=mul(a,sq),roundPad=2**-21;
   const term:I=[Math.max(0,Math.max(raw[0],tighter[0]-roundPad)),Math.min(raw[1],tighter[1]+roundPad)];
   if(term[0]>term[1])throw Error('Invalid ridge interval');octaves.push({qx,qz,noise:n,ridge,term});h=add(h,term);
   const nx=add(mul(sub(mul(qx,c(.8)),mul(qz,c(.6))),c(2.17)),c(13.4));
   const nz=add(mul(add(mul(qx,c(.6)),mul(qz,c(.8))),c(2.17)),c(13.4));
   qx=nx;qz=nz;a=mul(a,c(.43));
  }
  h=[Math.max(0,h[0]),h[1]];
  const coastNoise=this.noise(mul(x,c(.055)),mul(z,c(.055))),sinArg=mul(z,c(.045));
  const coast=sub(c(2),x),slant=mul(z,c(.20)),jitter=mul(sub(coastNoise,c(.5)),c(9));
  let coastI:I,inland:I;
  if(this.coastPolicy==='unknown-outside-wgsl-range'&&(sinArg[0]<-Math.PI||sinArg[1]>Math.PI)){
   this.counters.coastUnknown++;coastI=[-Infinity,Infinity];inland=[0,1+CUBIC_F32_ABS_GUARD];
  }else{
   coastI=add(add(add(coast,slant),mul(sinRange(sinArg),c(6))),jitter);
   inland=smooth01(clamp(divPositive(sub(coastI,c(0)),sub(c(13),c(0))),0,1));
  }
  const range=add(c(.55),mul(c(.45),this.noise(add(mul(x,c(.018)),c(3)),add(mul(z,c(.018)),c(7)))));
  const height=mul(inland,add(c(.12),mul(mul(c(3.2),pow13(h)),range)));
  const result={height:[Math.max(0,height[0]),height[1]] as I,coast:coastI,inland,ridgeSum:h,range,octaves};
  if(useCache)this.cache.set(key,result);return result;
 }
}
export interface Node {rect:Rect;level:number;ix:number;iz:number;bounds:I}
/** Bounds-only quadtree. Each lazily visited node is bounded analytically from
 * the original formula. A full pyramid can instead union its four child bounds.
 * Source geometry remains the imported procedural function in trace.ts.
 */
export class LazyMetadata {
 private nodes=new Map<string,Node>();
 loads=0;misses=0;
 constructor(public builder:TerrainBounds,public origin=-512,public span=1024,public leafKm=1){if(!Number.isInteger(Math.log2(span/leafKm)))throw Error('Power-of-two grid required');}
 get depth(){return Math.log2(this.span/this.leafKm);}
 rect(level:number,ix:number,iz:number):Rect{const size=this.span/2**level;return {x0:this.origin+ix*size,x1:this.origin+(ix+1)*size,z0:this.origin+iz*size,z1:this.origin+(iz+1)*size};}
 get(level:number,ix:number,iz:number):Node{
  this.loads++;const key=`${level}/${ix}/${iz}`;if(this.nodes.has(key))return this.nodes.get(key)!;this.misses++;
  const rect=this.rect(level,ix,iz);
  const node={rect,level,ix,iz,bounds:this.builder.evaluate(rect).height};this.nodes.set(key,node);return node;
 }
 get size(){return this.nodes.size;}
}
