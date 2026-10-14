/** World units are kilometres for the distant landscape: cloud datum is 4 km above sea level. */
export const EARTH_RADIUS=6371;
export const GROUND_LEVEL=-4;
export function groundIntersection(origin:readonly number[],ray:readonly number[]):number|null{
 const o=[origin[0],origin[1]+EARTH_RADIUS-GROUND_LEVEL,origin[2]];
 const b=o.reduce((sum,v,i)=>sum+v*ray[i],0),c=o.reduce((sum,v)=>sum+v*v,0)-EARTH_RADIUS**2,d=b*b-c;
 if(d<0)return null;const t=-b-Math.sqrt(d);return t>0?t:null;
}
export const LANDSCAPE_WGSL=`
fn terrainNoise(p:vec2<f32>)->f32{
 let i=floor(p);let f=fract(p);let u=f*f*(3.0-2.0*f);
 let a=fract(sin(dot(i,vec2<f32>(127.1,311.7)))*43758.5453);
 let b=fract(sin(dot(i+vec2<f32>(1,0),vec2<f32>(127.1,311.7)))*43758.5453);
 let c=fract(sin(dot(i+vec2<f32>(0,1),vec2<f32>(127.1,311.7)))*43758.5453);
 let d=fract(sin(dot(i+vec2<f32>(1,1),vec2<f32>(127.1,311.7)))*43758.5453);
 return mix(mix(a,b,u.x),mix(c,d,u.x),u.y);
}
fn terrainHeight(p:vec2<f32>)->f32{
 var q=p*.045;var h=0.0;var a=.55;
 for(var j=0;j<5;j++){h+=a*terrainNoise(q);q=vec2<f32>(q.x*.8-q.y*.6,q.x*.6+q.y*.8)*2.17+13.4;a*=.48;}
 return h;
}
fn earthDistance(origin:vec3<f32>,ray:vec3<f32>)->f32{
 let o=origin+vec3<f32>(0,6375,0);let b=dot(o,ray);let c=dot(o,o)-6371.0*6371.0;
 let d=b*b-c;if(d<0.0){return -1.0;}let t=-b-sqrt(d);return select(-1.0,t,t>0.0);
}
fn landscapeColor(point:vec3<f32>,distance:f32,sun:vec3<f32>,solar:vec3<f32>,ambient:vec3<f32>,sky:vec3<f32>,haze:f32)->vec3<f32>{
 let p=point.xz+vec2<f32>(84,-41);
 let h=terrainHeight(p);let coast=terrainNoise(p*.009)+.16*terrainNoise(p*.037);
 let land=smoothstep(.38,.43,coast);
 let vegetation=terrainNoise(p*.23);
 let mountain=smoothstep(.48,.76,h);
 let fields=terrainNoise(p*.8)*.35+terrainNoise(p*.18)*.65;
 var albedo=mix(vec3<f32>(.065,.103,.048),vec3<f32>(.23,.20,.125),fields*.8);
 albedo=mix(albedo,vec3<f32>(.17,.155,.13),mountain*.65);
 albedo*=.82+.18*vegetation;
 let slope=vec2<f32>(terrainHeight(p+vec2<f32>(.2,0))-h,terrainHeight(p+vec2<f32>(0,.2))-h)*12.0;
 let normal=normalize(vec3<f32>(-slope.x,1.0,-slope.y));
 let shade=.25+.75*max(0.0,dot(normal,sun));
 let ground=albedo*(solar*shade*.9+ambient*1.8);
 let sea=vec3<f32>(.025,.065,.087)*(solar*.35+ambient*1.6);
 let riverDistance=abs(p.x-84.0-sin(p.y*.31)*2.4-sin(p.y*.67)*.45-sin(p.y*1.27)*.12);
 let riverWidth=.055+.045*terrainNoise(p*.17);
 let river=1.0-smoothstep(riverWidth,riverWidth+.04+distance*.0005,riverDistance);
 let surface=mix(sea,mix(ground,vec3<f32>(.035,.061,.052)*(solar*.4+ambient),river*.85),land);
 let transmission=exp(-distance*(.008+.004*haze));
 return mix(sky,surface,transmission);
}`;
