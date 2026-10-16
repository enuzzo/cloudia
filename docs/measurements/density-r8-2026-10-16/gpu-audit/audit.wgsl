struct Query { uvGroup:vec4<f32> };
struct Output { samples:vec4<f32>, bits:vec4<u32>, echo:vec4<f32> };
struct Counters { processed:atomic<u32>, mismatches:atomic<u32>, nonfinite:atomic<u32>, outside:atomic<u32> };
@group(0) @binding(0) var macroRGBA:texture_3d<f32>;
@group(0) @binding(1) var densityR:texture_3d<f32>;
@group(0) @binding(2) var sharedSampler:sampler;
@group(0) @binding(3) var<storage,read> queries:array<Query>;
@group(0) @binding(4) var<storage,read_write> output:array<Output>;
@group(0) @binding(5) var<storage,read_write> counts:Counters;
@compute @workgroup_size(64)
fn auditDensity(@builtin(global_invocation_id) id:vec3<u32>){
 let i=id.x;if(i>=arrayLength(&queries)){return;}
 let q=queries[i].uvGroup;
 let oldR=textureSampleLevel(macroRGBA,sharedSampler,q.xyz,0.0).r;
 let newR=textureSampleLevel(densityR,sharedSampler,q.xyz,0.0).r;
 let a=bitcast<u32>(oldR);let b=bitcast<u32>(newR);
 let mismatch=select(0u,1u,a!=b);
 let nonfinite=select(0u,1u,((a&0x7f800000u)==0x7f800000u)||((b&0x7f800000u)==0x7f800000u));
 let outside=select(0u,1u,oldR<0.0||oldR>1.0||newR<0.0||newR>1.0);
 output[i].samples=vec4<f32>(oldR,newR,newR-oldR,abs(newR-oldR));
 output[i].bits=vec4<u32>(a,b,mismatch,nonfinite);
 output[i].echo=q;
 atomicAdd(&counts.processed,1u);atomicAdd(&counts.mismatches,mismatch);
 atomicAdd(&counts.nonfinite,nonfinite);atomicAdd(&counts.outside,outside);
}
