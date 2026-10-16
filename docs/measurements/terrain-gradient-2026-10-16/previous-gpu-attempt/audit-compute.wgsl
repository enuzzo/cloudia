struct AuditRay {origin:vec4<f32>,direction:vec4<f32>}
struct AuditParams {rayCount:u32,rectangleCount:u32,nodeCount:u32,padding:u32}
@group(0) @binding(0) var<storage,read> auditRaysInput:array<AuditRay>;
@group(0) @binding(1) var auditMetadata:texture_2d<f32>;
@group(0) @binding(2) var<storage,read_write> auditRayOutput:array<vec4<f32>>;
@group(0) @binding(3) var<storage,read> auditRectangles:array<vec4<f32>>;
@group(0) @binding(4) var<storage,read_write> auditRectangleOutput:array<vec4<f32>>;
@group(0) @binding(5) var<uniform> auditParams:AuditParams;
@compute @workgroup_size(32)
fn auditRayKernel(@builtin(global_invocation_id) invocation:vec3<u32>){
 let i=invocation.x;if(i>=auditParams.rayCount){return;}let input=auditRaysInput[i];let o=input.origin.xyz;let d=input.direction.xyz;
 // Explicit test-only opt-in. Production adapter defaults qualification to zero.
 let result=traceTerrainBounds(o,d,auditMetadata,f32(auditParams.nodeCount),1.0);
 let aa=dot(d,d);let hh=o.y+4.0;let bb=dot(vec3<f32>(o.x,6371.0+hh,o.z),d);let cc=dot(o.xz,o.xz)+hh*(12742.0+hh);let dd=bb*bb-aa*cc;var sea=-1.0;
 if(dd>=0.0){let sr=sqrt(dd);let q=-bb-select(sr,-sr,bb<0.0);let t0=q/aa;var t1=1e20;if(q!=0.0){t1=cc/q;}let near=min(t0,t1);if(near>0.0){sea=near;}}
 let relief=1.0-smoothstep(90.0,180.0,select(max(0.0,-bb/aa),sea,sea>0.0));
 var proof=vec4<f32>(0.0);if(result.z==1.0){let pa=o+d*result.x;let pb=o+d*result.y;proof=vec4<f32>(tb_alt(pa)-relief*terrainHeight(pa.xz),tb_alt(pb)-relief*terrainHeight(pb.xz),(result.y-result.x)*length(d),1.0);}
 auditRayOutput[i*4u]=result;auditRayOutput[i*4u+1u]=proof;auditRayOutput[i*4u+2u]=vec4<f32>(d,f32(i));auditRayOutput[i*4u+3u]=vec4<f32>(terrainHeight(o.xz),tb_alt(o),length(d),earthDistance(o,d));
}
@compute @workgroup_size(32)
fn auditRectangleKernel(@builtin(global_invocation_id) invocation:vec3<u32>){
 let i=invocation.x;if(i>=auditParams.rectangleCount){return;}let q=auditRectangles[i];let bounds=tb_height_bounds(q.xy,q.zw);var values:array<f32,16>;values[0]=bounds.x;values[1]=bounds.y;
 for(var j=0u;j<9u;j++){let x=mix(q.x,q.y,f32(j%3u)*.5);let z=mix(q.z,q.w,f32(j/3u)*.5);values[2u+j]=terrainHeight(vec2<f32>(x,z));}
 for(var j=0u;j<4u;j++){auditRectangleOutput[i*4u+j]=vec4<f32>(values[j*4u],values[j*4u+1u],values[j*4u+2u],values[j*4u+3u]);}
}
