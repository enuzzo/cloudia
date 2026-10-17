import {terrainOpticalSurfaceWGSL} from './terrainOpticalMaterial';

export type TerrainShadingLedgerMode='ordinary'|'macro-normal'|'final-normal'|'factors';

const materialEntry='\nfn terrainSurfaceMaterial(';
const materialEnd='\n}\nfn terrainSurfaceColour(';
const originalReturn='\n return mix(sea,ground,smoothstep(-coastBlendWidth,coastBlendWidth,coastKm));\n';
const normalLine='\n let p=point.xz+vec2<f32>(hKm*.37,-hKm*.21);let normal=normalize(macroNormal);\n';
const finalNormalLine='\n let n=normalize(normal-vec3<f32>(rough.x,0,rough.y));\n';
const skyLine='\n let skyVisibility=clamp(.62+.38*max(0.0,n.y)-.12*valley,.45,1.0);\n';
const diffuseLine='\n let diffuse=max(0.0,dot(n,sun));\n';

function unique(source:string,anchor:string,label:string):number{
 const index=source.indexOf(anchor);
 if(index<0||source.indexOf(anchor,index+anchor.length)!==-1)
  throw new Error(`Terrain shading ledger: ${label} expected exactly once`);
 return index;
}

/** Diagnostic libraries retain every ordinary source byte except the final
 * material return. Normals are signed, unencoded vectors; factors are not RGB
 * radiance. No new binding, normal/palette replacement or runtime mode uniform.
 * Code generation/DCE can differ from ordinary: never infer its cost or exact
 * compiled pipeline from this diagnostic variant.
 */
export function terrainShadingLedgerWGSL(mode:TerrainShadingLedgerMode='ordinary',optical=true):string{
 const source=terrainOpticalSurfaceWGSL(optical);
 if(mode==='ordinary')return source;
 let expression:string;
 switch(mode){
  case 'macro-normal':expression='normal';break;
  case 'final-normal':expression='n';break;
  case 'factors':expression='vec3<f32>(diffuse,skyVisibility,clamp(solarVisibility,0.0,1.0))';break;
  default:throw new Error('Terrain shading ledger: unknown mode');
 }
 const start=unique(source,materialEntry,'material entry');
 const end=unique(source,materialEnd,'material end');
 const last=unique(source,originalReturn,'final coast return');
 if(start>=last||last+originalReturn.length>end+1)
  throw new Error('Terrain shading ledger: final return outside material');
 for(const [anchor,label] of [[normalLine,'macro normal'],[finalNormalLine,'final normal'],[skyLine,'sky factor'],[diffuseLine,'solar factor']] as const){
  const at=unique(source,anchor,label);
  if(at<=start||at>=last)throw new Error(`Terrain shading ledger: ${label} outside material`);
 }
 return source.replace(originalReturn,`\n return ${expression};\n`);
}
