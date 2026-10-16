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
// These are the exact raster-backdrop replacement and the exact v50 block
// from cycle18/baseline-source/src/cumulonimbus/cloudShader.ts. Restore only
// that block and binding before reversing the two aerial expressions: the
// existing hashes still certify every other march/source/R8/narrow byte.
const rasterBackdrop=`  var groundDistance=10000.0;
  // The depth-tested terrain pass supplies the first visible triangle, including
  // relief above the sea horizon. Its RGB is linear radiance without aerial/film.
  if(ground>0.001){
    let terrainSize=vec2<i32>(textureDimensions(terrainRaster,0));
    let terrainPixel=clamp(vec2<i32>(floor(uv*vec2<f32>(terrainSize))),vec2<i32>(0),terrainSize-vec2<i32>(1));
    let terrainHit=textureLoad(terrainRaster,terrainPixel,0);
    if(terrainHit.a>0.0){
      groundDistance=terrainHit.a;
      let terrainBackdrop=mix(sky,terrainHit.rgb,aerialTransmittance(groundDistance,weather.x));
      backdrop=mix(sky,terrainBackdrop,ground);
    }
  }
`;
const v50Backdrop=`  var groundDistance=earthDistance(origin,ray);
  // Overcast changes atmospheric light; it must not dissolve the land itself.
  let groundAmount=ground;
  if(groundDistance>0.0 && groundAmount>0.001){
    groundDistance=landscapeDistance(origin,ray,groundDistance);
    backdrop=mix(sky,landscapeColor(origin+ray*groundDistance,groundDistance,sun,solarColor,ambientColor,sky,weather.x),groundAmount);
  }else{groundDistance=10000.0;}
`;
const beforeTerrainRaster=(code:string)=>{
  const binding='ground:f32, terrainRaster:texture_2d<f32>,';
  expect(code.split(binding)).toHaveLength(2);
  expect(code.split(rasterBackdrop)).toHaveLength(2);
  return code.replace(binding,'ground:f32,').replace(rasterBackdrop,v50Backdrop);
};
const beforeAerialTrial=(code:string)=>code
  .replace('rainSource=mix(sky,rainLight,aerialTransmittance(t,weather.x));','rainSource=mix(sky,rainLight,exp(-weather.x*.0035*t));')
  .replace('let aerial=aerialTransmittance(t,weather.x);','let aerial=exp(-weather.x*0.0035*t);');
afterEach(()=>{vi.clearAllMocks();});

describe('weather-specialized cloud integrator',()=>{
  it('preserves every dry-march byte outside the terrain replacement and two aerial expressions',()=>{
    const code=source();
    expect(sha(beforeAerialTrial(beforeTerrainRaster(code)))).toBe('d38fe3918e5cf95e2f13a1f6ca9a111a20045b2497600b89118cb7a8200bcb8c');
    expect(beforeTerrainRaster(code)).not.toMatch(/narrowCloud|narrowSupport|narrowDimensions|textureLoad/);
  });
  it('preserves the rainy point certificate around the two aerial changes',()=>{
    const code=source(0,true);
    expect(sha(beforeAerialTrial(beforeTerrainRaster(code)))).toBe('6d30dc1d1ab7bc99513c451f4fcbdee81c402fe90220d565bb3a6df52c5cb655');
    expect(code.indexOf('let local=reference-flowValue.rgb')).toBeLessThan(code.indexOf('var narrowSupport'));
    expect(code.indexOf('var narrowSupport')).toBeLessThan(code.indexOf('var fine='));
  });
  it('loads the first terrain triangle without a sea-sphere gate or analytic solver',()=>{
    for(const narrow of [false,true])for(const r8 of [false,true]){
      const code=source(0,narrow,r8);
      expect(code).toContain('terrainRaster:texture_2d<f32>');
      expect(code.match(/textureLoad\(terrainRaster,/g)).toHaveLength(1);
      expect(code.match(/textureLoad\(/g)).toHaveLength(narrow?2:1);
      expect(code).toContain('let terrainHit=textureLoad(terrainRaster,terrainPixel,0);');
      expect(code).toContain('if(ground>0.001)');
      expect(code).toContain('if(terrainHit.a>0.0)');
      expect(code).toContain('groundDistance=terrainHit.a;');
      expect(code).toContain('var groundDistance=10000.0;');
      expect(code).not.toMatch(/\b(?:earthDistance|landscapeDistance|landscapeColor)\s*\(/);
      expect(code).not.toMatch(/textureSample(?:Level)?\(terrainRaster/);
      expect(code.match(/aerialTransmittance\(groundDistance,weather\.x\)/g)).toHaveLength(1);
    }
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
      expect(code.match(/aerialTransmittance\(groundDistance,weather\.x\)/g)).toHaveLength(1);
    }
  });
});
