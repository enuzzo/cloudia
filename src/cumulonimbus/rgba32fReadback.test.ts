import {describe,it,expect} from 'vitest';
import {packRGBA32FReadback,RGBA32F_READBACK_MAX_PACKED_BYTES} from './rgba32fReadback';

describe('pinned Three186 RGBA32F readback byte compaction',()=>{
 it('drops only inter-row padding and preserves row order plus every payload bit from an offset view',()=>{
  const width=3,height=3,rowBytes=48,stride=256,length=(height-1)*stride+rowBytes;
  const storage=new ArrayBuffer(length+24),bytes=new Uint8Array(storage,12,length);bytes.fill(0xa5);
  const payloads=[0x00000000,0x80000000,0x7fc01234,0x7fa54321,0xffc05678,0x7f800000,0xff800000,0x3f800000,0x00800000,0x00000001,0xffffffff,0x12345678];
  const expected=new Uint8Array(rowBytes*height),expectedView=new DataView(expected.buffer),sourceView=new DataView(storage,12,length);
  for(let row=0;row<height;row++)for(let word=0;word<width*4;word++){
   const bits=(payloads[word]+row)>>>0;
   sourceView.setUint32(row*stride+word*4,bits,true);expectedView.setUint32(row*rowBytes+word*4,bits,true);
  }
  const before=bytes.slice(),input=new Float32Array(storage,12,length/4),packed=packRGBA32FReadback(input,width,height);
  expect(packed).toEqual(expected);expect(packed.byteLength).toBe(144);expect(packed.byteOffset).toBe(0);
  expect(packed.buffer).toBeInstanceOf(ArrayBuffer);expect(packed.buffer).not.toBe(storage);expect(bytes).toEqual(before);
  packed[0]^=0xff;expect(bytes).toEqual(before);
 });
 it('accepts a single unpadded row and an exactly aligned multi-row payload without aliasing',()=>{
  const one=new Float32Array(new Uint32Array([0x7fc01234,0x80000000,0x3f800000,0x00000001]).buffer);
  const packedOne=packRGBA32FReadback(one,1,1);
  expect(packedOne).toEqual(new Uint8Array(one.buffer));expect(packedOne.buffer).not.toBe(one.buffer);
  const aligned=new Float32Array(16*4*2),raw=new Uint8Array(aligned.buffer);
  for(let i=0;i<raw.length;i++)raw[i]=i%251;
  expect(packRGBA32FReadback(aligned,16,2)).toEqual(raw);
 });
 it('rejects wrong array types, missing padding and padded final rows before allocating output',()=>{
  expect(()=>packRGBA32FReadback(new Uint8Array(16) as unknown as Float32Array,1,1)).toThrow(TypeError);
  expect(()=>packRGBA32FReadback(new Float64Array(4) as unknown as Float32Array,1,1)).toThrow(TypeError);
  expect(()=>packRGBA32FReadback(new Float32Array(8),1,2)).toThrow(/row layout/);
  expect(()=>packRGBA32FReadback(new Float32Array(128),1,2)).toThrow(/row layout/);
  expect(()=>packRGBA32FReadback(new Float32Array(68),1,2)).not.toThrow();
 });
 it('fails closed on noninteger/oversized dimensions and the96MiB packed cap without large fixtures',()=>{
  const empty=new Float32Array(0);
  for(const [width,height] of [[0,1],[-1,1],[1.5,1],[1,NaN],[Infinity,1],[8193,1],[1,8193]])
   expect(()=>packRGBA32FReadback(empty,width,height)).toThrow(/dimensions/);
  expect(RGBA32F_READBACK_MAX_PACKED_BYTES).toBe(100663296);
  expect(()=>packRGBA32FReadback(empty,8192,8192)).toThrow(/96MiB/);
 });
});
