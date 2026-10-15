import {describe,it,expect} from 'vitest';
import {integrateMediaSegment} from './medium';

describe('co-located cloud and precipitation transport',()=>{
  it('matches the analytic mixture independently of ray partition and medium order',()=>{
    const cloud=[1,.7,.4],rain=[.1,.3,.9],length=2.3;
    const expected=integrateMediaSegment(.7,cloud,.35,rain,length);
    const swapped=integrateMediaSegment(.35,rain,.7,cloud,length);
    expect(swapped).toEqual(expected);
    for(const steps of [1,8,64,384,8192]){
      const cell=integrateMediaSegment(.7,cloud,.35,rain,length/steps);
      let transmission=1;const light=[0,0,0];
      for(let i=0;i<steps;i++){
        for(let c=0;c<3;c++)light[c]+=transmission*cell.radiance[c];
        transmission*=cell.transmittance;
      }
      expect(transmission).toBeCloseTo(Math.exp(-1.05*length),12);
      for(let c=0;c<3;c++)expect(light[c]).toBeCloseTo(expected.radiance[c],12);
    }
  });
  it('keeps empty segments transparent and reduces exactly to either medium alone',()=>{
    expect(integrateMediaSegment(0,[1,1,1],0,[1,1,1],10)).toEqual({radiance:[0,0,0],transmittance:1});
    const source=[.8,.6,.4],opacity=1-Math.exp(-.5*3);
    for(const result of [integrateMediaSegment(.5,source,0,[9,9,9],3),integrateMediaSegment(0,[9,9,9],.5,source,3)]){
      expect(result.transmittance).toBeCloseTo(1-opacity,14);
      source.forEach((v,i)=>expect(result.radiance[i]).toBeCloseTo(v*opacity,14));
    }
  });
});
