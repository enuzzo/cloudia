import {describe,it,expect} from 'vitest';
import {nextMorphologySeed,DispersalState} from './weatherInteraction';
describe('gesture-ready weather effects',()=>{
 it('cycles every morphology even at uint32 boundaries',()=>{
  for(const old of [0,1,2,1571198069,0xffffffff])for(const rng of [0,15,0xfffffffe,0xffffffff]){
   const next=nextMorphologySeed(rng,old);expect(next%3).toBe((old%3+1)%3);expect(next).toBeLessThanOrEqual(0xffffffff);
  }
 });
 it('smoothly disperses and recovers without a sudden density pop',()=>{
  const s=new DispersalState();s.burst(0);s.step(.1,.1);expect(s.amount).toBeGreaterThan(0);expect(s.amount).toBeLessThan(.5);
  for(let i=0;i<30;i++)s.step(.1,.2+i*.1);expect(s.amount).toBeGreaterThan(.7);
  for(let i=0;i<160;i++)s.step(.1,4+i*.1);expect(s.amount).toBeLessThan(.01);
 });
 it('manual strength holds until recovery and rejects nonfinite forcing',()=>{
  const s=new DispersalState();s.set(.6);for(let i=0;i<100;i++)s.step(.1,i*.1);expect(s.amount).toBeCloseTo(.6,3);
  s.set(NaN);s.step(.1,20);expect(Number.isFinite(s.amount)).toBe(true);s.recover();s.step(1,21);expect(s.amount).toBeLessThan(.6);
 });
});
