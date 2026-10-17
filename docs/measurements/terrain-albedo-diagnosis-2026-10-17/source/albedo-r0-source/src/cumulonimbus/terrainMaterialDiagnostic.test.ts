import {createHash} from 'node:crypto';
import {describe,expect,it,vi} from 'vitest';
import {TERRAIN_SURFACE_WGSL} from './terrainSurface';
import {terrainSurfaceWGSL} from './terrainMaterialDiagnostic';

const baseSHA256='1099a97f339851e3d520a4e4cfdd3831f865832c98660c1535a7754d387e55df';
const selection='select(ground,albedo+inlandWater*coverB.w,materialDiagnosticMode>0.5)';
const materialSignature='fn terrainSurfaceMaterial(point:vec3<f32>,hKm:f32,coastKm:f32,macroNormal:vec3<f32>,distanceKm:f32,pixelKm:f32,sun:vec3<f32>,solar:vec3<f32>,ambient:vec3<f32>,solarVisibility:f32,coverA:vec4<f32>,coverB:vec4<f32>)->vec3<f32>{';
const materialReturn=' return mix(sea,ground,smoothstep(-coastBlendWidth,coastBlendWidth,coastKm));';
const fallbackReturn=' return terrainSurfaceMaterial(point,field.x,field.w,normal,distanceKm,pixelKm,sun,solar,ambient,1.0,vec4<f32>(1.0,0.0,0.0,0.0),vec4<f32>(0.0));';
const occurrences=(source:string,needle:string)=>source.split(needle).length-1;

describe('terrain albedo diagnostic source, no renderer',()=>{
 it('returns the frozen ordinary library byte exact by default and with false',()=>{
  expect(terrainSurfaceWGSL()).toBe(TERRAIN_SURFACE_WGSL);expect(terrainSurfaceWGSL(false)).toBe(TERRAIN_SURFACE_WGSL);
  expect(Buffer.byteLength(terrainSurfaceWGSL(),'utf8')).toBe(7591);
  expect(createHash('sha256').update(terrainSurfaceWGSL(),'utf8').digest('hex')).toBe(baseSHA256);
  expect(terrainSurfaceWGSL()).not.toContain('materialDiagnosticMode');
 });
 it('reverses precisely three edits to recover every original library byte',()=>{
  const diagnostic=terrainSurfaceWGSL(true);
  expect(occurrences(diagnostic,',materialDiagnosticMode:f32)')).toBe(1);
  expect(occurrences(diagnostic,selection)).toBe(1);
  expect(occurrences(diagnostic,'vec4<f32>(0.0),0.0);')).toBe(1);
  const restored=diagnostic.replace(',materialDiagnosticMode:f32)',')').replace(selection,'ground')
   .replace('vec4<f32>(0.0),0.0);','vec4<f32>(0.0));');
  expect(restored).toBe(TERRAIN_SURFACE_WGSL);
  expect(terrainSurfaceWGSL()).toBe(TERRAIN_SURFACE_WGSL);
 });
 it('keeps one material function and the existing operations before its final select',()=>{
  const source=terrainSurfaceWGSL(true);
  expect(occurrences(source,'fn terrainSurfaceMaterial(')).toBe(1);
  expect(occurrences(source,'fn terrainSurfaceColour(')).toBe(1);
  expect(source.match(/\btexture(?:Sample\w*|Load|Store|Gather\w*)\s*\(/g)??[])
   .toEqual(TERRAIN_SURFACE_WGSL.match(/\btexture(?:Sample\w*|Load|Store|Gather\w*)\s*\(/g)??[]);
  expect(source.match(/\btsFilteredNoise\s*\(/g)).toHaveLength(TERRAIN_SURFACE_WGSL.match(/\btsFilteredNoise\s*\(/g)!.length);
  const ordinaryGround=' let ground=albedo*(solar*(.90*diffuse)*clamp(solarVisibility,0.0,1.0)+ambient*(1.12*skyVisibility))+inlandWater*coverB.w;';
  expect(source).toContain(ordinaryGround);
  expect(source.indexOf(ordinaryGround)).toBeLessThan(source.indexOf(selection));
  expect(source.indexOf('let rough=')).toBeLessThan(source.indexOf(selection));
  expect(source.indexOf('let sea=')).toBeLessThan(source.indexOf(selection));
  expect(source).not.toMatch(/if\s*\(materialDiagnosticMode/);
  expect(source).toContain('vec4<f32>(0.0),0.0);');
 });
 it.each([
  ['material signature',materialSignature],['material return',materialReturn],['fallback return',fallbackReturn],
 ] as const)('fails closed if the %s anchor is missing or duplicated',async(_label,anchor)=>{
  for(const corrupt of [TERRAIN_SURFACE_WGSL.replace(anchor,''),TERRAIN_SURFACE_WGSL+'\n'+anchor]){
   vi.resetModules();vi.doMock('./terrainSurface',()=>({TERRAIN_SURFACE_WGSL:corrupt}));
   try{
    const mocked=await import('./terrainMaterialDiagnostic');
    expect(()=>mocked.terrainSurfaceWGSL(true)).toThrow('expected exactly one occurrence');
    expect(mocked.terrainSurfaceWGSL()).toBe(corrupt); // Default never transforms its source.
   }finally{vi.doUnmock('./terrainSurface');vi.resetModules();}
  }
 });
});
