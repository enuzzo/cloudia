import {describe,it,expect} from 'vitest';
import {motionState,sourcePosition} from './motion';
import {fillMotionField,fillMotionAtlas} from './motionField';
import {DataUtils} from 'three/webgpu';

describe('convective evolution',()=>{
  it('packs successive spatial blocks along atlas depth without mixing time slices',()=>{
    const data=new Uint16Array(16**3*4*4);
    fillMotionAtlas(data,16,4,71,[5.15,5.95]);
    const point=((8*16+6)*16+7)*4+1;
    expect(DataUtils.fromHalfFloat(data[16**3*4+point])).toBeCloseTo(.2533,3);
    expect(DataUtils.fromHalfFloat(data[point])).toBeLessThan(0);
  });
  it('packs finite thermal displacement into a reusable half-float GPU field',()=>{
    const data=new Uint16Array(16**3*4);
    fillMotionField(data,16,{height:1,width:1,anvil:1,time:0,thermalA:[2.421875,1,1.15],thermalB:[5.4,0,1.05]},[5.15,5.95]);
    const at=((8*16+5)*16+7)*4;
    expect(DataUtils.fromHalfFloat(data[at])).toBeCloseTo(.08813,3);
    expect(DataUtils.fromHalfFloat(data[at+1])).toBeCloseTo(.27053,3);
    expect(DataUtils.fromHalfFloat(data[at+2])).toBeCloseTo(.03101,3);
    expect(DataUtils.fromHalfFloat(data[0])).toBe(0);
  });
  it('grows upward before the anvil spreads and keeps the cloud base anchored',()=>{
    const early=motionState(0,71),late=motionState(40,71);
    expect(late.height).toBeGreaterThan(early.height+.25);
    expect(motionState(8,71).anvil).toBeLessThan(motionState(28,71).anvil);
    expect(sourcePosition([0,.72,0],early)[1]).toBeCloseTo(.72);
  });
  it('moves local features differently instead of translating the whole volume',()=>{
    const a=motionState(45,71),b=motionState(50,71);
    const centerA=sourcePosition([-.65,2.5,0],a),centerB=sourcePosition([-.65,2.5,0],b);
    const edgeA=sourcePosition([3,2.5,0],a),edgeB=sourcePosition([3,2.5,0],b);
    expect(Math.hypot(...centerA.map((v,i)=>v-centerB[i]))).toBeGreaterThan(.025);
    expect(Math.hypot(...edgeA.map((v,i)=>v-edgeB[i]))).toBeLessThan(.001);
  });
  it('has continuous thermal birth and retirement without a modulo pop',()=>{
    const before=sourcePosition([-.65,1.2,0],motionState(34-.001,71));
    const after=sourcePosition([-.65,1.2,0],motionState(34+.001,71));
    expect(Math.hypot(...before.map((v,i)=>v-after[i]))).toBeLessThan(.001);
  });
  it('keeps the seeded evolution repeatable and finite at long run times',()=>{
    expect(motionState(120,1571198069)).toEqual(motionState(120,1571198069));
    for(const t of [0,8,20,40,120,3600]) {
      const state=motionState(t,71);
      for(const p of [[-5,-.5,-3.5],[0,.72,0],[0,3,0],[4.7,6.3,0],[5,8,3.5]]) {
        expect(sourcePosition(p,state).every(Number.isFinite)).toBe(true);
      }
    }
  });
});
