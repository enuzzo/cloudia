import { wgslFn, wgsl } from 'three/tsl';

/** Single-scattering integration with cached solar visibility and a multiple-scattering approximation.
 * Macro density/light and tiled fine erosion are sampled separately; no nested light march.
 * Explicit LOD allows divergent early-exit paths in WGSL. The texture is linear data, not sRGB.
 */
const film = wgsl(`fn cloudFilm(color: vec3<f32>) -> vec3<f32> {
  return clamp((color*(2.51*color+vec3<f32>(0.03))) / (color*(2.43*color+vec3<f32>(0.59))+vec3<f32>(0.14)),vec3<f32>(0.0),vec3<f32>(1.0));
}`);
export const integrateCloud = wgslFn(`
fn integrateCloud(uv: vec2<f32>, volume: texture_3d<f32>, volumeSampler: sampler,
  detail: texture_3d<f32>, detailSampler: sampler, iceRange: vec2<f32>,
  origin: vec3<f32>, forward: vec3<f32>, right: vec3<f32>, up: vec3<f32>,
  aspect: f32, tanFov: f32, stepSize: f32, resolution: vec2<f32>,
  drift: vec3<f32>, sun: vec3<f32>, lightSide: f32, extinction: f32) -> vec4<f32> {
  let screen = vec2<f32>(uv.x * 2.0 - 1.0, 1.0 - uv.y * 2.0);
  let ray = normalize(forward + right * screen.x * aspect * tanFov + up * screen.y * tanFov);
  let horizon = clamp(ray.y * 1.4 + 0.5, 0.0, 1.0);
  var sky = mix(vec3<f32>(0.52,0.68,0.82), vec3<f32>(0.105,0.285,0.53), horizon);
  let sunGlow = pow(max(dot(ray,sun),0.0), 24.0);
  sky += vec3<f32>(0.18,0.13,0.065) * sunGlow;
  let lower = vec3<f32>(-5.0,-0.5,-3.5) + drift;
  let upper = lower + vec3<f32>(10.0,8.5,7.0);
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
  // Dual-lobe approximation retains a gentle silver edge without extreme forward peaks.
  let g = 0.62;
  let phase = (1.0-g*g) / pow(max(1.0+g*g-2.0*g*mu,0.04),1.5);
  let sunPhase = 0.65 + 0.25*phase;
  for (var i=0u; i<640u; i++) {
    if (t > far || transmittance < 0.006) { break; }
    let position = origin + ray*t;
    let coord = (position-lower) / vec3<f32>(10.0,8.5,7.0);
    // Conservative support includes domain displacement and macro interpolation.
    // One cheap mask lookup avoids evaluating fine noise throughout empty sky.
    let support=textureSampleLevel(detail,detailSampler,coord,0.0).a;
    if(support<=0.0) {t+=stepSize*2.0;continue;}
    let local = position-drift;
    let ice=smoothstep(iceRange.x,iceRange.y,local.y);
    let fine=textureSampleLevel(detail,detailSampler,local*0.3,0.0);
    let warp=(fine.gbr-vec3<f32>(0.5))*mix(vec3<f32>(0.16,0.12,0.16),vec3<f32>(0.08,0.02,0.1),ice);
    let warped=textureSampleLevel(volume,volumeSampler,coord+warp/vec3<f32>(10.0,8.5,7.0),0.0).r;
    if (warped < 0.002) { t += stepSize; continue; }
    var erosion=(1.0-fine.r)*0.38+(1.0-fine.b)*0.08;
    if(ice>0.0) {
      let wisps=textureSampleLevel(detail,detailSampler,local*vec3<f32>(0.06,1.1,0.28),0.0).r;
      erosion=mix(erosion,(1.0-wisps)*0.52,ice);
    }
    let density=clamp((warped-erosion)/(1.0-erosion),0.0,1.0);
    if(density<0.002) {t+=stepSize;continue;}
    let voxel = textureSampleLevel(volume,volumeSampler,coord,0.0);
    let solar = exp(-mix(voxel.g,voxel.b,lightSide)*16.0);
    let skyVisibility = exp(-voxel.a*16.0);
    let direct = vec3<f32>(1.25,1.22,1.16)*solar*sunPhase;
    let ambient = vec3<f32>(0.18,0.215,0.27) * (0.2+0.8*pow(skyVisibility,0.28));
    let multiple = vec3<f32>(0.32,0.33,0.35) * pow(solar,0.3) + vec3<f32>(0.03,0.036,0.048);
    let source = direct + ambient + multiple;
    let opacity = 1.0 - exp(-density * extinction * stepSize);
    radiance += transmittance * opacity * source;
    transmittance *= 1.0-opacity;
    t += stepSize;
  }
  let color = radiance + sky*transmittance;
  // Mild exposure shoulder, applied to both the cloud and its atmospheric background.
  let mapped = cloudFilm(color);
  return vec4<f32>(mapped,1.0);
}`, [film]);
