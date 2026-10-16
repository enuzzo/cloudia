import { bakeOpticalDepth } from './light';
import {SUN_LEFT,SUN_RIGHT,solarDirection} from './sun';
export {SUN_LEFT,SUN_RIGHT} from './sun';
import { THERMAL_DISPLACEMENT } from './motion';
import { createPlumeSweep, preparePlumeSweep, type PlumeSweep, type Point3 } from './morphology';
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
export interface CloudVolume { size: number; data: Uint8Array; sunsetLight: Uint8Array; detail: DetailVolume; supportBounds:{min:number[];max:number[]} }
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
export function generateVolume(size = VOLUME_RESOLUTION, seed = 71, progress?: (fraction: number) => void): CloudVolume {
  const n = size ** 3, field = new Float32Array(n), density = new Float32Array(n);
  field.fill(-10);
  const cellular=cellularNoise(seed+137);
  const shape=cloudParameters(seed);
  // Separate updraft sites share a broad low condensation base. Their unequal
  // summits and outflow geometry change topology, rather than scaling one stack.
  const liquid:Lobe[]=[],iceCores:Lobe[]=[],summits:Lobe[]=[],foundations:Lobe[]=[];
  const columnProfiles:{level:number;expansion:number}[]=[];
  const capParents=new Map<Lobe,Lobe>();
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
    // Preserve the site's independent expansion rate while the rising trunk
    // below is authored as a continuous sweep, rather than stacked ellipsoids.
    columnProfiles.push({level:(shoulder-lower)/(crest-lower),expansion:.87+anatomy()*.12});
    liquid.push(top);
    summits.push(top);
    // Irregular lateral shoulders belong to this updraft, rather than a global
    // height layer. They are broad enough to read before any fine erosion.
    const shoulders=2+Math.floor(anatomy()*2),phase=anatomy()*Math.PI*2;
    for(let j=0;j<shoulders;j++) {
      const angle=phase+j*(2.05+anatomy()*.65),level=.3+anatomy()*.38;
      const radius=girth*(.62+anatomy()*.24),bulge=girth*(.45+anatomy()*.2);
      liquid.push([siteX+lean*level+Math.cos(angle)*radius,lower+(crest-lower)*level,
        siteZ+depth*level+Math.sin(angle)*radius,bulge,bulge*(.88+anatomy()*.4),bulge*(.82+anatomy()*.3),.16]);
    }
  };
  if(shape.family==='congestus') {
    liquid.push([-.25,1.52,.1,2.55,.76,1.58],[-1.5,2.1,-.25,1.38,.88,1.2],[1.35,1.97,.25,1.34,.78,1.1]);
    turret(-1.55,-.35,4.95,1.04,-.15);
    turret(.15,.4,5.35,.99,.1);
    turret(1.55,-.25,4.55,.88,.17);
    // Congestus retains growing, rounded summits. Visible glaciation can arise
    // through the common height/material field; it has no authored roof cap.
  } else if(shape.family==='multicell') {
    liquid.push([-1.5,1.48,-.25,1.86,.78,1.36],[1.25,1.5,.25,1.78,.82,1.39]);
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
    for(const [i,top] of summits.entries()) {
      const cap:Lobe=[top[0]+top[3]*(i===0?.4:.22),top[1]+top[4]*.4,top[2],
        top[3]*(i===0?1.7:1.22),top[4]*(i===0?.78:.82),top[5]*(i===0?1.24:1.05),.055];
      iceCores.push(cap);capParents.set(top,cap);
    }
  } else {
    liquid.push([-1.2,1.5,0,2.18,.78,1.51]);
    turret(-1.45,-.3,5.3,1.05,.5);
    turret(.75,.5,4.35,.82,.24);
    liquid.push([-2.45,2.7,.15,.82,1.0,.83],[-2.15,3.75,.1,.64,.72,.68]);
    // A shared replenished body occupies the lower/middle space between the
    // actual updraft sites. The younger summit remains separate above it.
    const [a,b]=summits,rise=Math.min(a[1],b[1])-.72;
    liquid.push([(a[0]+b[0])*.5,.72+rise*.5,(a[2]+b[2])*.5,
      Math.abs(a[0]-b[0])*.5+Math.min(a[3],b[3])*.68,rise*.29+.16,
      Math.max(a[5],b[5])*.95+Math.abs(a[2]-b[2])*.35,.18]);
    // A deep source overlaps the mature summit before broadening downwind.
    // The ice outflow starts in this fed shoulder rather than across a gap
    // above a bent narrow stalk, and rises modestly along its length.
    const mature=summits.reduce((a,b)=>a[1]>b[1]?a:b);
    const source:Lobe=[mature[0]+mature[3]*.4,mature[1]+mature[4]*.42,mature[2],
      mature[3]*1.7,mature[4]*.86,mature[5]*1.32,.07];
    iceCores.push(source,[source[0]+1.65,source[1]+.18,source[2]-.12,2.12,.42,1.16,.045]);
    capParents.set(mature,source);
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
      liquid.push([top[0]+(cap[0]-top[0])*t,top[1]+(cap[1]-top[1])*t,top[2]+(cap[2]-top[2])*t,
        rx,.3+(cap[1]-top[1])*.48,rz,.14]);
    }
  }
  const lobes:Lobe[]=[...liquid,...iceCores],sweeps:PlumeSweep[]=[];
  const sweep=(start:Point3,end:Point3,r0:number,r1:number,stretch:Point3=[1,1,.88],blend=.075)=>
    sweeps.push(createPlumeSweep({start,end,startRadius:r0,endRadius:r1,stretch,blend}));
  for(let i=0;i<summits.length;i++) {
    const top=summits[i],foot=foundations[i],profile=columnProfiles[i];
    const lower:Point3=[foot[0],foot[1]-foot[4]*.48,foot[2]];
    const shoulder:Point3=[foot[0]+(top[0]-foot[0])*.52,
      foot[1]+(top[1]-foot[1])*profile.level,foot[2]+(top[2]-foot[2])*.46];
    const head:Point3=[top[0],top[1]-top[4]*.12,top[2]];
    const depth=(foot[5]/foot[3]+top[5]/top[3])*.5;
    // The broad, slightly bent column replenishes its own upper shoulder.
    // Unequal section radii keep a continuous body without horizontal ledges.
    sweep(lower,shoulder,foot[3]*.8,foot[3]*profile.expansion,[1,.94,depth],.14);
    sweep(shoulder,head,foot[3]*profile.expansion,top[3]*.94,[1,.94,depth],.14);
  }
  const crownRng=random(seed^0x39fc01b7);
  for(let i=0;i<summits.length;i++) {
    const top=summits[i],foot=foundations[i];
    const rise=top[1]-foot[1],girth=top[3],phase=crownRng()*Math.PI*2;
    // Relief follows each rising column across several heights. A few unequal
    // outer branches turn over into its shoulders; they are not horizontal
    // rings or an equal-size population wrapped around every buried nucleus.
    const count=i===0?4:3;
    for(let j=0;j<count;j++) {
      const angle=phase+j*2.399963229728653+(crownRng()-.5)*.45;
      const dx=Math.cos(angle),dz=Math.sin(angle),age=.55+crownRng()*.45;
      const level=.4+crownRng()*.43,crest=top[1]+top[4]*(.08+crownRng()*.68);
      const r=girth*(.32+crownRng()*.34),outer=.66+crownRng()*.34;
      const start:Point3=[foot[0]+(top[0]-foot[0])*level+dx*girth*.58,
        foot[1]+rise*level,foot[2]+(top[2]-foot[2])*level+dz*top[5]*.58];
      const shoulder:Point3=[top[0]+dx*girth*.72,crest-r*.3,top[2]+dz*top[5]*.72];
      const turn:Point3=[top[0]+dx*girth*outer,crest,top[2]+dz*top[5]*outer];
      const fall:Point3=[top[0]+dx*girth*(outer+.12),crest-r*(.8+age),
        top[2]+dz*top[5]*(outer+.12)];
      sweep(start,shoulder,r*.68,r,[1,1.05,.92],.1);
      sweep(shoulder,turn,r,r*(.8+age*.1),[1,1.05,.92],.1);
      if(j%2===0) sweep(turn,fall,r*(.8+age*.1),r*.48,[1,1.05,.92],.085);
    }
  }
  // Broad ice outflow is stretched away from a local source, with unequal
  // depth and height. It inherits the column's shoulder instead of acquiring
  // a second skin of rounded liquid-style billows.
  const capRng=random(seed^0x291fab);
  for(const core of iceCores) for(let j=0;j<5;j++) {
    const side=capRng()*2-1,reach=.5+capRng()*.65;
    const start:Point3=[core[0]-core[3]*.25,core[1]+(capRng()-.5)*core[4]*.9,
      core[2]+side*core[5]*.48];
    const end:Point3=[core[0]+core[3]*reach,start[1]+(capRng()-.5)*core[4]*.8,
      core[2]+side*core[5]*(.8+capRng()*.3)];
    const r=Math.min(core[4]*1.45,core[5]*.5);
    sweep(start,end,r,r*(.35+capRng()*.25),[1,.66,.82],.035);
  }
  // Sparse, thin ice streaks connect to the outflow and taper at varying heights.
  // A separate RNG preserves the convective tower layout for seed comparisons.
  const iceRng=random(seed^0x73d61a29);
  const streakCount=iceCores.length===0?0:shape.family==='multicell'?36:48;
  for(let j=0;j<streakCount;j++) {
    const core=iceCores[j%iceCores.length],reach=.45+iceRng()*.72;
    // Strands leave actual local outflow edges, including the sloping sheared
    // source; a fixed horizontal streak band would recreate the detached roof.
    lobes.push([core[0]+core[3]*reach,core[1]+(iceRng()-.5)*core[4]*1.5+reach*core[4]*.28,
      core[2]+(iceRng()-.5)*core[5]*1.4,core[3]*(.24+iceRng()*.36),.035+iceRng()*.05,.07+iceRng()*.14,.035]);
  }
  // Contract whole horizontal axes if a seeded puff/outflow would approach the
  // texture wall. This preserves curved lobe endings, without clipping any lobe
  // or piling centres against a plane. Reserve a halo for smooth union and warp.
  for(const [axis,radius,limit] of [[0,3,4.35],[2,5,2.8]] as const) {
    const extent=Math.max(...lobes.map(c=>Math.abs(c[axis])+c[radius]),
      ...sweeps.map(s=>Math.max(Math.abs(s.start[axis]),Math.abs(s.end[axis]))+
        Math.max(s.startRadius,s.endRadius)*s.stretch[axis]));
    const scale=Math.min(1,limit/extent);
    for(const c of lobes) {c[axis]*=scale;c[radius]*=scale;}
    for(const s of sweeps) {s.start[axis]*=scale;s.end[axis]*=scale;s.stretch[axis]*=scale;}
  }
  // Rasterize lobes into their local bounds instead of testing every lobe at every voxel.
  for (const [cx,cy,cz,rx,ry,rz,blend=.2] of lobes) {
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
  for(const sweep of sweeps) {
    const plume=preparePlumeSweep(sweep),{blend}=sweep;
    const start=plume.min.map((v,i)=>Math.max(1,Math.floor((v-.35-BOUNDS_MIN[i])/BOUNDS_SIZE[i]*size-.5)));
    const end=plume.max.map((v,i)=>Math.min(size-2,Math.ceil((v+.35-BOUNDS_MIN[i])/BOUNDS_SIZE[i]*size-.5)));
    for(let z=start[2];z<=end[2];z++) for(let y=start[1];y<=end[1];y++) for(let x=start[0];x<=end[0];x++) {
      const sd=plume.sample(voxelCenter(x,0,size),voxelCenter(y,1,size),voxelCenter(z,2,size));
      const idx=(z*size+y)*size+x,old=field[idx],h=clamp(.5+.5*(old-sd)/blend);
      field[idx]=sd+(old-sd)*h+blend*h*(1-h);
    }
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
  // Ellipsoid and slope-bounded plume fields and their smooth union are
  // 1-Lipschitz. Include the maximum
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
  return {size, data, sunsetLight, detail, supportBounds:densitySupportBounds(envelope)};
}
