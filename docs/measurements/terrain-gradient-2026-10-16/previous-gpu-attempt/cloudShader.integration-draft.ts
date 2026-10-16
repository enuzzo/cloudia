import { wgslFn, wgsl } from 'three/tsl';
import { MOTION_WGSL } from './motion';
import {LANDSCAPE_WGSL} from './landscape';
import {createTerrainCode} from './terrainTrace.generated';
import {MEDIA_WGSL} from './medium';
import {PRECIPITATION_WGSL,RAIN_SAMPLE_STEP,RAIN_WIND_DISPLACEMENT_BOUND,RAIN_EXTINCTION} from './precipitation';

/** Single-scattering integration with cached solar visibility and a multiple-scattering approximation.
 * Macro density/light and tiled fine erosion are sampled separately; no nested light march.
 * Explicit LOD allows divergent early-exit paths in WGSL. The texture is linear data, not sRGB.
 */
const film = wgsl(`fn cloudFilm(color: vec3<f32>) -> vec3<f32> {
  return clamp((color*(2.51*color+vec3<f32>(0.03))) / (color*(2.43*color+vec3<f32>(0.59))+vec3<f32>(0.14)),vec3<f32>(0.0),vec3<f32>(1.0));
}`);
const motion = wgsl(MOTION_WGSL);
const landscape=wgsl(LANDSCAPE_WGSL);
const terrainBounds=createTerrainCode();
const media=wgsl(MEDIA_WGSL);
const precipitation=wgsl(PRECIPITATION_WGSL);
const channel=wgsl(`fn lightningChannelDistance(p:vec3<f32>,a:vec3<f32>,b:vec3<f32>)->f32 {
  let ab=b-a;let u=clamp(dot(p-a,ab)/max(dot(ab,ab),0.0001),0.0,1.0);
  let d=p-a-ab*u;return dot(d,d);
}`);
const integrationSource = `
fn integrateCloud(uv: vec2<f32>, volume: texture_3d<f32>, volumeSampler: sampler,
  inspection:f32, ground:f32, terrainNodes:texture_2d<f32>, terrainNodeCount:f32, terrainQualified:f32, rainBounds:vec4<f32>, rainMap:texture_2d<f32>, rainSampler:sampler,
  sunsetLight:texture_3d<f32>, sunsetSampler:sampler, sunsetAmount:f32,
  skyLUT: texture_2d<f32>, skySampler: sampler, skyFrom:texture_2d<f32>, skyFromSampler:sampler, atmosphereBlend:f32, precipitationTime:f32, solarColor:vec3<f32>, ambientColor:vec3<f32>, weather:vec3<f32>, forcing:vec2<f32>, wind:vec2<f32>, flash:vec4<f32>, flashTop:vec3<f32>, flashBend:vec3<f32>, flashEnd:vec3<f32>, flashBranch:vec3<f32>,
  detail: texture_3d<f32>, detailSampler: sampler, flow: texture_3d<f32>, flowSampler: sampler, iceRange: vec2<f32>,
  origin: vec3<f32>, forward: vec3<f32>, right: vec3<f32>, up: vec3<f32>,
  aspect: f32, tanFov: f32, stepSize: f32, emptyStep: f32, resolution: vec2<f32>,
  drift: vec3<f32>, growth: vec3<f32>, supportMin:vec3<f32>, supportMax:vec3<f32>,
  sun: vec3<f32>, lightSide: f32, extinction: f32, iceExtinction: f32) -> vec4<f32> {
  let screen = vec2<f32>(uv.x * 2.0 - 1.0, 1.0 - uv.y * 2.0 - 0.16*(1.0-inspection));
  let ray = normalize(forward + right * screen.x * aspect * tanFov + up * screen.y * tanFov);
  let horizontal=max(length(ray.xz)*length(sun.xz),0.0001);
  let azimuth=clamp(dot(ray.xz,sun.xz)/horizontal,-1.0,1.0);
  let skyUV=vec2<f32>(azimuth*0.5+0.5,sign(ray.y)*sqrt(abs(ray.y))*0.5+0.5);
  var sky=mix(textureSampleLevel(skyFrom,skyFromSampler,skyUV,0.0).rgb,textureSampleLevel(skyLUT,skySampler,skyUV,0.0).rgb,atmosphereBlend);
  sky*=1.0-weather.y*0.12;
  let flashDirection=normalize(flash.xyz+drift-origin);
  sky+=vec3<f32>(0.12,0.122,0.126)*flash.w*(0.15+pow(max(0.0,dot(ray,flashDirection)),32.0));
  var backdrop=sky;
  var groundDistance=10000.0;
  let groundAmount=ground;
  if(groundAmount>0.001){
    let terrainHit=traceTerrainBounds(origin,ray,terrainNodes,terrainNodeCount,terrainQualified);
    if(terrainHit.z==1.0){
      groundDistance=(terrainHit.x+terrainHit.y)*0.5;
      backdrop=mix(sky,landscapeColor(origin+ray*groundDistance,groundDistance,sun,solarColor,ambientColor,sky,weather.x),groundAmount);
    }else if(terrainHit.z!=0.0){
      // Explicit QA signal: unresolved pixels cannot count as sky/valid FPS.
      return vec4<f32>(1.0,0.0,1.0,1.0);
    }
  }
  let hasRain=weather.z>0.001 && rainBounds.z>rainBounds.x && rainBounds.w>rainBounds.y;
  // Source bounds include the bilinear halo. At base<=2.5 and y>=-4.75,
  // falling drift plus source shear is bounded by 7.25*.32+.155 < 2.5.
  let rainMinXZ=rainBounds.xy/growth.y+min(wind*${RAIN_WIND_DISPLACEMENT_BOUND},vec2<f32>(0.0));
  let rainMaxXZ=rainBounds.zw/growth.y+max(wind*${RAIN_WIND_DISPLACEMENT_BOUND},vec2<f32>(0.0));
  let rainLower=vec3<f32>(rainMinXZ.x,-4.75,rainMinXZ.y)+drift;
  // The attachment fades through base+.3, including sources near the 2.5 km ceiling.
  let rainUpper=vec3<f32>(rainMaxXZ.x,2.8,rainMaxXZ.y)+drift;
  let lower = min(supportMin+drift,select(supportMin+drift,rainLower,hasRain));
  let upper = max(supportMax+drift,select(supportMax+drift,rainUpper,hasRain));
  let inv = 1.0 / ray;
  let t0 = (lower-origin)*inv;
  let t1 = (upper-origin)*inv;
  let near3 = min(t0,t1); let far3 = max(t0,t1);
  let near = max(0.0, max(near3.x, max(near3.y,near3.z)));
  let far = min(groundDistance,min(far3.x,min(far3.y,far3.z)));
  let rainT0=(rainLower-origin)*inv;let rainT1=(rainUpper-origin)*inv;
  let rainNear3=min(rainT0,rainT1);let rainFar3=max(rainT0,rainT1);
  let rainNear=max(0.0,max(rainNear3.x,max(rainNear3.y,rainNear3.z)));
  let rainFar=min(groundDistance,min(rainFar3.x,min(rainFar3.y,rainFar3.z)));
  if (far <= near) { return vec4<f32>(cloudFilm(backdrop),1.0); }
  let pixel = floor(uv*resolution);
  let jitter = fract(52.9829189 * fract(dot(pixel,vec2<f32>(0.06711056,0.00583715))));
  let entryStep=mix(stepSize,min(stepSize,max(.0015,near*.008)),inspection);
  var t = near + min(entryStep,select(entryStep,${RAIN_SAMPLE_STEP},hasRain))*jitter;
  if(hasRain&&near<rainNear){t=min(t,rainNear);}
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
  for (var i=0u; i<8192u; i++) {
    if (t >= far || transmittance < 0.006) { break; }
    let position = origin + ray*t;
    let reference=cloudReference(position-drift,growth,iceRange,wind);
    // Conservative support includes domain displacement and macro interpolation.
    // One cheap mask lookup avoids evaluating fine noise throughout empty sky.
    let referenceCoord=(reference-vec3<f32>(-5.0,-0.5,-3.5))/vec3<f32>(10.0,8.5,7.0);
    let support=textureSampleLevel(detail,detailSampler,clamp(referenceCoord,maskInset,vec3<f32>(1.0)-maskInset),0.0).a;
    let ordinaryStep=mix(stepSize,min(stepSize,max(.0015,t*.008)),inspection);
    let rp=position-drift;
    let rainRegion=hasRain && t>=rainNear && t<rainFar;
    // Integrate only the remaining visible interval, including the terrain clip.
    // Cloud occupancy does not prove empty rain: preserve ordinary sampling
    // throughout the precipitation region, even between source columns.
    let mediaStep=select(ordinaryStep,min(ordinaryStep,${RAIN_SAMPLE_STEP}),rainRegion);
    let untilRain=select(far-t,rainNear-t,hasRain&&t<rainNear);
    let mediaBoundary=select(far-t,rainFar-t,rainRegion);
    let sampleStep=min(select(mediaStep,emptyStep,support<=0.0&&!rainRegion),min(mediaBoundary,untilRain));
    var rainExtinction=0.0;
    var rainSource=vec3<f32>(0.0);
    // Rain is sourced by the cloud's own column density. Long streaks and broad
    // curtains advect downward in world space, sharing cloud transmittance.
    if(rainRegion){
      // Estimate the emitting height, then solve its height-dependent shear and
      // falling drift once. This remains an approximate static source footprint.
      let guessXZ=rp.xz-wind*max(0.0,1.0-rp.y)*.32;
      let guessUV=(guessXZ*growth.y-vec2<f32>(-5.0,-3.5))/vec2<f32>(10.0,7.0);
      let guess=textureSampleLevel(rainMap,rainSampler,guessUV,0.0).g;
      let guessBase=.72+(guess*3.0-.5-.72)/growth.x;
      let descent=max(0.0,guessBase-rp.y);
      let sourceShear=pow(clamp((guessBase-.72)/6.2,0.0,1.0),1.5);
      let xz=rp.xz-wind*(descent*.32+sourceShear);
      let rainUV=(xz*growth.y-vec2<f32>(-5.0,-3.5))/vec2<f32>(10.0,7.0);
      if(all(rainUV>vec2<f32>(0.0))&&all(rainUV<vec2<f32>(1.0))){
        let column=textureSampleLevel(rainMap,rainSampler,rainUV,0.0).rg;
        if(column.r>0.0){
        let base=.72+(column.g*3.0-.5-.72)/growth.x;
        let attached=1.0-smoothstep(base-.08,base+.3,rp.y);
        // Broad curtains follow the emitting column; evaporation does not gain
        // unrelated vertical lobes while descending through this sheet field.
        let sheets=textureSampleLevel(detail,detailSampler,vec3<f32>(xz*.20,(base+precipitationTime*.012)*.025),0.0).g;
        let evaporation=precipitationSurvival(position.y,base+drift.y,weather.z,column.r,sheets);
        let streaks=textureSampleLevel(detail,detailSampler,vec3<f32>(xz*2.6,(rp.y+precipitationTime*.018)*.16),0.0).r;
        let rainDensity=column.r*attached*evaporation*(.15+1.85*sheets*sheets)*(.35+1.3*streaks);
        rainExtinction=weather.z*rainDensity*${RAIN_EXTINCTION};
        let forwardRain=.08+.2*pow(max(0.0,dot(ray,sun)),8.0);
        let rainLight=sky*.25+ambientColor*.28+solarColor*forwardRain*(1.0-weather.y*.7);
        rainSource=mix(sky,rainLight,exp(-weather.x*.0035*t));
        }
      }
    }
    var density=0.0;
    var ice=0.0;
    var source=vec3<f32>(.65);
    if(support>0.0){
    // The compute pass interpolates time once per flow voxel, rather than per ray sample.
    var flowValue=vec4<f32>(0.0);if(probeMode!=3.0){flowValue=textureSampleLevel(flow,flowSampler,referenceCoord,0.0);}
    let local=reference-flowValue.rgb;
    let coord=(local-vec3<f32>(-5.0,-0.5,-3.5))/vec3<f32>(10.0,8.5,7.0);
    ice=smoothstep(iceRange.x,iceRange.y,local.y);
    var fine=vec4<f32>(.6);if(probeMode!=4.0){fine=textureSampleLevel(detail,detailSampler,local*0.3,0.0);}
    let warp=(fine.gbr-vec3<f32>(0.5))*mix(vec3<f32>(0.16,0.12,0.16),vec3<f32>(0.08,0.02,0.1),ice);
    let warped=textureSampleLevel(volume,volumeSampler,coord+warp/vec3<f32>(10.0,8.5,7.0),0.0).r;
    if(warped>=0.002){
    var erosion=(1.0-fine.r)*0.38+(1.0-fine.b)*0.08+flowValue.a;
    var material=1.0;
    if(ice>0.0 && probeMode!=4.0) {
      let bend=textureSampleLevel(detail,detailSampler,local*vec3<f32>(0.12,0.10,0.06),0.0).g;
      let iceCoord=vec3<f32>(local.x*0.055+bend*0.08,local.y*0.34+local.x*0.022+(bend-0.5)*0.06,local.z*0.08+(bend-0.5)*0.025);
      let iceDetail=textureSampleLevel(detail,detailSampler,iceCoord,0.0);
      let wisps=iceDetail.r;
      erosion=mix(erosion,0.08+(1.0-wisps)*0.5+flowValue.a,ice);
      let strand=smoothstep(0.3,0.7,wisps);
      material=mix(1.0,(0.012+0.56*pow(strand,1.7))*(0.65+0.35*smoothstep(0.25,0.75,iceDetail.b))*(1.0-0.7*smoothstep(0.4,3.8,local.x)),ice);
    }
    // Additional metre-scale erosion appears only during near inspection.
    let microWeight=inspection*(1.0-smoothstep(.08,.3,t))*(1.0-ice);
    if(microWeight>.001){let micro=textureSampleLevel(detail,detailSampler,local*8.0,0.0).b;erosion+=microWeight*(1.0-micro)*.055;}
    erosion=min(0.92,erosion+forcing.x*(0.11+0.32*(1.0-fine.r)));
    let fragments=mix(1.0,smoothstep(0.25,0.7,fine.r),forcing.x);
    density=clamp((warped-erosion)/(1.0-erosion),0.0,1.0)*material*massFactor*fragments;
    if(density<0.002){density=0.0;}
    if(density>0.0&&probeMode!=1.0){
    let voxel = textureSampleLevel(volume,volumeSampler,coord,0.0);
    if(probeMode==2.0){source=voxel.gba;}else{
    var solarDepth=mix(voxel.g,voxel.b,lightSide);
    if(sunsetAmount>0.0){
      let low=textureSampleLevel(sunsetLight,sunsetSampler,coord,0.0).rg;
      solarDepth=mix(solarDepth,mix(low.r,low.g,lightSide),sunsetAmount);
    }
    let sunTau=solarDepth*16.0*massFactor;
    let solar = exp(-sunTau);
    let skyVisibility = exp(-voxel.a*16.0*massFactor);
    let direct = solarColor*1.65*solar*sunPhase*(1.0-weather.y*0.15);
    let ambient = ambientColor * (0.18+0.82*pow(skyVisibility,0.35))*(1.0-weather.y*0.1);
    // Sunset bounce follows the attenuated solar spectrum; keep the established daytime look.
    let bounceTint=mix(vec3<f32>(1.0),solarColor,sunsetAmount);
    let multiple = bounceTint*vec3<f32>(1.0,0.985,0.95)*(0.27*exp(-sunTau*0.45)+0.10*exp(-sunTau*0.18)) + vec3<f32>(0.028,0.032,0.04);
    source = direct + ambient + multiple*(1.0-weather.y*0.13);
    if(flash.w>0.001 && probeMode!=5.0){
      // Same bent scene-space channel for every density sample; view integration
      // attenuates it through the intervening cloud instead of drawing a screen bolt.
      let p=position-drift;
      let r2=min(min(lightningChannelDistance(p,flashTop,flash.xyz),lightningChannelDistance(p,flash.xyz,flashBend)),
        min(lightningChannelDistance(p,flashBend,flashEnd),lightningChannelDistance(p,flashBend,flashBranch)));
      let glow=12.0*exp(-r2*700.0)+1.25*exp(-r2*1.4)+0.3/(1.0+r2*4.0);
      source+=vec3<f32>(0.92,0.95,1.0)*flash.w*glow;

    }
    }}
    }}
    if(density<=0.0&&rainExtinction<=0.0){t+=sampleStep;continue;}
    let aerial=exp(-weather.x*0.0035*t);
    // Co-located media share one exponential segment; neither is artificially in front.
    let cell=cloudMediaSegment(density*mix(extinction,iceExtinction,ice),mix(sky,source,aerial),rainExtinction,rainSource,sampleStep);
    radiance += transmittance * cell.rgb;
    transmittance *= cell.a;
    t += sampleStep;
  }
  let color = radiance + backdrop*transmittance;
  // Mild exposure shoulder, applied to both the cloud and its atmospheric background.
  let mapped = cloudFilm(color);
  return vec4<f32>(mapped,1.0);
}`;
/** Compile the diagnostic choice, so production has no per-sample probe branches. */
export function createCloudIntegrator(mode=0){
  const selected=Number.isInteger(mode)&&mode>=0&&mode<=5?mode:0;
  return wgslFn(integrationSource.replaceAll('probeMode',`${selected}.0`),[film,motion,channel,landscape,terrainBounds,media,precipitation]);
}

