import {afterEach,describe,expect,it,vi} from 'vitest';
import * as opticalMaterial from './terrainOpticalMaterial';
import {terrainFaceDirectSurfaceWGSL} from './terrainFaceDirect';

const ordinary='\n let diffuse=max(0.0,dot(n,sun));\n';
const replacement=`
 let faceDirectCross=cross(dpdy(point),dpdx(point));
 let faceDirectLength2=dot(faceDirectCross,faceDirectCross);
 let faceDirectUnit=faceDirectCross*inverseSqrt(max(faceDirectLength2,1e-20));
 let faceDirectUp=select(-faceDirectUnit,faceDirectUnit,faceDirectUnit.y>=0.0);
 let faceDirectNormal=select(normal,faceDirectUp,faceDirectLength2>1e-20);
 let diffuse=max(0.0,dot(faceDirectNormal,sun));
`;
type Triple=readonly [number,number,number];
const f=Math.fround;
const fmul=(a:number,b:number)=>f(f(a)*f(b));
const fsub=(a:number,b:number)=>f(f(a)-f(b));
function fdot(a:Triple,b:Triple):number{return f(f(fmul(a[0],b[0])+fmul(a[1],b[1]))+fmul(a[2],b[2]));}

/** Test-only staged-f32 arithmetic oracle for the requested expression, not a
 * GPU inverseSqrt precision claim. Plane witnesses below derive their expected
 * normal independently from h(x,z)=a*x+b*z, and allow float32 roundoff.
 */
function evaluate(dx:Triple,dy:Triple,macro:Triple,sun:Triple){
 const cross:Triple=[fsub(fmul(dy[1],dx[2]),fmul(dy[2],dx[1])),fsub(fmul(dy[2],dx[0]),fmul(dy[0],dx[2])),fsub(fmul(dy[0],dx[1]),fmul(dy[1],dx[0]))];
 const length2=fdot(cross,cross),inverse=f(1/Math.sqrt(Math.max(length2,f(1e-20))));
 const unit=cross.map(value=>fmul(value,inverse)) as unknown as Triple;
 const up=(unit[1]>=0?unit:unit.map(value=>f(-value))) as Triple;
 const normal=length2>f(1e-20)?up:macro;
 return {normal,length2,fallback:length2<=f(1e-20),diffuse:Math.max(0,fdot(normal,sun))};
}
function unit(values:Triple):Triple{
 const scale=1/Math.hypot(...values);return values.map(value=>value*scale) as unknown as Triple;
}
afterEach(()=>vi.restoreAllMocks());

describe('immutable face-normal direct-light experiment',()=>{
 it('returns the optical baseline by default and both disabled variants byte-exactly',()=>{
  expect(terrainFaceDirectSurfaceWGSL()).toBe(opticalMaterial.terrainOpticalSurfaceWGSL(true));
  for(const optical of [false,true])expect(terrainFaceDirectSurfaceWGSL(false,optical)).toBe(opticalMaterial.terrainOpticalSurfaceWGSL(optical));
 });

 it.each([false,true])('changes only the diffuse statement and preserves every other byte with optical=%s',optical=>{
  const before=opticalMaterial.terrainOpticalSurfaceWGSL(optical),after=terrainFaceDirectSurfaceWGSL(true,optical);
  expect(before.split(ordinary)).toHaveLength(2);expect(after.split(replacement)).toHaveLength(2);
  expect(after.replace(replacement,ordinary)).toBe(before);
  expect(after).toContain('let n=normalize(normal-vec3<f32>(rough.x,0,rough.y));');
  expect(after).toContain('let skyVisibility=clamp(.62+.38*max(0.0,n.y)-.12*valley,.45,1.0);');
  expect(after).toContain('let ground=albedo*(solar*(.90*diffuse)*clamp(solarVisibility,0.0,1.0)+ambient*(1.12*skyVisibility))+inlandWater*coverB.w;');
  expect(replacement).not.toMatch(/\bif\b|\belse\b|\bvar\b|textureSample|normal\s*=|rough\s*=|skyVisibility\s*=/);
  expect(replacement.indexOf('dpdy(point)')).toBeLessThan(replacement.indexOf('select('));
 });

 it('fails closed on a missing or duplicated diffuse anchor and preexisting diagnostic identifiers',()=>{
  const baseline=opticalMaterial.terrainOpticalSurfaceWGSL(true);
  const factory=vi.spyOn(opticalMaterial,'terrainOpticalSurfaceWGSL');
  factory.mockReturnValueOnce(baseline.replace(ordinary,'\n let diffuse=0.0;\n'));
  expect(()=>terrainFaceDirectSurfaceWGSL(true)).toThrow('ordinary diffuse line');
  factory.mockReturnValueOnce(baseline+ordinary);
  expect(()=>terrainFaceDirectSurfaceWGSL(true)).toThrow('ordinary diffuse line');
  factory.mockReturnValueOnce(baseline+'\n// faceDirectCross already exists\n');
  expect(()=>terrainFaceDirectSurfaceWGSL(true)).toThrow('identifiers already present');
 });
});

describe('face-direct staged float32 plane witnesses',()=>{
 it.each([[0,0],[.75,-.25],[-2,.5],[.1,3.25]] as const)('follows the geometric plane h=%s*x+%s*z independently of macro direction', (a,b)=>{
  const expected=unit([-a,1,-b]),sun=unit([-.6,.8,.1]),macro:Triple=[1,0,0];
  const result=evaluate([1,a,0],[0,b,1],macro,sun);
  expect(result.fallback).toBe(false);expect(Math.hypot(...result.normal)).toBeCloseTo(1,6);
  for(let axis=0;axis<3;axis++)expect(result.normal[axis]).toBeCloseTo(expected[axis],6);
  expect(result.diffuse).toBeCloseTo(Math.max(0,expected[0]*sun[0]+expected[1]*sun[1]+expected[2]*sun[2]),6);
 });

 it('orients a negative-Y derivative cross upward without a branch or changing the plane result',()=>{
  const a=.7,b=-.4,macro:Triple=[0,1,0],sun:Triple=[0,1,0];
  const positive=evaluate([1,a,0],[0,b,1],macro,sun);
  const reversed=evaluate([1,a,0],[0,-b,-1],macro,sun);
  expect(positive.normal[1]).toBeGreaterThan(0);expect(reversed.normal[1]).toBeGreaterThan(0);
  for(let axis=0;axis<3;axis++)expect(reversed.normal[axis]).toBeCloseTo(positive.normal[axis],6);
  expect(reversed.diffuse).toBeCloseTo(positive.diffuse,6);
 });

 it('preserves the plane normal under independent nondegenerate pixel-derivative scales',()=>{
  const a=.4,b=-.8,expected=unit([-a,1,-b]),macro:Triple=[0,1,0],sun:Triple=[0,1,0];
  for(const [xscale,zscale] of [[.01,.03],[2,.25],[.0001,.0002]]){
   const result=evaluate([xscale,a*xscale,0],[0,b*zscale,zscale],macro,sun);
   expect(result.fallback).toBe(false);
   for(let axis=0;axis<3;axis++)expect(result.normal[axis]).toBeCloseTo(expected[axis],6);
  }
 });

 it.each([
  [[0,0,0],[0,0,0]],
  [[1,2,3],[2,4,6]],
  [[.000001,0,0],[0,0,.000001]],
 ] as const)('uses the normalized macro normal for degenerate/tiny derivatives %s / %s',(dx,dy)=>{
  const macro:Triple=[f(.6),f(.8),0],sun:Triple=[1,0,0],result=evaluate(dx,dy,macro,sun);
  expect(result.fallback).toBe(true);expect(result.normal).toBe(macro);expect(result.diffuse).toBe(f(.6));
  expect(result.normal.every(Number.isFinite)).toBe(true);expect(Number.isFinite(result.diffuse)).toBe(true);
 });

 it('uses face direct light above the epsilon and retains the max-zero solar terminator',()=>{
  const macro:Triple=[1,0,0],up=evaluate([.0001,0,0],[0,0,.0001],macro,[0,1,0]);
  expect(up.fallback).toBe(false);expect(up.diffuse).toBeCloseTo(1,6);
  const away=evaluate([1,0,0],[0,0,1],macro,[0,-1,0]);expect(away.diffuse).toBe(0);
 });
});
