/** Small CPU-baked single-scattering sky LUT, in linear radiance.
 * Earth geometry in km; exponential Rayleigh/Mie layers. This is a bounded
 * approximation, not Hillaire's multiple-scattering atmosphere implementation. */
const EARTH=6371,TOP=6471,OBSERVER=6371.18;
const RAYLEIGH=[.0058,.0135,.0331];
const normalize=(v:readonly number[])=>{const l=Math.hypot(...v);return v.map(x=>x/l);};
function exitDistance(p:readonly number[],d:readonly number[],radius:number){
  const b=p[0]*d[0]+p[1]*d[1]+p[2]*d[2],c=p[0]**2+p[1]**2+p[2]**2-radius**2;
  return -b+Math.sqrt(Math.max(0,b*b-c));
}
function optical(p:readonly number[],sun:readonly number[]){
  const length=exitDistance(p,sun,TOP),step=length/8;let r=0,m=0;
  for(let i=0;i<8;i++){
    const t=(i+.5)*step,h=Math.max(0,Math.hypot(p[0]+sun[0]*t,p[1]+sun[1]*t,p[2]+sun[2]*t)-EARTH);
    r+=Math.exp(-h/8)*step;m+=Math.exp(-h/1.2)*step;
  }
  return [r,m];
}
export function skyRadiance(direction:readonly number[],sunDirection:readonly number[],haze:number):number[]{
  const ray=normalize([direction[0],Math.max(.002,direction[1]),direction[2]]),sun=normalize(sunDirection);
  const origin=[0,OBSERVER,0],length=exitDistance(origin,ray,TOP),step=length/24;
  const mu=ray.reduce((s,v,i)=>s+v*sun[i],0),phaseR=3/(16*Math.PI)*(1+mu*mu),g=.76;
  const phaseM=3/(8*Math.PI)*(1-g*g)*(1+mu*mu)/((2+g*g)*Math.pow(Math.max(.01,1+g*g-2*g*mu),1.5));
  let viewR=0,viewM=0;const result=[0,0,0],mie=.003*Math.max(.2,haze);
  for(let i=0;i<24;i++){
    const t=(i+.5)*step,p=[ray[0]*t,OBSERVER+ray[1]*t,ray[2]*t],h=Math.max(0,Math.hypot(...p)-EARTH);
    const dr=Math.exp(-h/8)*step,dm=Math.exp(-h/1.2)*step,[sunR,sunM]=optical(p,sun);
    for(let c=0;c<3;c++)result[c]+=12*Math.exp(-RAYLEIGH[c]*(viewR+.5*dr+sunR)-mie*(viewM+.5*dm+sunM))*(RAYLEIGH[c]*dr*phaseR+mie*dm*phaseM);
    viewR+=dr;viewM+=dm;
  }
  // Unmodelled higher-order scattering: low, neutral horizon fill.
  const fill=.025*(1-Math.exp(-viewM*.02));
  for(let c=0;c<3;c++)result[c]+=fill;
  if(direction[1]<0){const blend=1-Math.exp(direction[1]*14);for(let c=0;c<3;c++)result[c]=result[c]*(1-blend)+[.18,.225,.27][c]*blend;}
  return result;
}
export function atmosphereLighting(sun:readonly number[],haze:number){
  const [r,m]=optical([0,OBSERVER,0],normalize(sun));
  return {solar:RAYLEIGH.map(b=>Math.exp(-b*r-.003*haze*m)),ambient:skyRadiance([0,1,0],sun,haze).map(v=>.06+v*.48)};
}
export const SKY_LUT_SIZE=128;
export function fillSkyLUT(data:Float32Array,sun:readonly number[],haze:number){
  const s=normalize(sun),azimuth=Math.atan2(s[2],s[0]);
  for(let y=0;y<SKY_LUT_SIZE;y++)for(let x=0;x<SKY_LUT_SIZE;x++){
    const k=2*(y+.5)/SKY_LUT_SIZE-1,elevation=Math.sign(k)*k*k,horizontal=Math.sqrt(1-elevation*elevation);
    const az=azimuth+Math.acos(2*(x+.5)/SKY_LUT_SIZE-1),color=skyRadiance([horizontal*Math.cos(az),elevation,horizontal*Math.sin(az)],s,haze),at=(y*SKY_LUT_SIZE+x)*4;
    for(let c=0;c<3;c++)data[at+c]=color[c];data[at+3]=1;
  }
}
