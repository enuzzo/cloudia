import {describe,expect,it} from 'vitest';
import {TERRAIN_NAVIGATION_DIAGNOSTIC,terrainNavigationYaw} from './terrainNavigationDiagnostic';

describe('fixed terrain navigation diagnostic',()=>{
 it('freezes the two-second warmup and thirty-second three-cycle path specification',()=>{
  expect(TERRAIN_NAVIGATION_DIAGNOSTIC).toEqual({
   id:'terrain-yaw-sine-three-cycles-v1',warmupMs:2000,measuredDurationMs:30000,cycleMs:10000,cycles:3,
   amplitudeRadians:.16,elapsedOrigin:'measured-start-after-warmup',axis:'camera-yaw-offset-radians',outsideWindowYawRadians:0,
  });
  expect(Object.isFrozen(TERRAIN_NAVIGATION_DIAGNOSTIC)).toBe(true);
 });

 it('keeps the complete warmup and times outside the measurement at exact positive zero',()=>{
  for(const time of [-Number.MAX_VALUE,-2001,-2000,-1999,-1000,-1,-Number.MIN_VALUE,-0,0,30000,30001,Number.MAX_VALUE]){
   expect(Object.is(terrainNavigationYaw(time),0)).toBe(true);
  }
 });

 it('visits the analytic quarter-period extrema in three complete cycles',()=>{
  for(const cycle of [0,10000,20000]){
   expect(terrainNavigationYaw(cycle+2500)).toBeCloseTo(.16,14);
   expect(terrainNavigationYaw(cycle+7500)).toBeCloseTo(-.16,14);
   expect(terrainNavigationYaw(cycle+1250)).toBeCloseTo(.16/Math.SQRT2,14);
   expect(terrainNavigationYaw(cycle+3750)).toBeCloseTo(.16/Math.SQRT2,14);
   expect(terrainNavigationYaw(cycle+6250)).toBeCloseTo(-.16/Math.SQRT2,14);
   expect(terrainNavigationYaw(cycle+8750)).toBeCloseTo(-.16/Math.SQRT2,14);
  }
  for(const time of [5000,10000,15000,20000,25000])expect(terrainNavigationYaw(time)).toBeCloseTo(0,14);
  expect(Object.is(terrainNavigationYaw(30000),0)).toBe(true);
 });

 it('is periodic, half-period antisymmetric, bounded and deterministic over a fixed clock sweep',()=>{
  for(let index=1;index<=199;index++){
   const time=index*25.125,value=terrainNavigationYaw(time);
   expect(terrainNavigationYaw(time+10000)).toBeCloseTo(value,14);
   expect(terrainNavigationYaw(time+20000)).toBeCloseTo(value,14);
   expect(terrainNavigationYaw(time+5000)).toBeCloseTo(-value,14);
   expect(terrainNavigationYaw(10000-time)).toBeCloseTo(-value,14);
   expect(Object.is(terrainNavigationYaw(time),value)).toBe(true);
  }
  let positive=0,negative=0;
  for(let time=0;time<=30000;time+=10){
   const value=terrainNavigationYaw(time);expect(Number.isFinite(value)).toBe(true);expect(Math.abs(value)).toBeLessThanOrEqual(.16);
   positive=Math.max(positive,value);negative=Math.min(negative,value);
  }
  expect(positive).toBeCloseTo(.16,14);expect(negative).toBeCloseTo(-.16,14);
 });

 it.each([NaN,Infinity,-Infinity])('rejects nonfinite elapsed time %s',time=>{
  expect(()=>terrainNavigationYaw(time)).toThrow(RangeError);
 });
});
