// @vitest-environment node
import {createHash} from 'node:crypto';
import {describe,expect,it,vi} from 'vitest';
import {TERRAIN_SURFACE_WGSL} from './terrainSurface';
import {terrainOpticalSurfaceWGSL} from './terrainOpticalMaterial';

const signature='\nfn terrainSurfaceMaterial(point:vec3<f32>,hKm:f32,coastKm:f32,macroNormal:vec3<f32>,distanceKm:f32,pixelKm:f32,sun:vec3<f32>,solar:vec3<f32>,ambient:vec3<f32>,solarVisibility:f32,coverA:vec4<f32>,coverB:vec4<f32>)->vec3<f32>{\n';
const opticalSignature=signature.replace('coverB:vec4<f32>)','coverB:vec4<f32>,observed:vec4<f32>)');
const paletteLine='\n let albedo=authored*coverA.x+forest*coverA.y+grass*coverA.z+crops*coverA.w+built*coverB.x+rock*coverB.y+snow*coverB.z;\n';
const opticalBlock=`
 let unknownAlbedo=authored*coverA.x;
 let knownPalette=forest*coverA.y+grass*coverA.z+crops*coverA.w+built*coverB.x+rock*coverB.y+snow*coverB.z;
 let knownLandWeight=coverA.y+coverA.z+coverA.w+coverB.x+coverB.y+coverB.z;
 let albedo=unknownAlbedo+(1.0-observed.a)*knownPalette+knownLandWeight*observed.rgb;
`;
const fallback='\n return terrainSurfaceMaterial(point,field.x,field.w,normal,distanceKm,pixelKm,sun,solar,ambient,1.0,vec4<f32>(1.0,0.0,0.0,0.0),vec4<f32>(0.0));\n';
const opticalFallback=fallback.replace('vec4<f32>(0.0));','vec4<f32>(0.0),vec4<f32>(0.0));');
const count=(s:string,needle:string)=>s.split(needle).length-1;

describe('compile-time observed terrain colour library',()=>{
 it('retains the canonical default bytes, SHA, signature and fallback',()=>{
  expect(terrainOpticalSurfaceWGSL()).toBe(TERRAIN_SURFACE_WGSL);expect(terrainOpticalSurfaceWGSL(false)).toBe(TERRAIN_SURFACE_WGSL);
  expect(Buffer.byteLength(terrainOpticalSurfaceWGSL(),'utf8')).toBe(7591);
  expect(createHash('sha256').update(terrainOpticalSurfaceWGSL(),'utf8').digest('hex')).toBe('1099a97f339851e3d520a4e4cfdd3831f865832c98660c1535a7754d387e55df');
  expect(terrainOpticalSurfaceWGSL()).not.toMatch(/\bobserved\b/);
 });
 it('recovers every canonical byte by inverting exactly the three intended edits',()=>{
  const enabled=terrainOpticalSurfaceWGSL(true);
  for(const anchor of [opticalSignature,opticalBlock,opticalFallback])expect(count(enabled,anchor)).toBe(1);
  const parameters=enabled.match(/fn terrainSurfaceMaterial\(([^)]*)\)->vec3<f32>/)![1].split(',');
  expect(parameters).toHaveLength(13);expect(parameters.at(-1)).toBe('observed:vec4<f32>');
  expect(enabled.replace(opticalSignature,signature).replace(opticalBlock,paletteLine).replace(opticalFallback,fallback)).toBe(TERRAIN_SURFACE_WGSL);
  // Calling B cannot mutate or memoize a modified A.
  expect(terrainOpticalSurfaceWGSL(false)).toBe(TERRAIN_SURFACE_WGSL);
 });
 it('adds no texture/noise evaluation and leaves the complete normal/light/water/sea tail unchanged',()=>{
  const enabled=terrainOpticalSurfaceWGSL(true),tail=' let rockCover=biome.y*coverA.x+coverB.y;';
  const tailOf=(source:string)=>source.slice(source.indexOf(tail),source.indexOf('\nfn terrainSurfaceColour('));
  expect(tailOf(enabled)).toBe(tailOf(TERRAIN_SURFACE_WGSL));
  const operations=/\b(?:texture(?:Sample\w*|Load|Store|Gather\w*)|tsFilteredNoise)\s*\(/g;
  expect(enabled.match(operations)??[]).toEqual(TERRAIN_SURFACE_WGSL.match(operations)??[]);
  expect(enabled.slice(0,enabled.indexOf(opticalSignature))).toBe(TERRAIN_SURFACE_WGSL.slice(0,TERRAIN_SURFACE_WGSL.indexOf(signature)));
 });
 it.each([
  ['missing signature',TERRAIN_SURFACE_WGSL.replace(signature,'')],
  ['duplicate signature',TERRAIN_SURFACE_WGSL.replace(signature,signature+signature)],
  ['missing palette',TERRAIN_SURFACE_WGSL.replace(paletteLine,'')],
  ['duplicate palette',TERRAIN_SURFACE_WGSL.replace(paletteLine,paletteLine+paletteLine)],
  ['missing fallback',TERRAIN_SURFACE_WGSL.replace(fallback,'')],
  ['duplicate fallback',TERRAIN_SURFACE_WGSL.replace(fallback,fallback+fallback)],
  ['changed light formula',TERRAIN_SURFACE_WGSL.replace('solar*(.90*diffuse)','solar*(.91*diffuse)')],
  ['already optical',TERRAIN_SURFACE_WGSL+'\n// observed\n'],
 ] as const)('fails closed on %s without altering the false return',async(_label,source)=>{
  vi.resetModules();vi.doMock('./terrainSurface',()=>({TERRAIN_SURFACE_WGSL:source}));
  try{const changed=await import('./terrainOpticalMaterial');expect(()=>changed.terrainOpticalSurfaceWGSL(true)).toThrow('Terrain optical material:');expect(changed.terrainOpticalSurfaceWGSL(false)).toBe(source);}
  finally{vi.doUnmock('./terrainSurface');vi.resetModules();}
 });
});

type RGB=readonly[number,number,number];
type Q=readonly[number,number,number,number];
// Group order is the current shader's A.xyzw/B.xyzw, not source class IDs.
type Weights=readonly[number,number,number,number,number,number,number,number];
type Palettes=readonly[RGB,RGB,RGB,RGB,RGB,RGB];
const authored:RGB=[.125,.375,.25];
const palettes:Palettes=[[.125,.25,.5],[.25,.125,.5],[.5,.25,.125],[.375,.25,.125],[.25,.375,.5],[.75,.5,.25]];
// Test-only real-arithmetic reference for the source contract above. This is
// not a WGSL evaluator, f32 simulator, texture decoder or proof of GPU parity.
function groupedReference(w:Weights,q:Q):number[]{
 const u=authored.map(v=>v*w[0]),p=[0,0,0];let k=0;
 for(let group=0;group<6;group++){k+=w[group+1];for(let channel=0;channel<3;channel++)p[channel]+=palettes[group][channel]*w[group+1];}
 return u.map((v,channel)=>v+(1-q[3])*p[channel]+k*q[channel]);
}
// Independent area oracle: split each known class into valid and invalid
// subareas, accumulate their actual conditional colours, then add unknown.
// Water is absent from this albedo calculation and stays in the original tail.
function classAreaOracle(w:Weights,conditional:RGB,valid:number):number[]{
 const result=authored.map(v=>v*w[0]);
 for(let group=0;group<6;group++)for(let channel=0;channel<3;channel++){
  const invalidArea=w[group+1]*(1-valid),validArea=w[group+1]*valid;
  result[channel]+=invalidArea*palettes[group][channel]+validArea*conditional[channel];
 }
 return result;
}
const premul=(rgb:RGB,a:number):Q=>[rgb[0]*a,rgb[1]*a,rgb[2]*a,a];

describe('premultiplied observed area algebra (CPU contract only)',()=>{
 it('preserves pure unknown and excludes pure water for every observed validity',()=>{
  for(const a of [0,.25,1]){
   expect(groupedReference([1,0,0,0,0,0,0,0],premul([.5,.25,.125],a))).toEqual(authored);
   expect(groupedReference([0,0,0,0,0,0,0,1],premul([.5,.25,.125],a))).toEqual([0,0,0]);
  }
 });
 it('replaces each of the six known groups at full validity without changing its area weight',()=>{
  const observed:RGB=[.5,.25,.125];
  for(let group=1;group<=6;group++){
   const w=[0,0,0,0,0,0,0,0];w[group]=1;
   expect(groupedReference(w as unknown as Weights,premul(observed,1))).toEqual(observed);
  }
 });
 it('agrees with independent class subareas for invalid, partially valid and valid mixed pixels',()=>{
  const w:Weights=[.125,.25,.125,.125,.0625,.0625,.125,.125],conditional:RGB=[.5,.25,.125];
  for(const valid of [0,.25,.5,1])expect(groupedReference(w,premul(conditional,valid))).toEqual(classAreaOracle(w,conditional,valid));
 });
 it('commutes with a filtered valid/invalid optical footprint rather than dividing by its alpha',()=>{
  const w:Weights=[.125,.25,.125,.125,.0625,.0625,.125,.125],valid=premul([.5,.25,.125],1),invalid:Q=[0,0,0,0];
  const filtered=valid.map((v,i)=>(v+invalid[i])*.5) as unknown as Q;
  const expected=groupedReference(w,valid).map((v,i)=>(v+groupedReference(w,invalid)[i])*.5);
  expect(groupedReference(w,filtered)).toEqual(expected);
  expect(groupedReference(w,filtered)).toEqual(classAreaOracle(w,[.5,.25,.125],.5));
  // Dividing Q.rgb by filtered.a would incorrectly add the full observed
  // colour while retaining half the palette; this fixed witness distinguishes it.
  const wronglyUnpremultiplied:Q=[filtered[0]/filtered[3],filtered[1]/filtered[3],filtered[2]/filtered[3],filtered[3]];
  expect(groupedReference(w,wronglyUnpremultiplied)).not.toEqual(expected);
 });
});
