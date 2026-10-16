struct Query { coordIce:vec4<f32>, fineGroup:vec4<f32> };
struct Result { sampled:vec4<f32>, indexIce:vec4<f32>, warpedCoord:vec4<f32> };
@group(0) @binding(0) var volume:texture_3d<f32>;
@group(0) @binding(1) var volumeSampler:sampler;
@group(0) @binding(2) var narrowCloud:texture_3d<f32>;
@group(0) @binding(3) var<storage,read> queries:array<Query>;
@group(0) @binding(4) var<storage,read_write> results:array<Result>;
@compute @workgroup_size(64)
fn auditNarrow(@builtin(global_invocation_id) id:vec3<u32>){
 if(id.x>=arrayLength(&queries)){return;}
 let coord=queries[id.x].coordIce.xyz;
 let ice=queries[id.x].coordIce.w;
 let fine=vec4<f32>(queries[id.x].fineGroup.xyz,1.0);
 let narrowDimensions=textureDimensions(narrowCloud,0);
 let narrowIndex=min(vec3<u32>(floor(clamp(coord,vec3<f32>(0.0),vec3<f32>(1.0))*vec3<f32>(narrowDimensions))),narrowDimensions-vec3<u32>(1u));
 let narrowValue=textureLoad(narrowCloud,vec3<i32>(narrowIndex),0).r;
 let warp=(fine.gbr-vec3<f32>(0.5))*mix(vec3<f32>(0.16,0.12,0.16),vec3<f32>(0.08,0.02,0.1),ice);
 let warped=textureSampleLevel(volume,volumeSampler,coord+warp/vec3<f32>(10.0,8.5,7.0),0.0).r;
 results[id.x].sampled=vec4<f32>(narrowValue,warped,select(0.0,1.0,narrowValue==0.0&&warped>0.0),select(0.0,1.0,narrowValue==0.0&&warped>=0.002));
 results[id.x].indexIce=vec4<f32>(vec3<f32>(narrowIndex),ice);
 results[id.x].warpedCoord=vec4<f32>(coord+warp/vec3<f32>(10.0,8.5,7.0),queries[id.x].fineGroup.w);
}
