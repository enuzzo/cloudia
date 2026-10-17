import {TERRAIN_SURFACE_WGSL} from './terrainSurface';

const ordinaryGround='\n let ground=albedo*(solar*(.90*diffuse)*clamp(solarVisibility,0.0,1.0)+ambient*(1.12*skyVisibility))+inlandWater*coverB.w;\n';
const albedoGround='\n let ground=albedo+inlandWater*coverB.w;\n';

/** Immutable, owner-selected material diagnostic. Default is the original WGSL
 * library byte for byte. True changes exactly one complete source line, leaving
 * function signatures, calls, sea/water and all other material formulas intact.
 * Each mode has a separate owner/pipeline; ordinary GPU parity must be checked
 * before interpreting albedo output. No uniform, binding or lookup is added.
 */
export function terrainSurfaceWGSL(diagnostic=false):string{
 if(!diagnostic)return TERRAIN_SURFACE_WGSL;
 const index=TERRAIN_SURFACE_WGSL.indexOf(ordinaryGround);
 if(index<0||TERRAIN_SURFACE_WGSL.indexOf(ordinaryGround,index+1)>=0)
  throw new Error('Terrain albedo diagnostic: ground line expected exactly one occurrence');
 return TERRAIN_SURFACE_WGSL.slice(0,index)+albedoGround+TERRAIN_SURFACE_WGSL.slice(index+ordinaryGround.length);
}
