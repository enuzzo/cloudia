import {TERRAIN_SURFACE_WGSL} from './terrainSurface';

const materialSignature='\nfn terrainSurfaceMaterial(point:vec3<f32>,hKm:f32,coastKm:f32,macroNormal:vec3<f32>,distanceKm:f32,pixelKm:f32,sun:vec3<f32>,solar:vec3<f32>,ambient:vec3<f32>,solarVisibility:f32,coverA:vec4<f32>,coverB:vec4<f32>)->vec3<f32>{\n';
const opticalSignature=materialSignature.replace('coverB:vec4<f32>)','coverB:vec4<f32>,observed:vec4<f32>)');
const ordinaryAlbedo='\n let albedo=authored*coverA.x+forest*coverA.y+grass*coverA.z+crops*coverA.w+built*coverB.x+rock*coverB.y+snow*coverB.z;\n';
const opticalAlbedo=`
 let unknownAlbedo=authored*coverA.x;
 let knownPalette=forest*coverA.y+grass*coverA.z+crops*coverA.w+built*coverB.x+rock*coverB.y+snow*coverB.z;
 let knownLandWeight=coverA.y+coverA.z+coverA.w+coverB.x+coverB.y+coverB.z;
 let albedo=unknownAlbedo+(1.0-observed.a)*knownPalette+knownLandWeight*observed.rgb;
`;
const ordinaryFallback='\n return terrainSurfaceMaterial(point,field.x,field.w,normal,distanceKm,pixelKm,sun,solar,ambient,1.0,vec4<f32>(1.0,0.0,0.0,0.0),vec4<f32>(0.0));\n';
const opticalFallback=ordinaryFallback.replace('vec4<f32>(0.0));','vec4<f32>(0.0),vec4<f32>(0.0));');
const groundGuard='\n let ground=albedo*(solar*(.90*diffuse)*clamp(solarVisibility,0.0,1.0)+ambient*(1.12*skyVisibility))+inlandWater*coverB.w;\n';

function unique(source:string,anchor:string,label:string):void{
 const index=source.indexOf(anchor);
 if(index<0||source.indexOf(anchor,index+anchor.length)!==-1)
  throw new Error(`Terrain optical material: ${label} expected exactly one occurrence`);
}

/** Immutable owner-selected trial. False returns the canonical library exactly,
 * including the original signature/bindings. True changes only material input,
 * albedo composition and the analytic fallback call. The wrapper alone owns the
 * extra texture sample. observed.rgb is already linear RGB*validity: no alpha
 * division, gain, gamma, clamping, class normalization or radiometric claim.
 */
export function terrainOpticalSurfaceWGSL(enabled=false):string{
 if(!enabled)return TERRAIN_SURFACE_WGSL;
 const source=TERRAIN_SURFACE_WGSL;
 unique(source,materialSignature,'material signature');unique(source,ordinaryAlbedo,'albedo line');
 unique(source,ordinaryFallback,'fallback call');unique(source,groundGuard,'unchanged ground line');
 // A previously derived/partly integrated library must not be transformed twice.
 if(/\bobserved\b|\bunknownAlbedo\b|\bknownPalette\b|\bknownLandWeight\b/.test(source))
  throw new Error('Terrain optical material: optical identifiers already present');
 return source.replace(materialSignature,opticalSignature).replace(ordinaryAlbedo,opticalAlbedo).replace(ordinaryFallback,opticalFallback);
}
