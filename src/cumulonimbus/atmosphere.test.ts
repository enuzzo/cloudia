import {describe,it,expect} from 'vitest';
import {skyRadiance,atmosphereLighting} from './atmosphere';
describe('shared atmosphere lighting',()=>{
  const sun=[-.65,.71,.22];
  it('has a blue zenith and a brighter less saturated horizon',()=>{
    const zenith=skyRadiance([0,1,0],sun,1),horizon=skyRadiance([0,.01,-1],sun,1);
    expect(zenith[2]).toBeGreaterThan(zenith[0]*1.5);
    expect(horizon.reduce((a,b)=>a+b)).toBeGreaterThan(zenith.reduce((a,b)=>a+b));
    expect(horizon[2]/horizon[0]).toBeLessThan(zenith[2]/zenith[0]);
  });
  it('follows sun azimuth and produces finite positive radiance under haze',()=>{
    const a=skyRadiance([.5,.3,.812],sun,1),b=skyRadiance([-.5,.3,.812],[.65,.71,.22],1);
    a.forEach((v,i)=>expect(v).toBeCloseTo(b[i],6));
    for(const y of [-1,0,.001,.3,1])expect(skyRadiance([Math.sqrt(1-y*y),y,0],sun,2.5).every(v=>Number.isFinite(v)&&v>=0)).toBe(true);
    expect(atmosphereLighting(sun,1).ambient[2]).toBeGreaterThan(atmosphereLighting(sun,1).ambient[0]);
  });
});
