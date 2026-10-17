import {TERRAIN_SURFACE_WGSL} from './terrainSurface';

const materialSignature='fn terrainSurfaceMaterial(point:vec3<f32>,hKm:f32,coastKm:f32,macroNormal:vec3<f32>,distanceKm:f32,pixelKm:f32,sun:vec3<f32>,solar:vec3<f32>,ambient:vec3<f32>,solarVisibility:f32,coverA:vec4<f32>,coverB:vec4<f32>)->vec3<f32>{';
const diagnosticSignature=materialSignature.replace('coverB:vec4<f32>)','coverB:vec4<f32>,materialDiagnosticMode:f32)');
const materialReturn=' return mix(sea,ground,smoothstep(-coastBlendWidth,coastBlendWidth,coastKm));';
const diagnosticReturn=' return mix(sea,select(ground,albedo+inlandWater*coverB.w,materialDiagnosticMode>0.5),smoothstep(-coastBlendWidth,coastBlendWidth,coastKm));';
const fallbackReturn=' return terrainSurfaceMaterial(point,field.x,field.w,normal,distanceKm,pixelKm,sun,solar,ambient,1.0,vec4<f32>(1.0,0.0,0.0,0.0),vec4<f32>(0.0));';
const diagnosticFallbackReturn=' return terrainSurfaceMaterial(point,field.x,field.w,normal,distanceKm,pixelKm,sun,solar,ambient,1.0,vec4<f32>(1.0,0.0,0.0,0.0),vec4<f32>(0.0),0.0);';

function replaceExactlyOnce(source:string,before:string,after:string,label:string):string{
 const index=source.indexOf(before);
 if(index<0||source.indexOf(before,index+before.length)>=0)throw new Error(`Terrain material diagnostic: ${label} expected exactly one occurrence`);
 return source.slice(0,index)+after+source.slice(index+before.length);
}

/** Default returns the original library byte for byte. The diagnostic library
 * adds one explicit f32 argument: 0 selects ordinary, 1 unlit land albedo.
 * All original material/noise/derivative expressions remain a single copy and
 * are evaluated before the final select. Sea and inland-water terms stay live.
 *
 * The diagnostic owner must bind a uniform mode and include it in cacheInputs.
 * A shared compiled diagnostic pipeline still requires actual mode0 parity;
 * preserving source expressions does not promise identical driver bytecode.
 */
export function terrainSurfaceWGSL(diagnostic=false):string{
 if(!diagnostic)return TERRAIN_SURFACE_WGSL;
 let source=replaceExactlyOnce(TERRAIN_SURFACE_WGSL,materialSignature,diagnosticSignature,'material signature');
 source=replaceExactlyOnce(source,materialReturn,diagnosticReturn,'material return');
 return replaceExactlyOnce(source,fallbackReturn,diagnosticFallbackReturn,'fallback return');
}
