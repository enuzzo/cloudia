import {describe,it,expect} from 'vitest';
import {skyRadiance,atmosphereLighting,overcastRadiance} from './atmosphere';
describe('shared atmosphere lighting',()=>{
  it('makes the requested overcast sky and ambient neutral instead of dimming blue',()=>{
    const sky=overcastRadiance([.02,.1,.3],.3),ambient=atmosphereLighting([-.65,.71,.22],1.8,1).ambient;
    expect(Math.max(...sky)/Math.min(...sky)).toBeLessThan(1.15);
    expect(Math.max(...ambient)/Math.min(...ambient)).toBeLessThan(1.15);
    expect(Math.min(...sky)).toBeGreaterThan(.08);
  });
  it('keeps solar radiance finite and redder at low elevation',()=>{
    const low=atmosphereLighting([-.75,.025,.24],1.6).solar,high=atmosphereLighting([-.75,.8,.24],1.6).solar;
    expect(low.every(v=>Number.isFinite(v)&&v>=0)).toBe(true);
    expect(low[0]/low[2]).toBeGreaterThan(high[0]/high[2]);
  });
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
