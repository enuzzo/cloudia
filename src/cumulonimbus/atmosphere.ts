/** Small CPU-baked single-scattering sky LUT, in linear radiance.
 * Earth geometry in km; exponential Rayleigh/Mie layers. This is a bounded
 * approximation, not Hillaire's multiple-scattering atmosphere implementation. */
const EARTH=6371,TOP=6471,OBSERVER=6371.18;
const RAYLEIGH=[.0058,.0135,.0331];
// Approximate Chappuis absorption (km^-1), triangular ozone layer at 25 km.
const OZONE=[.000650,.001881,.000085];
const ozoneDensity=(h:number)=>Math.max(0,1-Math.abs(h-25)/15);
const normalize=(v:readonly number[])=>{const l=Math.hypot(...v);return v.map(x=>x/l);};
function exitDistance(p:readonly number[],d:readonly number[],radius:number){
  const b=p[0]*d[0]+p[1]*d[1]+p[2]*d[2],c=p[0]**2+p[1]**2+p[2]**2-radius**2;
  return -b+Math.sqrt(Math.max(0,b*b-c));
}
function optical(p:readonly number[],sun:readonly number[]){
  const length=exitDistance(p,sun,TOP),step=length/8;let r=0,m=0,o=0;
  for(let i=0;i<8;i++){
    const t=(i+.5)*step,h=Math.max(0,Math.hypot(p[0]+sun[0]*t,p[1]+sun[1]*t,p[2]+sun[2]*t)-EARTH);
    r+=Math.exp(-h/8)*step;m+=Math.exp(-h/1.2)*step;o+=ozoneDensity(h)*step;
  }
  return [r,m,o];
}
export function skyRadiance(direction:readonly number[],sunDirection:readonly number[],haze:number):number[]{
  const ray=normalize([direction[0],Math.max(.002,direction[1]),direction[2]]),sun=normalize(sunDirection);
  const origin=[0,OBSERVER,0],length=exitDistance(origin,ray,TOP),step=length/24;
  const mu=ray.reduce((s,v,i)=>s+v*sun[i],0),phaseR=3/(16*Math.PI)*(1+mu*mu),g=.76;
  const phaseM=3/(8*Math.PI)*(1-g*g)*(1+mu*mu)/((2+g*g)*Math.pow(Math.max(.01,1+g*g-2*g*mu),1.5));
  let viewR=0,viewM=0,viewO=0;const result=[0,0,0],mie=.003*Math.max(.2,haze);
  for(let i=0;i<24;i++){
    const t=(i+.5)*step,p=[ray[0]*t,OBSERVER+ray[1]*t,ray[2]*t],h=Math.max(0,Math.hypot(...p)-EARTH);
    const dr=Math.exp(-h/8)*step,dm=Math.exp(-h/1.2)*step,od=ozoneDensity(h)*step,[sunR,sunM,sunO]=optical(p,sun);
    for(let c=0;c<3;c++)result[c]+=12*Math.exp(-RAYLEIGH[c]*(viewR+.5*dr+sunR)-mie*(viewM+.5*dm+sunM)-OZONE[c]*(viewO+.5*od+sunO))*(RAYLEIGH[c]*dr*phaseR+mie*dm*phaseM);
    viewR+=dr;viewM+=dm;viewO+=od;
  }
  // Unmodelled higher-order scattering: low, neutral horizon fill.
  const fill=.025*(1-Math.exp(-viewM*.02));
  for(let c=0;c<3;c++)result[c]+=fill;
  if(direction[1]<0){const blend=1-Math.exp(direction[1]*9),twilight=Math.max(0,1-sun[1]*5);for(let c=0;c<3;c++)result[c]=result[c]*(1-blend)+([.12,.15,.18][c]*(1-twilight)+[.13,.085,.082][c]*twilight)*blend;}
  return result;
}
/** Neutral overcast surroundings, not a colour-darkened clear atmosphere. */
export function overcastRadiance(color:readonly number[],elevation:number):number[]{
  const luminance=color[0]*.2126+color[1]*.7152+color[2]*.0722;
  const height=Math.max(0,Math.min(1,elevation*1.4+.15));
  const horizon=Math.exp(-Math.abs(elevation)*5);
  const below=1-Math.exp(Math.min(0,elevation)*7);
  const diffuse=.095+.07*height+.13*horizon+.20*luminance-.07*below;
  return [diffuse*.985,diffuse,diffuse*1.025];
}
export function atmosphereLighting(sun:readonly number[],haze:number,overcast=0){
  const [r,m,o]=optical([0,OBSERVER,0],normalize(sun));
  const sky=skyRadiance([0,1,0],sun,haze),neutral=overcastRadiance(sky,1);
  return {solar:RAYLEIGH.map((b,c)=>Math.exp(-b*r-.003*haze*m-OZONE[c]*o)*(1-.32*overcast)),ambient:sky.map((v,c)=>.06+(v*(1-overcast)+neutral[c]*overcast)*.48)};
}
export const SKY_LUT_SIZE=128;
export function fillSkyLUT(data:Float32Array,sun:readonly number[],haze:number,overcast=0){
  const s=normalize(sun),azimuth=Math.atan2(s[2],s[0]);
  for(let y=0;y<SKY_LUT_SIZE;y++)for(let x=0;x<SKY_LUT_SIZE;x++){
    const k=2*(y+.5)/SKY_LUT_SIZE-1,elevation=Math.sign(k)*k*k,horizontal=Math.sqrt(1-elevation*elevation);
    const az=azimuth+Math.acos(2*(x+.5)/SKY_LUT_SIZE-1),color=skyRadiance([horizontal*Math.cos(az),elevation,horizontal*Math.sin(az)],s,haze),at=(y*SKY_LUT_SIZE+x)*4;
    const neutral=overcastRadiance(color,elevation);
    for(let c=0;c<3;c++)data[at+c]=color[c]*(1-overcast)+neutral[c]*overcast;data[at+3]=1;
  }
}
