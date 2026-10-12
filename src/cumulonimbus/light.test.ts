import {describe,it,expect} from 'vitest';
import {bakeOpticalDepth} from './light';

const dimensions=[10,8.5,7], extinction=6.5;
const index=(size:number,x:number,y:number,z:number)=>(z*size+y)*size+x;
describe('cached optical depth',()=>{
  it('matches Beer-Lambert path length at voxel centers in homogeneous media',()=>{
    const size=32,density=new Float32Array(size**3).fill(.2);
    for(const direction of [[0,1,0],[.5,1,0],[-.5,1,.1]]) {
      const tau=bakeOpticalDepth(density,size,dimensions,direction,extinction);
      const expected=(size-24-.5)*dimensions[1]/size*Math.hypot(...direction)/direction[1]*extinction*.2;
      expect(tau[index(size,16,24,16)]).toBeCloseTo(expected,5);
    }
  });
  it('does not spread a narrow shadow across many empty layers',()=>{
    const size=64,density=new Float32Array(size**3),direction=[.5,1,0];
    // Half a voxel of horizontal travel per layer, with a three-layer thin blocker.
    direction[0]=.5*dimensions[0]/dimensions[1];
    for(let z=0;z<size;z++) for(let y=47;y<=49;y++) density[index(size,34,y,z)]=1;
    const tau=bakeOpticalDepth(density,size,dimensions,direction,extinction);
    expect(tau[index(size,14,8,32)]).toBeGreaterThan(.8);
    expect(tau[index(size,10,8,32)]).toBe(0);
    expect(tau[index(size,18,8,32)]).toBe(0);
  });
});
