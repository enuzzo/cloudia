import { wgslFn, wgsl } from 'three/tsl';
import { MOTION_WGSL } from './motion';

/** Single-scattering integration with cached solar visibility and a multiple-scattering approximation.
 * Macro density/light and tiled fine erosion are sampled separately; no nested light march.
 * Explicit LOD allows divergent early-exit paths in WGSL. The texture is linear data, not sRGB.
 */
const film = wgsl(`fn cloudFilm(color: vec3<f32>) -> vec3<f32> {
  return clamp((color*(2.51*color+vec3<f32>(0.03))) / (color*(2.43*color+vec3<f32>(0.59))+vec3<f32>(0.14)),vec3<f32>(0.0),vec3<f32>(1.0));
}`);
const motion = wgsl(MOTION_WGSL);
export const integrateCloud = wgslFn(`
fn integrateCloud(uv: vec2<f32>, volume: texture_3d<f32>, volumeSampler: sampler,
  skyLUT: texture_2d<f32>, skySampler: sampler, solarColor:vec3<f32>, ambientColor:vec3<f32>, weather:vec3<f32>, flash:vec4<f32>,
  detail: texture_3d<f32>, detailSampler: sampler, flow: texture_3d<f32>, flowSampler: sampler, iceRange: vec2<f32>,
  origin: vec3<f32>, forward: vec3<f32>, right: vec3<f32>, up: vec3<f32>,
  aspect: f32, tanFov: f32, stepSize: f32, emptyStep: f32, resolution: vec2<f32>,
  drift: vec3<f32>, growth: vec3<f32>, supportMin:vec3<f32>, supportMax:vec3<f32>,
  sun: vec3<f32>, lightSide: f32, extinction: f32, iceExtinction: f32) -> vec4<f32> {
  let screen = vec2<f32>(uv.x * 2.0 - 1.0, 1.0 - uv.y * 2.0);
  let ray = normalize(forward + right * screen.x * aspect * tanFov + up * screen.y * tanFov);
  let horizontal=max(length(ray.xz)*length(sun.xz),0.0001);
  let azimuth=clamp(dot(ray.xz,sun.xz)/horizontal,-1.0,1.0);
  let skyUV=vec2<f32>(azimuth*0.5+0.5,sign(ray.y)*sqrt(abs(ray.y))*0.5+0.5);
  var sky=textureSampleLevel(skyLUT,skySampler,skyUV,0.0).rgb;
  sky*=1.0-weather.y*0.48;
  let flashDirection=normalize(flash.xyz+drift-origin);
  sky+=vec3<f32>(0.12,0.145,0.19)*flash.w*(0.15+pow(max(0.0,dot(ray,flashDirection)),32.0));
  let lower = supportMin + drift;
  let upper = supportMax + drift;
  let inv = 1.0 / ray;
  let t0 = (lower-origin)*inv;
  let t1 = (upper-origin)*inv;
  let near3 = min(t0,t1); let far3 = max(t0,t1);
  let near = max(0.0, max(near3.x, max(near3.y,near3.z)));
  let far = min(far3.x,min(far3.y,far3.z));
  if (far <= near) { return vec4<f32>(cloudFilm(sky),1.0); }
  let pixel = floor(uv*resolution);
  let jitter = fract(52.9829189 * fract(dot(pixel,vec2<f32>(0.06711056,0.00583715))));
  var t = near + stepSize*jitter;
  var transmittance = 1.0;
  var radiance = vec3<f32>(0.0);
  let mu = dot(ray,sun);
  // View ray points into the volume; sun points toward the light. HG is
  // expressed relative to isotropic scattering (the 4pi factor is absorbed by intensity).
  let forwardPhase=(1.0-0.68*0.68)/pow(max(1.0+0.68*0.68-2.0*0.68*mu,0.04),1.5);
  let backPhase=(1.0-0.25*0.25)/pow(max(1.0+0.25*0.25+2.0*0.25*mu,0.04),1.5);
  let sunPhase=0.45+0.55*(0.82*forwardPhase+0.18*backPhase);
  for (var i=0u; i<1024u; i++) {
    if (t > far || transmittance < 0.006) { break; }
    let position = origin + ray*t;
    let reference=cloudReference(position-drift,growth,iceRange);
    // Conservative support includes domain displacement and macro interpolation.
    // One cheap mask lookup avoids evaluating fine noise throughout empty sky.
    let referenceCoord=(reference-vec3<f32>(-5.0,-0.5,-3.5))/vec3<f32>(10.0,8.5,7.0);
    let support=textureSampleLevel(detail,detailSampler,referenceCoord,0.0).a;
    if(support<=0.0) {t+=emptyStep;continue;}
    // The compute pass interpolates time once per flow voxel, rather than per ray sample.
    let flowValue=textureSampleLevel(flow,flowSampler,referenceCoord,0.0);
    let local=reference-flowValue.rgb;
    let coord=(local-vec3<f32>(-5.0,-0.5,-3.5))/vec3<f32>(10.0,8.5,7.0);
    let ice=smoothstep(iceRange.x,iceRange.y,local.y);
    let fine=textureSampleLevel(detail,detailSampler,local*0.3,0.0);
    let warp=(fine.gbr-vec3<f32>(0.5))*mix(vec3<f32>(0.16,0.12,0.16),vec3<f32>(0.08,0.02,0.1),ice);
    let warped=textureSampleLevel(volume,volumeSampler,coord+warp/vec3<f32>(10.0,8.5,7.0),0.0).r;
    if (warped < 0.002) { t += stepSize; continue; }
    var erosion=(1.0-fine.r)*0.38+(1.0-fine.b)*0.08+flowValue.a;
    var material=1.0;
    if(ice>0.0) {
      let bend=textureSampleLevel(detail,detailSampler,local*vec3<f32>(0.12,0.10,0.06),0.0).g;
      let iceCoord=vec3<f32>(local.x*0.05+bend*0.06,local.y*0.42+local.x*0.026+(bend-0.5)*0.035,local.z*0.022);
      let wisps=textureSampleLevel(detail,detailSampler,iceCoord,0.0).r;
      erosion=mix(erosion,0.11+(1.0-wisps)*0.78+flowValue.a,ice);
      let strand=smoothstep(0.3,0.7,wisps);
      material=mix(1.0,(0.008+0.22*pow(strand,1.7))*(1.0-0.7*smoothstep(0.4,3.8,local.x)),ice);
    }
    let density=clamp((warped-erosion)/(1.0-erosion),0.0,1.0)*material;
    if(density<0.002) {t+=stepSize;continue;}
    let voxel = textureSampleLevel(volume,volumeSampler,coord,0.0);
    let sunTau=mix(voxel.g,voxel.b,lightSide)*16.0;
    let solar = exp(-sunTau);
    let skyVisibility = exp(-voxel.a*16.0);
    let direct = solarColor*1.65*solar*sunPhase*(1.0-weather.y*0.38);
    let ambient = ambientColor * (0.18+0.82*pow(skyVisibility,0.35))*(1.0-weather.y*0.3);
    let multiple = vec3<f32>(1.0,0.985,0.95)*(0.27*exp(-sunTau*0.45)+0.10*exp(-sunTau*0.18)) + vec3<f32>(0.028,0.032,0.04);
    var source = direct + ambient + multiple*(1.0-weather.y*0.24);
    if(flash.w>0.001){
      // Shared scene-space source: growth/flow change cloud material, not the
      // position of the discharge or its matching atmospheric halo.
      let delta=position-(flash.xyz+drift);
      // Distributed internal channel, with a diffuse scattering halo. No screen overlay.
      let branch=position-(flash.xyz+drift+vec3<f32>(0.65,0.55,-0.25));
      let r2=min(dot(delta,delta),dot(branch,branch));
      let glow=exp(-r2*2.4)*3.8+0.8/(1.0+r2*1.6);
      source+=vec3<f32>(0.82,0.9,1.0)*flash.w*glow;
    }
    let opacity = 1.0 - exp(-density * mix(extinction,iceExtinction,ice) * stepSize);
    radiance += transmittance * opacity * source;
    transmittance *= 1.0-opacity;
    t += stepSize;
  }
  let aerial=exp(-weather.x*0.0035*near);
  let color = mix(sky,radiance + sky*transmittance,aerial);
  // Mild exposure shoulder, applied to both the cloud and its atmospheric background.
  let mapped = cloudFilm(color);
  return vec4<f32>(mapped,1.0);
}`, [film,motion]);
