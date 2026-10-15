import {describe,it,expect} from 'vitest';
import {DataUtils} from 'three/webgpu';
import {fillMotionField,sampleMotionField,writeFilteredSourcePosition,MOTION_FIELD_SIZE} from './motionField';
import {motionState,sourcePosition,referencePosition} from './motion';
import {probeApproach} from './camera';

const center=(x:number,y:number,z:number,size=2)=>[-5+(x+.5)/size*10,-.5+(y+.5)/size*8.5,-3.5+(z+.5)/size*7];
function affineField(){
 const field=new Uint16Array(2**3*4);
 for(let z=0;z<2;z++)for(let y=0;y<2;y++)for(let x=0;x<2;x++){
  const values=[1+2*x,4+4*y,8+8*z,16+4*x+2*y+z],at=((z*2+y)*2+x)*4;
  values.forEach((value,c)=>{field[at+c]=DataUtils.toHalfFloat(value);});
 }
 return field;
}
describe('filtered GPU motion field reference',()=>{
 it('recovers all four channels at half-texel centers',()=>{
  const field=affineField(),out=new Float64Array(4);
  for(let z=0;z<2;z++)for(let y=0;y<2;y++)for(let x=0;x<2;x++){
   sampleMotionField(field,2,center(x,y,z),out);
   expect(Array.from(out)).toEqual([1+2*x,4+4*y,8+8*z,16+4*x+2*y+z]);
  }
 });
 it('interpolates an affine field at a known fractional cell location',()=>{
  const out=new Float64Array(4);
  sampleMotionField(affineField(),2,center(.25,.5,.75),out);
  expect(Array.from(out)).toEqual([1.5,6,14,18.75]);
 });
 it('clamps each texture axis instead of wrapping beyond its boundary',()=>{
  const out=new Float64Array(4);
  sampleMotionField(affineField(),2,[-100,100,-100],out);
  [1,8,8,18].forEach((value,c)=>expect(out[c]).toBeCloseTo(value,14));
 });
 it('returns source coordinates and retains the independently stored erosion',()=>{
  const field=new Uint16Array(MOTION_FIELD_SIZE**3*4),state=motionState(60,1571198069),ice=[5.15,5.95],wind=[.3,.1],position=[.7,3,.9],out=new Float64Array(4);
  for(let i=0;i<field.length;i+=4)[.125,-.25,.0625,.03125].forEach((v,c)=>{field[i+c]=DataUtils.toHalfFloat(v);});
  const reference=referencePosition(position,state,ice,wind);
  writeFilteredSourcePosition(position,state,ice,wind,field,out);
  reference.forEach((v,c)=>expect(out[c]).toBeCloseTo(v-[.125,-.25,.0625][c],14));
  expect(out[3]).toBeCloseTo(.03125,14);
 });
 it('keeps the probe outside a rendered slab that the analytic-flow probe enters',()=>{
  const state=motionState(60,1571198069),ice=[5.15,5.95],wind=[.3,.1],field=new Uint16Array(MOTION_FIELD_SIZE**3*4),out=new Float64Array(4),target=[0,3,0],home=[0,3,4];
  fillMotionField(field,MOTION_FIELD_SIZE,state,ice);
  // A sharp, oblique material boundary isolates the displacement representation.
  const slab=(p:ArrayLike<number>)=>p[1]+p[2]<3.6?1:0;
  const analytic=(p:number[])=>slab(sourcePosition(p,state,ice,wind));
  const rendered=(p:number[])=>{writeFilteredSourcePosition(p,state,ice,wind,field,out);return slab(out);};
  const old=probeApproach(target,home,analytic),corrected=probeApproach(target,home,rendered);
  expect(old.found&&corrected.found).toBe(true);
  expect(corrected.distance-old.distance).toBeGreaterThan(.02);
  expect(rendered([0,3,old.distance])).toBe(1);
  expect(rendered([0,3,corrected.distance])).toBe(0);
  expect(rendered([0,3,corrected.distance-.006])).toBe(1);
 });
});
