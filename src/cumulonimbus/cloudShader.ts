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
  detail: texture_3d<f32>, detailSampler: sampler, flow: texture_3d<f32>, flowSampler: sampler, iceRange: vec2<f32>,
  origin: vec3<f32>, forward: vec3<f32>, right: vec3<f32>, up: vec3<f32>,
  aspect: f32, tanFov: f32, stepSize: f32, emptyStep: f32, resolution: vec2<f32>,
  drift: vec3<f32>, growth: vec3<f32>, supportMin:vec3<f32>, supportMax:vec3<f32>,
  sun: vec3<f32>, lightSide: f32, extinction: f32, iceExtinction: f32) -> vec4<f32> {
  let screen = vec2<f32>(uv.x * 2.0 - 1.0, 1.0 - uv.y * 2.0);
  let ray = normalize(forward + right * screen.x * aspect * tanFov + up * screen.y * tanFov);
  let horizon = clamp(ray.y * 1.4 + 0.5, 0.0, 1.0);
  var sky = mix(vec3<f32>(0.52,0.68,0.82), vec3<f32>(0.105,0.285,0.53), horizon);
  let sunGlow = pow(max(dot(ray,sun),0.0), 24.0);
  sky += vec3<f32>(0.18,0.13,0.065) * sunGlow;
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
    let local=reference-textureSampleLevel(flow,flowSampler,referenceCoord,0.0).rgb;
    let coord=(local-vec3<f32>(-5.0,-0.5,-3.5))/vec3<f32>(10.0,8.5,7.0);
    let ice=smoothstep(iceRange.x,iceRange.y,local.y);
    let fine=textureSampleLevel(detail,detailSampler,local*0.3,0.0);
    let warp=(fine.gbr-vec3<f32>(0.5))*mix(vec3<f32>(0.16,0.12,0.16),vec3<f32>(0.08,0.02,0.1),ice);
    let warped=textureSampleLevel(volume,volumeSampler,coord+warp/vec3<f32>(10.0,8.5,7.0),0.0).r;
    if (warped < 0.002) { t += stepSize; continue; }
    var erosion=(1.0-fine.r)*0.38+(1.0-fine.b)*0.08;
    var material=1.0;
    if(ice>0.0) {
      let bend=textureSampleLevel(detail,detailSampler,local*vec3<f32>(0.12,0.10,0.06),0.0).g;
      let iceCoord=vec3<f32>(local.x*0.035+bend*0.06,local.y*0.38+local.x*0.026+(bend-0.5)*0.035,local.z*0.022);
      let wisps=textureSampleLevel(detail,detailSampler,iceCoord,0.0).r;
      erosion=mix(erosion,0.16+(1.0-wisps)*0.64,ice);
      let strand=smoothstep(0.25,0.6,wisps);
      material=mix(1.0,(0.01+0.235*strand)*(1.0-0.7*smoothstep(0.4,3.8,local.x)),ice);
    }
    let density=clamp((warped-erosion)/(1.0-erosion),0.0,1.0)*material;
    if(density<0.002) {t+=stepSize;continue;}
    let voxel = textureSampleLevel(volume,volumeSampler,coord,0.0);
    let sunTau=mix(voxel.g,voxel.b,lightSide)*16.0;
    let solar = exp(-sunTau);
    let skyVisibility = exp(-voxel.a*16.0);
    let direct = vec3<f32>(1.45,1.40,1.30)*solar*sunPhase;
    let ambient = vec3<f32>(0.14,0.185,0.255) * (0.18+0.82*pow(skyVisibility,0.35));
    let multiple = vec3<f32>(1.0,0.985,0.95)*(0.27*exp(-sunTau*0.45)+0.10*exp(-sunTau*0.18)) + vec3<f32>(0.028,0.032,0.04);
    let source = direct + ambient + multiple;
    let opacity = 1.0 - exp(-density * mix(extinction,iceExtinction,ice) * stepSize);
    radiance += transmittance * opacity * source;
    transmittance *= 1.0-opacity;
    t += stepSize;
  }
  let color = radiance + sky*transmittance;
  // Mild exposure shoulder, applied to both the cloud and its atmospheric background.
  let mapped = cloudFilm(color);
  return vec4<f32>(mapped,1.0);
}`, [film,motion]);
