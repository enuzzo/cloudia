import {describe,it,expect} from 'vitest';
import {bakeOpticalDepth} from './light';
import {solarDirection} from './sun';

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
  it('integrates finite horizontal and low-sun paths through all signed axes',()=>{
    const size=24,density=new Float32Array(size**3).fill(.2),point=[12,12,12];
    for(const direction of [[1,0,0],[-1,0,0],[0,-1,0],[0,0,1],[0,0,-1],solarDirection(0,true),solarDirection(1,true),[.02,.01,-1]]){
      const rates=direction.map((d,i)=>Math.abs(d)/dimensions[i]);
      const axis=rates.indexOf(Math.max(...rates)),positive=direction[axis]>0;
      const distance=(positive?size-point[axis]-.5:point[axis]+.5)*dimensions[axis]/size*Math.hypot(...direction)/Math.abs(direction[axis]);
      const tau=bakeOpticalDepth(density,size,dimensions,direction,extinction);
      expect(tau[index(size,...point as [number,number,number])]).toBeCloseTo(distance*extinction*.2,5);
      expect(tau.every(Number.isFinite)).toBe(true);
    }
  });
  it('puts low-sun shadow behind a blocker and mirrors with light direction',()=>{
    const size=32,density=new Float32Array(size**3);
    for(let z=10;z<22;z++)for(let y=10;y<22;y++)density[index(size,15,y,z)]=1;
    const left=bakeOpticalDepth(density,size,dimensions,[-1,.025,0],extinction);
    const right=bakeOpticalDepth(density,size,dimensions,[1,.025,0],extinction);
    expect(left[index(size,23,16,16)]).toBeGreaterThan(1);
    expect(left[index(size,7,16,16)]).toBe(0);
    expect(right[index(size,7,16,16)]).toBeGreaterThan(1);
    expect(right[index(size,23,16,16)]).toBe(0);
    expect(left[index(size,23,5,16)]).toBe(0);
  });
  it('rejects degenerate directions instead of allocating an unbounded ray grid',()=>{
    const density=new Float32Array(8);
    for(const d of [[0,0,0],[NaN,1,0],[Infinity,1,0]])expect(()=>bakeOpticalDepth(density,2,dimensions,d,extinction)).toThrow();
    expect(()=>bakeOpticalDepth(density,2,[0,8,7],[1,0,0],extinction)).toThrow();
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
