import {afterEach,beforeAll,describe,expect,it,vi} from 'vitest';
import {createHash} from 'node:crypto';
import * as volumeModule from './volume';
import type {DensityR8Packet} from './densityR8';
import type {SupportR8Packet} from './supportR8';
import {BOUNDS_MIN,BOUNDS_SIZE,sampleCloudDensity,sampleDetail,type DetailVolume} from './volume';
import {buildNarrowCloudMask,NARROW_CLOUD_GUARD_KM,type NarrowCloudMask,type NarrowCloudVolume} from './narrowCloud';

const f=Math.fround;
const load=(mask:NarrowCloudMask,coord:readonly number[])=>{
  const p=coord.map(v=>Math.min(mask.size-1,Math.floor(f(Math.max(0,Math.min(1,f(v)))*mask.size))));
  return mask.data[(p[2]*mask.size+p[1])*mask.size+p[0]];
};
const index=(size:number,p:readonly number[])=>(p[2]*size+p[1])*size+p[0];
const hash=(bytes:Uint8Array)=>createHash('sha256').update(bytes).digest('hex');

afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();});

describe('post-flow narrow cloud mask',()=>{
  const size=256,coarse=128,sites=[[0,0,0],[255,255,255],[129,81,131],[130,82,132],[40,119,55]];
  let envelope:DetailVolume,mask:NarrowCloudMask,beforeHash:string;
  beforeAll(()=>{
    envelope={size,data:new Uint8Array(size**3*4)};
    for(const [i,p] of sites.entries())envelope.data[index(size,p)*4]=i%2?1:255;
    // Lighting without raw density must not create occupied mask texels.
    envelope.data[index(size,[200,200,200])*4+1]=255;
    envelope.data[index(size,[200,200,200])*4+2]=255;
    envelope.data[index(size,[200,200,200])*4+3]=255;
    beforeHash=hash(envelope.data);mask=buildNarrowCloudMask(envelope);
  });

  it('returns only an independent R8 array and leaves every macro channel intact',()=>{
    expect(mask.size).toBe(coarse);expect(mask.data.byteLength).toBe(coarse**3);
    expect(mask.data.buffer.byteLength).toBe(coarse**3);
    expect(mask.data.buffer).not.toBe(envelope.data.buffer);
    expect(Object.keys(mask).sort()).toEqual(['data','size']);
    expect(hash(envelope.data)).toBe(beforeHash);
    expect(load(mask,[200.5/size,200.5/size,200.5/size])).toBe(0);
  });

  it('covers exactly the clipped union of raw-positive seed cubes, including R=1 and overlap',()=>{
    const seeds=sites.map(p=>p.map(v=>Math.floor(v/2)));
    let mismatches=0,marked=0;
    for(let z=0;z<coarse;z++)for(let y=0;y<coarse;y++)for(let x=0;x<coarse;x++){
      const expected=seeds.some(p=>Math.abs(x-p[0])<=2&&Math.abs(y-p[1])<=2&&Math.abs(z-p[2])<=2);
      const actual=mask.data[(z*coarse+y)*coarse+x];
      if(actual!==(expected?255:0))mismatches++;
      if(actual)marked++;
    }
    expect(mismatches).toBe(0);
    // Two face-corner cubes 3³ each, one isolated 5³ and two overlapping 5³−4³.
    expect(marked).toBe(27+27+125+125+125-64);
    expect(NARROW_CLOUD_GUARD_KM).toBe(.001);
  });

  it('never rejects a contributing macro corner under signed fine warp and mixed ice',()=>{
    let checkedPositive=0,misses=0;
    const offsets=[-.9999,-.6,0,.6,.9999];
    for(const p of sites)for(const ice of [0,.35,1])for(const r of [0,1])for(const g of [0,1])for(const b of [0,1]){
      const warp=[(g-.5)*(.16-.08*ice),(b-.5)*(.12-.1*ice),(r-.5)*(.16-.06*ice)];
      for(const dz of offsets)for(const dy of offsets)for(const dx of offsets){
        const macro=[dx,dy,dz].map((v,a)=>(p[a]+.5+v)/size);
        const coord=macro.map((v,a)=>f(v-f(warp[a]/BOUNDS_SIZE[a])));
        const displaced=coord.map((v,a)=>f(v+f(warp[a]/BOUNDS_SIZE[a])));
        const raw=sampleDetail(envelope,displaced[0],displaced[1],displaced[2],0,false);
        if(raw>0){checkedPositive++;if(load(mask,coord)===0)misses++;}
      }
    }
    expect(checkedPositive).toBeGreaterThan(10000);expect(misses).toBe(0);
  });

  it('clamps finite outside-domain points to positive face corners without wrapping',()=>{
    for(const v of [-100,-1e-8,0,1,1+1e-8,100]){
      expect(sampleDetail(envelope,v,v,v,0,false)).toBeGreaterThan(0);
      expect(load(mask,[v,v,v])).toBe(255);
    }
  });

  it('retains a rendered liquid sample that a radius-one mask would lose',()=>{
    const p=sites[2],detail={size:1,data:new Uint8Array([0,128,255,255])};
    const warp=[(128/255-.5)*.16,.06,-.08];
    const macro=p.map(v=>(v+.5)/size);macro[2]+=1/size-.0017;
    const local=macro.map((v,a)=>BOUNDS_MIN[a]+v*BOUNDS_SIZE[a]-warp[a]);
    const coord=local.map((v,a)=>(v-BOUNDS_MIN[a])/BOUNDS_SIZE[a]);
    const loadedZ=Math.floor(f(f(coord[2])*coarse));
    expect(loadedZ-Math.floor(p[2]/2)).toBe(2);
    expect(sampleCloudDensity(envelope,detail,local[0],local[1],local[2],0)).toBeGreaterThan(.08);
    expect(load(mask,coord)).toBe(255);
  });

  it('certifies an empty production R channel even when lighting is nonzero',()=>{
    const empty={size,data:new Uint8Array(size**3*4)};
    empty.data[1]=255;empty.data[2]=255;empty.data[3]=255;
    const result=buildNarrowCloudMask(empty);
    expect(result.data.some(v=>v!==0)).toBe(false);
  });

  it.each([[4,2],[12,7],[96,128],[256,64]])('keeps unqualified macro%s/mask%s fixtures fully occupied',(fine,maskSize)=>{
    const fixture={size:fine,data:new Uint8Array(4)};
    const result=buildNarrowCloudMask(fixture,maskSize);
    expect(result.data.length).toBe(maskSize**3);
    expect(result.data.every(v=>v===255)).toBe(true);
  });

  it('falls back for a malformed production payload and rejects invalid dimensions',()=>{
    expect(buildNarrowCloudMask({size,data:new Uint8Array(4)}).data.every(v=>v===255)).toBe(true);
    for(const invalid of [0,-1,1.5,NaN])expect(()=>buildNarrowCloudMask(envelope,invalid)).toThrow(RangeError);
  });
});

describe('volume worker narrow transfer',()=>{
  it('transfers independent mask, density and support R8 buffers, preserving existing buffers/progress/errors',async()=>{
    const generated:NarrowCloudVolume&DensityR8Packet&SupportR8Packet={size:2,data:new Uint8Array(2**3*4),detail:{size:1,data:new Uint8Array([3,5,7,11])},
      sunsetLight:new Uint8Array(2**3*2),supportBounds:{min:[-1,0,-1],max:[1,2,1]}};
    const generate=vi.spyOn(volumeModule,'generateVolume').mockImplementation((_size,_seed,progress)=>{
      progress?.(.5);return generated;
    });
    const postMessage=vi.fn(),scope={onmessage:null as null|((event:MessageEvent<{size:number;seed:number}>)=>void),postMessage};
    vi.stubGlobal('self',scope);
    await import('./volume.worker');
    scope.onmessage!({data:{size:2,seed:72}} as MessageEvent<{size:number;seed:number}>);
    expect(generate).toHaveBeenCalledWith(2,72,expect.any(Function));
    expect(postMessage).toHaveBeenNthCalledWith(1,{progress:.5});
    const [packet,options]=postMessage.mock.calls[1] as [{volume:NarrowCloudVolume&DensityR8Packet&SupportR8Packet},{transfer:ArrayBuffer[]}];
    expect(packet.volume).toBe(generated);
    expect(packet.volume.narrowMask).toEqual({size:1,data:new Uint8Array([255])});
    expect([...packet.volume.detail.data]).toEqual([3,5,7,11]);
    expect(options.transfer).toEqual([generated.data.buffer,generated.detail.data.buffer,generated.sunsetLight.buffer,generated.narrowMask!.data.buffer,generated.densityR8!.data.buffer,generated.supportR8!.data.buffer]);
    expect(new Set(options.transfer).size).toBe(6);
    expect(generated.supportR8).toEqual({size:1,data:new Uint8Array([11])});
    expect(generated.supportR8!.data.buffer).not.toBe(generated.detail.data.buffer);
    expect(generated.densityR8!.data).toEqual(new Uint8Array(8));
    expect(generated.densityR8!.data.buffer).not.toBe(generated.data.buffer);
    expect(generated.narrowMask!.data.buffer.byteLength).toBe(1);
    generate.mockImplementation(()=>{throw new Error('generation failed');});
    scope.onmessage!({data:{size:2,seed:73}} as MessageEvent<{size:number;seed:number}>);
    expect(postMessage).toHaveBeenLastCalledWith({error:'generation failed'});
    expect(postMessage.mock.calls.filter(call=>call[1]!==undefined)).toHaveLength(1);
  });
});
