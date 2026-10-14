import {describe,it,expect} from 'vitest';
import {OrbitView,probeApproach} from './camera';
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

describe('bounded close approach',()=>{
 it('finds a thin foreground layer that 192 panorama samples miss',()=>{
  const density=(p:number[])=>p[2]>3.021&&p[2]<3.061?1:0;
  let oldHit=false;for(let i=1;i<=192;i++)oldHit ||= density([0,0,16*(1-i/192)])>.025;
  expect(oldHit).toBe(false);
  const result=probeApproach([0,0,0],[0,0,16],density,{min:[-1,-1,2],max:[1,1,4]});
  expect(result.found).toBe(true);expect(result.distance).toBeCloseTo(3.064,4);
 });
 it('keeps the same boundary and sample budget when portrait framing moves home far away',()=>{
  const bounds={min:[-2,-2,-4],max:[2,2,4]},density=(p:number[])=>p[2]>.13&&p[2]<2.17?1:0;
  const wide=probeApproach([0,0,0],[0,0,16],density,bounds),portrait=probeApproach([0,0,0],[0,0,136],density,bounds);
  expect(portrait.distance).toBe(wide.distance);expect(portrait.samples).toBe(wide.samples);
  expect(portrait.spacingKm).toBeLessThanOrEqual(.0125);
 });
 it('rejects off-ray bounds without sampling and handles parallel axes and translated clouds',()=>{
  let calls=0;const density=()=>{calls++;return 1;};
  expect(probeApproach([0,0,0],[0,0,16],density,{min:[2,-1,0],max:[4,1,3]}).found).toBe(false);expect(calls).toBe(0);
  const probe=probeApproach([10,20,30],[10,20,46],p=>p[2]<32?1:0,{min:[9,19,29],max:[11,21,34]});
  expect(probe.distance).toBeCloseTo(2.003,4);
 });
 it('bounds work for empty large domains, reports no hit and rejects invalid coordinates',()=>{
  const empty=probeApproach([0,0,0],[0,0,136],()=>0);
  expect(empty.found).toBe(false);expect(empty.samples).toBeLessThanOrEqual(2049);expect(empty.distance).toBe(.4);
  expect(probeApproach([0,0,0],[NaN,0,1],()=>1).samples).toBe(0);
  expect(probeApproach([0,0,0],[0,0,0],()=>1).distance).toBe(0);
 });
});
