// @vitest-environment node
import {describe,expect,it} from 'vitest';
import {extractDensityR8,readDensityR8} from './densityR8';

describe('exact macro density R8 payload',()=>{
  it('preserves raw endpoints and weak tails independently of light channels and source edits',()=>{
    const data=new Uint8Array([0,91,2,3,1,81,4,5,255,71,6,7,17,61,8,9,83,51,10,11,128,41,12,13,254,31,14,15,7,21,16,17]);
    const before=data.slice(),source={size:2,data},result=extractDensityR8(source);
    expect([...result.data]).toEqual([0,1,255,17,83,128,254,7]);
    expect(result.size).toBe(2);expect(result.data.buffer.byteLength).toBe(8);
    expect(result.data.buffer).not.toBe(data.buffer);expect(data).toEqual(before);
    data[0]=77;expect(result.data[0]).toBe(0);result.data[1]=99;expect(data[4]).toBe(1);
  });
  it.each([0,-1,1.5,NaN,Infinity,Number.MAX_SAFE_INTEGER])('rejects invalid dimensions before allocation: %s',size=>{
    expect(()=>extractDensityR8({size,data:new Uint8Array(4)})).toThrow(RangeError);
  });
  it('rejects malformed source storage instead of silently changing the field',()=>{
    expect(()=>extractDensityR8({size:2,data:new Uint8Array(8)})).toThrow(RangeError);
    expect(()=>extractDensityR8({size:1,data:new Float32Array(4) as unknown as Uint8Array})).toThrow(TypeError);
  });
  it('accepts only a matching independent packet and returns its original array without allocation',()=>{
    const source={size:2,data:new Uint8Array(32)},densityR8=extractDensityR8(source);
    expect(readDensityR8({...source,densityR8})).toBe(densityR8);
    for(const invalid of [undefined,null,{},'r8',{size:1,data:new Uint8Array(8)},{size:2,data:new Uint8Array(7)},
      {size:2,data:new Float32Array(8)},{size:2,data:new Uint8Array(source.data.buffer,0,8)}]){
      expect(readDensityR8({...source,densityR8:invalid})).toBeNull();
    }
    expect(readDensityR8({size:0,densityR8})).toBeNull();
  });
});
