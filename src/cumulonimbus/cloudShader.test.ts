import {afterEach,describe,expect,it,vi} from 'vitest';
import {createHash} from 'node:crypto';
vi.mock('three/tsl',async(importOriginal)=>{
  const actual=await importOriginal<typeof import('three/tsl')>();
  return {...actual,wgslFn:vi.fn(actual.wgslFn)};
});
import {wgslFn} from 'three/tsl';
import {createCloudIntegrator} from './cloudShader';
import {LANDSCAPE_WGSL} from './landscape';
import {AERIAL_WGSL} from './aerial';
const source=(mode=0,useNarrow=false,useDensityR8=false)=>{
  createCloudIntegrator(mode,useNarrow,useDensityR8);
  const code=vi.mocked(wgslFn).mock.calls.at(-1)?.[0];
  if(typeof code!=='string')throw new Error('Expected the WGSL integrator source.');
  return code;
};
const sha=(code:string)=>createHash('sha256').update(code).digest('hex');
// Reversing only the two authored aerial changes must recover every byte of
// the qualified template, including its march, sources, bindings and R8 path.
const beforeAerialTrial=(code:string)=>code
  .replace('rainSource=mix(sky,rainLight,aerialTransmittance(t,weather.x));','rainSource=mix(sky,rainLight,exp(-weather.x*.0035*t));')
  .replace('let aerial=aerialTransmittance(t,weather.x);','let aerial=exp(-weather.x*0.0035*t);');
afterEach(()=>{vi.clearAllMocks();});

describe('weather-specialized cloud integrator',()=>{
  it('limits the dry optical trial to the two aerial expressions in the qualified template',()=>{
    const code=source();
    expect(sha(beforeAerialTrial(code))).toBe('d38fe3918e5cf95e2f13a1f6ca9a111a20045b2497600b89118cb7a8200bcb8c');
    expect(code).not.toMatch(/narrowCloud|narrowSupport|narrowDimensions|textureLoad/);
  });
  it('preserves the rainy point certificate around the two aerial changes',()=>{
    const code=source(0,true);
    expect(sha(beforeAerialTrial(code))).toBe('6d30dc1d1ab7bc99513c451f4fcbdee81c402fe90220d565bb3a6df52c5cb655');
    expect(code.indexOf('let local=reference-flowValue.rgb')).toBeLessThan(code.indexOf('var narrowSupport'));
    expect(code.indexOf('var narrowSupport')).toBeLessThan(code.indexOf('var fine='));
  });
  it('specializes diagnostics independently and preserves the dry default for invalid modes',()=>{
    for(const narrow of [false,true])for(let mode=0;mode<=5;mode++){
      const code=source(mode,narrow);
      expect(code).not.toContain('probeMode');
      expect(code).toContain(`if(${mode}.0!=3.0)`);
      expect(code).toContain(`if(${mode}.0!=4.0)`);
      expect(code.includes('narrowCloud')).toBe(narrow);
    }
    expect(source(-1)).toBe(source());expect(source(6)).toBe(source());
  });
  it('changes only the warped-density texture in every R8 weather/diagnostic specialization',()=>{
    for(const narrow of [false,true])for(let mode=0;mode<=5;mode++){
      const candidate=source(mode,narrow,true);
      expect(candidate).toContain('let voxel = textureSampleLevel(volume,volumeSampler,coord,0.0);');
      const restored=candidate
        .replace('volumeSampler: sampler, densityR8: texture_3d<f32>,','volumeSampler: sampler,')
        .replace('textureSampleLevel(densityR8,volumeSampler,coord+warp/vec3<f32>(10.0,8.5,7.0),0.0).r',
          'textureSampleLevel(volume,volumeSampler,coord+warp/vec3<f32>(10.0,8.5,7.0),0.0).r');
      expect(restored).toBe(source(mode,narrow));
      expect(candidate).not.toBe(restored);
    }
  });
  it('registers the shared aerial definition exactly once through the standalone landscape library',()=>{
    for(const narrow of [false,true])for(const r8 of [false,true]){
      const code=source(0,narrow,r8);
      const includes=vi.mocked(wgslFn).mock.calls.at(-1)?.[1]??[];
      const declarations=includes.map(node=>Reflect.get(node,'code') as string);
      expect(declarations.filter(value=>value===LANDSCAPE_WGSL)).toHaveLength(1);
      expect(declarations.join('\n').match(/fn aerialTransmittance\(/g)).toHaveLength(1);
      expect(LANDSCAPE_WGSL).toContain(AERIAL_WGSL);
      expect(LANDSCAPE_WGSL).toContain('let transmission=aerialTransmittance(distance,haze);');
      expect(code.match(/aerialTransmittance\(t,weather\.x\)/g)).toHaveLength(2);
    }
  });
});
