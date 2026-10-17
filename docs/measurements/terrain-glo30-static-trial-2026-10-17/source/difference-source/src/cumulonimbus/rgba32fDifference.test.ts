import {describe,expect,it} from 'vitest';
import {comparePackedRGBA32F,RGBA32F_DIFFERENCE_LIMITS} from './rgba32fDifference';
const little=new Uint8Array(new Uint32Array([0x01020304]).buffer)[0]===4;
function packed(values:number[],byteOffset=0):Uint8Array{
 const buffer=new ArrayBuffer(values.length*4+byteOffset+7),bytes=new Uint8Array(buffer,byteOffset,values.length*4),view=new DataView(buffer,byteOffset,bytes.byteLength);
 values.forEach((v,i)=>view.setFloat32(i*4,v,little));return bytes;
}
function bits(values:number[]):Uint8Array{
 const bytes=new Uint8Array(values.length*4),view=new DataView(bytes.buffer);values.forEach((v,i)=>view.setUint32(i*4,v,little));return bytes;
}
describe('packed native RGBA32F difference',()=>{
 it('distinguishes pixel/word/RGB/alpha counts, finite deltas and the smallest changed rectangle',()=>{
  const a=packed([1,2,3,4, 5,6,7,8, 9,10,11,12, 13,14,15,16]);
  const b=packed([1,2,3,4, 5,8,7,8, 9,10,11,12, 12,14,15,19]);
  const r=comparePackedRGBA32F(a,b,2,2);
  expect(r).toMatchObject({changedWords:3,changedPixels:2,changedRgbWords:2,changedRgbPixels:2,changedAlphaWords:1,changedAlphaPixels:1,
   changedWordsByChannel:[1,1,0,1],boundingRect:{x:1,y:0,width:1,height:2},finiteComparableWords:16,maxFiniteAbsDelta:3,maxFiniteAbsDeltaByChannel:[1,2,0,3]});
  expect(r.firstDifferences.map(p=>[p.x,p.y,p.channelMask])).toEqual([[1,0,2],[1,1,9]]);
  expect(r.firstDifferences[1]!.before.values).toEqual([13,14,15,16]);expect(r.firstDifferences[1]!.after.values).toEqual([12,14,15,19]);
 });
 it('has no differences for identical bits, including a shared input, and ignores backing padding/unaligned offsets',()=>{
  const a=packed([.5,2,3,4],1),b=packed([.5,2,3,4],3),savedA=Array.from(new Uint8Array(a.buffer)),savedB=Array.from(new Uint8Array(b.buffer));
  new Uint8Array(a.buffer)[0]=222;new Uint8Array(b.buffer)[0]=111;savedA[0]=222;savedB[0]=111;
  const r=comparePackedRGBA32F(a,b,1,1);
  expect(r).toMatchObject({changedWords:0,changedPixels:0,boundingRect:null,maxFiniteAbsDelta:0,firstDifferences:[]});
  expect(comparePackedRGBA32F(a,a,1,1).changedWords).toBe(0);
  expect(Array.from(new Uint8Array(a.buffer))).toEqual(savedA);expect(Array.from(new Uint8Array(b.buffer))).toEqual(savedB);
 });
 it('retains NaN payload bits, infinity signs and signed zero without pretending they are finite deltas',()=>{
  const a=bits([0x7fc00001,0x7f800000,0x00000000,0x3f800000]);
  const b=bits([0x7fc00002,0xff800000,0x80000000,0x7f800000]);
  const r=comparePackedRGBA32F(a,b,1,1);
  expect(r).toMatchObject({changedWords:4,changedPixels:1,changedRgbWords:3,changedAlphaWords:1,signedZeroChangedWords:1,
   finiteComparableWords:1,maxFiniteAbsDelta:0,maxFiniteAbsDeltaByChannel:[null,null,0,null],
   beforeNonFinite:{nanWords:1,positiveInfinityWords:1,negativeInfinityWords:0},afterNonFinite:{nanWords:1,positiveInfinityWords:1,negativeInfinityWords:1},
   nonFinitePairs:{eitherNonFiniteWords:3,bothNonFiniteWords:2,finiteToNonFiniteWords:1,nonFiniteToFiniteWords:0,changedWordsWithNonFinite:3,bothNaNChangedBits:1}});
  expect(r.firstDifferences[0]!.before.bits).toEqual([0x7fc00001,0x7f800000,0,0x3f800000]);
  expect(r.firstDifferences[0]!.after.values).toEqual(['NaN','-Infinity','-0','+Infinity']);
  expect(JSON.parse(JSON.stringify(r)).firstDifferences[0].after.values).toEqual(['NaN','-Infinity','-0','+Infinity']);
 });
 it('counts unchanged nonfinite words and reports null extrema if no finite pair exists',()=>{
  const a=bits([0x7fc00001,0x7f800000,0xff800000,0x7fa00002]);
  const r=comparePackedRGBA32F(a,a,1,1);
  expect(r).toMatchObject({changedWords:0,maxFiniteAbsDelta:null,maxFiniteAbsDeltaByChannel:[null,null,null,null],finiteComparableWords:0,
   beforeNonFinite:{nanWords:2,positiveInfinityWords:1,negativeInfinityWords:1},nonFinitePairs:{eitherNonFiniteWords:4,bothNonFiniteWords:4,changedWordsWithNonFinite:0}});
  const back=comparePackedRGBA32F(a,packed([1,2,3,4]),1,1);expect(back.nonFinitePairs.nonFiniteToFiniteWords).toBe(4);expect(back.maxFiniteAbsDelta).toBeNull();
 });
 it('limits examples to the first24 changed pixels in top-to-bottom row-major order',()=>{
  const a=packed(Array(120).fill(0)),b=packed(Array(120).fill(1));const r=comparePackedRGBA32F(a,b,3,10);
  expect(r.changedWords).toBe(120);expect(r.changedPixels).toBe(30);expect(r.firstDifferences).toHaveLength(24);
  expect(r.firstDifferences[23]).toMatchObject({x:2,y:7,channelMask:15});expect(r.boundingRect).toEqual({x:0,y:0,width:3,height:10});
 });
 it('keeps the difference of extreme finiteFloat32 values finite in the JS summary',()=>{
  const a=bits([0x7f7fffff,0,0,0]),b=bits([0xff7fffff,0,0,0]);const r=comparePackedRGBA32F(a,b,1,1);
  expect(Number.isFinite(r.maxFiniteAbsDelta)).toBe(true);expect(r.maxFiniteAbsDelta).toBeGreaterThan(6e38);
 });
 it('rejects invalid dimensions, length, input kinds and excess payload before scanning',()=>{
  const a=packed([0,0,0,0]);
  for(const dims of [[0,1],[1,-1],[1.5,1],[8193,1],[NaN,1],[1,Infinity]] as const)expect(()=>comparePackedRGBA32F(a,a,dims[0],dims[1])).toThrow(/dimensions/);
  expect(()=>comparePackedRGBA32F(a,a,8192,769)).toThrow(/96MiB/);
  expect(()=>comparePackedRGBA32F(a,a.subarray(1),1,1)).toThrow(/exact packed/);
  expect(()=>comparePackedRGBA32F(a,new Float32Array(4) as unknown as Uint8Array,1,1)).toThrow(/exact packed/);
  expect(RGBA32F_DIFFERENCE_LIMITS.maxPackedBytes).toBe(100663296);
 });
});
