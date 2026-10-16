import {describe,it,expect} from 'vitest';
import {aerialTransmittance} from './aerial';

describe('shared homogeneous aerial perspective trial',()=>{
  it('preserves fixed landscape witnesses and unit transmission at zero distance',()=>{
    // Fixed witnesses from the frozen08c33cb landscape replay, recorded in
    // cycle14/rain-landscape/aerial-witnesses.json before adding this helper.
    const witnesses=[
      {distance:16,haze:1,contrast:.8521437889662113},
      {distance:16,haze:2.6,contrast:.7692032808507674},
      {distance:60,haze:2.4,contrast:.392193475893505},
    ];
    for(const {distance,haze,contrast} of witnesses){
      expect(aerialTransmittance(distance,haze)).toBeCloseTo(contrast,14);
    }
    for(const haze of [0,1,1.8,2.6])expect(aerialTransmittance(0,haze)).toBe(1);
  });
  it('is bounded, decreases with distance and composes along a homogeneous ray',()=>{
    for(const haze of [0,1,1.6,1.8,2.4,2.6]){
      let previous=1;
      for(const distance of [0,.001,1,5,16,30,60,180]){
        const value=aerialTransmittance(distance,haze);
        expect(value).toBeGreaterThanOrEqual(0);expect(value).toBeLessThanOrEqual(previous);previous=value;
        expect(aerialTransmittance(distance+3.25,haze)).toBeCloseTo(value*aerialTransmittance(3.25,haze),14);
      }
    }
  });
});
