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
const channel=wgsl(`fn lightningChannelDistance(p:vec3<f32>,a:vec3<f32>,b:vec3<f32>)->f32 {
  let ab=b-a;let u=clamp(dot(p-a,ab)/max(dot(ab,ab),0.0001),0.0,1.0);
  let d=p-a-ab*u;return dot(d,d);
}`);
export const integrateCloud = wgslFn(`
fn integrateCloud(uv: vec2<f32>, volume: texture_3d<f32>, volumeSampler: sampler,
  skyLUT: texture_2d<f32>, skySampler: sampler, solarColor:vec3<f32>, ambientColor:vec3<f32>, weather:vec3<f32>, forcing:vec2<f32>, wind:vec2<f32>, flash:vec4<f32>, flashTop:vec3<f32>, flashBend:vec3<f32>, flashEnd:vec3<f32>, flashBranch:vec3<f32>,
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
  sky*=1.0-weather.y*0.12;
  let flashDirection=normalize(flash.xyz+drift-origin);
  sky+=vec3<f32>(0.12,0.122,0.126)*flash.w*(0.15+pow(max(0.0,dot(ray,flashDirection)),32.0));
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
  let maskInset=vec3<f32>(0.5)/vec3<f32>(textureDimensions(detail,0));
  let massFactor=pow(1.0-0.9*forcing.x,1.3);
  let mu = dot(ray,sun);
  // View ray points into the volume; sun points toward the light. HG is
  // expressed relative to isotropic scattering (the 4pi factor is absorbed by intensity).
  let forwardPhase=(1.0-0.68*0.68)/pow(max(1.0+0.68*0.68-2.0*0.68*mu,0.04),1.5);
  let backPhase=(1.0-0.25*0.25)/pow(max(1.0+0.25*0.25+2.0*0.25*mu,0.04),1.5);
  let sunPhase=0.45+0.55*(0.82*forwardPhase+0.18*backPhase);
  for (var i=0u; i<1024u; i++) {
    if (t > far || transmittance < 0.006) { break; }
    let position = origin + ray*t;
    let reference=cloudReference(position-drift,growth,iceRange,wind);
    // Conservative support includes domain displacement and macro interpolation.
    // One cheap mask lookup avoids evaluating fine noise throughout empty sky.
    let referenceCoord=(reference-vec3<f32>(-5.0,-0.5,-3.5))/vec3<f32>(10.0,8.5,7.0);
    let support=textureSampleLevel(detail,detailSampler,clamp(referenceCoord,maskInset,vec3<f32>(1.0)-maskInset),0.0).a;
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
      let iceCoord=vec3<f32>(local.x*0.055+bend*0.08,local.y*0.34+local.x*0.022+(bend-0.5)*0.06,local.z*0.08+(bend-0.5)*0.025);
      let iceDetail=textureSampleLevel(detail,detailSampler,iceCoord,0.0);
      let wisps=iceDetail.r;
      erosion=mix(erosion,0.08+(1.0-wisps)*0.5+flowValue.a,ice);
      let strand=smoothstep(0.3,0.7,wisps);
      material=mix(1.0,(0.012+0.56*pow(strand,1.7))*(0.65+0.35*smoothstep(0.25,0.75,iceDetail.b))*(1.0-0.7*smoothstep(0.4,3.8,local.x)),ice);
    }
    erosion=min(0.92,erosion+forcing.x*(0.11+0.32*(1.0-fine.r)));
    let fragments=mix(1.0,smoothstep(0.25,0.7,fine.r),forcing.x);
    let density=clamp((warped-erosion)/(1.0-erosion),0.0,1.0)*material*massFactor*fragments;
    if(density<0.002) {t+=stepSize;continue;}
    let voxel = textureSampleLevel(volume,volumeSampler,coord,0.0);
    let sunTau=mix(voxel.g,voxel.b,lightSide)*16.0*massFactor;
    let solar = exp(-sunTau);
    let skyVisibility = exp(-voxel.a*16.0*massFactor);
    let direct = solarColor*1.65*solar*sunPhase*(1.0-weather.y*0.15);
    let ambient = ambientColor * (0.18+0.82*pow(skyVisibility,0.35))*(1.0-weather.y*0.1);
    let multiple = vec3<f32>(1.0,0.985,0.95)*(0.27*exp(-sunTau*0.45)+0.10*exp(-sunTau*0.18)) + vec3<f32>(0.028,0.032,0.04);
    var source = direct + ambient + multiple*(1.0-weather.y*0.13);
    if(flash.w>0.001){
      // Same bent scene-space channel for every density sample; view integration
      // attenuates it through the intervening cloud instead of drawing a screen bolt.
      let p=position-drift;
      let r2=min(min(lightningChannelDistance(p,flashTop,flash.xyz),lightningChannelDistance(p,flash.xyz,flashBend)),
        min(lightningChannelDistance(p,flashBend,flashEnd),lightningChannelDistance(p,flashBend,flashBranch)));
      let glow=12.0*exp(-r2*700.0)+1.25*exp(-r2*1.4)+0.3/(1.0+r2*4.0);
      source+=vec3<f32>(0.92,0.95,1.0)*flash.w*glow;

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
}`, [film,motion,channel]);
