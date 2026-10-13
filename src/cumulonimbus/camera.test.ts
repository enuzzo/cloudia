import {describe,it,expect} from 'vitest';
import {OrbitView} from './camera';
describe('inspection orbit',()=>{
 it('rotates on both drag axes and clamps pitch away from singularities',()=>{
  const v=new OrbitView();v.drag(120,-90,1000,700);
  expect(Math.abs(v.yaw)).toBeGreaterThan(.2);expect(Math.abs(v.pitch)).toBeGreaterThan(.1);
  v.drag(0,1e6,1000,700);expect(Math.abs(v.pitch)).toBeLessThan(1.2);
  const frame=v.frame([.3,3,0],1.5,0);expect(frame.origin.every(Number.isFinite)).toBe(true);
 });
 it('recenters only the view and keeps narrow displays framed',()=>{
  const v=new OrbitView();v.drag(300,120,800,600);v.reset();expect(v.yaw).toBe(0);expect(v.pitch).toBe(0);
  const normal=v.frame([0,3,0],1.5,0),narrow=v.frame([0,3,0],.45,0);
  expect(narrow.distance).toBeGreaterThan(normal.distance);
  expect(normal.origin[1]).toBe(3);
 });
 it('rejects malformed input and wraps accumulated horizontal turns',()=>{
  const v=new OrbitView();v.drag(NaN,Infinity,0,0);expect([v.yaw,v.pitch]).toEqual([0,0]);
  for(let i=0;i<100;i++)v.drag(500,0,800,600);
  expect(Math.abs(v.yaw)).toBeLessThanOrEqual(Math.PI);
 });
});
