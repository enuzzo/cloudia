import { wgslFn, wgsl } from 'three/tsl';

/** Single-scattering integration with cached solar visibility and a multiple-scattering approximation.
 * Every occupied sample fetches one RGBA texel; there is no nested light march.
 * Explicit LOD allows divergent early-exit paths in WGSL. The texture is linear data, not sRGB.
 */
const film = wgsl(`fn cloudFilm(color: vec3<f32>) -> vec3<f32> {
  return clamp((color*(2.51*color+vec3<f32>(0.03))) / (color*(2.43*color+vec3<f32>(0.59))+vec3<f32>(0.14)),vec3<f32>(0.0),vec3<f32>(1.0));
}`);
export const integrateCloud = wgslFn(`
fn integrateCloud(uv: vec2<f32>, volume: texture_3d<f32>, volumeSampler: sampler,
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
  for (var i=0u; i<384u; i++) {
    if (t > far || transmittance < 0.006) { break; }
    let position = origin + ray*t;
    let coord = (position-lower) / vec3<f32>(10.0,8.5,7.0);
    let voxel = textureSampleLevel(volume,volumeSampler,coord,0.0);
    let density = voxel.r;
    if (density < 0.002) { t += stepSize*2.0; continue; }
    let solar = exp(-mix(voxel.g,voxel.b,lightSide)*16.0);
    let skyVisibility = exp(-voxel.a*16.0);
    let direct = vec3<f32>(1.55,1.48,1.38)*solar*sunPhase;
    let ambient = vec3<f32>(0.16,0.23,0.34) * (0.18+0.82*pow(skyVisibility,0.22));
    let multiple = vec3<f32>(0.42,0.43,0.44) * pow(solar,0.22) + vec3<f32>(0.025,0.034,0.045);
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
