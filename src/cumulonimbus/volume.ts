import { bakeOpticalDepth } from './light';
import { THERMAL_DISPLACEMENT } from './motion';
/** World bounds and extinction are shared by the bake and ray integrator. */
export const BOUNDS_MIN = [-5, -0.5, -3.5] as const;
export const BOUNDS_SIZE = [10, 8.5, 7] as const;
export const EXTINCTION = 18;
export const ICE_EXTINCTION = 6.5;
export const materialExtinction=(ice:number)=>EXTINCTION+(ICE_EXTINCTION-EXTINCTION)*ice;
export const VOLUME_RESOLUTION = 256;
export const DETAIL_RESOLUTION = 128;
// The 256/128 mask leaves at least 0.043 world units beyond displaced density.
// This limit keeps multi-step empty advances inside that proven empty margin.
export const EMPTY_SKIP_LIMIT = .04;
export const voxelCenter=(index:number,axis:0|1|2,size:number)=>BOUNDS_MIN[axis]+(index+.5)/size*BOUNDS_SIZE[axis];
export const SUN_LEFT = [-0.75, 0.8, 0.24] as const;
export const SUN_RIGHT = [0.75, 0.8, 0.24] as const;
export const heightErosionScale = (worldY: number) => (.48+.52*smoothstep(1.6,2.5,worldY))*(1-.55*smoothstep(5.1,6.2,worldY));
export interface DetailVolume { size: number; data: Uint8Array }
export interface CloudVolume { size: number; data: Uint8Array; detail: DetailVolume; supportBounds:{min:number[];max:number[]} }
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
export interface CloudParameters { towerHeight: number; towerWidth: number; anvilSpread: number; windLean: number }
type Lobe = [number, number, number, number, number, number, number?];
const clamp = (v: number) => Math.max(0, Math.min(1, v));
const smoothstep = (a: number,b: number,x: number) => { const t=clamp((x-a)/(b-a)); return t*t*(3-2*t); };
function random(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6d2b79f5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t ^= t + Math.imul(t ^ t >>> 7, 61 | t); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
/** Bounded morphology keeps the convective tower, rain base and ice anvil recognizable. */
export function cloudParameters(seed: number): CloudParameters {
  const rng=random(seed^0x41c6ce57);
  return {towerHeight:.87+rng()*.23,towerWidth:.85+rng()*.19,anvilSpread:.78+rng()*.26,windLean:(rng()-.5)*.055};
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
export function sampleCloudDensity(envelope:DetailVolume,detail:DetailVolume,x:number,y:number,z:number,ice:number): number {
  const r=sampleDetail(detail,x*.3,y*.3,z*.3,0),g=sampleDetail(detail,x*.3,y*.3,z*.3,1),b=sampleDetail(detail,x*.3,y*.3,z*.3,2);
  const wx=(g-.5)*(.16-.08*ice),wy=(b-.5)*(.12-.1*ice),wz=(r-.5)*(.16-.06*ice);
  const warped=sampleDetail(envelope,(x+wx-BOUNDS_MIN[0])/10,(y+wy-BOUNDS_MIN[1])/8.5,(z+wz-BOUNDS_MIN[2])/7,0,false);
  let erosion=(1-r)*.38+(1-b)*.08;
  let material=1;
  if(ice>0) {
    // Larger ice eddies bend the fine filaments. Lower vertical frequency limits
    // undersampling by the 256-volume light bake.
    const bend=sampleDetail(detail,x*.12,y*.10,z*.06,1);
    const wisps=sampleDetail(detail,x*.05+bend*.06,y*.42+x*.026+(bend-.5)*.035,z*.022,0);
    erosion=erosion*(1-ice)+(.11+(1-wisps)*.78)*ice;
    const strand=smoothstep(.3,.7,wisps);
    material=1-ice+(.008+.22*strand**1.7)*(1-.7*smoothstep(.4,3.8,x))*ice;
  }
  return erodeDensity(warped,erosion)*material;
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
  const rng = random(seed);
  const cellular=cellularNoise(seed+137);
  // Wide rain base, rising convective turrets and wind-stretched ice anvil.
  const cores: Lobe[] = [
    [-.25,1.45,0, 2.85,.88,1.75], [-.4,2.5,-.1, 2.1,1.45,1.6],
    [-.35,3.85,0, 2.1,1.6,1.65], [-.7,5.1,-.1, 1.7,1.25,1.5],
    [.3,6.0,-.3, 2.8,.30,1.65,.045], [1.7,6.12,-.35, 2.55,.19,1.4,.035]
  ];
  const shape=cloudParameters(seed);
  for(let i=0;i<cores.length;i++) {
    const c=cores[i], width=i>3?shape.anvilSpread:shape.towerWidth;
    c[0]=c[0]*width+c[1]*shape.windLean; c[2]*=shape.towerWidth;
    c[1]=.72+(c[1]-.72)*shape.towerHeight;
    c[3]*=width; c[4]*=shape.towerHeight; c[5]*=shape.towerWidth;
  }
  const lobes: Lobe[] = [...cores];
  cores.forEach((c,i) => {
    const count = i > 3 ? 12 : 24;
    for (let j=0; j<count; j++) {
      const theta=rng()*Math.PI*2, elevation=(rng()-.5)*1.8;
      const s=.34+rng()*.3, radius=i>3?.62:.72;
      lobes.push([c[0]+Math.cos(theta)*c[3]*radius*Math.cos(elevation), c[1]+Math.sin(elevation)*c[4]*radius,
        c[2]+Math.sin(theta)*c[5]*radius*Math.cos(elevation), s*(i>3?1.7:1), s*(i>3?.16:1), s*.85, i>3?.045:.2]);
      if(i<4) {
        const l=lobes.at(-1)!;
        for(let k=0;k<4;k++) {
          const a=rng()*Math.PI*2,e=(rng()-.5)*2,r=s*(.24+rng()*.22);
          lobes.push([l[0]+Math.cos(a)*s*.76*Math.cos(e),l[1]+Math.sin(e)*s*.76,l[2]+Math.sin(a)*s*.76*Math.cos(e),r,r*.9,r]);
        }
      }
    }
  });
  // Sparse, thin ice streaks connect to the outflow and taper at varying heights.
  // A separate RNG preserves the convective tower layout for seed comparisons.
  const iceRng=random(seed^0x73d61a29);
  for(let j=0;j<48;j++) {
    const reach=iceRng(),rx=(.55+iceRng()*.75)*shape.anvilSpread;
    const cx=(.3+reach*2.8)*shape.anvilSpread+6*shape.windLean;
    lobes.push([Math.min(cx,4.7-rx),.72+(6.08+(iceRng()-.5)*.8-.72)*shape.towerHeight,
      -.35+(iceRng()-.5)*2.3*shape.towerWidth,rx,.055+iceRng()*.055,.17+iceRng()*.27,.045]);
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
      const carving=erosion*erosionScale*(1-ice)-(.008+(1-fibers)*.035)*ice;
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
    progress?.(.55+.15*channel);
  }
  bakeOccupancy(envelope,detail,THERMAL_DISPLACEMENT);
  return {size, data, detail, supportBounds:densitySupportBounds(envelope)};
}
