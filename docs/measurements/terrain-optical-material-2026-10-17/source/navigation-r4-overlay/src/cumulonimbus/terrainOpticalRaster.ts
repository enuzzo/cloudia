import {terrainOpticalSurfaceWGSL} from './terrainOpticalMaterial';

/** Canonical wrapper returned byte-for-byte when disabled. Immutable owner variant. */
const ORIGINAL_TERRAIN_RASTER_WGSL=`fn terrainRasterColour(point:vec3<f32>,normal:vec3<f32>,height:f32,coast:f32,distance:f32,sun:vec3<f32>,solar:vec3<f32>,ambient:vec3<f32>,solarVisibility:f32,coverMapA:texture_2d<f32>,coverSamplerA:sampler,coverMapB:texture_2d<f32>,coverSamplerB:sampler)->vec3<f32>{
      let pixelKm=max(max(length(dpdx(point)),length(dpdy(point))),.00001);
      // Cell edges at -64/+64km; UV texel centres match the source cell means.
      // Hardware area mips avoid point-sampling cover at coarse mesh vertices.
      let coverUV=(point.xz+vec2<f32>(64.0))/128.0;
      let a=textureSample(coverMapA,coverSamplerA,coverUV);
      let b=textureSample(coverMapB,coverSamplerB,coverUV);
      let total=max(dot(a+b,vec4<f32>(1.0)),.00001);
      let measured=(1.0-smoothstep(48.0,64.0,abs(point.x)))*(1.0-smoothstep(48.0,64.0,abs(point.z)));
      let coverA=mix(vec4<f32>(1.0,0.0,0.0,0.0),a/total,measured);
      let coverB=b*(measured/total);
      return terrainSurfaceMaterial(point,height,coast,normal,distance,pixelKm,sun,solar,ambient,solarVisibility,coverA,coverB);
    }`;
export function terrainOpticalRasterWGSL(enabled=false):string{
 if(!enabled)return ORIGINAL_TERRAIN_RASTER_WGSL;
 const signature='coverSamplerB:sampler)->vec3<f32>{';
 const call='solarVisibility,coverA,coverB);';
 if(ORIGINAL_TERRAIN_RASTER_WGSL.split(signature).length!==2||ORIGINAL_TERRAIN_RASTER_WGSL.split(call).length!==2)throw new Error('Optical raster anchors changed');
 return ORIGINAL_TERRAIN_RASTER_WGSL.replace(signature,'coverSamplerB:sampler,opticalMap:texture_2d<f32>,opticalSampler:sampler)->vec3<f32>{').replace(call,'solarVisibility,coverA,coverB,textureSample(opticalMap,opticalSampler,coverUV));');
}
export {terrainOpticalSurfaceWGSL};
