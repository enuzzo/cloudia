import {createHash} from 'node:crypto';
import {describe,expect,it,vi} from 'vitest';
import {TERRAIN_SURFACE_WGSL} from './terrainSurface';
import {terrainSurfaceWGSL} from './terrainMaterialDiagnostic';

const ordinaryGround=' let ground=albedo*(solar*(.90*diffuse)*clamp(solarVisibility,0.0,1.0)+ambient*(1.12*skyVisibility))+inlandWater*coverB.w;';
const albedoGround=' let ground=albedo+inlandWater*coverB.w;';
const occurrences=(source:string,needle:string)=>source.split(needle).length-1;

describe('immutable terrain albedo-only diagnostic source',()=>{
 it('returns the frozen ordinary library byte exact with omitted mode or false',()=>{
  expect(terrainSurfaceWGSL()).toBe(TERRAIN_SURFACE_WGSL);expect(terrainSurfaceWGSL(false)).toBe(TERRAIN_SURFACE_WGSL);
  expect(Buffer.byteLength(terrainSurfaceWGSL(),'utf8')).toBe(7591);
  expect(createHash('sha256').update(terrainSurfaceWGSL(),'utf8').digest('hex'))
   .toBe('1099a97f339851e3d520a4e4cfdd3831f865832c98660c1535a7754d387e55df');
 });
 it('recovers every ordinary byte by reversing the unique ground-line change',()=>{
  const diagnostic=terrainSurfaceWGSL(true);
  expect(occurrences(diagnostic,ordinaryGround)).toBe(0);expect(occurrences(diagnostic,albedoGround)).toBe(1);
  expect(diagnostic.replace(albedoGround,ordinaryGround)).toBe(TERRAIN_SURFACE_WGSL);
  expect(terrainSurfaceWGSL()).toBe(TERRAIN_SURFACE_WGSL);
 });
 it('changes only one line and preserves function signatures and call sites',()=>{
  const original=TERRAIN_SURFACE_WGSL.split('\n'),diagnostic=terrainSurfaceWGSL(true).split('\n');
  expect(diagnostic.length).toBe(original.length);
  const changed=original.flatMap((line,i)=>line===diagnostic[i]?[]:[{before:line,after:diagnostic[i]}]);
  expect(changed).toEqual([{before:ordinaryGround,after:albedoGround}]);
  expect(diagnostic.filter(line=>line.startsWith('fn '))).toEqual(original.filter(line=>line.startsWith('fn ')));
  expect(occurrences(terrainSurfaceWGSL(true),'fn terrainSurfaceMaterial(')).toBe(1);
  expect(terrainSurfaceWGSL(true)).not.toContain('materialDiagnosticMode');
 });
 it('adds no texture operations or material evaluation and retains the lit water/sea expressions',()=>{
  const diagnostic=terrainSurfaceWGSL(true);
  const operations=/\b(?:texture(?:Sample\w*|Load|Store|Gather\w*)|tsFilteredNoise)\s*\(/g;
  expect(diagnostic.match(operations)??[]).toEqual(TERRAIN_SURFACE_WGSL.match(operations)??[]);
  expect(diagnostic).toContain('let inlandWater=vec3<f32>(.018,.055,.067)*(solar*.4+ambient*1.5);');
  expect(diagnostic).toContain('let sea=mix(vec3<f32>(.016,.048,.075),vec3<f32>(.026,.11,.115),shallows)*(solar*.4+ambient*1.5);');
  expect(diagnostic).toContain('return mix(sea,ground,smoothstep(-coastBlendWidth,coastBlendWidth,coastKm));');
 });
 it.each([
  ['missing',TERRAIN_SURFACE_WGSL.replace(ordinaryGround,'')],
  ['duplicate',TERRAIN_SURFACE_WGSL.replace(ordinaryGround,ordinaryGround+'\n'+ordinaryGround)],
  ['changed formula',TERRAIN_SURFACE_WGSL.replace('solar*(.90*diffuse)','solar*(.91*diffuse)')],
 ] as const)('fails closed on a %s source anchor without changing the default library',async(_label,corrupt)=>{
  vi.resetModules();vi.doMock('./terrainSurface',()=>({TERRAIN_SURFACE_WGSL:corrupt}));
  try{
   const mocked=await import('./terrainMaterialDiagnostic');
   expect(()=>mocked.terrainSurfaceWGSL(true)).toThrow('ground line expected exactly one occurrence');
   expect(mocked.terrainSurfaceWGSL()).toBe(corrupt);
  }finally{vi.doUnmock('./terrainSurface');vi.resetModules();}
 });
});
