struct Settings {
  // maxBaseReference, guardKm, queryCount, maximumGNormalized
  metadata:vec4<f32>,
  // Actual uploaded reciprocal heights; endpoints plus one interior value.
  growth:vec4<f32>,
};
struct Result {
  // Actual sampled R/G plus echoed dynamic UV.
  sampled:vec4<f32>,
  // actual base+.3, guarded ceiling, attached at ceiling, attached just above.
  endpoints:array<vec4<f32>,3>,
  // Worst one-code G-envelope: min slack, max attached at/above guard.
  envelope:vec4<f32>,
};
@group(0) @binding(0) var rainMap:texture_2d<f32>;
@group(0) @binding(1) var rainSampler:sampler;
@group(0) @binding(2) var<storage,read> queries:array<vec4<f32>>;
@group(0) @binding(3) var<uniform> settings:Settings;
@group(0) @binding(4) var<storage,read_write> results:array<Result>;

fn nextUp(value:f32)->f32 {
  if(value==0.0){return bitcast<f32>(1u);}
  let bits=bitcast<u32>(value);
  return bitcast<f32>(select(bits-1u,bits+1u,value>0.0));
}
fn sourceBase(g:f32,growth:f32)->f32 {
  return .72+(g*3.0-.5-.72)/growth;
}
fn attachment(base:f32,y:f32)->f32 {
  return 1.0-smoothstep(base-.08,base+.3,y);
}
@compute @workgroup_size(64)
fn auditSampler(@builtin(global_invocation_id) id:vec3<u32>) {
  if(id.x>=u32(settings.metadata.z)){return;}
  let uv=queries[id.x].xy;
  // One two-dimensional plane and an explicit level; UV comes from storage.
  let column=textureSampleLevel(rainMap,rainSampler,uv,0.0).rg;
  results[id.x].sampled=vec4<f32>(column,uv);
  var minEnvelopeSlack=1e10;
  var maxEnvelopeAttached=0.0;
  var maxEnvelopeNextAttached=0.0;
  let envelopeG=min(1.0,settings.metadata.w+1.0/255.0);
  for(var j=0u;j<3u;j++){
    let growth=settings.growth[j];
    // Keep the original decoded-base expression, independently of the guard.
    let base=.72+(column.g*3.0-.5-.72)/growth;
    let ceiling=.72+(settings.metadata.x-.72)/growth+.3+settings.metadata.y;
    let firstSkipped=nextUp(ceiling);
    results[id.x].endpoints[j]=vec4<f32>(
      base+.3,ceiling,attachment(base,ceiling),attachment(base,firstSkipped));
    let envelopeBase=sourceBase(envelopeG,growth);
    minEnvelopeSlack=min(minEnvelopeSlack,ceiling-(envelopeBase+.3));
    maxEnvelopeAttached=max(maxEnvelopeAttached,attachment(envelopeBase,ceiling));
    maxEnvelopeNextAttached=max(maxEnvelopeNextAttached,attachment(envelopeBase,firstSkipped));
  }
  results[id.x].envelope=vec4<f32>(minEnvelopeSlack,maxEnvelopeAttached,maxEnvelopeNextAttached,0.0);
}
