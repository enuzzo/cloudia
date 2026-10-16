import {terrainHeight} from './landscape.source.ts';
import {gradientBound,type Rect} from './gradient.ts';
import {Lookup,type Pack} from './data.ts';
type S={v:number;x:number;z:number};const f=Math.fround;
const c=(v:number):S=>({v:f(v),x:0,z:0}),a=(p:S,q:S):S=>({v:p.v+q.v,x:p.x+q.x,z:p.z+q.z}),m=(p:S,q:S):S=>({v:p.v*q.v,x:p.x*q.v+p.v*q.x,z:p.z*q.v+p.v*q.z});
const neg=(p:S):S=>({v:-p.v,x:-p.x,z:-p.z}),s=(p:S,q:S)=>a(p,neg(q));
const hash=(x:number,z:number)=>{let h=(Math.imul(x|0,0x9e3779b9)^Math.imul(z|0,0x85ebca6b)^0x243f6a88)>>>0;h=Math.imul(h^(h>>>16),0x7feb352d)>>>0;h=Math.imul(h^(h>>>15),0x846ca68b)>>>0;return((h^(h>>>16))>>>8)/16777216;};
function n(x:S,z:S):S{const ix=Math.floor(x.v),iz=Math.floor(z.v),fx=x.v-ix,fz=z.v-iz,u=fx*fx*(3-2*fx),v=fz*fz*(3-2*fz),A=hash(ix,iz),B=hash(ix+1,iz),C=hash(ix,iz+1),D=hash(ix+1,iz+1),dx=6*fx*(1-fx)*((1-v)*(B-A)+v*(D-C)),dz=6*fz*(1-fz)*((1-u)*(C-A)+u*(D-B));return{v:((1-u)*A+u*B)*(1-v)+((1-u)*C+u*D)*v,x:dx*x.x+dz*z.x,z:dx*x.z+dz*z.z};}
/** Independent scalar ideal evaluator with a direct noise gradient. All
 * arithmetic here is binary64; only authored constants and weights are f32. */
export function ideal(xv:number,zv:number):S{
 const x:S={v:xv,x:1,z:0},z:S={v:zv,x:0,z:1};let qx=m(x,c(.065)),qz=m(z,c(.065)),h=c(0),weight=f(.58);
 for(let j=0;j<4;j++){const v=s(m(n(qx,qz),c(2)),c(1)),sg=v.v<0?-1:1,r=s(c(1),{v:Math.abs(v.v),x:sg*v.x,z:sg*v.z});h=a(h,m(m(c(weight),r),r));const nx=a(m(s(m(qx,c(.8)),m(qz,c(.6))),c(2.17)),c(13.4)),nz=a(m(a(m(qx,c(.6)),m(qz,c(.8))),c(2.17)),c(13.4));qx=nx;qz=nz;weight=f(weight*f(.43));}
 const zsin=m(z,c(.045)),sn:S={v:Math.sin(zsin.v),x:Math.cos(zsin.v)*zsin.x,z:Math.cos(zsin.v)*zsin.z},coast=a(a(a(s(c(2),x),m(z,c(.2))),m(sn,c(6))),m(s(n(m(x,c(.055)),m(z,c(.055))),c(.5)),c(9)));
 const t=Math.max(0,Math.min(1,coast.v/13)),dt=coast.v>0&&coast.v<13?6*t*(1-t)/13:0,inland:S={v:t*t*(3-2*t),x:dt*coast.x,z:dt*coast.z};
 const range=a(c(.55),m(c(.45),n(a(m(x,c(.018)),c(3)),a(m(z,c(.018)),c(7))))),p=f(1.3),hp=Math.pow(h.v,p),dp=p*Math.pow(h.v,p-1),power:S={v:hp,x:dp*h.x,z:dp*h.z};return m(inland,a(c(.12),m(m(c(3.2),power),range)));
}
const contains=(lo:number,hi:number,x:number)=>x>=lo-1e-10&&x<=hi+1e-10;
export function validate(pack:Pack){
 let seed=0xc10a86d3;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 const failures:any[]=[],rects:Rect[]=[];
 for(const s of[0,.001,.25,1,16])for(const[x,z]of[[-32,-32],[-1e-7,0],[0,0],[1e-7,-1e-7],[-8,0],[-10,12],[17,-20],[32,32],[-256,77]])rects.push({x0:x-s/2,x1:x+s/2,z0:z-s/2,z1:z+s/2});
 for(let i=0;i<300;i++){const x=rand()*1024-512,z=rand()*1024-512,s=2**(-12+rand()*16);rects.push({x0:x,x1:x+s,z0:z,z1:z+s});}
 let samples=0,ledgerMaxRatio=0,gradientSamples=0;
 for(const r of rects){const g=gradientBound(r);for(let i=0;i<9;i++){const x=i<4?(i&1?r.x1:r.x0):r.x0+rand()*(r.x1-r.x0),z=i<4?(i&2?r.z1:r.z0):r.z0+rand()*(r.z1-r.z0),v=ideal(x,z),cpu=terrainHeight(x,z);samples++;gradientSamples++;
  ledgerMaxRatio=Math.max(ledgerMaxRatio,Math.abs(cpu-v.v)/g.errorKm);
  if(!contains(g.height[0],g.height[1],cpu)||!contains(g.idealHeight[0],g.idealHeight[1],v.v)||!contains(g.gx[0],g.gx[1],v.x)||!contains(g.gz[0],g.gz[1],v.z)||Math.abs(cpu-v.v)>g.errorKm+1e-10)failures.push({kind:'rectangle-ledger-gradient',r,x,z,cpu,v,g});
 }}
 const leaves=pack.nodes.filter(n=>!n.firstChild),lookup=new Lookup(pack);let metadataSamples=0;
 for(let j=0;j<Math.min(2048,leaves.length);j++){const node=lookup.get(leaves[Math.floor(rand()*leaves.length)].index),r=node.rect;for(let i=0;i<5;i++){const x=i<4?(i&1?r.x1:r.x0):(r.x0+r.x1)/2,z=i<4?(i&2?r.z1:r.z0):(r.z0+r.z1)/2,v=ideal(x,z),cpu=terrainHeight(x,z);metadataSamples++;
  if(!contains(node.height[0],node.height[1],cpu)||!contains(node.gx[0],node.gx[1],v.x)||!contains(node.gz[0],node.gz[1],v.z)||Math.abs(cpu-v.v)>node.errorKm+1e-10)failures.push({kind:'serialized-metadata',node,x,z,cpu,v});
 }}
 return{rectangleCount:rects.length,samples,gradientSamples,metadataSamples,ledgerMaxRatio,failures:failures.slice(0,30),failureCount:failures.length,finiteQualified:failures.length===0,universalHostCertificate:false};
}
