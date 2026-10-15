import {describe,it,expect} from 'vitest';
import {precipitationMaxBaseReference,RAIN_MAP_SIZE} from './precipitation';

const mapOf=(size:number)=>new Uint8Array(size*size*2);
const set=(map:Uint8Array,size:number,x:number,z:number,r:number,g:number)=>{
 map[(z*size+x)*2]=r;map[(z*size+x)*2+1]=g;
};
const decode=(g:number)=>g/255*3-.5;
/** Independent normalized, texel-centred bilinear reference with edge clamp. */
function sampleRG(map:Uint8Array,size:number,u:number,v:number):[number,number]{
 const px=u*size-.5,pz=v*size-.5,x=Math.floor(px),z=Math.floor(pz),tx=px-x,tz=pz-z;
 const fetch=(xx:number,zz:number,c:number)=>map[(Math.max(0,Math.min(size-1,zz))*size+Math.max(0,Math.min(size-1,xx)))*2+c]/255;
 const mix=(a:number,b:number,t:number)=>a+(b-a)*t;
 return [0,1].map(c=>mix(mix(fetch(x,z,c),fetch(x+1,z,c),tx),mix(fetch(x,z+1,c),fetch(x+1,z+1,c),tx),tz)) as [number,number];
}

describe('rain base bound from independently filtered RG8',()=>{
 it('ignores height-only padding when every encoded source R is zero',()=>{
  const map=mapOf(RAIN_MAP_SIZE);
  for(let i=1;i<map.length;i+=2)map[i]=255;
  expect(precipitationMaxBaseReference(map)).toBeNull();
  map[0]=Math.round(.49); // Positive pre-quantization strength still encodes R=0.
  expect(precipitationMaxBaseReference(map)).toBeNull();
 });
 it('includes high-G transparent neighbours of a one-code source',()=>{
  const size=6,map=mapOf(size);
  set(map,size,1,1,1,0);set(map,size,2,1,0,255);
  const [r,g]=sampleRG(map,size,2.4/size,1.5/size);
  expect(r).toBeGreaterThan(0);expect(g).toBeGreaterThan(.89);
  expect(precipitationMaxBaseReference(map,size)).toBe(2.5);
  // A bound using only G where R>0 would be -.5 and would lose this source.
  expect(decode(g*255)).toBeGreaterThan(-.5);
 });
 it('includes diagonal neighbours at all corners and preserves edge-clamp samples',()=>{
  const size=5;
  for(const [x,z] of [[0,0],[size-1,0],[0,size-1],[size-1,size-1]]){
   const map=mapOf(size),dx=x===0?1:-1,dz=z===0?1:-1;
   set(map,size,x,z,1,0);set(map,size,x+dx,z+dz,0,255);
   expect(precipitationMaxBaseReference(map,size)).toBe(2.5);
   for(const fraction of [0,.1,.5,.99]){
    const [r,g]=sampleRG(map,size,(x+.5+dx*fraction)/size,(z+.5+dz*fraction)/size);
    expect(r).toBeGreaterThan(0);expect(decode(g*255)).toBeLessThanOrEqual(2.5);
   }
   const [edgeR]=sampleRG(map,size,x===0?0:1,z===0?0:1);
   expect(edgeR).toBe(1/255);
  }
 });
 it('excludes an unrelated 2.5km sentinel beyond the complete bilinear footprint',()=>{
  const size=8,map=mapOf(size);
  set(map,size,4,4,255,64);set(map,size,0,0,0,255);
  expect(precipitationMaxBaseReference(map,size)).toBe(decode(64));
 });
 it('reads actual rounded bytes and leaves the uploaded map untouched',()=>{
  const size=8,map=mapOf(size),rawBase=1.103,encoded=Math.round((rawBase+.5)/3*255);
  set(map,size,3,3,1,encoded);const before=map.slice();
  expect(encoded).toBe(136);
  expect(precipitationMaxBaseReference(map,size)).toBe(decode(136));
  expect(precipitationMaxBaseReference(map,size)).not.toBe(rawBase);
  expect(map).toEqual(before);
 });
 it('distinguishes a positive R source at the lowest encoded height from no source',()=>{
  const map=mapOf(1);set(map,1,0,0,1,0);
  expect(precipitationMaxBaseReference(map,1)).toBe(-.5);
  set(map,1,0,0,0,255);expect(precipitationMaxBaseReference(map,1)).toBeNull();
 });
 it('bounds all positive independent bilinear samples on an oblique map scan',()=>{
  const size=9,map=mapOf(size);
  for(let z=0;z<size;z++)for(let x=0;x<size;x++)set(map,size,x,z,0,(37*x+61*z)%256);
  set(map,size,3,5,1,7);set(map,size,6,2,173,21);
  const bound=precipitationMaxBaseReference(map,size)!;let positive=0;
  for(let k=0;k<=997;k++){
   const u=k/997,v=((k*67)%998)/997,[r,g]=sampleRG(map,size,u,v);
   if(r<=0)continue;positive++;
   expect(decode(g*255)).toBeLessThanOrEqual(bound+1e-12);
  }
  expect(positive).toBeGreaterThan(20);
 });
});
