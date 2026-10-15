import {BOUNDS_MIN,BOUNDS_SIZE,type DetailVolume} from './volume';
import {GROUND_LEVEL} from './landscape';
export const RAIN_MAP_SIZE=64;
// Resolve the roughly 12 m lateral rain structures without using cloud-empty skips.
export const RAIN_SAMPLE_STEP=.006;
// Authored extinction per kilometre; avoid turning distant rain into an opaque slab.
export const RAIN_EXTINCTION=.85;
// Maximum authored fall drift plus source shear, multiplied by signed wind.
export const RAIN_WIND_DISPLACEMENT_BOUND=2.5;
export type PrecipitationSourceBounds=[minX:number,minZ:number,maxX:number,maxZ:number];
/** Material-space support of every positive source texel under linear filtering.
 * A texel centre influences samples up to one full texel away, so expand the
 * texel cells by another half texel before clipping to the source domain.
 * Height-only padding is deliberately excluded: it cannot create rainfall.
 */
export function precipitationSourceBounds(map:Uint8Array,size=RAIN_MAP_SIZE):PrecipitationSourceBounds|null{
 let minX=size,minZ=size,maxX=-1,maxZ=-1;
 for(let z=0;z<size;z++)for(let x=0;x<size;x++){
  if(!(map[(z*size+x)*2]>0))continue;
  minX=Math.min(minX,x);minZ=Math.min(minZ,z);maxX=Math.max(maxX,x);maxZ=Math.max(maxZ,z);
 }
 if(maxX<0)return null;
 return [
  BOUNDS_MIN[0]+Math.max(0,(minX-.5)/size)*BOUNDS_SIZE[0],
  BOUNDS_MIN[2]+Math.max(0,(minZ-.5)/size)*BOUNDS_SIZE[2],
  BOUNDS_MIN[0]+Math.min(1,(maxX+1.5)/size)*BOUNDS_SIZE[0],
  BOUNDS_MIN[2]+Math.min(1,(maxZ+1.5)/size)*BOUNDS_SIZE[2],
 ];
}
const SOURCE_TOP=2.5;
const SOURCE_THRESHOLD=.05;
const encodeBase=(base:number)=>Math.round(Math.max(0,Math.min(1,(base+.5)/3))*255);
const clamp=(v:number)=>Math.max(0,Math.min(1,v));
const smooth=(a:number,b:number,v:number)=>{const t=clamp((v-a)/(b-a));return t*t*(3-2*t);};
/** Artistic evaporation distances in kilometres, shared by CPU and WGSL.
 * Weak sources make short virga; saturated sources retain water at sea level.
 * Terrain occlusion terminates the view ray separately, without sampling
 * terrain height for every precipitation integration step.
 */
export const VIRGA_FALL_DISTANCE=1.4;
export const EVAPORATION_FADE=.55;
export const WET_FLOOR=GROUND_LEVEL-.65;
export function precipitationSurvival(worldY:number,baseWorld:number,amount:number,strength:number):number{
 if(amount<=0||strength<=0)return 0;
 const reach=smooth(.2,.8,clamp(amount)*Math.sqrt(clamp(strength)));
 const floor=(baseWorld-VIRGA_FALL_DISTANCE)*(1-reach)+WET_FLOOR*reach;
 return smooth(floor,floor+EVAPORATION_FADE,worldY);
}
export const PRECIPITATION_WGSL=`
fn precipitationSurvival(worldY:f32,baseWorld:f32,amount:f32,strength:f32)->f32{
 if(amount<=0.0||strength<=0.0){return 0.0;}
 let reach=smoothstep(0.2,0.8,clamp(amount,0.0,1.0)*sqrt(clamp(strength,0.0,1.0)));
 let floor=mix(baseWorld-${VIRGA_FALL_DISTANCE},${WET_FLOOR},reach);
 return smoothstep(floor,floor+${EVAPORATION_FADE},worldY);
}`;
/** Area-filtered lower-cloud mass and mass-weighted base height, in RG8.
 * Both channels follow the same source footprint. Empty texels next to rain
 * carry an extrapolated height so linear GPU filtering cannot lift the curtain
 * toward an unrelated sentinel height. This is an authored source, not droplets.
 */
export function precipitationFootprint(volume:DetailVolume,size=RAIN_MAP_SIZE):Uint8Array{
 const data=new Uint8Array(size*size*2),raw=new Float32Array(size*size),bases=new Float32Array(size*size),filteredBase=new Float32Array(size*size);
 const cell=volume.size/size,voxelHeight=BOUNDS_SIZE[1]/volume.size;
 for(let z=0;z<size;z++)for(let x=0;x<size;x++){
  const left=x*cell,right=(x+1)*cell,front=z*cell,back=(z+1)*cell;
  let mass=0,baseMoment=0;
  // Integrate every overlapping macro column; nearest-column downsampling
  // otherwise loses compact rain cores between the 64² texel centres.
  for(let zz=Math.floor(front);zz<Math.min(volume.size,Math.ceil(back));zz++)for(let xx=Math.floor(left);xx<Math.min(volume.size,Math.ceil(right));xx++){
   const area=(Math.min(right,xx+1)-Math.max(left,xx))*(Math.min(back,zz+1)-Math.max(front,zz));
   let columnMass=0,columnBase=SOURCE_TOP;
   for(let y=0;y<volume.size;y++){
    const height=BOUNDS_MIN[1]+(y+.5)*voxelHeight;if(height>SOURCE_TOP)break;
    const d=volume.data[((zz*volume.size+y)*volume.size+xx)*4]/255;
    // A diffuse column without a qualifying cloud base is not a rain source.
    if(d<=SOURCE_THRESHOLD)continue;
    columnBase=Math.min(columnBase,height);columnMass+=d*voxelHeight;
   }
   mass+=columnMass*area;baseMoment+=columnBase*columnMass*area;
  }
  raw[z*size+x]=Math.min(1,mass/(cell*cell)*.85);
  bases[z*size+x]=mass>0?baseMoment/mass:SOURCE_TOP;
 }
 for(let z=0;z<size;z++)for(let x=0;x<size;x++){
  let sum=0,weight=0,baseMoment=0;
  for(let dz=-2;dz<=2;dz++)for(let dx=-2;dx<=2;dx++){
   const xx=x+dx,zz=z+dz,w=Math.exp(-(dx*dx+dz*dz)/2);
   if(xx>=0&&xx<size&&zz>=0&&zz<size){
    const source=raw[zz*size+xx]*w;
    sum+=source;baseMoment+=bases[zz*size+xx]*source;
   }
   weight+=w;
  }
  data[(z*size+x)*2]=Math.round(sum/weight*255);
  filteredBase[z*size+x]=sum>0?baseMoment/sum:NaN;
 }
 for(let z=0;z<size;z++)for(let x=0;x<size;x++){
  let base=filteredBase[z*size+x];
  if(!Number.isFinite(base)){
   // One texel is enough for the GPU bilinear footprint, including diagonals.
   let weight=0,moment=0;
   for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++){
    const xx=x+dx,zz=z+dz;
    if(xx<0||xx>=size||zz<0||zz>=size)continue;
    const at=zz*size+xx,w=data[at*2];
    if(w>0){weight+=w;moment+=filteredBase[at]*w;}
   }
   base=weight>0?moment/weight:SOURCE_TOP;
  }
  data[(z*size+x)*2+1]=encodeBase(base);
 }
 return data;
}
