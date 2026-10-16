import {clipTerrainShadowTexel,type TerrainShadowTriangle} from '../candidate-source/src/cumulonimbus/terrainShadowClip';

// One pre-derived analytic case, no parameter search. See Solar's signed proof.
const radius=64,size=2048,step=2*radius/size,offset=step/2,bias=.001;
const a=[[.02,-.1,.54],[.1,0,.7],[.02,.1,.54]] as const;
const b=[[.02,.1,.54],[-.1,0,.3],[.02,-.1,.54]] as const;
const centre=[step/2,-step/2] as const,receiver=[-.001,-3.498,-.001] as const;
const radial=[receiver[0],receiver[1]+6375,receiver[2]],length=Math.hypot(...radial);
const lookup=receiver.map((v,i)=>v+offset*radial[i]/length);
const lightLookup=[-lookup[0],lookup[2],lookup[1]+4];
const inside=(p:readonly number[],triangle:readonly (readonly number[])[])=>{
 const cross=(a:readonly number[],b:readonly number[],c:readonly number[])=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
 return triangle.every((v,i)=>cross(v,triangle[(i+1)%3],p)>0);
};
if(!inside(centre,a)||inside(centre,b)||!inside([.001,-.001],b)||inside([.001,-.001],a))throw Error('Analytic topology failed');
const triangle=a.map(([xi,eta,q])=>[.5+xi/(2*radius),.5-eta/(2*radius),q]) as unknown as TerrainShadowTriangle;
const pixel=[Math.floor((.5+lightLookup[0]/(2*radius))*size),Math.floor((.5-lightLookup[1]/(2*radius))*size)] as [number,number];
if(pixel[0]!==1024||pixel[1]!==1024)throw Error('Lookup left intended texel');
const baseline=.5625-.5*.125-bias;
const cases=(['float64','float32'] as const).map(precision=>{
 const result=clipTerrainShadowTexel(triangle,[1024.5,1024.5],[size,size],baseline,precision);
 const q=precision==='float32'?Math.fround(lightLookup[2]):lightLookup[2];
 if(!result.valid||q<baseline||q>=result.minimum)throw Error('Counterexample did not expose false self-shadow');
 return {precision,baselineMinimumKm:baseline,clippedMinimumKm:result.minimum,qLookupKm:q,
  baselineLit:q>=baseline,clippedLit:q>=result.minimum,falseShadowMarginM:(result.minimum-q)*1000,polygonVertices:result.count};
});
process.stdout.write(JSON.stringify({status:'SINGLE_PREDEFINED_COPLANAR_COUNTEREXAMPLE_CONFIRMED',radiusKm:radius,resolution:size,stepKm:step,
 receiverRadialOffsetKm:offset,biasKm:bias,trianglesLightCoordinates:[a,b],texelCentre:centre,receiver,lookup,lightLookup,addressedPixel:pixel,
 receiverInsideB:true,texelCentreInsideA:true,normalDotSun:1/Math.sqrt(5),physicalSunRay:'Vertical ray from point on one affine graph; XZ fixed and Y strictly increases, so no later intersection with that graph.',
 cases,scope:'Analytic topology plus existing CPU clipping function. Not a GPU/raster proof or explanation of the native speckle frequency. Float32 mode rounds clipping and lookup q, not the full GPU matrix/FMA path.'},null,2)+'\n');
