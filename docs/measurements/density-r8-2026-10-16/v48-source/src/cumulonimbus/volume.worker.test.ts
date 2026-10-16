// @vitest-environment node
import {afterEach,expect,it,vi} from 'vitest';
import * as volumeModule from './volume';
import type {NarrowCloudVolume} from './narrowCloud';
import type {DensityR8Packet} from './densityR8';
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();});

it('transfers five distinct buffers with exact density bytes and intact light/detail channels',async()=>{
  const macro=new Uint8Array([0,9,8,7,1,6,5,4,255,3,2,1,17,9,8,7,83,6,5,4,128,3,2,1,254,9,8,7,7,6,5,4]);
  const before=macro.slice();
  const generated:NarrowCloudVolume&DensityR8Packet={size:2,data:macro,sunsetLight:new Uint8Array(16).fill(33),
    detail:{size:1,data:new Uint8Array([3,5,7,11])},supportBounds:{min:[-1,0,-1],max:[1,2,1]}};
  vi.spyOn(volumeModule,'generateVolume').mockImplementation((_size,_seed,progress)=>{progress?.(.5);return generated;});
  let received:(NarrowCloudVolume&DensityR8Packet)|undefined;
  let transferred:ArrayBuffer[]=[];
  const progress:number[]=[];
  const scope={onmessage:null as null|((event:MessageEvent<{size:number;seed:number}>)=>void),
    postMessage:(packet:{volume?:NarrowCloudVolume&DensityR8Packet;progress?:number},options?:{transfer:ArrayBuffer[]})=>{
      if(packet.progress!==undefined)progress.push(packet.progress);
      if(options){transferred=[...options.transfer];received=structuredClone(packet,{transfer:options.transfer}).volume;}
    }};
  vi.stubGlobal('self',scope);await import('./volume.worker');
  scope.onmessage!({data:{size:2,seed:72}} as MessageEvent<{size:number;seed:number}>);
  expect(progress).toEqual([.5]);expect(new Set(transferred).size).toBe(5);
  expect(transferred.every(buffer=>buffer.byteLength===0)).toBe(true);
  expect(generated.data.byteLength).toBe(0);expect(generated.densityR8!.data.byteLength).toBe(0);
  expect(received!.data).toEqual(before);expect([...received!.densityR8!.data]).toEqual([0,1,255,17,83,128,254,7]);
  expect(received!.densityR8!.data.buffer).not.toBe(received!.data.buffer);
  expect([...received!.detail.data]).toEqual([3,5,7,11]);
  expect(received!.sunsetLight.every(value=>value===33)).toBe(true);
  expect([...received!.narrowMask!.data]).toEqual([255]);
});
