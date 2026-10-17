// @vitest-environment node
import {createHash} from 'node:crypto';
import {describe,expect,it,vi} from 'vitest';
import {terrainOpticalSurfaceWGSL} from './terrainOpticalMaterial';
import {terrainShadingLedgerWGSL,type TerrainShadingLedgerMode} from './terrainShadingLedger';

const originalReturn='\n return mix(sea,ground,smoothstep(-coastBlendWidth,coastBlendWidth,coastKm));\n';
const outputs=[['macro-normal','normal'],['final-normal','n'],['factors','vec3<f32>(diffuse,skyVisibility,clamp(solarVisibility,0.0,1.0))']] as const;
const sha=(value:string)=>createHash('sha256').update(value,'utf8').digest('hex');

describe('immutable terrain shading ledger source derivation',()=>{
 it('returns the existing optical ordinary bytes by default, and exact canonical bytes when disabled',()=>{
  expect(terrainShadingLedgerWGSL()).toBe(terrainOpticalSurfaceWGSL(true));
  expect(terrainShadingLedgerWGSL('ordinary',true)).toBe(terrainOpticalSurfaceWGSL(true));
  expect(terrainShadingLedgerWGSL('ordinary',false)).toBe(terrainOpticalSurfaceWGSL(false));
  expect(sha(terrainShadingLedgerWGSL('ordinary',false))).toBe('1099a97f339851e3d520a4e4cfdd3831f865832c98660c1535a7754d387e55df');
 });
 it.each(outputs)('changes only one material return for %s, in either optical variant', (mode,expression)=>{
  for(const optical of [true,false]){
   const baseline=terrainOpticalSurfaceWGSL(optical),actual=terrainShadingLedgerWGSL(mode,optical),replacement=`\n return ${expression};\n`;
   expect(actual.split(replacement)).toHaveLength(2);
   expect(actual.replace(replacement,originalReturn)).toBe(baseline);
   // Full inverse equality above protects palettes, noise, roughness, lighting,
   // water, declarations, material arguments and fallback, not just a count.
   expect(actual.match(/fn terrainSurfaceMaterial\([^\n]+/g)).toEqual(baseline.match(/fn terrainSurfaceMaterial\([^\n]+/g));
   expect(terrainShadingLedgerWGSL('ordinary',optical)).toBe(baseline);
  }
 });
 it('does not encode normals or apply coast/water/radiance composition to diagnostics',()=>{
  expect(terrainShadingLedgerWGSL('macro-normal')).toContain('\n return normal;\n');
  expect(terrainShadingLedgerWGSL('final-normal')).toContain('\n return n;\n');
  expect(terrainShadingLedgerWGSL('factors')).toContain('\n return vec3<f32>(diffuse,skyVisibility,clamp(solarVisibility,0.0,1.0));\n');
  expect(()=>terrainShadingLedgerWGSL('invalid' as TerrainShadingLedgerMode)).toThrow('unknown mode');
 });
 const baseline=terrainOpticalSurfaceWGSL(true);
 const changedSources=[
  ['missing material entry',baseline.replace('\nfn terrainSurfaceMaterial(','\nfn changedMaterial(')],
  ['duplicate material entry',baseline+'\nfn terrainSurfaceMaterial('],
  ['missing final return',baseline.replace(originalReturn,'\n return ground;\n')],
  ['duplicate final return',baseline+originalReturn],
  ['changed normal',baseline.replace('let normal=normalize(macroNormal);','let normal=macroNormal;')],
  ['renamed final normal',baseline.replace('let n=normalize(normal-','let nChanged=normalize(normal-')],
  ['changed sky',baseline.replace('skyVisibility=clamp(.62+','skyVisibility=clamp(.63+')],
  ['changed diffuse',baseline.replace('diffuse=max(0.0,dot(n,sun))','diffuse=max(0.1,dot(n,sun))')],
  ['return moved beyond material',baseline.replace(originalReturn,'\n')+originalReturn],
 ] as const;
 it.each(changedSources)('fails closed for %s while ordinary still returns upstream bytes',async(_label,source)=>{
  vi.resetModules();vi.doMock('./terrainOpticalMaterial',()=>({terrainOpticalSurfaceWGSL:()=>source}));
  try{
   const changed=await import('./terrainShadingLedger');
   for(const [mode] of outputs)expect(()=>changed.terrainShadingLedgerWGSL(mode)).toThrow('Terrain shading ledger:');
   expect(changed.terrainShadingLedgerWGSL('ordinary')).toBe(source);
  }finally{vi.doUnmock('./terrainOpticalMaterial');vi.resetModules();}
 });
});
