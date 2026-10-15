/** Constant-coefficient reference for one ray segment with co-located media.
 * Source is radiance per unit extinction. Adding coefficients before integrating
 * avoids inventing a front/back ordering between cloud water and falling rain.
 */
export function integrateMediaSegment(cloudExtinction:number,cloudSource:readonly number[],rainExtinction:number,rainSource:readonly number[],distance:number){
  const extinction=cloudExtinction+rainExtinction;
  if(extinction<=0||distance<=0)return {radiance:[0,0,0],transmittance:1};
  const opacity=-Math.expm1(-extinction*distance);
  return {radiance:cloudSource.map((v,i)=>(v*cloudExtinction+rainSource[i]*rainExtinction)*opacity/extinction),transmittance:1-opacity};
}

export const MEDIA_WGSL=`
fn cloudMediaSegment(cloudExtinction:f32,cloudSource:vec3<f32>,rainExtinction:f32,rainSource:vec3<f32>,distance:f32)->vec4<f32>{
  let extinction=cloudExtinction+rainExtinction;
  if(extinction<=0.0||distance<=0.0){return vec4<f32>(0.0,0.0,0.0,1.0);}
  let opacity=1.0-exp(-extinction*distance);
  let source=(cloudSource*cloudExtinction+rainSource*rainExtinction)/extinction;
  return vec4<f32>(source*opacity,1.0-opacity);
}`;
