// @vitest-environment node
import {describe,expect,it} from 'vitest';
import {extractSupportR8,readSupportR8} from './supportR8';

describe('exact broad-support R8 payload',()=>{
  it('copies alpha endpoints and weak values independently of RGB, without mutating or aliasing',()=>{
    const detail={size:2,data:new Uint8Array([91,2,3,0,81,4,5,1,71,6,7,255,61,8,9,17,51,10,11,83,41,12,13,128,31,14,15,254,21,16,17,7])};
    const before=detail.data.slice(),result=extractSupportR8(detail);
    expect(result.size).toBe(2);expect([...result.data]).toEqual([0,1,255,17,83,128,254,7]);
    expect(result.data.buffer.byteLength).toBe(8);expect(result.data.buffer).not.toBe(detail.data.buffer);expect(detail.data).toEqual(before);
    detail.data[3]=99;expect(result.data[0]).toBe(0);result.data[1]=33;expect(detail.data[7]).toBe(1);
  });
  it('respects an offset source view and ignores bytes outside the RGBA payload',()=>{
    const backing=new Uint8Array(12).fill(77),view=new Uint8Array(backing.buffer,4,4);view.set([19,23,29,31]);
    const result=extractSupportR8({size:1,data:view});
    expect([...result.data]).toEqual([31]);expect([...backing]).toEqual([77,77,77,77,19,23,29,31,77,77,77,77]);
  });
  it.each([0,-1,1.5,NaN,Infinity,Number.MAX_SAFE_INTEGER])('rejects invalid dimensions before allocation: %s',size=>{
    expect(()=>extractSupportR8({size,data:new Uint8Array(4)})).toThrow(RangeError);
  });
  it('rejects malformed source storage instead of accepting an incomplete occupancy field',()=>{
    expect(()=>extractSupportR8({size:2,data:new Uint8Array(31)})).toThrow(RangeError);
    expect(()=>extractSupportR8({size:1,data:new Float32Array(4) as unknown as Uint8Array})).toThrow(TypeError);
  });
  it('accepts the matching independent packet by identity without allocating another copy',()=>{
    const detail={size:2,data:new Uint8Array(32)},supportR8=extractSupportR8(detail);
    expect(readSupportR8({detail,supportR8})).toBe(supportR8);
    const backing=new Uint8Array(12),offset={size:2,data:new Uint8Array(backing.buffer,2,8)};
    expect(readSupportR8({detail,supportR8:offset})).toBe(offset);
  });
  it('falls back for absent, mismatched, malformed or aliased packets and malformed detail',()=>{
    const detail={size:2,data:new Uint8Array(32)};
    for(const supportR8 of [undefined,null,{},'r8',{size:1,data:new Uint8Array(8)},{size:2,data:new Uint8Array(7)},
      {size:2,data:new Float32Array(8)},{size:2,data:new Uint8Array(detail.data.buffer,0,8)}]){
      expect(readSupportR8({detail,supportR8})).toBeNull();
    }
    const valid={size:2,data:new Uint8Array(8)};
    expect(readSupportR8({detail:{size:0,data:new Uint8Array(0)},supportR8:valid})).toBeNull();
    expect(readSupportR8({detail:{size:2,data:new Uint8Array(31)},supportR8:valid})).toBeNull();
    expect(readSupportR8({detail:{size:2,data:new Float32Array(32) as unknown as Uint8Array},supportR8:valid})).toBeNull();
  });
});
