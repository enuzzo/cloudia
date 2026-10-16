// External candidate. Depends on the ORIGINAL LANDSCAPE_WGSL terrainHash/Height.
// GPU numeric envelope is not yet qualified. No height field replacement.
struct TbRecord { bounds:vec2<f32>, first:u32, rect:vec3<f32> }
struct TbSamples { t:array<f32,16>, f:array<f32,16>, count:u32 }
fn tb_next(x:f32,up:bool)->f32 {
 if(abs(x)<1.17549435e-38){return select(-1.17549435e-38,1.17549435e-38,up);}
 let b=bitcast<u32>(x);return bitcast<f32>(select(b-1u,b+1u,(x>0.0)==up));
}
fn tb_out(v:vec2<f32>)->vec2<f32>{return vec2<f32>(tb_next(v.x,false),tb_next(v.y,true));}
fn tb_c(v:f32)->vec2<f32>{return vec2<f32>(v);}
fn tb_add(a:vec2<f32>,b:vec2<f32>)->vec2<f32>{return tb_out(a+b);}
fn tb_sub(a:vec2<f32>,b:vec2<f32>)->vec2<f32>{return tb_out(vec2<f32>(a.x-b.y,a.y-b.x));}
fn tb_mul(a:vec2<f32>,b:vec2<f32>)->vec2<f32>{let p=vec4<f32>(a.x*b.x,a.x*b.y,a.y*b.x,a.y*b.y);return tb_out(vec2<f32>(min(min(p.x,p.y),min(p.z,p.w)),max(max(p.x,p.y),max(p.z,p.w))));}
fn tb_div13(a:vec2<f32>)->vec2<f32>{return tb_out(a/13.0);}
fn tb_abs(a:vec2<f32>)->vec2<f32>{return vec2<f32>(select(min(abs(a.x),abs(a.y)),0.0,a.x<=0.0&&a.y>=0.0),max(abs(a.x),abs(a.y)));}
fn tb_square(a:vec2<f32>)->vec2<f32>{let lo=select(min(a.x*a.x,a.y*a.y),0.0,a.x<=0.0&&a.y>=0.0);return tb_out(vec2<f32>(lo,max(a.x*a.x,a.y*a.y)));}
fn tb_smooth(t0:vec2<f32>)->vec2<f32>{let t=clamp(t0,vec2<f32>(0.0),vec2<f32>(1.0));let p=t*t*(3.0-2.0*t);return tb_out(vec2<f32>(max(0.0,p.x-0.00000095367431640625),p.y+0.00000095367431640625));}
fn tb_mix(a:vec2<f32>,b:vec2<f32>,t:vec2<f32>)->vec2<f32>{
 var lo=1e20;var hi=-1e20;
 for(var x=0u;x<2u;x++){for(var y=0u;y<2u;y++){for(var z=0u;z<2u;z++){let v=a[x]*(1.0-t[z])+b[y]*t[z];lo=min(lo,v);hi=max(hi,v);}}}
 return tb_out(vec2<f32>(lo-0.000000476837158203125,hi+0.000000476837158203125));
}
fn tb_noise(x:vec2<f32>,z:vec2<f32>)->vec2<f32>{
 let lo=vec2<i32>(floor(vec2<f32>(x.x,z.x)));let hi=vec2<i32>(floor(vec2<f32>(x.y,z.y)));
 let cells=(hi.x-lo.x+1)*(hi.y-lo.y+1);if(cells>64){return vec2<f32>(-0.00000762939453125,1.00000762939453125);}
 var result=vec2<f32>(1e20,-1e20);
 // Fixed count bound: caller rectangles are limited to valid finite local coords.
 for(var iz=lo.y;iz<=hi.y;iz++){for(var ix=lo.x;ix<=hi.x;ix++){
  let fx=clamp(tb_sub(vec2<f32>(max(x.x,f32(ix)),min(x.y,f32(ix+1))),tb_c(f32(ix))),vec2<f32>(0.0),vec2<f32>(1.0));
  let fz=clamp(tb_sub(vec2<f32>(max(z.x,f32(iz)),min(z.y,f32(iz+1))),tb_c(f32(iz))),vec2<f32>(0.0),vec2<f32>(1.0));
  let u=tb_smooth(fx);let v=tb_smooth(fz);let i=vec2<i32>(ix,iz);
  let a=tb_c(terrainHash(i));let b=tb_c(terrainHash(i+vec2<i32>(1,0)));let c=tb_c(terrainHash(i+vec2<i32>(0,1)));let d=tb_c(terrainHash(i+vec2<i32>(1,1)));
  let n=tb_mix(tb_mix(a,b,u),tb_mix(c,d,u),v);result=vec2<f32>(min(result.x,n.x),max(result.y,n.y));
 }}return result;
}
fn tb_sin(a:vec2<f32>)->vec2<f32>{
 // 2*2^-11 covers endpoint native-sin uncertainty plus query uncertainty in the
 // WGSL specified range. Outside that range the caller uses full inland [0,1].
 let s=sin(a);var lo=min(s.x,s.y);var hi=max(s.x,s.y);
 let k0=i32(ceil((a.x-1.5707963267948966)/3.141592653589793));let k1=i32(floor((a.y-1.5707963267948966)/3.141592653589793));
 for(var k=k0;k<=k1;k++){let v=select(-1.0,1.0,(k&1)==0);lo=min(lo,v);hi=max(hi,v);}
 return tb_out(vec2<f32>(lo-0.0009765625,hi+0.0009765625));
}
fn tb_height_bounds(x:vec2<f32>,z:vec2<f32>)->vec2<f32>{
 var qx=tb_mul(x,tb_c(.065));var qz=tb_mul(z,tb_c(.065));var h=tb_c(0.0);var a=tb_c(.58);
 for(var octave=0u;octave<4u;octave++){
  let n=tb_noise(qx,qz);let r=tb_sub(tb_c(1.0),tb_abs(tb_sub(tb_mul(n,tb_c(2.0)),tb_c(1.0))));
  let raw=tb_mul(tb_mul(a,r),r);let tight=tb_mul(a,tb_square(r));
  let term=vec2<f32>(max(0.0,max(raw.x,tight.x-0.000000476837158203125)),min(raw.y,tight.y+0.000000476837158203125));h=tb_add(h,term);
  let nx=tb_add(tb_mul(tb_sub(tb_mul(qx,tb_c(.8)),tb_mul(qz,tb_c(.6))),tb_c(2.17)),tb_c(13.4));
  let nz=tb_add(tb_mul(tb_add(tb_mul(qx,tb_c(.6)),tb_mul(qz,tb_c(.8))),tb_c(2.17)),tb_c(13.4));qx=nx;qz=nz;a=tb_mul(a,tb_c(.43));
 }
 h.x=max(0.0,h.x);let angle=tb_mul(z,tb_c(.045));var inland=vec2<f32>(0.0,1.0000009536743164);
 if(angle.x>=-3.1415925&&angle.y<=3.1415925){
  let noise=tb_noise(tb_mul(x,tb_c(.055)),tb_mul(z,tb_c(.055)));
  let coast=tb_add(tb_add(tb_add(tb_sub(tb_c(2.0),x),tb_mul(z,tb_c(.20))),tb_mul(tb_sin(angle),tb_c(6.0))),tb_mul(tb_sub(noise,tb_c(.5)),tb_c(9.0)));
  inland=tb_smooth(tb_div13(coast));
 }
 let range=tb_add(tb_c(.55),tb_mul(tb_c(.45),tb_noise(tb_add(tb_mul(x,tb_c(.018)),tb_c(3.0)),tb_add(tb_mul(z,tb_c(.018)),tb_c(7.0)))));
 // Declared numerical trial guard, not an accepted all-device pow error ledger.
 var powerLo=0.0;if(h.x>0.0){powerLo=max(0.0,pow(h.x,1.3)-0.00000762939453125);}var powerHi=0.0;if(h.y>0.0){powerHi=pow(h.y,1.3)+0.00000762939453125;}let power=tb_out(vec2<f32>(powerLo,powerHi));
 let value=tb_mul(inland,tb_add(tb_c(.12),tb_mul(tb_mul(tb_c(3.2),power),range)));return vec2<f32>(max(0.0,value.x),value.y);
}
fn tb_texel(metadataTex:texture_2d<f32>,linear:u32)->vec4<f32>{let size=textureDimensions(metadataTex,0);return textureLoad(metadataTex,vec2<i32>(i32(linear%size.x),i32(linear/size.x)),0);}
fn tb_record(metadataTex:texture_2d<f32>,index:u32)->TbRecord{let a=tb_texel(metadataTex,index*2u);let b=tb_texel(metadataTex,index*2u+1u);return TbRecord(a.xy,u32(a.z),b.xyz);}
fn tb_clip(o:vec3<f32>,d:vec3<f32>,rect:vec3<f32>,range:vec2<f32>)->vec2<f32>{
 var r=range;
 for(var k=0u;k<2u;k++){let axis=select(0u,2u,k==1u);let lower=rect[k];let upper=lower+rect.z;
  if(d[axis]==0.0){if(o[axis]<lower||o[axis]>upper){return vec2<f32>(1.0,-1.0);}}
  else{let t0=(lower-o[axis])/d[axis];let t1=(upper-o[axis])/d[axis];r=vec2<f32>(max(r.x,min(t0,t1)),min(r.y,max(t0,t1)));}
 }return r;
}
fn tb_alt(p:vec3<f32>)->f32{let h=p.y+4.0;let c=dot(p.xz,p.xz)+h*(12742.0+h);return c/(length(vec3<f32>(p.x,6371.0+h,p.z))+6371.0);}
fn tb_sample(o:vec3<f32>,d:vec3<f32>,t:f32,r:f32,s:ptr<function,TbSamples>)->vec2<f32>{
 for(var i=0u;i<(*s).count;i++){if((*s).t[i]==t){return vec2<f32>((*s).f[i],1.0);}}
 if((*s).count>=16u){return vec2<f32>(0.0,0.0);}let p=o+d*t;let value=tb_alt(p)-r*terrainHeight(p.xz);let i=(*s).count;(*s).t[i]=t;(*s).f[i]=value;(*s).count=i+1u;return vec2<f32>(value,1.0);
}
fn tb_result(lo:f32,hi:f32,status:u32,visits:u32,samples:u32)->vec4<f32>{return vec4<f32>(lo,hi,f32(status),f32(visits*32u+samples));}
