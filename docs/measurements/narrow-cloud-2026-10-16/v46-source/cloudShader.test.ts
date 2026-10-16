import {afterEach,describe,expect,it,vi} from 'vitest';
import {createHash} from 'node:crypto';
vi.mock('three/tsl',async(importOriginal)=>{
  const actual=await importOriginal<typeof import('three/tsl')>();
  return {...actual,wgslFn:vi.fn(actual.wgslFn)};
});
import {wgslFn} from 'three/tsl';
import {createCloudIntegrator} from './cloudShader';
const source=(mode=0,useNarrow=false)=>{
  createCloudIntegrator(mode,useNarrow);
  const code=vi.mocked(wgslFn).mock.calls.at(-1)?.[0];
  if(typeof code!=='string')throw new Error('Expected the WGSL integrator source.');
  return code;
};
const sha=(code:string)=>createHash('sha256').update(code).digest('hex');
afterEach(()=>{vi.clearAllMocks();});

describe('weather-specialized cloud integrator',()=>{
  it('keeps the complete dry WGSL byte-identical to the original production template',()=>{
    // Pin the pre-trial code, including its signature, march and original rain path.
    const code=source();
    expect(sha(code)).toBe('d38fe3918e5cf95e2f13a1f6ca9a111a20045b2497600b89118cb7a8200bcb8c');
    expect(code).not.toMatch(/narrowCloud|narrowSupport|narrowDimensions|textureLoad/);
  });
  it('keeps the rainy WGSL identical to the qualified uniform-gated point certificate',()=>{
    const code=source(0,true);
    expect(sha(code)).toBe('6d30dc1d1ab7bc99513c451f4fcbdee81c402fe90220d565bb3a6df52c5cb655');
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
});
