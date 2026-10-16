/** Offline only: ideal-field interval automatic differentiation + a declared
 * CPU-fround deviation ledger. No derivative is assigned to the stepped CPU field.
 */
export type I=readonly[number,number];
export interface Rect{x0:number;x1:number;z0:number;z1:number}
export interface J{v:I;x:I;z:I;e:number}
export interface GradientBound{height:I;gx:I;gz:I;errorKm:number;idealHeight:I;L:number;rect:Rect}
const f=Math.fround,U=2**-24;
const absmax=(a:I)=>Math.max(Math.abs(a[0]),Math.abs(a[1]));
const out=(lo:number,hi:number):I=>{const p=1e-13*(1+Math.max(Math.abs(lo),Math.abs(hi)));return[lo-p,hi+p];};
export const addI=(a:I,b:I):I=>out(a[0]+b[0],a[1]+b[1]);
export const subI=(a:I,b:I):I=>out(a[0]-b[1],a[1]-b[0]);
export const mulI=(a:I,b:I):I=>{const v=[a[0]*b[0],a[0]*b[1],a[1]*b[0],a[1]*b[1]];return out(Math.min(...v),Math.max(...v));};
const scaleI=(a:I,s:number):I=>s>=0?out(a[0]*s,a[1]*s):out(a[1]*s,a[0]*s);
const union=(a:I,b:I):I=>[Math.min(a[0],b[0]),Math.max(a[1],b[1])];
const expand=(a:I,e:number):I=>out(a[0]-e,a[1]+e);
const roundError=(a:I)=>a[0]===a[1]?Math.abs(f(a[0])-a[0]):U*absmax(a)+2**-149;
const c=(v:number):J=>({v:[f(v),f(v)],x:[0,0],z:[0,0],e:0});
function add(a:J,b:J):J{const v=addI(a.v,b.v);return{v,x:addI(a.x,b.x),z:addI(a.z,b.z),e:a.e+b.e+roundError(expand(v,a.e+b.e))};}
function sub(a:J,b:J):J{const v=subI(a.v,b.v);return{v,x:subI(a.x,b.x),z:subI(a.z,b.z),e:a.e+b.e+roundError(expand(v,a.e+b.e))};}
function mul(a:J,b:J):J{const v=mulI(a.v,b.v),prior=absmax(a.v)*b.e+absmax(b.v)*a.e+a.e*b.e;return{v,x:addI(mulI(a.x,b.v),mulI(a.v,b.x)),z:addI(mulI(a.z,b.v),mulI(a.v,b.z)),e:prior+roundError(expand(v,prior))};}
function abs(a:J):J{const crossed=a.v[0]<=0&&a.v[1]>=0,v:I=crossed?[0,absmax(a.v)]:[Math.min(Math.abs(a.v[0]),Math.abs(a.v[1])),absmax(a.v)],s:I=crossed?[-1,1]:a.v[0]>=0?[1,1]:[-1,-1];return{v,x:mulI(a.x,s),z:mulI(a.z,s),e:a.e};}
function divide13(a:J):J{const v=scaleI(a.v,1/13);return{v,x:scaleI(a.x,1/13),z:scaleI(a.z,1/13),e:a.e/13+roundError(expand(v,a.e/13))};}
function clamp01(a:J):J{
 if(a.v[1]+a.e<=0)return c(0);if(a.v[0]-a.e>=1)return c(1);
 const v:I=[Math.max(0,Math.min(1,a.v[0])),Math.max(0,Math.min(1,a.v[1]))],s:I=a.v[0]>0&&a.v[1]<1?[1,1]:[0,1];return{v,x:mulI(a.x,s),z:mulI(a.z,s),e:a.e};
}
function sinRange(a:I):I{let lo=Math.min(Math.sin(a[0]),Math.sin(a[1])),hi=Math.max(Math.sin(a[0]),Math.sin(a[1]));if(a[1]-a[0]>=Math.PI*2)return[-1,1];for(let k=Math.ceil((a[0]-Math.PI/2)/Math.PI);k<=Math.floor((a[1]-Math.PI/2)/Math.PI);k++){const v=k%2===0?1:-1;lo=Math.min(lo,v);hi=Math.max(hi,v);}return out(lo,hi);}
function sin(a:J):J{const v=sinRange(a.v),der=sinRange([a.v[0]+Math.PI/2,a.v[1]+Math.PI/2]),prior=a.e+2**-23;return{v,x:mulI(der,a.x),z:mulI(der,a.z),e:prior+roundError(expand(v,prior))};}
function power(a:J):J{const p=f(1.3),pv=out(Math.pow(Math.max(0,a.v[0]),p),Math.pow(Math.max(0,a.v[1]),p)),v:I=[Math.max(0,pv[0]),pv[1]],d=out(p*Math.pow(Math.max(0,a.v[0]),p-1),p*Math.pow(Math.max(0,a.v[1]),p-1)),L=p*Math.pow(Math.max(0,a.v[1]+a.e),p-1),prior=L*a.e+2**-22;return{v,x:mulI(d,a.x),z:mulI(d,a.z),e:prior+roundError(expand(v,prior))};}
function hash(x:number,z:number):number{let h=(Math.imul(x|0,0x9e3779b9)^Math.imul(z|0,0x85ebca6b)^0x243f6a88)>>>0;h=Math.imul(h^(h>>>16),0x7feb352d)>>>0;h=Math.imul(h^(h>>>15),0x846ca68b)>>>0;h=(h^(h>>>16))>>>0;return(h>>>8)/16777216;}
const smooth=(t:number)=>t*t*(3-2*t);
const dsmooth=(a:number,b:number):I=>[Math.min(6*a*(1-a),6*b*(1-b)),a<=.5&&b>=.5?1.5:Math.max(6*a*(1-a),6*b*(1-b))];
const lerp=(a:number,b:number,u:number)=>a*(1-u)+b*u;
export const counters={noiseQueries:0,cells:0,arithmeticCells:0,globalFallbacks:0,metadataQueries:0};
function cubicError(F:I,fracError:number):{v:I;e:number}{
 const M=absmax(F),B:I=[F[0]*F[0],F[1]*F[1]],C=out(3-2*F[1],3-2*F[0]),S=out(smooth(F[0]),smooth(F[1]));
 const pB=2*M*fracError+fracError*fracError,eB=pB+roundError(expand(B,pB)),eC=2*fracError+roundError(expand(C,2*fracError));
 const pS=absmax(B)*eC+absmax(C)*eB+eB*eC;return{v:S,e:pS+roundError(expand(S,pS))};
}
function mixError(A:I,B:I,U:I,D:I,ideal:I,eA:number,eB:number,eU:number):number{
 const Ah=expand(A,eA),Bh=expand(B,eB),Uh=expand(U,eU),W=subI([1,1],Uh),rw=roundError(W),Wh=expand(W,rw);
 const p=absmax(W)*eA+absmax(Uh)*eB+absmax(D)*eU,ar=absmax(Ah)*rw+roundError(mulI(Ah,Wh))+roundError(mulI(Bh,Uh));
 return p+ar+roundError(expand(ideal,p+ar));
}
function localNoiseError(x:I,z:I):number{
 const x0=Math.floor(x[0]),x1=Math.floor(x[1]),z0=Math.floor(z[0]),z1=Math.floor(z[1]);
 if((x1-x0+1)*(z1-z0+1)>64)return 2**-19;let error=0;
 for(let iz=z0;iz<=z1;iz++)for(let ix=x0;ix<=x1;ix++){
  counters.arithmeticCells++;const F:I=[Math.max(0,x[0]-ix),Math.min(1,x[1]-ix)],G:I=[Math.max(0,z[0]-iz),Math.min(1,z[1]-iz)];
  // q is already f32 at this stage. Fraction subtraction is exact outside
  // (-.5,0); include its rounding where cancellation lacks that guarantee.
  const u=cubicError(F,ix===-1&&x[1]>-.5&&x[0]<0?roundError(F):0),v=cubicError(G,iz===-1&&z[1]>-.5&&z[0]<0?roundError(G):0);
  const a=hash(ix,iz),b=hash(ix+1,iz),c=hash(ix,iz+1),d=hash(ix+1,iz+1);
  const row=(p:number,q:number):I=>{const lo=lerp(p,q,u.v[0]),hi=lerp(p,q,u.v[1]);return out(Math.min(lo,hi),Math.max(lo,hi));},A=row(a,b),B=row(c,d);
  const eA=mixError([a,a],[b,b],u.v,[b-a,b-a],A,0,0,u.e),eB=mixError([c,c],[d,d],u.v,[d-c,d-c],B,0,0,u.e);
  const ds=[lerp(c-a,d-b,u.v[0]),lerp(c-a,d-b,u.v[1])],D=out(Math.min(...ds),Math.max(...ds)),values=[];
  for(const U of u.v)for(const V of v.v)values.push(lerp(lerp(a,b,U),lerp(c,d,U),V));
  error=Math.max(error,mixError(A,B,v.v,D,out(Math.min(...values),Math.max(...values)),eA,eB,v.e));
 }return Math.min(2**-19,error);
}
function noiseRect(x:I,z:I):{v:I;dx:I;dz:I}{
 counters.noiseQueries++;const x0=Math.floor(x[0]),x1=Math.floor(x[1]),z0=Math.floor(z[0]),z1=Math.floor(z[1]);
 if((x1-x0+1)*(z1-z0+1)>64){counters.globalFallbacks++;return{v:[0,1],dx:[-1.5,1.5],dz:[-1.5,1.5]};}
 let value:I=[Infinity,-Infinity],dx:I=[Infinity,-Infinity],dz:I=[Infinity,-Infinity];
 for(let iz=z0;iz<=z1;iz++)for(let ix=x0;ix<=x1;ix++){
  counters.cells++;const fx0=Math.max(0,x[0]-ix),fx1=Math.min(1,x[1]-ix),fz0=Math.max(0,z[0]-iz),fz1=Math.min(1,z[1]-iz),ux:I=[smooth(fx0),smooth(fx1)],uz:I=[smooth(fz0),smooth(fz1)],a=hash(ix,iz),b=hash(ix+1,iz),c=hash(ix,iz+1),d=hash(ix+1,iz+1),vs=[];
  for(const u of ux)for(const v of uz)vs.push(lerp(lerp(a,b,u),lerp(c,d,u),v));value=union(value,out(Math.min(...vs),Math.max(...vs)));
  const dxCoeff:I=[Math.min(lerp(b-a,d-c,uz[0]),lerp(b-a,d-c,uz[1])),Math.max(lerp(b-a,d-c,uz[0]),lerp(b-a,d-c,uz[1]))];
  const dzCoeff:I=[Math.min(lerp(c-a,d-b,ux[0]),lerp(c-a,d-b,ux[1])),Math.max(lerp(c-a,d-b,ux[0]),lerp(c-a,d-b,ux[1]))];
  dx=union(dx,mulI(dsmooth(fx0,fx1),dxCoeff));dz=union(dz,mulI(dsmooth(fz0,fz1),dzCoeff));
 }return{v:value,dx,dz};
}
function noise(qx:J,qz:J):J{
 // The enlarged domain covers the segment between ideal and rounded octave
 // coordinates, even when a rounding change crosses an integer lattice boundary.
 const ideal=noiseRect(qx.v,qz.v),extended=noiseRect(expand(qx.v,qx.e),expand(qz.v,qz.e));
 const e=absmax(extended.dx)*qx.e+absmax(extended.dz)*qz.e+localNoiseError(expand(qx.v,qx.e),expand(qz.v,qz.e));
 return{v:ideal.v,x:addI(mulI(ideal.dx,qx.x),mulI(ideal.dz,qz.x)),z:addI(mulI(ideal.dx,qx.z),mulI(ideal.dz,qz.z)),e};
}
function input(a:I,axis:'x'|'z'):J{return{v:a,x:axis==='x'?[1,1]:[0,0],z:axis==='z'?[1,1]:[0,0],e:roundError(a)};}
export function gradientBound(rect:Rect):GradientBound{
 counters.metadataQueries++;const x=input([rect.x0,rect.x1],'x'),z=input([rect.z0,rect.z1],'z');let qx=mul(x,c(.065)),qz=mul(z,c(.065)),h=c(0),weight=f(.58);
 for(let j=0;j<4;j++){
  const ridge=sub(c(1),abs(sub(mul(noise(qx,qz),c(2)),c(1))));h=add(h,mul(mul(c(weight),ridge),ridge));
  const nx=add(mul(sub(mul(qx,c(.8)),mul(qz,c(.6))),c(2.17)),c(13.4)),nz=add(mul(add(mul(qx,c(.6)),mul(qz,c(.8))),c(2.17)),c(13.4));qx=nx;qz=nz;weight=f(weight*f(.43));
 }
 // Geometric sign knowledge: source h is a sum of nonnegative ridge products.
 h.v=[Math.max(0,h.v[0]),h.v[1]];
 const coast=add(add(add(sub(c(2),x),mul(z,c(.20))),mul(sin(mul(z,c(.045))),c(6))),mul(sub(noise(mul(x,c(.055)),mul(z,c(.055))),c(.5)),c(9)));
 const t=clamp01(divide13(coast)),inland=mul(mul(t,t),sub(c(3),mul(c(2),t)));
 // Keep the source arithmetic ledger, but use the exact monotone cubic value
 // and its [0,1.5] derivative rather than a dependency-inflated polynomial AD.
 inland.v=[smooth(t.v[0]),smooth(t.v[1])];const di=dsmooth(t.v[0],t.v[1]);inland.x=mulI(di,t.x);inland.z=mulI(di,t.z);
 const range=add(c(.55),mul(c(.45),noise(add(mul(x,c(.018)),c(3)),add(mul(z,c(.018)),c(7)))));
 const out=mul(inland,add(c(.12),mul(mul(c(3.2),power(h)),range))),gx=out.x,gz=out.z;
 return{height:[Math.max(0,out.v[0]-out.e),Math.max(0,out.v[1]+out.e)],gx,gz,errorKm:out.e,idealHeight:out.v,L:Math.hypot(absmax(gx),absmax(gz)),rect};
}
export function idealPoint(x:number,z:number){return gradientBound({x0:x,x1:x,z0:z,z1:z}).idealHeight;}
export const NUMERIC_CONTRACT={target:'CPU fround source versus ideal continuous field with exact f32 constants and coordinate-independent pre-rounded octave weights',inputRoundoffIncluded:true,octaveCoordinateRoundoffIncluded:true,noiseInterpolationAbsBudget:2**-19,noiseInterpolationBudget:'local per-cell composed frac/cubic/mix ledger; 32u fallback',sinHostAbsBudget:2**-23,powHostAbsBudget:2**-22,hostBudgetsUniversallyProven:false,GPUQualified:false,gradientAppliesToCPUField:false};
