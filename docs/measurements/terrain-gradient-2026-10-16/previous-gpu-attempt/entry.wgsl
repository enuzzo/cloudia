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
