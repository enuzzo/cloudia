import {describe,it,expect} from 'vitest';
import {OrbitView} from './camera';
import {CAMERA_TERRAIN_CLEARANCE_KM,EARTH_RADIUS,GROUND_LEVEL,clampCameraAboveLandscape,landscapeSurfaceY,terrainHeight,terrainNoise} from './landscape';

const radialHeight=(point:readonly number[])=>Math.hypot(point[0],point[1]+EARTH_RADIUS-GROUND_LEVEL,point[2])-EARTH_RADIUS;

describe('camera clearance above the spherical natural landscape',()=>{
 it('keeps the noise continuous across negative lattice boundaries',()=>{
  for(const boundary of [-3,-1,0,1,4])for(const other of [-2.3,.4,7.8]){
   const left=terrainNoise(boundary-1e-5,other),right=terrainNoise(boundary+1e-5,other);
   expect(left).toBeGreaterThanOrEqual(0);expect(right).toBeLessThan(1);
   expect(Math.abs(left-right)).toBeLessThan(1e-5);
   expect(Math.abs(terrainNoise(other,boundary-1e-5)-terrainNoise(other,boundary+1e-5))).toBeLessThan(1e-5);
  }
 });

 it('retains sea outside the coast and positive relief inland',()=>{
  expect(terrainHeight(24,0)).toBe(0);
  expect(terrainHeight(-24,0)).toBeGreaterThan(.2);
 });

 it('rejects the old sea-only camera floor at a reachable low orbit',()=>{
  const view=new OrbitView();view.pitch=-.92;
  const origin=view.frame([.4296875,2.9365234375,0],16/9,0,.6045067691053366).origin;
  origin[1]=Math.max(-3.8,origin[1]);
  const relief=terrainHeight(origin[0],origin[2]);
  expect(radialHeight(origin)).toBeLessThan(relief);
  const corrected=clampCameraAboveLandscape(origin);
  expect(radialHeight(corrected)-relief).toBeCloseTo(CAMERA_TERRAIN_CLEARANCE_KM,9);
 });

 it('preserves radial clearance through yaw, pitch, approach and portrait framing',()=>{
  const view=new OrbitView(),target=[.4296875,2.9365234375,0];
  for(const aspect of [.45,16/9,2.3])for(const approach of [0,.8,1])for(const pitch of [-.92,-.55,0,.6,.92])for(const yaw of [-Math.PI,-Math.PI/2,0,Math.PI/2,Math.PI]){
   view.approach=approach;view.pitch=pitch;view.yaw=yaw;
   const origin=view.frame(target,aspect,0,.6045067691053366).origin,before=[...origin];
   const corrected=clampCameraAboveLandscape(origin);
   expect(origin).toEqual(before);
   expect(corrected[0]).toBe(origin[0]);expect(corrected[2]).toBe(origin[2]);
   expect(corrected[1]).toBeGreaterThanOrEqual(origin[1]);
   expect(radialHeight(corrected)-terrainHeight(corrected[0],corrected[2])).toBeGreaterThanOrEqual(CAMERA_TERRAIN_CLEARANCE_KM-1e-9);
   expect(clampCameraAboveLandscape(corrected)).toEqual(corrected);
  }
 });

 it('uses spherical curvature rather than a flat height plus margin',()=>{
  const x=120,z=-90,clearance=.2;
  const surface=landscapeSurfaceY(x,z,clearance),corrected=clampCameraAboveLandscape([x,-8,z],clearance);
  expect(surface).toBeLessThan(GROUND_LEVEL+terrainHeight(x,z)+clearance-1);
  expect(corrected[1]).toBe(surface);
  expect(radialHeight(corrected)).toBeCloseTo(terrainHeight(x,z)+clearance,9);
 });

 it('raises only submerged cameras and supports an explicit radial margin',()=>{
  const origin=[-3,-4,2];
  for(const clearance of [0,.2,.5]){
   const corrected=clampCameraAboveLandscape(origin,clearance);
   expect(radialHeight(corrected)-terrainHeight(origin[0],origin[2])).toBeCloseTo(clearance,9);
  }
  const high=[-3,8,2];
  expect(clampCameraAboveLandscape(high)).toEqual(high);
 });

 it('keeps a 200m radial margin above a supplied triangle surface without moving xz or mutating the input',()=>{
  // Barycentric point of a sloped rendered triangle, independent of the
  // procedural field. Its world-space y is the optional mesh contract.
  const a=[120,-2,-90],b=[121,-1.5,-90],c=[120,-1.75,-89],weights=[.25,.5,.25];
  const point=a.map((value,axis)=>value*weights[0]+b[axis]*weights[1]+c[axis]*weights[2]);
  const origin=Object.freeze([point[0],-8,point[2]]),before=[...origin];
  const corrected=clampCameraAboveLandscape(origin,.2,point[1]);
  expect(radialHeight(corrected)-radialHeight(point)).toBeCloseTo(.2,9);
  expect(corrected[1]-point[1]).toBeGreaterThan(.2); // radial clearance is not a vertical offset
  expect(corrected[0]).toBe(origin[0]);expect(corrected[2]).toBe(origin[2]);
  expect(origin).toEqual(before);expect(corrected).not.toBe(origin);
  expect(clampCameraAboveLandscape(corrected,.2,point[1])).toEqual(corrected);
 });

 it('uses the supplied mesh floor while preserving the orbit target and already-clear cameras',()=>{
  const target=Object.freeze([.4296875,2.9365234375,0]),beforeTarget=[...target],view=new OrbitView();
  view.pitch=-.92;
  const origin=view.frame(target,16/9,0,.6045067691053366).origin,beforeOrigin=[...origin];
  const meshY=origin[1]+.75;
  for(const clearance of [0,CAMERA_TERRAIN_CLEARANCE_KM,.5]){
   const corrected=clampCameraAboveLandscape(origin,clearance,meshY),meshPoint=[origin[0],meshY,origin[2]];
   expect(radialHeight(corrected)-radialHeight(meshPoint)).toBeCloseTo(clearance,9);
   expect(corrected[0]).toBe(origin[0]);expect(corrected[2]).toBe(origin[2]);
  }
  expect(origin).toEqual(beforeOrigin);expect(target).toEqual(beforeTarget);
  const high=Object.freeze([origin[0],meshY+2,origin[2]]);
  expect(clampCameraAboveLandscape(high,.2,meshY)).toEqual(high);
 });

 it('keeps the default analytic floor when the optional mesh surface is omitted or null',()=>{
  for(const origin of [[-24,-8,0],[120,-8,-90],[-3,8,2]]){
   expect(clampCameraAboveLandscape(origin)).toEqual(clampCameraAboveLandscape(origin,CAMERA_TERRAIN_CLEARANCE_KM,null));
   for(const clearance of [0,.2,.5]){
    const expected=[origin[0],Math.max(origin[1],landscapeSurfaceY(origin[0],origin[2],clearance)),origin[2]];
    expect(clampCameraAboveLandscape(origin,clearance)).toEqual(expected);
    expect(clampCameraAboveLandscape(origin,clearance,null)).toEqual(expected);
   }
  }
 });
});
