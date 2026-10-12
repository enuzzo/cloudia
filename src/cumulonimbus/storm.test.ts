import {describe,it,expect} from 'vitest';
import {createFlash,flashIntensity,thunderPlan,generateThunder} from './storm';
describe('storm timing and sound',()=>{
  it('has discrete irregular strokes and no light outside the flash',()=>{
    const f=createFlash(17,3,10);
    expect(f).toEqual(createFlash(17,3,10));
    expect(f.pulses.length).toBeGreaterThanOrEqual(2);
    expect(flashIntensity(f,9.99)).toBe(0);
    expect(flashIntensity(f,12)).toBe(0);
    expect(Math.max(...Array.from({length:100},(_,i)=>flashIntensity(f,10+i*.01)))).toBeGreaterThan(.6);
    expect(f.pulses[1].at-f.pulses[0].at).not.toEqual(f.pulses[2]?.at-f.pulses[1].at);
  });
  it('uses physical sound delay independent of animation speed',()=>{
    expect(thunderPlan(3,17).delay).toBeCloseTo(3000/343,6);
    expect(thunderPlan(8,17).delay).toBeGreaterThan(thunderPlan(1,17).delay);
    expect(thunderPlan(8,17).cutoff).toBeLessThan(thunderPlan(1,17).cutoff);
    expect(thunderPlan(8,17).gain).toBeLessThan(thunderPlan(1,17).gain);
  });
  it('generates finite varied stereo rumbles with silence at the boundaries',()=>{
    const a=generateThunder(8000,17),b=generateThunder(8000,18);
    expect(a[0].length).toBe(80000);
    expect(a[0][0]).toBe(0);expect(a[0].at(-1)).toBeCloseTo(0,4);
    expect(a[0]).not.toEqual(a[1]);expect(a[0]).not.toEqual(b[0]);
    expect(a.every(c=>c.every(v=>Number.isFinite(v)&&Math.abs(v)<=1))).toBe(true);
  });
});
