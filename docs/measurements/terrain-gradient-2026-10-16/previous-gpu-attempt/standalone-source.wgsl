
// u32-avalanche-24-v1: match the CPU lattice without transcendental hash drift.
fn terrainHash(i:vec2<i32>)->f32{
 var h=(bitcast<u32>(i.x)*0x9e3779b9u)^(bitcast<u32>(i.y)*0x85ebca6bu)^0x243f6a88u;
 h=(h^(h>>16u))*0x7feb352du;
 h=(h^(h>>15u))*0x846ca68bu;
 h=h^(h>>16u);
 return f32(h>>8u)*(1.0/16777216.0);
}
fn terrainNoise(p:vec2<f32>)->f32{
 let i=floor(p);let f=fract(p);let u=f*f*(3.0-2.0*f);
 let a=terrainHash(vec2<i32>(i));
 let b=terrainHash(vec2<i32>(i)+vec2<i32>(1,0));
 let c=terrainHash(vec2<i32>(i)+vec2<i32>(0,1));
 let d=terrainHash(vec2<i32>(i)+vec2<i32>(1,1));
 return mix(mix(a,b,u.x),mix(c,d,u.x),u.y);
}
// A fictional wilderness coast: wooded foothills rise into irregular ridges.
fn coastDistance(p:vec2<f32>)->f32{
 return 2.0-p.x+p.y*.20+sin(p.y*.045)*6.0+(terrainNoise(p*.055)-.5)*9.0;
}
fn terrainHeight(p:vec2<f32>)->f32{
 var q=p*.065;var h=0.0;var a=.58;
 for(var j=0;j<4;j++){
  let ridge=1.0-abs(terrainNoise(q)*2.0-1.0);
  h+=a*ridge*ridge;q=vec2<f32>(q.x*.8-q.y*.6,q.x*.6+q.y*.8)*2.17+13.4;a*=.43;
 }
 let inland=smoothstep(0.0,13.0,coastDistance(p));
 let range=.55+.45*terrainNoise(p*.018+vec2<f32>(3,7));
 return inland*(.12+3.2*pow(h,1.3)*range);
}
fn earthDistance(origin:vec3<f32>,ray:vec3<f32>)->f32{
 let o=origin+vec3<f32>(0,6375,0);let b=dot(o,ray);let c=dot(o,o)-6371.0*6371.0;
 let d=b*b-c;if(d<0.0){return -1.0;}let t=-b-sqrt(d);return select(-1.0,t,t>0.0);
}
// Refine the sea-sphere hit against kilometre-scale relief. Far relief fades
// before the horizon to keep grazing rays stable; no extra cloud march steps.
fn landscapeDistance(origin:vec3<f32>,ray:vec3<f32>,seaDistance:f32)->f32{
 if(seaDistance<=0.0){return seaDistance;}
 let relief=1.0-smoothstep(90.0,180.0,seaDistance);
 if(relief<=0.0){return seaDistance;}
 var t=seaDistance;
 for(var i=0;i<6;i++){
  let p=origin+ray*t;let radial=p+vec3<f32>(0,6375,0);
  let clearance=length(radial)-6371.0-terrainHeight(p.xz)*relief;
  let incidence=min(-.045,dot(normalize(radial),ray));
  t=clamp(t-clearance/incidence,0.0,seaDistance);
 }
 return t;
}
fn landscapeColor(point:vec3<f32>,distance:f32,sun:vec3<f32>,solar:vec3<f32>,ambient:vec3<f32>,sky:vec3<f32>,haze:f32)->vec3<f32>{
 let p=point.xz;
 let coast=coastDistance(p);let land=smoothstep(-.15,.25,coast);
 let h=terrainHeight(p);
 let slope=vec2<f32>(terrainHeight(p+vec2<f32>(.08,0))-terrainHeight(p-vec2<f32>(.08,0)),terrainHeight(p+vec2<f32>(0,.08))-terrainHeight(p-vec2<f32>(0,.08)))/.16;
 let normal=normalize(vec3<f32>(-slope.x,1.0,-slope.y));
 let canopy=terrainNoise(p*2.4)*.55+terrainNoise(p*8.5)*.45;
 let forest=mix(vec3<f32>(.025,.062,.033),vec3<f32>(.070,.115,.049),canopy);
 let rock=mix(vec3<f32>(.19,.18,.16),vec3<f32>(.30,.29,.26),terrainNoise(p*.7));
 let exposed=max(smoothstep(.8,1.65,h),smoothstep(.3,.85,length(slope)));
 var albedo=mix(forest,rock,exposed);
 albedo=mix(albedo,vec3<f32>(.53,.56,.55),smoothstep(1.65,2.3,h)*.65);
 let shade=.16+.84*max(0.0,dot(normal,sun));
 let ground=albedo*(solar*shade*.9+ambient*1.45);
 let shallows=exp(-max(0.0,-coast)*.55);
 let sea=mix(vec3<f32>(.016,.048,.075),vec3<f32>(.026,.11,.115),shallows)*(solar*.4+ambient*1.5);
 let surface=mix(sea,ground,land);
 let transmission=exp(-distance*(.006+.004*haze));
 return mix(sky,surface,transmission);
}
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

fn traceTerrainBounds(origin:vec3<f32>,ray:vec3<f32>,metadata:texture_2d<f32>,recordCount:f32,numericQualification:f32)->vec4<f32>{
 // Status: 0 miss, 1 hit, 2 visit budget, 3 height budget, 4 stack,
 // 5 metadata domain, 6 numeric/precision contact, 7 unqualified/invalid metadata.
 // Default adapter keeps numericQualification=0 until explicit GPU QA.
 if(numericQualification<.5||recordCount<1.0){return tb_result(0.0,0.0,7u,0u,0u);}
 let a=dot(ray,ray);let speed=sqrt(a);let h0=origin.y+4.0;
 let b=dot(vec3<f32>(origin.x,6371.0+h0,origin.z),ray);let tc=-b/a;
 let c=dot(origin.xz,origin.xz)+h0*(12742.0+h0);let discSea=b*b-a*c;
 var sea=-1.0;if(discSea>=0.0){let root=sqrt(discSea);let q=-b-select(root,-root,b<0.0);let t0=q/a;var t1=1e20;if(q!=0.0){t1=c/q;}let near=min(t0,t1);if(near>0.0){sea=near;}}
 let relief=1.0-smoothstep(90.0,180.0,select(max(0.0,tc),sea,sea>0.0));
 if(relief<=0.0){if(sea>0.0){return tb_result(sea,sea,1u,0u,0u);}return tb_result(-1.0,-1.0,0u,0u,0u);}
 // 10m larger than the CPU envelope; enlarges the search domain, not geometry.
 // Its f32 all-ray safety and the 1cm radial allowance still require GPU audit.
 let outer=3.26*relief;let co=dot(origin.xz,origin.xz)+(h0-outer)*(12742.0+h0+outer);let disc=b*b-a*co;
 if(disc<0.0){return tb_result(-1.0,-1.0,0u,0u,0u);}let half=sqrt(disc)/a;
 if(tc+half<=0.0){return tb_result(-1.0,-1.0,0u,0u,0u);}let start=max(0.0,tc-half);let end=select(tc+half,sea,sea>0.0);
 let root=tb_record(metadata,0u);let rootRange=tb_clip(origin,ray,root.rect,vec2<f32>(start,end));
 if(rootRange.x>start||rootRange.y<end||rootRange.y<rootRange.x){return tb_result(start,end,5u,0u,0u);}
 var samples:TbSamples;var known=1e20;
 let s0=tb_sample(origin,ray,start,relief,&samples);let se=tb_sample(origin,ray,end,relief,&samples);
 if(s0.x+0.00001<=0.0){known=start;}if(se.x+0.00001<=0.0){known=min(known,end);}
 var stack:array<vec4<f32>,48>;var count=1u;stack[0]=vec4<f32>(start,end,0.0,0.0);var visits=0u;
 for(var iteration=0u;iteration<256u;iteration++){
  if(count==0u){return tb_result(-1.0,-1.0,0u,visits,samples.count);}count--;let work=stack[count];let ta=work.x;let tb=work.y;let mid=(ta+tb)*.5;visits++;
  if(known>=ta&&(known-ta)*speed<=.001){return tb_result(ta,known,1u,visits,samples.count);}if(ta>=known){continue;}
  var bound=vec2<f32>(0.0,3.26);var node:TbRecord;
  if(work.w<.5){let index=u32(work.z);if(index>=u32(recordCount)){return tb_result(ta,tb,7u,visits,samples.count);}node=tb_record(metadata,index);bound=node.bounds;}
  else{let pa=origin+ray*ta;let pb=origin+ray*tb;bound=tb_height_bounds(vec2<f32>(min(pa.x,pb.x),max(pa.x,pb.x)),vec2<f32>(min(pa.z,pb.z),max(pa.z,pb.z)));}
  let radial=tb_alt(origin+ray*clamp(tc,ta,tb))-0.00001;
  if(radial-relief*bound.y>0.0){continue;}
  if(work.w<.5&&node.first>0u){
   var children:array<vec4<f32>,4>;var n=0u;
   for(var i=0u;i<4u;i++){let ci=node.first+i;if(ci>=u32(recordCount)){return tb_result(ta,tb,7u,visits,samples.count);}let child=tb_record(metadata,ci);let r=tb_clip(origin,ray,child.rect,vec2<f32>(ta,tb));if(r.y>=r.x){children[n]=vec4<f32>(r,f32(ci),0.0);n++;}}
   if(n==0u){return tb_result(ta,tb,6u,visits,samples.count);}
   // Sort far to near before pushing, so stack pops near first, including ties.
   for(var i=0u;i<n;i++){for(var j=i+1u;j<n;j++){if(children[i].x<children[j].x||(children[i].x==children[j].x&&children[i].y<children[j].y)){let swap=children[i];children[i]=children[j];children[j]=swap;}}}
   if(count+n>48u){return tb_result(ta,tb,4u,visits,samples.count);}for(var i=0u;i<n;i++){stack[count]=children[i];count++;}continue;
  }
  if(work.w<.5){let pa=origin+ray*ta;let pb=origin+ray*tb;bound=tb_height_bounds(vec2<f32>(min(pa.x,pb.x),max(pa.x,pb.x)),vec2<f32>(min(pa.z,pb.z),max(pa.z,pb.z)));if(radial-relief*bound.y>0.0){continue;}}
  if((tb-ta)*speed<=.001){let sm=tb_sample(origin,ray,mid,relief,&samples);if(sm.y<.5){return tb_result(ta,tb,3u,visits,samples.count);}if(sm.x+0.00001<=0.0){known=min(known,mid);}}
  if((tb-ta)*speed<=.001&&known-ta>.001/speed){let t=min(end,ta+.001/speed);let sl=tb_sample(origin,ray,t,relief,&samples);if(sl.y<.5){return tb_result(ta,tb,3u,visits,samples.count);}if(sl.x+0.00001<=0.0){known=min(known,t);}}
  if(known>=ta&&(known-ta)*speed<=.001){return tb_result(ta,known,1u,visits,samples.count);}
  if((tb-ta)*speed<=0.0000001||mid==ta||mid==tb){return tb_result(ta,tb,6u,visits,samples.count);}
  if(count+2u>48u){return tb_result(ta,tb,4u,visits,samples.count);}stack[count]=vec4<f32>(mid,tb,0.0,1.0);count++;stack[count]=vec4<f32>(ta,mid,0.0,1.0);count++;
 }
 if(count==0u){return tb_result(-1.0,-1.0,0u,visits,samples.count);}return tb_result(stack[count-1u].x,stack[count-1u].y,2u,visits,samples.count);
}
