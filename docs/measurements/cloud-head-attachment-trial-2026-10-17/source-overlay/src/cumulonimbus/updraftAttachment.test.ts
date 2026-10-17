import {describe,expect,it} from 'vitest';
import {prepareUpdraftAttachment,type AttachmentLobe,type AttachmentPoint} from './updraftAttachment';

const point=(x:number,y:number,z:number):AttachmentPoint=>Object.freeze([x,y,z] as const);
const core=(x:number,y:number,z:number,rx=1,ry=1,rz=1):AttachmentLobe=>Object.freeze([x,y,z,rx,ry,rz] as const);
const foot=point(0,0,0),head=point(0,4,0);

describe('same-height attachment to the connected mature envelope',()=>{
 it('places an outside young head on the exit of a unit sphere at the same height',()=>{
  const young=point(3,2,0),body=Object.freeze([core(0,2,0)]),result=prepareUpdraftAttachment(foot,head,body,young);
  expect(result.status).toBe('attached');expect(result.axisPoint).toEqual([0,2,0]);
  expect(result.headDistanceKm).toBe(3);expect(result.boundaryDistanceKm).toBeCloseTo(1,12);
  expect(young[0]+result.translationXZ[0]).toBeCloseTo(1,12);expect(young[2]+result.translationXZ[1]).toBeCloseTo(0,12);
 });

 it('uses the actual sliced anisotropic ellipse rather than full horizontal radii',()=>{
  const young=point(3,2.5,4),lobe=core(0,2,0,2,1,1),result=prepareUpdraftAttachment(foot,head,[lobe],young);
  expect(result.status).toBe('attached');expect(result.axisPoint).toEqual([0,2.5,0]);
  const x=young[0]+result.translationXZ[0],z=young[2]+result.translationXZ[1];
  // Independent surface equation, with a quarter of squared radius already used by Y.
  expect((x/2)**2+.5**2+z*z).toBeCloseTo(1,11);
  expect(result.boundaryDistanceKm).toBeCloseTo(Math.sqrt(.75/(.6**2/4+.8**2)),11);
  expect(x/z).toBeCloseTo(3/4,12);
 });

 it('stops at the component containing the axis rather than a disconnected farther lobe',()=>{
  const result=prepareUpdraftAttachment(foot,head,[core(0,2,0),core(1.5,2,0),core(4,2,0,.5,.5,.5)],point(6,2,0));
  expect(result.status).toBe('attached');expect(result.boundaryDistanceKm).toBeCloseTo(2.5,12);
  expect(result.translationXZ[0]).toBeCloseTo(-3.5,12);
 });

 it('treats touching closed intervals as connected without inventing an extra gap threshold',()=>{
  const result=prepareUpdraftAttachment(foot,head,[core(0,2,0),core(2,2,0)],point(5,2,0));
  expect(result.status).toBe('attached');expect(result.boundaryDistanceKm).toBeCloseTo(3,12);
  expect(result.translationXZ[0]).toBeCloseTo(-2,12);
 });

 it('leaves an already contained head and all frozen input geometry unchanged',()=>{
  const body=Object.freeze([core(0,2,0)]),young=point(.5,2,0),before=JSON.stringify({foot,head,body,young});
  const result=prepareUpdraftAttachment(foot,head,body,young);
  expect(result.status).toBe('already-contained');expect(result.translationXZ.every(v=>v===0)).toBe(true);
  expect(result.boundaryDistanceKm).toBeCloseTo(1,12);expect(JSON.stringify({foot,head,body,young})).toBe(before);
 });

 it('handles a covered coincident axis without dividing by zero or fabricating a direction',()=>{
  const f=point(0,0,0),m=point(2,4,-2),young=point(1,2,-1),result=prepareUpdraftAttachment(f,m,[core(1,2,-1)],young);
  expect(result.status).toBe('axis-coincident');expect(result.axisPoint).toEqual([1,2,-1]);expect(result.headDistanceKm).toBe(0);
  expect(result.boundaryDistanceKm).toBeNull();expect(result.intervals).toEqual([]);
  expect(result.directionXZ.every(v=>v===0)).toBe(true);expect(result.translationXZ.every(v=>v===0)).toBe(true);
 });

 it('interpolates the feeding axis at the young height instead of using the mature summit XZ',()=>{
  const f=point(-1,0,2),m=point(1,4,0),young=point(-.5,1,4.5),result=prepareUpdraftAttachment(f,m,[core(-.5,1,1.5,2,1,1)],young);
  expect(result.axisPoint).toEqual([-.5,1,1.5]);expect(result.headDistanceKm).toBe(3);
  expect(result.boundaryDistanceKm).toBeCloseTo(1,12);expect(result.translationXZ[0]).toBeCloseTo(0,12);expect(result.translationXZ[1]).toBeCloseTo(-2,12);
 });

 it('fails explicitly for invalid geometry and for an uncovered axis, including coincident direction',()=>{
  expect(()=>prepareUpdraftAttachment(foot,point(0,0,0),[core(0,0,0)],point(2,0,0))).toThrow();
  expect(()=>prepareUpdraftAttachment(foot,head,[core(0,2,0,0,1,1)],point(2,2,0))).toThrow();
  expect(()=>prepareUpdraftAttachment(foot,head,[core(0,2,0)],point(NaN,2,0))).toThrow();
  expect(()=>prepareUpdraftAttachment(foot,head,[],point(2,2,0))).toThrow();
  expect(()=>prepareUpdraftAttachment(foot,head,[core(3,2,0)],point(6,2,0))).toThrow();
  expect(()=>prepareUpdraftAttachment(foot,head,[core(3,2,0)],point(0,2,0))).toThrow();
 });
});
