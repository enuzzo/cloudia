/** World bounds and extinction are shared by the bake and ray integrator. */
export const BOUNDS_MIN = [-5, -0.5, -3.5] as const;
export const BOUNDS_SIZE = [10, 8.5, 7] as const;
export const EXTINCTION = 6.5;
export const SUN_LEFT = [-0.75, 0.8, 0.24] as const;
export const SUN_RIGHT = [0.75, 0.8, 0.24] as const;
export const heightErosionScale = (worldY: number) => (.48+.52*smoothstep(1.6,2.5,worldY))*(1-.55*smoothstep(5.1,6.2,worldY));
export interface CloudVolume { size: number; data: Uint8Array }
export interface CloudParameters { towerHeight: number; towerWidth: number; anvilSpread: number; windLean: number }
type Lobe = [number, number, number, number, number, number];
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
function noise(x: number, y: number, z: number, seed: number): number {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
  let fx=x-ix, fy=y-iy, fz=z-iz;
  fx=fx*fx*(3-2*fx); fy=fy*fy*(3-2*fy); fz=fz*fz*(3-2*fz);
  const h = (a: number,b: number,c: number) => {
    let n = Math.imul(a, 73856093) ^ Math.imul(b, 19349663) ^ Math.imul(c, 83492791) ^ seed;
    n = Math.imul(n ^ n >>> 13, 1274126177); return (n >>> 0)/4294967295;
  };
  const lerp = (a: number,b: number,t: number) => a+(b-a)*t;
  return lerp(lerp(lerp(h(ix,iy,iz),h(ix+1,iy,iz),fx),lerp(h(ix,iy+1,iz),h(ix+1,iy+1,iz),fx),fy),
    lerp(lerp(h(ix,iy,iz+1),h(ix+1,iy,iz+1),fx),lerp(h(ix,iy+1,iz+1),h(ix+1,iy+1,iz+1),fx),fy),fz);
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
export function generateVolume(size = 224, seed = 71, progress?: (fraction: number) => void): CloudVolume {
  const n = size ** 3, field = new Float32Array(n), density = new Float32Array(n);
  field.fill(-10);
  const rng = random(seed);
  const cellular=cellularNoise(seed+137);
  // Wide rain base, rising convective turrets and wind-stretched ice anvil.
  const cores: Lobe[] = [
    [-.25,1.45,0, 2.85,.88,1.75], [-.4,2.5,-.1, 2.1,1.45,1.6],
    [-.35,3.85,0, 2.1,1.6,1.65], [-.7,5.1,-.1, 1.7,1.25,1.5],
    [.45,6.05,-.3, 2.35,.85,1.55], [1.75,6.2,-.4, 2.05,.55,1.3]
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
    const count = i > 3 ? 22 : 19;
    for (let j=0; j<count; j++) {
      const theta=rng()*Math.PI*2, elevation=(rng()-.5)*1.8;
      const s=.4+rng()*.3, radius=i>3?.62:.72;
      lobes.push([c[0]+Math.cos(theta)*c[3]*radius*Math.cos(elevation), c[1]+Math.sin(elevation)*c[4]*radius,
        c[2]+Math.sin(theta)*c[5]*radius*Math.cos(elevation), s*(i>3?1.25:1), s*(i>3?.48:1), s*.85]);
    }
  });
  // Rasterize lobes into their local bounds instead of testing every lobe at every voxel.
  for (const [cx,cy,cz,rx,ry,rz] of lobes) {
    const lo = [cx-rx-.35,cy-ry-.35,cz-rz-.35], hi=[cx+rx+.35,cy+ry+.35,cz+rz+.35];
    const start=lo.map((v,i)=>Math.max(1,Math.floor((v-BOUNDS_MIN[i])/BOUNDS_SIZE[i]*(size-1))));
    const end=hi.map((v,i)=>Math.min(size-2,Math.ceil((v-BOUNDS_MIN[i])/BOUNDS_SIZE[i]*(size-1))));
    for(let z=start[2];z<=end[2];z++) for(let y=start[1];y<=end[1];y++) for(let x=start[0];x<=end[0];x++) {
      const px=BOUNDS_MIN[0]+x/(size-1)*BOUNDS_SIZE[0], py=BOUNDS_MIN[1]+y/(size-1)*BOUNDS_SIZE[1], pz=BOUNDS_MIN[2]+z/(size-1)*BOUNDS_SIZE[2];
      const sd=(1-Math.sqrt(((px-cx)/rx)**2+((py-cy)/ry)**2+((pz-cz)/rz)**2))*Math.min(rx,ry,rz);
      const idx=(z*size+y)*size+x; const old=field[idx], h=clamp(.5+.5*(old-sd)/.2);
      field[idx]=sd+(old-sd)*h+.2*h*(1-h);
    }
  }
  for(let z=1;z<size-1;z++) {
    for(let y=1;y<size-1;y++) for(let x=1;x<size-1;x++) {
      const idx=(z*size+y)*size+x; if(field[idx]<-.3) continue;
      const px=x/(size-1)*10, py=y/(size-1)*8.5, pz=z/(size-1)*7;
      const n1=noise(px*1.25,py*1.25,pz*1.25,seed), n2=noise(px*3.6,py*3.6,pz*3.6,seed+12), n3=noise(px*9,py*9,pz*9,seed+42);
      const c1=cellular(px*1.8,py*1.8,pz*1.8), c2=cellular(px*4.5,py*4.5,pz*4.5);
      const erosion=Math.min(0,(n1-.5)*.2-(1-c1)*.52-(1-c2)*.2+(n3-.5)*.1);
      const baseFade=clamp((py+BOUNDS_MIN[1]-.72)/.24);
      const worldY=py+BOUNDS_MIN[1];
      const erosionScale=heightErosionScale(worldY);
      density[idx]=clamp((field[idx]+erosion*erosionScale-.025)*10) * (.65+.35*n2) * baseFade;
    }
    if(z%8===0) progress?.(.1+.45*z/size);
  }
  const data = new Uint8Array(n*4);
  for(let i=0;i<n;i++) data[i*4]=Math.round(density[i]*255);
  // Upwind transport: each row integrates extinction through the preceding sunward row.
  // Two independently baked directions. Intermediate directions are never shown using stale lighting.
  for (let channel=1;channel<=3;channel++) {
    const dir=channel===1?SUN_LEFT:channel===2?SUN_RIGHT:[0,1,0];
    const dy=BOUNDS_SIZE[1]/(size-1), length=Math.hypot(...dir);
    const dx=dir[0]/dir[1]*dy/BOUNDS_SIZE[0]*(size-1), dz=dir[2]/dir[1]*dy/BOUNDS_SIZE[2]*(size-1);
    const ds=dy*length/dir[1], tau=new Float32Array(n);
    for(let y=size-1;y>=0;y--) {
      for(let z=0;z<size;z++) for(let x=0;x<size;x++) {
        const idx=(z*size+y)*size+x;
        let upstream=0;
        if(y<size-1) {
          const xx=x+dx, zz=z+dz, ix=Math.floor(xx), iz=Math.floor(zz), fx=xx-ix, fz=zz-iz;
          const at=(a:number,b:number) => a<0||a>=size||b<0||b>=size?0:tau[(b*size+y+1)*size+a];
          upstream=at(ix,iz)*(1-fx)*(1-fz)+at(ix+1,iz)*fx*(1-fz)+at(ix,iz+1)*(1-fx)*fz+at(ix+1,iz+1)*fx*fz;
        }
        data[idx*4+channel]=Math.round(clamp((upstream+density[idx]*ds*EXTINCTION*.5)/16)*255);
        tau[idx]=upstream+density[idx]*ds*EXTINCTION;
      }
    }
    progress?.(.55+.15*channel);
  }
  return {size, data};
}
