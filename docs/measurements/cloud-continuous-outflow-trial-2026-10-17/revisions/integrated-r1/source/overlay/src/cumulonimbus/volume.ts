import { bakeOpticalDepth } from './light';
import {SUN_LEFT,SUN_RIGHT,solarDirection} from './sun';
export {SUN_LEFT,SUN_RIGHT} from './sun';
import { THERMAL_DISPLACEMENT } from './motion';
import {
  prepareContinuousOutflow, CONTINUOUS_OUTFLOW_ROUNDOFF_SLACK_KM,
  type ContinuousOutflowLobe, type PreparedContinuousOutflow, type ContinuousOutflowStats,
} from './continuousOutflow';
/** World bounds and extinction are shared by the bake and ray integrator. */
export const BOUNDS_MIN = [-5, -0.5, -3.5] as const;
export const BOUNDS_SIZE = [10, 8.5, 7] as const;
export const EXTINCTION = 18;
export const ICE_EXTINCTION = 6.5;
export const materialExtinction=(ice:number)=>EXTINCTION+(ICE_EXTINCTION-EXTINCTION)*ice;
export const VOLUME_RESOLUTION = 256;
export const DETAIL_RESOLUTION = 128;
// Historical fine-warp-only margin, retained for the original mask proof test.
// The live renderer uses the flow-expanded margin in emptyTraversal.ts instead.
export const EMPTY_SKIP_LIMIT = .04;
export const voxelCenter=(index:number,axis:0|1|2,size:number)=>BOUNDS_MIN[axis]+(index+.5)/size*BOUNDS_SIZE[axis];
export const heightErosionScale = (worldY: number) => (.48+.52*smoothstep(1.6,2.5,worldY))*(1-.55*smoothstep(5.1,6.2,worldY));
export interface DetailVolume { size: number; data: Uint8Array }
export interface CloudVolume { size: number; data: Uint8Array; sunsetLight: Uint8Array; detail: DetailVolume; supportBounds:{min:number[];max:number[]}; continuousOutflow?:ContinuousOutflowStats & {retiredCollars:number;retiredPrimitives:number} }
/** The raw linear density footprint, enlarged for fine warp and bounded flow.
 * Growth contracts toward x/z=0 and y=.72, so including those anchors covers
 * every growth phase as well as the mature cloud. The global texture box stays fixed.
 */
export function densitySupportBounds(envelope:DetailVolume): {min:number[];max:number[]} {
  const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
  for(let z=0;z<envelope.size;z++) for(let y=0;y<envelope.size;y++) for(let x=0;x<envelope.size;x++) {
    if(!envelope.data[((z*envelope.size+y)*envelope.size+x)*4]) continue;
    const point=[x,y,z];
    for(let axis=0;axis<3;axis++) {min[axis]=Math.min(min[axis],point[axis]);max[axis]=Math.max(max[axis],point[axis]);}
  }
  if(!Number.isFinite(min[0])) return {min:[...BOUNDS_MIN],max:BOUNDS_MIN.map((v,i)=>v+BOUNDS_SIZE[i])};
  const anchor=[0,.72,0];
  for(let axis=0;axis<3;axis++) {
    const voxel=BOUNDS_SIZE[axis]/envelope.size,pad=voxel+[.08,.06,.08][axis]+THERMAL_DISPLACEMENT[axis];
    min[axis]=Math.max(BOUNDS_MIN[axis],Math.min(anchor[axis],BOUNDS_MIN[axis]+(min[axis]+.5)*voxel-pad));
    max[axis]=Math.min(BOUNDS_MIN[axis]+BOUNDS_SIZE[axis],Math.max(anchor[axis],BOUNDS_MIN[axis]+(max[axis]+.5)*voxel+pad));
  }
  return {min,max};
}
export type MorphologyFamily = 'congestus' | 'multicell' | 'sheared';
export const morphologyFamily=(seed:number):MorphologyFamily=>['congestus','multicell','sheared'][((Math.trunc(seed)%3)+3)%3] as MorphologyFamily;
export interface CloudParameters { family: MorphologyFamily; towerHeight: number; towerWidth: number; anvilSpread: number; windLean: number }
type Lobe = [number, number, number, number, number, number, number?];
const clamp = (v: number) => Math.max(0, Math.min(1, v));
const smoothstep = (a: number,b: number,x: number) => { const t=clamp((x-a)/(b-a)); return t*t*(3-2*t); };
function random(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6d2b79f5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t ^= t + Math.imul(t ^ t >>> 7, 61 | t); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
/** Bounded morphology keeps the convective tower, rain base and ice anvil recognizable. */
export function cloudParameters(seed: number): CloudParameters {
  const rng=random(seed^0x41c6ce57),family=morphologyFamily(seed);
  const height=rng(),width=rng(),spread=rng(),lean=rng();
  if(family==='congestus') return {family,towerHeight:.65+height*.09,towerWidth:1+width*.12,anvilSpread:.55+spread*.16,windLean:(lean-.5)*.045};
  if(family==='multicell') return {family,towerHeight:.78+height*.12,towerWidth:1+width*.1,anvilSpread:.82+spread*.18,windLean:.025+lean*.045};
  return {family,towerHeight:.73+height*.13,towerWidth:.96+width*.12,anvilSpread:.94+spread*.12,windLean:.19+lean*.07};
}
function noise(x: number, y: number, z: number, seed: number, period = 0): number {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
  let fx=x-ix, fy=y-iy, fz=z-iz;
  fx=fx*fx*(3-2*fx); fy=fy*fy*(3-2*fy); fz=fz*fz*(3-2*fz);
  const h = (a: number,b: number,c: number) => {
    if(period) {a&=period-1;b&=period-1;c&=period-1;}
    let n = Math.imul(a, 73856093) ^ Math.imul(b, 19349663) ^ Math.imul(c, 83492791) ^ seed;
    n = Math.imul(n ^ n >>> 13, 1274126177); return (n >>> 0)/4294967295;
  };
  const lerp = (a: number,b: number,t: number) => a+(b-a)*t;
  return lerp(lerp(lerp(h(ix,iy,iz),h(ix+1,iy,iz),fx),lerp(h(ix,iy+1,iz),h(ix+1,iy+1,iz),fx),fy),
    lerp(lerp(h(ix,iy,iz+1),h(ix+1,iy,iz+1),fx),lerp(h(ix,iy+1,iz+1),h(ix+1,iy+1,iz+1),fx),fy),fz);
}
export function generateDetail(size=DETAIL_RESOLUTION,seed=71): DetailVolume {
  const data=new Uint8Array(size**3*4), cellular=cellularNoise(seed+513);
  for(let z=0;z<size;z++) for(let y=0;y<size;y++) for(let x=0;x<size;x++) {
    const px=(x+.5)/size, py=(y+.5)/size, pz=(z+.5)/size, i=((z*size+y)*size+x)*4;
    data[i]=Math.round((cellular(px*32,py*32,pz*32)*.65+noise(px*8,py*8,pz*8,seed,8)*.35)*255);
    data[i+1]=Math.round(noise(px*16,py*16,pz*16,seed+21,16)*255);
    data[i+2]=Math.round(noise(px*32,py*32,pz*32,seed+39,32)*255); data[i+3]=255;
  }
  return {size,data};
}
/** Matches normalized, repeating linear GPU texture sampling, including the half-texel offset. */
export function sampleDetail(detail: DetailVolume,x:number,y:number,z:number,channel:number,repeat=true): number {
  const normalize=(v:number)=>repeat?v-Math.floor(v):clamp(v);
  const {size,data}=detail, px=normalize(x)*size-.5,py=normalize(y)*size-.5,pz=normalize(z)*size-.5;
  const ix=Math.floor(px),iy=Math.floor(py),iz=Math.floor(pz),fx=px-ix,fy=py-iy,fz=pz-iz;
  const index=(v:number)=>repeat?(v+size)%size:Math.max(0,Math.min(size-1,v));
  const at=(a:number,b:number,c:number)=>data[(((index(c)*size+index(b))*size+index(a))*4)+channel]/255;
  let sum=0;
  for(let dz=0;dz<2;dz++) for(let dy=0;dy<2;dy++) for(let dx=0;dx<2;dx++) sum+=at(ix+dx,iy+dy,iz+dz)*(dx?fx:1-fx)*(dy?fy:1-fy)*(dz?fz:1-fz);
  return sum;
}
export const erodeDensity=(density:number,erosion:number)=>clamp((density-erosion)/(1-erosion));
export function iceHeights(seed:number): [number,number] {
  const h=cloudParameters(seed).towerHeight;
  return [.72+(5.15-.72)*h,.72+(5.95-.72)*h];
}
/** Evaluates the same displaced and eroded envelope used by the GPU integrator. */
export function sampleCloudDensity(envelope:DetailVolume,detail:DetailVolume,x:number,y:number,z:number,ice:number,additionalErosion=0): number {
  const r=sampleDetail(detail,x*.3,y*.3,z*.3,0),g=sampleDetail(detail,x*.3,y*.3,z*.3,1),b=sampleDetail(detail,x*.3,y*.3,z*.3,2);
  const wx=(g-.5)*(.16-.08*ice),wy=(b-.5)*(.12-.1*ice),wz=(r-.5)*(.16-.06*ice);
  const warped=sampleDetail(envelope,(x+wx-BOUNDS_MIN[0])/10,(y+wy-BOUNDS_MIN[1])/8.5,(z+wz-BOUNDS_MIN[2])/7,0,false);
  let erosion=(1-r)*.38+(1-b)*.08;
  let material=1;
  if(ice>0) {
    // Bent outflow ribbons vary through depth as well as height, so an oblique
    // view does not collapse the ice into parallel sheets. RGB shares one lookup.
    const bend=sampleDetail(detail,x*.12,y*.10,z*.06,1);
    const ix=x*.055+bend*.08,iy=y*.34+x*.022+(bend-.5)*.06,iz=z*.08+(bend-.5)*.025;
    const wisps=sampleDetail(detail,ix,iy,iz,0),breakup=sampleDetail(detail,ix,iy,iz,2);
    erosion=erosion*(1-ice)+(.08+(1-wisps)*.5)*ice;
    const strand=smoothstep(.3,.7,wisps);
    material=1-ice+(.012+.56*strand**1.7)*(.65+.35*smoothstep(.25,.75,breakup))*(1-.7*smoothstep(.4,3.8,x))*ice;
  }
  return erodeDensity(warped,Math.min(.92,erosion+additionalErosion))*material;
}
/** Packs a conservative occupied-region mask into the unused alpha of the detail texture.
 * Noise RGB still repeats in cloud space; mask alpha is read at normalized world coordinates.
 */
export function bakeOccupancy(envelope:DetailVolume,detail:DetailVolume,additional:readonly number[]=[0,0,0]): void {
  const coarse=detail.size, fine=envelope.size, mask=new Uint8Array(coarse**3);
  for(let z=0;z<fine;z++) for(let y=0;y<fine;y++) for(let x=0;x<fine;x++) {
    if(envelope.data[((z*fine+y)*fine+x)*4]===0) continue;
    mask[(Math.floor(z*coarse/fine)*coarse+Math.floor(y*coarse/fine))*coarse+Math.floor(x*coarse/fine)]=1;
  }
  // Include displacement and the macro interpolation footprint on each axis.
  const radius=BOUNDS_SIZE.map((extent,axis)=>Math.ceil(([.08,.06,.08][axis]+additional[axis]+extent/fine)/(extent/coarse)));
  // Cuboid union via a 3D difference array: broad deformation margins must not
  // multiply the worker's work by the volume of every dilation neighbourhood.
  const edge=coarse+1, difference=new Int32Array(edge**3);
  for(let z=0;z<coarse;z++) for(let y=0;y<coarse;y++) for(let x=0;x<coarse;x++) {
    if(!mask[(z*coarse+y)*coarse+x]) continue;
    const lo=[Math.max(0,x-radius[0]),Math.max(0,y-radius[1]),Math.max(0,z-radius[2])];
    const hi=[Math.min(coarse,x+radius[0]+1),Math.min(coarse,y+radius[1]+1),Math.min(coarse,z+radius[2]+1)];
    for(let c=0;c<2;c++) for(let b=0;b<2;b++) for(let a=0;a<2;a++)
      difference[((c?hi[2]:lo[2])*edge+(b?hi[1]:lo[1]))*edge+(a?hi[0]:lo[0])]+=(a+b+c)%2?-1:1;
  }
  for(let z=0;z<edge;z++) for(let y=0;y<edge;y++) for(let x=1;x<edge;x++) difference[(z*edge+y)*edge+x]+=difference[(z*edge+y)*edge+x-1];
  for(let z=0;z<edge;z++) for(let y=1;y<edge;y++) for(let x=0;x<edge;x++) difference[(z*edge+y)*edge+x]+=difference[(z*edge+y-1)*edge+x];
  for(let z=1;z<edge;z++) for(let y=0;y<edge;y++) for(let x=0;x<edge;x++) difference[(z*edge+y)*edge+x]+=difference[((z-1)*edge+y)*edge+x];
  for(let z=0;z<coarse;z++) for(let y=0;y<coarse;y++) for(let x=0;x<coarse;x++) detail.data[((z*coarse+y)*coarse+x)*4+3]=difference[(z*edge+y)*edge+x]>0?255:0;
}
/** Periodic feature lattice for cellular erosion. Feature positions are allocated once per bake. */
function cellularNoise(seed: number) {
  const rng=random(seed), points=new Float32Array(32**3*3);
  for(let i=0;i<points.length;i++) points[i]=rng();
  return (x:number,y:number,z:number) => {
    const ix=Math.floor(x), iy=Math.floor(y), iz=Math.floor(z);
    const fx=x-ix, fy=y-iy, fz=z-iz;
    let distance=3;
    for(let dz=-1;dz<=1;dz++) for(let dy=-1;dy<=1;dy++) for(let dx=-1;dx<=1;dx++) {
      const idx=((((iz+dz)&31)*32+((iy+dy)&31))*32+((ix+dx)&31))*3;
      const ax=dx+points[idx]-fx, ay=dy+points[idx+1]-fy, az=dz+points[idx+2]-fz;
      distance=Math.min(distance,ax*ax+ay*ay+az*az);
    }
    return 1-clamp(Math.sqrt(distance));
  };
}
/** The real owner-side preparation, also usable with tiny synthetic keyframes.
 * The negative band includes the existing light-prune margin and one blend.
 */
export function prepareVolumeContinuousOutflow(
  keyframes:readonly [ContinuousOutflowLobe,ContinuousOutflowLobe,ContinuousOutflowLobe],size:number,
):PreparedContinuousOutflow {
  const supportMargin=.13+Math.hypot(...BOUNDS_SIZE)/size;
  return prepareContinuousOutflow(keyframes,{
    maxFieldErrorKm:Math.min(...BOUNDS_SIZE)/size/8,
    negativeBandKm:Math.max(.35,supportMargin+.16+CONTINUOUS_OUTFLOW_ROUNDOFF_SLACK_KM),
    grid:{min:BOUNDS_MIN,size:BOUNDS_SIZE,resolution:size},
    maxKernels:4096,maxRasterVoxelVisits:256_000_000,maxEnvelopeBytes:16*1024*1024,
  });
}

/** Clipped MAX in a bounded Float32 tile, followed by one legacy .16 blend.
 * Empty cells retain the certified negative floor. No full-volume copy.
 */
export function rasterizeContinuousOutflow(
  field:Float32Array,size:number,
  prepared:Pick<PreparedContinuousOutflow,'kernels'|'raster'> & {stats:Pick<ContinuousOutflowStats,'fieldFloorKm'>},
):void {
  if(field.length!==size**3)throw new RangeError('Outflow raster needs its native field');
  const floor=prepared.stats.fieldFloorKm;
  if(!Number.isFinite(floor)||floor>0)throw new RangeError('Outflow raster needs a finite nonpositive field floor');
  const {start,end,voxelCount,bytes}=prepared.raster;
  const width=end[0]-start[0]+1,height=end[1]-start[1]+1,depth=end[2]-start[2]+1;
  if(width<1||height<1||depth<1||voxelCount!==width*height*depth||bytes!==voxelCount*4||bytes>16*1024*1024)
    throw new RangeError('Outflow raster envelope exceeds its owner budget');
  const local=new Float32Array(voxelCount);local.fill(floor);
  for(const {lobe:[cx,cy,cz,rx,ry,rz],start:lo,end:hi} of prepared.kernels) {
    for(let z=lo[2];z<=hi[2];z++)for(let y=lo[1];y<=hi[1];y++)for(let x=lo[0];x<=hi[0];x++) {
      const px=voxelCenter(x,0,size),py=voxelCenter(y,1,size),pz=voxelCenter(z,2,size);
      const sd=(1-Math.sqrt(((px-cx)/rx)**2+((py-cy)/ry)**2+((pz-cz)/rz)**2))*Math.min(rx,ry,rz);
      const index=((z-start[2])*height+y-start[1])*width+x-start[0];
      if(sd>local[index])local[index]=sd;
    }
  }
  for(let z=start[2];z<=end[2];z++)for(let y=start[1];y<=end[1];y++)for(let x=start[0];x<=end[0];x++) {
    const sd=local[((z-start[2])*height+y-start[1])*width+x-start[0]];
    const index=(z*size+y)*size+x,old=field[index],blend=.16,h=clamp(.5+.5*(old-sd)/blend);
    field[index]=sd+(old-sd)*h+blend*h*(1-h);
  }
}

export function generateVolume(size = VOLUME_RESOLUTION, seed = 71, progress?: (fraction: number) => void): CloudVolume {
  const n = size ** 3, field = new Float32Array(n), density = new Float32Array(n);
  field.fill(-10);
  const rng = random(seed);
  const cellular=cellularNoise(seed+137);
  const shape=cloudParameters(seed);
  // Separate updraft sites share a broad low condensation base. Their unequal
  // summits and outflow geometry change topology, rather than scaling one stack.
  const liquid:Lobe[]=[],iceCores:Lobe[]=[],summits:Lobe[]=[],foundations:Lobe[]=[];
  const capParents=new Map<Lobe,Lobe>();
  const neckByTop=new Map<Lobe,Lobe>();
  const retiredCollarGroups=new Map<Lobe,Set<Lobe>>(),retiredRasterLobes=new Set<Lobe>();
  let continuousFrames:readonly [Lobe,Lobe,Lobe]|null=null;
  const authoredShoulders:Array<{core:Lobe;top:Lobe;foundation:Lobe;ordinal:number}>=[];
  let sharedBody:Lobe|null=null;
  const anatomy=random(seed^0x1b37c9a5);
  const turret=(x:number,z:number,height:number,width:number,lean:number) => {
    // Each updraft has its own emergence height, course and rate of expansion.
    // Shared horizontal rings would survive surface noise as visible ledges.
    const siteX=x+(anatomy()-.5)*.28,siteZ=z+(anatomy()-.5)*.32;
    const lower=2.25+(anatomy()-.5)*.3,crest=height+(anatomy()-.5)*.42;
    const shoulder=lower+(crest-lower)*(.43+anatomy()*.16);
    const offset=(anatomy()-.5)*.34,depth=(anatomy()-.5)*.3;
    const girth=width*(.91+anatomy()*.18),tipWidth=girth*(.67+anatomy()*.2);
    const top:Lobe=[siteX+lean+offset,crest,siteZ+depth,tipWidth,.65+anatomy()*.24,tipWidth*(.86+anatomy()*.2)];
    const foundation:Lobe=[siteX,lower,siteZ,girth*1.2,.94+anatomy()*.14,girth*1.06];
    liquid.push(foundation);foundations.push(foundation);
    liquid.push([siteX+lean*.4+offset*.6,shoulder,siteZ+depth*.6,girth*(.91+anatomy()*.12),(crest-lower)*.37,girth*.94]);
    // A buried neck keeps the main mass connected without smoothing the summit.
    const neck:Lobe=[siteX+lean*.72+offset,(shoulder+crest)*.5,siteZ+depth,girth*.74,(crest-shoulder)*.5+.48,girth*.77];
    liquid.push(neck,top);neckByTop.set(top,neck);
    summits.push(top);
    // Irregular lateral shoulders belong to this updraft, rather than a global
    // height layer. They are broad enough to read before any fine erosion.
    const shoulders=2+Math.floor(anatomy()*2),phase=anatomy()*Math.PI*2;
    for(let j=0;j<shoulders;j++) {
      const angle=phase+j*(2.05+anatomy()*.65),level=.3+anatomy()*.38;
      const radius=girth*(.62+anatomy()*.24),bulge=girth*(.45+anatomy()*.2);
      const lateral:Lobe=[siteX+lean*level+Math.cos(angle)*radius,lower+(crest-lower)*level,
        siteZ+depth*level+Math.sin(angle)*radius,bulge,bulge*(.88+anatomy()*.4),bulge*(.82+anatomy()*.3),.16];
      liquid.push(lateral);authoredShoulders.push({core:lateral,top,foundation,ordinal:j});
    }
  };
  if(shape.family==='congestus') {
    liquid.push([-.25,1.6,0,3.05,.9,1.9],[-1.5,2.25,-.25,1.55,.9,1.3],[1.35,2.1,.25,1.5,.8,1.2]);
    turret(-1.55,-.35,4.95,1.04,-.15);
    turret(.15,.4,5.35,.99,.1);
    turret(1.55,-.25,4.55,.88,.17);
    // Congestus starts a small, deep outflow at the oldest summit. It does not
    // carry a common flat canopy across the younger convective tips.
    const top=summits.reduce((a,b)=>a[1]>b[1]?a:b);
    const cap:Lobe=[top[0]+top[3]*.3,top[1]+top[4]*.48,top[2],top[3]*1.65,top[4]*.56,top[5]*1.1,.06];
    iceCores.push(cap);capParents.set(top,cap);
  } else if(shape.family==='multicell') {
    liquid.push([-1.5,1.5,-.25,2.1,.85,1.55],[1.25,1.55,.25,2.0,.9,1.6]);
    turret(-1.7,-.35,5.45,.98,-.22);
    turret(1.25,.3,4.5,.9,.25);
    const [older,younger]=summits;
    const pulseX=older[0]*.42+younger[0]*.58,pulseZ=(older[2]+younger[2])*.5+Math.min(older[5],younger[5])*.35;
    const pulseHeight=.72+(Math.min(older[1],younger[1])-.72)*(.58+anatomy()*.08);
    const pulseWidth=Math.min(older[3],younger[3])*(.72+anatomy()*.16);
    // A young intermediate updraft rises from the common base, forward of the
    // mature sites. Its own narrow neck/head raises the lower saddle without
    // joining the mature summits with a horizontal bridge or matching canopy.
    liquid.push([pulseX-.08,1.95,pulseZ,pulseWidth*1.22,(pulseHeight-.72)*.42,pulseWidth*1.12,.18],
      [pulseX,(1.95+pulseHeight)*.5,pulseZ,pulseWidth*.87,(pulseHeight-1.95)*.5+.32,pulseWidth*.9,.16],
      [pulseX+.08,pulseHeight,pulseZ+.05,pulseWidth*.9,pulseWidth*.98,pulseWidth*.94,.16]);
    // Each cell supplies its own outflow at its own maturity height. Keeping
    // those origins separate avoids a horizontal roof bridging empty air.
    for(const top of summits) {
      const cap:Lobe=[top[0]+top[3]*.34,top[1]+top[4]*.48,top[2],top[3]*1.65,top[4]*.5,top[5]*1.14,.055];
      iceCores.push(cap);capParents.set(top,cap);
    }
  } else {
    liquid.push([-1.2,1.55,0,2.65,.87,1.8]);
    turret(-1.45,-.3,5.3,1.05,.5);
    turret(.75,.5,4.35,.82,.24);
    liquid.push([-2.45,2.7,.15,.82,1.0,.83],[-2.15,3.75,.1,.64,.72,.68]);
    // A shared replenished body occupies the lower/middle space between the
    // actual updraft sites. The younger summit remains separate above it.
    const [a,b]=summits,rise=Math.min(a[1],b[1])-.72;
    sharedBody=[(a[0]+b[0])*.5,.72+rise*.5,(a[2]+b[2])*.5,
      Math.abs(a[0]-b[0])*.5+Math.min(a[3],b[3])*.68,rise*.29+.16,
      Math.max(a[5],b[5])*.95+Math.abs(a[2]-b[2])*.35,.18];
    liquid.push(sharedBody);
    // The upper tower is advected into a narrow, long incus, with a short
    // upwind shoulder and a much longer fibrous downwind end.
    iceCores.push([-.25,5.85,-.2,1.45,.44,1.3,.045],[1.45,6.02,-.2,2.25,.36,1.05,.035]);
    // References follow the one legacy transform/contraction without mutation.
    // This first-cap role does not change the legacy nearest-parent collars.
    const mature=summits.reduce((a,b)=>a[1]>b[1]?a:b);
    continuousFrames=[neckByTop.get(mature)!,mature,iceCores[0]];
  }
  if(shape.family!=='sheared') for(let i=0;i<summits.length;i++) {
    const top=summits[i],foot=foundations[i];
    const bottom=.72+(top[1]-.72)*.18,roof=.72+(top[1]-.72)*(shape.family==='congestus'?.76:.68);
    // A buried, vertically replenished body reaches through the lower/middle
    // updraft. Surface shoulders and distinct summits sit outside this nucleus.
    liquid.push([foot[0]+(top[0]-foot[0])*.32,(bottom+roof)*.5,foot[2]+(top[2]-foot[2])*.32,
      foot[3]*.94,(roof-bottom)*.5+.1,foot[5]*.98,.18]);
  }
  const transform=(c:Lobe,isIce:boolean) => {
    const width=isIce?shape.anvilSpread:shape.towerWidth;
    // Lean grows from the base anchor, shifting the summit more than the base.
    c[0]=c[0]*shape.towerWidth+(c[1]-.72)*shape.windLean;
    c[1]=.72+(c[1]-.72)*shape.towerHeight;
    c[2]*=shape.towerWidth;
    c[3]*=width*(isIce?1:1.16);c[4]*=shape.towerHeight*(isIce?1:1.1);c[5]*=shape.towerWidth*(isIce?1:1.16);
  };
  liquid.forEach(c=>transform(c,false));iceCores.forEach(c=>transform(c,true));
  // The outflow expands from the mature summits through overlapping sloped
  // collars. These attach to local tower/cap geometry, not a fixed world height.
  const highest=Math.max(...summits.map(c=>c[1]));
  for(const top of summits) {
    if(shape.family==='congestus'&&!capParents.has(top)) continue;
    if(shape.family!=='multicell'&&top[1]<highest-.28*shape.towerHeight) continue;
    const cap=capParents.get(top)??iceCores.reduce((a,b)=>Math.hypot(a[0]-top[0],a[2]-top[2])<Math.hypot(b[0]-top[0],b[2]-top[2])?a:b);
    const broadShoulder=shape.family==='sheared'&&top[1]===highest;
    for(const t of broadShoulder?[.1,.42,.78]:[.3,.72]) {
      // Mature sheared convection broadens before turning into its outflow,
      // rather than bending a thin stalk directly into the horizontal cap.
      const reach=broadShoulder?Math.sqrt(t):t*t;
      const rx=top[3]*(1-reach)+Math.min(cap[3]*(broadShoulder?.95:.72),top[3]*(broadShoulder?2.05:1.65))*reach;
      const rz=top[5]*(1-reach)+cap[5]*(broadShoulder?.9:.72)*reach;
      const collar:Lobe=[top[0]+(cap[0]-top[0])*t,top[1]+(cap[1]-top[1])*t,top[2]+(cap[2]-top[2])*t,
        rx,.3+(cap[1]-top[1])*.48,rz,.14];
      liquid.push(collar);
      if(broadShoulder)retiredCollarGroups.set(collar,new Set([collar]));
    }
  }
  const lobes:Lobe[]=[...liquid,...iceCores];
  // Retain actual descendants without changing the append schedule or RNG.
  const trackedGroups=new Map<Lobe,Set<Lobe>>();
  if(shape.family==='sheared') {
    if(!sharedBody)throw new Error('The joint-body trial needs its shared body');
    trackedGroups.set(sharedBody,new Set([sharedBody]));
    for(const {core} of authoredShoulders)trackedGroups.set(core,new Set([core]));
  }
  [...liquid,...iceCores].forEach((c,i) => {
    const tracked=trackedGroups.get(c);
    const retired=retiredCollarGroups.get(c);
    const isIce=i>=liquid.length,count=isIce?10:18;
    for (let j=0; j<count; j++) {
      const theta=rng()*Math.PI*2, elevation=(rng()-.5)*1.8;
      // Billow size follows the parent: shoulder relief remains subordinate to
      // the major masses instead of wrapping every core in equal-sized beads.
      const scale=Math.min(c[3],c[4],c[5]);
      const shearedIce=isIce&&shape.family==='sheared';
      const s=!isIce?Math.max(.16,Math.min(.7,scale*(.32+rng()*.27))):
        shearedIce?.34+rng()*.3:Math.max(.16,Math.min(.48,Math.min(c[3],c[5])*(.26+rng()*.24)));
      const radius=isIce?.68:.78,stretchX=isIce?(shearedIce?1.7:1.45):1,stretchY=isIce?(shearedIce?.16:.48):1;
      lobes.push([c[0]+Math.cos(theta)*c[3]*radius*Math.cos(elevation), c[1]+Math.sin(elevation)*c[4]*radius,
        c[2]+Math.sin(theta)*c[5]*radius*Math.cos(elevation), s*stretchX, s*stretchY, s*.85, isIce?.045:.2]);
      tracked?.add(lobes.at(-1)!);
      retired?.add(lobes.at(-1)!);
      if(!isIce) {
        const l=lobes.at(-1)!;
        for(let k=0;k<4;k++) {
          const a=rng()*Math.PI*2,e=(rng()-.5)*2,r=s*(.24+rng()*.22);
          lobes.push([l[0]+Math.cos(a)*s*.76*Math.cos(e),l[1]+Math.sin(e)*s*.76,l[2]+Math.sin(a)*s*.76*Math.cos(e),r,r*.9,r]);
          tracked?.add(lobes.at(-1)!);
          retired?.add(lobes.at(-1)!);
        }
      }
    }
  });
  // Unequal overlapping outflow billows give the cap a three-dimensional shoulder.
  // Their heights/depths vary independently: no single smooth roof ellipsoid.
  const capRng=random(seed^0x291fab);
  for(const core of iceCores) for(let j=0;j<14;j++) {
    const reach=capRng()*2-1,side=capRng()*2-1;
    if(shape.family==='sheared') lobes.push([core[0]+reach*core[3]*.82,core[1]+(capRng()-.5)*.18,
      core[2]+side*core[5]*.78,.35+capRng()*.7,.14+capRng()*.16,.25+capRng()*.42,.035]);
    else lobes.push([core[0]+reach*core[3]*.76,core[1]+(capRng()-.5)*core[4]*1.6,
      core[2]+side*core[5]*.78,core[3]*(.2+capRng()*.32),core[4]*(.55+capRng()*.6),core[5]*(.2+capRng()*.35),.045]);
  }
  // Sparse, thin ice streaks connect to the outflow and taper at varying heights.
  // A separate RNG preserves the convective tower layout for seed comparisons.
  const iceRng=random(seed^0x73d61a29);
  const streakCount=shape.family==='congestus'?16:shape.family==='multicell'?36:48;
  for(let j=0;j<streakCount;j++) {
    if(shape.family!=='sheared') {
      const core=iceCores[j%iceCores.length],reach=.55+iceRng()*.65;
      // Short, thin strands leave local outflow edges at varying heights/depths;
      // they do not rebuild a second common canopy above separate cells.
      lobes.push([core[0]+core[3]*reach,core[1]+(iceRng()-.5)*core[4]*1.8+reach*core[4]*.15,
        core[2]+(iceRng()-.5)*core[5]*1.4,core[3]*(.24+iceRng()*.36),.035+iceRng()*.05,.07+iceRng()*.14,.035]);
      continue;
    }
    const reach=iceRng(),rx=(.55+iceRng()*.75)*shape.anvilSpread;
    const origin=-.1,length=3.5;
    const cx=(origin+reach*length)*shape.anvilSpread+5.3*shape.windLean;
    lobes.push([cx,.72+(6.0+(iceRng()-.5)*.6-.72)*shape.towerHeight,
      -.2+(iceRng()-.5)*1.7*shape.towerWidth,rx,.055+iceRng()*.045,.17+iceRng()*.22,.045]);
  }
  for(const group of retiredCollarGroups.values())for(const lobe of group)retiredRasterLobes.add(lobe);
  // Contract whole horizontal axes if a seeded puff/outflow would approach the
  // texture wall. This preserves curved lobe endings, without clipping any lobe
  // or piling centres against a plane. Reserve a halo for smooth union and warp.
  for(const [axis,radius,limit] of [[0,3,4.35],[2,5,2.8]] as const) {
    const extent=Math.max(...lobes.map(c=>Math.abs(c[axis])+c[radius]));
    const scale=Math.min(1,limit/extent);
    for(const c of lobes) {c[axis]*=scale;c[radius]*=scale;}
  }
  if(shape.family==='sheared') {
    // Remove only the inward component of the mature shoulder offset;
    // perpendicular offsets, shared body and other groups stay unchanged.
    const mature=summits.reduce((a,b)=>a[1]>b[1]?a:b),foot=foundations[summits.indexOf(mature)];
    const others=foundations.filter(value=>value!==foot);
    if(others.length!==1||!sharedBody)throw new Error('The joint-body trial needs two source cells');
    const direction=[others[0][0]-foot[0],0,others[0][2]-foot[2]],length=Math.hypot(...direction);
    if(!(length>0))throw new Error('The joint-body trial needs distinct source cells');
    const inner=direction.map(value=>value/length);
    const candidates=authoredShoulders.filter(value=>value.top===mature).map(value=>{
      const t=(value.core[1]-foot[1])/(mature[1]-foot[1]);
      const pivot=[foot[0],foot[1],foot[2]].map((coordinate,axis)=>coordinate+(mature[axis]!-coordinate)*t);
      const offset=[value.core[0],value.core[1],value.core[2]].map((coordinate,axis)=>coordinate-pivot[axis]);
      const projection=offset.reduce((sum,coordinate,axis)=>sum+coordinate*inner[axis],0);
      return {...value,pivot,projection};
    });
    if(!candidates.length)throw new Error('The joint-body trial needs an authored mature shoulder');
    const selected=candidates.reduce((a,b)=>a.projection>b.projection?a:b);
    const bodyGroup=trackedGroups.get(sharedBody)!,innerGroup=trackedGroups.get(selected.core)!;
    if(bodyGroup.size!==91||innerGroup.size!==91||new Set([...bodyGroup,...innerGroup]).size!==182)
      throw new Error('The joint-body trial needs two distinct complete descendant groups');
    const translation=[-inner[0]*selected.projection,0,-inner[2]*selected.projection];
    if(selected.projection>0)for(const lobe of innerGroup){lobe[0]+=translation[0];lobe[2]+=translation[2];}
  }
  // Rasterize lobes into their local bounds instead of testing every lobe at every voxel.
  let preparedOutflow:PreparedContinuousOutflow|undefined;
  if(shape.family==='sheared') {
    if(!continuousFrames||retiredCollarGroups.size!==3||retiredRasterLobes.size!==273||
        [...retiredCollarGroups.values()].some(group=>group.size!==91)||continuousFrames.some(lobe=>retiredRasterLobes.has(lobe)))
      throw new Error('The continuous outflow needs its original endpoints and three complete retired collar groups');
    // Fail preparation budgets before either the legacy or the new raster loop.
    preparedOutflow=prepareVolumeContinuousOutflow(continuousFrames,size);
  }
  for (const lobe of lobes) {
    if(retiredRasterLobes.has(lobe))continue;
    const [cx,cy,cz,rx,ry,rz,blend=.2]=lobe;
    const lo = [cx-rx-.35,cy-ry-.35,cz-rz-.35], hi=[cx+rx+.35,cy+ry+.35,cz+rz+.35];
    const start=lo.map((v,i)=>Math.max(1,Math.floor((v-BOUNDS_MIN[i])/BOUNDS_SIZE[i]*size-.5)));
    const end=hi.map((v,i)=>Math.min(size-2,Math.ceil((v-BOUNDS_MIN[i])/BOUNDS_SIZE[i]*size-.5)));
    for(let z=start[2];z<=end[2];z++) for(let y=start[1];y<=end[1];y++) for(let x=start[0];x<=end[0];x++) {
      const px=voxelCenter(x,0,size), py=voxelCenter(y,1,size), pz=voxelCenter(z,2,size);
      const sd=(1-Math.sqrt(((px-cx)/rx)**2+((py-cy)/ry)**2+((pz-cz)/rz)**2))*Math.min(rx,ry,rz);
      const idx=(z*size+y)*size+x; const old=field[idx],h=clamp(.5+.5*(old-sd)/blend);
      field[idx]=sd+(old-sd)*h+blend*h*(1-h);
    }
  }
  let continuousOutflow:CloudVolume['continuousOutflow'];
  if(preparedOutflow) {
    rasterizeContinuousOutflow(field,size,preparedOutflow);
    continuousOutflow={...preparedOutflow.stats,retiredCollars:retiredCollarGroups.size,retiredPrimitives:retiredRasterLobes.size};
  }
  const [iceStart,iceEnd]=iceHeights(seed);
  for(let z=1;z<size-1;z++) {
    for(let y=1;y<size-1;y++) for(let x=1;x<size-1;x++) {
      const idx=(z*size+y)*size+x; if(field[idx]<-.3) continue;
      const px=(x+.5)/size*10, py=(y+.5)/size*8.5, pz=(z+.5)/size*7;
      const n1=noise(px*1.25,py*1.25,pz*1.25,seed), n2=noise(px*3.6,py*3.6,pz*3.6,seed+12), n3=noise(px*9,py*9,pz*9,seed+42);
      const c1=cellular(px*1.8,py*1.8,pz*1.8), c2=cellular(px*4.5,py*4.5,pz*4.5);
      const erosion=Math.min(0,(n1-.5)*.2-(1-c1)*.52-(1-c2)*.2+(n3-.5)*.1);
      const baseFade=clamp((py+BOUNDS_MIN[1]-.72)/.24);
      const worldY=py+BOUNDS_MIN[1];
      const erosionScale=heightErosionScale(worldY);
      const ice=smoothstep(iceStart,iceEnd,worldY);
      const fibers=noise(px*.3+py*.17,py*5,pz*1.0,seed+81);
      const interior=1-.6*smoothstep(.04,.28,field[idx]);
      const carving=erosion*erosionScale*interior*(1-ice)-(.012+(1-fibers)*.045+(1-n1)*.07+(1-n2)*.025)*ice;
      density[idx]=clamp((field[idx]+carving-(.025-.017*ice))*(10+ice*4)) * (.65+.35*n2) * (1-ice*(1-fibers)*.5) * baseFade;
    }
    if(z%8===0) progress?.(.1+.45*z/size);
  }
  const data = new Uint8Array(n*4);
  for(let i=0;i<n;i++) data[i*4]=Math.round(density[i]*255);
  const detailSize=Math.min(DETAIL_RESOLUTION,2**Math.ceil(Math.log2(size)));
  const detail=generateDetail(detailSize,seed);
  const envelope={size,data};
  // Bake visibility from the same fine erosion the shader applies to the macro envelope.
  // Reuse the density buffer; there is no extra full-sized light-density allocation.
  // Ellipsoid fields and their smooth union are 1-Lipschitz. Include the maximum
  // displacement (0.128 world units) plus a full voxel diagonal for interpolation.
  const supportMargin=.13+Math.hypot(...BOUNDS_SIZE)/size;
  for(let z=1;z<size-1;z++) for(let y=1;y<size-1;y++) for(let x=1;x<size-1;x++) {
    const i=(z*size+y)*size+x;
    if(field[i]<-supportMargin) {density[i]=0;continue;}
    const px=voxelCenter(x,0,size),py=voxelCenter(y,1,size),pz=voxelCenter(z,2,size);
    const ice=smoothstep(iceStart,iceEnd,py);
    density[i]=sampleCloudDensity(envelope,detail,px,py,pz,ice)*materialExtinction(ice)/EXTINCTION;
  }
  // Parallel light-space rays preserve fine shadows without repeated diffusion.
  for (let channel=1;channel<=3;channel++) {
    const dir=channel===1?SUN_LEFT:channel===2?SUN_RIGHT:[0,1,0];
    const tau=bakeOpticalDepth(density,size,BOUNDS_SIZE,dir,EXTINCTION);
    for(let i=0;i<n;i++) data[i*4+channel]=Math.round(clamp(tau[i]/16)*255);
    progress?.(.55+.09*channel);
  }
  // Two RG8 low-sun caches keep all 256³ shadow detail without a nested light march.
  const sunsetLight=new Uint8Array(n*2);
  for(let side=0;side<2;side++){
    const tau=bakeOpticalDepth(density,size,BOUNDS_SIZE,solarDirection(side,true),EXTINCTION);
    for(let i=0;i<n;i++)sunsetLight[i*2+side]=Math.round(clamp(tau[i]/16)*255);
    progress?.(.82+.09*(side+1));
  }
  bakeOccupancy(envelope,detail,THERMAL_DISPLACEMENT);
  return {size, data, sunsetLight, detail, supportBounds:densitySupportBounds(envelope),...(continuousOutflow?{continuousOutflow}:{})};
}
