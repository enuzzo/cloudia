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
}`;
