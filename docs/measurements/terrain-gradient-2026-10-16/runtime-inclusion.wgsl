// External design artifact, not GPU-qualified or linked to the product.
// This replaces interval noise evaluation in the traversal, not terrainHeight.
// ray/point arithmetic and metadata upload require a separate WGSL error ledger.
struct TerrainGradientCell {
  height: vec2<f32>,
  gradientX: vec2<f32>,
  gradientZ: vec2<f32>,
  heightError: f32,
};
fn tg_scale(a:vec2<f32>,s:f32)->vec2<f32>{
  return select(a.yx*s,a*s,s>=0.0);
}
fn tg_product(a:vec2<f32>,b:vec2<f32>)->vec2<f32>{
  let p=vec4<f32>(a.x*b.x,a.x*b.y,a.y*b.x,a.y*b.y);
  return vec2<f32>(min(min(p.x,p.y),min(p.z,p.w)),max(max(p.x,p.y),max(p.z,p.w)));
}
// radialSlope encloses the ideal radial derivative on the entire segment
// from the sample to this interval. For a nonzero general ray it is monotone.
fn tg_clearance_derivative(cell:TerrainGradientCell,ray:vec3<f32>,relief:f32,radialSlope:vec2<f32>)->vec2<f32>{
  let heightSlope=tg_scale(cell.gradientX,ray.x)+tg_scale(cell.gradientZ,ray.z);
  return radialSlope-relief*heightSlope.yx;
}
fn tg_clearance_lower(cell:TerrainGradientCell,derivative:vec2<f32>,sampleClearance:f32,deltaT:vec2<f32>,relief:f32,arithmeticGuard:f32)->f32{
  return sampleClearance+tg_product(derivative,deltaT).x-2.0*relief*cell.heightError-arithmeticGuard;
}
// Used only when the corresponding whole-prefix inclusion is strictly >0.
// This function returns a candidate cut; caller must validate the inclusion
// after outward arithmetic guards, retain near-first order and an actual
// nonpositive terrainHeight witness. Exhausted caps remain unresolved.
fn tg_prefix_candidate(sampleT:f32,shiftedClearance:f32,derivative:vec2<f32>,interval:vec2<f32>)->f32{
  var cut=interval.x;
  if(shiftedClearance>=0.0){
    if(derivative.x<0.0){cut=sampleT+shiftedClearance/(-derivative.x);}else{cut=interval.y;}
  }else if(derivative.y<0.0){cut=sampleT+shiftedClearance/(-derivative.y);}
  return clamp(cut,interval.x,interval.y);
}
