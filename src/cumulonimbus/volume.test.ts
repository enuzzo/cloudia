import { describe, expect, it } from 'vitest';
import { generateVolume, heightErosionScale, cloudParameters, morphologyFamily, iceHeights, generateDetail, sampleDetail, erodeDensity, sampleCloudDensity, bakeOccupancy, voxelCenter, BOUNDS_MIN, BOUNDS_SIZE, materialExtinction, EMPTY_SKIP_LIMIT, VOLUME_RESOLUTION, DETAIL_RESOLUTION } from './volume';
import { THERMAL_DISPLACEMENT } from './motion';
import { densitySupportBounds } from './volume';

/** Mass moments of the actual density channel, independent of the authored lobes. */
function massMoments(volume: ReturnType<typeof generateVolume>, minY=-Infinity,maxY=Infinity) {
  let mass=0; const first=[0,0,0],second=[0,0,0];
  for(let z=0;z<volume.size;z++) for(let y=0;y<volume.size;y++) for(let x=0;x<volume.size;x++) {
    const p=[voxelCenter(x,0,volume.size),voxelCenter(y,1,volume.size),voxelCenter(z,2,volume.size)];
    if(p[1]<minY||p[1]>maxY) continue;
    const d=volume.data[((z*volume.size+y)*volume.size+x)*4]/255;
    mass+=d;
    for(let a=0;a<3;a++) {first[a]+=d*p[a];second[a]+=d*p[a]*p[a];}
  }
  const centroid=first.map(v=>v/mass);
  return {mass,centroid,spread:second.map((v,a)=>Math.sqrt(Math.max(0,v/mass-centroid[a]**2)))};
}

describe('authored density volume', () => {
  it('keeps intermediate ice wisps optically separated from bright fibres',()=>{
    const envelope={size:1,data:new Uint8Array([255,0,0,0])};
    const medium={size:1,data:new Uint8Array([128,128,128,255])};
    const bright={size:1,data:new Uint8Array([255,128,128,255])};
    expect(sampleCloudDensity(envelope,medium,0,6,0,1)).toBeLessThan(sampleCloudDensity(envelope,bright,0,6,0,1)*.35);
  });
  it('bounds interpolated raw support, fine warp and flow including contraction toward the anchors',()=>{
    const envelope={size:4,data:new Uint8Array(4**3*4)};
    envelope.data[((1*4+2)*4+1)*4]=255;
    const bounds=densitySupportBounds(envelope);
    expect(bounds.min[0]).toBeCloseTo(-4.25);
    expect(bounds.min[1]).toBeCloseTo(.72);
    expect(bounds.min[2]).toBeCloseTo(-3.045);
    expect(bounds.max[0]).toBeCloseTo(1.75);
    expect(bounds.max[1]).toBeCloseTo(7.8175);
    expect(bounds.max[2]).toBeCloseTo(1.295);
  });
  it('covers the thermal displacement before evaluating the expensive flow field',()=>{
    const size=64,envelope={size,data:new Uint8Array(size**3*4)},detail={size,data:new Uint8Array(size**3*4)};
    envelope.data[((32*size+32)*size+32)*4]=255;
    bakeOccupancy(envelope,detail,THERMAL_DISPLACEMENT);
    expect(sampleDetail(detail,.51+.2/10,.51+.535/8.5,.51,3,false)).toBeGreaterThan(0);
    expect(sampleDetail(detail,.05,.05,.05,3,false)).toBe(0);
  });
  it('unions overlapping occupancy boxes and clips them at texture boundaries',()=>{
    const envelope={size:16,data:new Uint8Array(16**3*4)},detail={size:8,data:new Uint8Array(8**3*4)};
    for(const [x,y,z] of [[0,1,2],[6,8,12],[8,9,13]]) envelope.data[((z*16+y)*16+x)*4]=255;
    bakeOccupancy(envelope,detail,THERMAL_DISPLACEMENT);
    // Hand-derived 8-grid centers and dilation radii [1,2,1].
    const centers=[[0,0,1],[3,4,6],[4,4,6]];
    for(let z=0;z<8;z++) for(let y=0;y<8;y++) for(let x=0;x<8;x++) {
      const covered=centers.some(c=>Math.abs(x-c[0])<=1&&Math.abs(y-c[1])<=2&&Math.abs(z-c[2])<=1);
      expect(detail.data[((z*8+y)*8+x)*4+3]).toBe(covered?255:0);
    }
  });
  it('bounds accelerated empty samples by the displacement and interpolation halo', () => {
    const warp=[.08,.06,.08];
    const margins=BOUNDS_SIZE.map((extent,axis)=>{
      const macro=extent/VOLUME_RESOLUTION,coarse=extent/DETAIL_RESOLUTION;
      const radius=Math.ceil((warp[axis]+macro)/coarse);
      return (radius+.5+.5*DETAIL_RESOLUTION/VOLUME_RESOLUTION)*coarse-warp[axis]-macro;
    });
    expect(EMPTY_SKIP_LIMIT).toBeLessThan(Math.min(...margins));
    expect(7/384*2).toBeLessThanOrEqual(EMPTY_SKIP_LIMIT);
  });
  it('gives liquid convection a shorter optical penetration length than ice', () => {
    expect(materialExtinction(0)).toBeGreaterThan(materialExtinction(1)*2);
    expect(materialExtinction(1)).toBeCloseTo(6.5);
    expect(Math.abs(materialExtinction(.5-.0001)-materialExtinction(.5+.0001))).toBeLessThan(.01);
  });
  it('separates sparse ice gaps from connected fibres inside a dense envelope', () => {
    const envelope={size:1,data:new Uint8Array([255,0,0,0])};
    const low={size:1,data:new Uint8Array([64,128,128,255])};
    const high={size:1,data:new Uint8Array([153,128,128,255])};
    expect(sampleCloudDensity(envelope,high,0,6,0,1)).toBeGreaterThan(sampleCloudDensity(envelope,low,0,6,0,1)*15);
  });
  it('thins the ice outflow toward the downwind edge without thinning the liquid tower', () => {
    const envelope={size:1,data:new Uint8Array([255,0,0,0])};
    const detail={size:1,data:new Uint8Array([255,255,255,255])};
    const attached=sampleCloudDensity(envelope,detail,0,6,0,1);
    const outflow=sampleCloudDensity(envelope,detail,4,6,0,1);
    expect(outflow).toBeGreaterThan(0);
    expect(outflow).toBeLessThan(attached*.5);
    expect(sampleCloudDensity(envelope,detail,4,3,0,0)).toBeCloseTo(1,6);
  });
  it('retains fibre contrast inside a fully occupied ice envelope', () => {
    const envelope={size:1,data:new Uint8Array([255,0,0,0])};
    const dense={size:1,data:new Uint8Array([255,255,255,255])};
    const sparse={size:1,data:new Uint8Array([0,0,0,255])};
    const bright=sampleCloudDensity(envelope,dense,0,6,0,1);
    const thin=sampleCloudDensity(envelope,sparse,0,6,0,1);
    expect(thin).toBeGreaterThan(0);
    expect(bright).toBeGreaterThan(thin*3);
    expect(sampleCloudDensity(envelope,sparse,0,3,0,0)).toBeCloseTo(1,6);
  });
  it('makes fully icy material transmissive while retaining dense liquid convection', () => {
    const envelope={size:1,data:new Uint8Array([255,0,0,0])};
    const detail={size:1,data:new Uint8Array([255,255,255,255])};
    expect(sampleCloudDensity(envelope,detail,0,3,0,0)).toBeCloseTo(1,6);
    expect(sampleCloudDensity(envelope,detail,0,6,0,1)).toBeGreaterThan(.2);
    expect(sampleCloudDensity(envelope,detail,0,6,0,1)).toBeLessThan(.6);
    const below=sampleCloudDensity(envelope,detail,0,5,0,.5-.0001);
    const above=sampleCloudDensity(envelope,detail,0,5,0,.5+.0001);
    expect(Math.abs(below-above)).toBeLessThan(.001);
  });
  it('keeps displaced and interpolated boundaries inside the conservative skip mask', () => {
    const size=32,data=new Uint8Array(size**3*4),detail={size:8,data:new Uint8Array(8**3*4)};
    data[((16*size+16)*size+16)*4]=255;
    bakeOccupancy({size,data},detail);
    const center=[16.5/32,16.5/32,16.5/32];
    for(const axis of [0,1,2]) for(const direction of [-1,1]) {
      const coord=[...center]; coord[axis]+=direction*(.08/BOUNDS_SIZE[axis]+1/32);
      expect(sampleDetail(detail,coord[0],coord[1],coord[2],3,false)).toBeGreaterThan(0);
    }
    expect(sampleDetail(detail,.1,.1,.1,3,false)).toBe(0);
  });
  it('allows a warp to extend density into an originally empty sample', () => {
    const size=8,data=new Uint8Array(size**3*4);
    for(let z=0;z<size;z++) for(let y=0;y<size;y++) for(let x=4;x<size;x++) data[((z*size+y)*size+x)*4]=255;
    const detail={size:1,data:new Uint8Array([255,255,255,255])};
    const x=-5+10*3.5/8;
    expect(sampleDetail({size,data},3.5/8,.5,.5,0,false)).toBe(0);
    expect(sampleCloudDensity({size,data},detail,x,3.75,0,0)).toBeCloseTo(.064,5);
  });
  it('registers world coordinates at the same centers as normalized GPU sampling', () => {
    const size=4,data=new Uint8Array(size**3*4);
    for(let i=0;i<size**3;i++) data[i*4]=(i%size)*70;
    for(let i=0;i<size;i++) {
      const coordinate=(voxelCenter(i,0,size)-BOUNDS_MIN[0])/BOUNDS_SIZE[0];
      expect(sampleDetail({size,data},coordinate,.5,.5,0,false)).toBeCloseTo(i*70/255,6);
    }
    expect(sampleDetail({size,data},-1,.5,.5,0,false)).toBe(0);
    expect(sampleDetail({size,data},2,.5,.5,0,false)).toBeCloseTo(210/255);
  });
  it('keeps tiled detail continuous at repeats and preserves fully dense interiors', () => {
    const detail=generateDetail(16,71);
    expect(sampleDetail(detail,0,.32,.46,0)).toBeCloseTo(sampleDetail(detail,1,.32,.46,0),6);
    expect(Math.abs(sampleDetail(detail,-.0001,.32,.46,0)-sampleDetail(detail,.0001,.32,.46,0))).toBeLessThan(.01);
    expect(erodeDensity(1,.4)).toBe(1);
    expect(erodeDensity(.2,.4)).toBe(0);
    expect(erodeDensity(.6,.4)).toBeCloseTo(1/3);
  });
  it('varies bounded morphology by seed and can reproduce a chosen shape', () => {
    const first=cloudParameters(71), second=cloudParameters(912);
    expect(first).toEqual(cloudParameters(71));
    expect(first).not.toEqual(second);
    expect(first.towerHeight).toBeGreaterThanOrEqual(.65);
    expect(first.towerHeight).toBeLessThanOrEqual(.9);
    expect(generateVolume(24,71).data).not.toEqual(generateVolume(24,912).data);
  });
  it('cycles reproducible topology families and derives the ice transition from their height',()=>{
    for(const [seed,family] of [[72,'congestus'],[73,'multicell'],[74,'sheared'],[-1,'sheared']] as const) {
      expect(morphologyFamily(seed)).toBe(family);
      expect(cloudParameters(seed).family).toBe(family);
      expect(cloudParameters(seed)).toEqual(cloudParameters(seed));
      const {towerHeight}=cloudParameters(seed),[start,end]=iceHeights(seed);
      expect(start).toBeCloseTo(.72+4.43*towerHeight);
      expect(end).toBeCloseTo(.72+5.23*towerHeight);
    }
    for(let seed=0;seed<300;seed++) {
      const shape=cloudParameters(seed);
      expect(Object.values(shape).filter(v=>typeof v==='number').every(Number.isFinite)).toBe(true);
      expect(shape.towerHeight).toBeGreaterThanOrEqual(.65);
      expect(shape.towerHeight).toBeLessThanOrEqual(.9);
    }
  });
  it('changes horizontal and vertical mass distribution instead of rescaling one cylindrical stack',()=>{
    const congestus=generateVolume(32,72),multicell=generateVolume(32,73),sheared=generateVolume(32,74);
    const a=massMoments(congestus),b=massMoments(multicell),c=massMoments(sheared);
    expect(a.spread[0]/a.spread[1]).toBeGreaterThan(1.1);
    expect(b.spread[0]/b.spread[1]).toBeGreaterThan(1.1);
    expect(Math.abs(a.centroid[1]-b.centroid[1])).toBeGreaterThan(.12);
    const low=massMoments(sheared,.9,2),high=massMoments(sheared,3.5);
    expect(high.centroid[0]-low.centroid[0]).toBeGreaterThan(.65);
    expect(Math.abs(c.centroid[0]-a.centroid[0])).toBeGreaterThan(.1);
  });
  it('retains separated elevated multicell towers above their connected rain base',()=>{
    const volume=generateVolume(40,73),rows=new Float64Array(40);
    for(let z=0;z<40;z++) for(let y=0;y<40;y++) for(let x=0;x<40;x++) {
      const h=voxelCenter(y,1,40);
      if(h>2.8&&h<3.65) rows[x]+=volume.data[((z*40+y)*40+x)*4];
    }
    const left=Math.max(...rows.slice(9,18)),right=Math.max(...rows.slice(22,30));
    const saddle=Math.min(...rows.slice(18,22));
    expect(left).toBeGreaterThan(saddle*1.3);
    expect(right).toBeGreaterThan(saddle*1.3);
  });
  it('keeps every morphology away from all texture faces without a forced box cutoff',()=>{
    for(const seed of [72,73,74,912,913,914]) {
      const volume=generateVolume(24,seed); let occupied=0;
      for(let z=0;z<24;z++) for(let y=0;y<24;y++) for(let x=0;x<24;x++) {
        const density=volume.data[((z*24+y)*24+x)*4];
        if(!density) continue;
        occupied++;
        const point=[voxelCenter(x,0,24),voxelCenter(y,1,24),voxelCenter(z,2,24)];
        for(let axis=0;axis<3;axis++) {
          expect(point[axis]).toBeGreaterThan(BOUNDS_MIN[axis]+.3);
          expect(point[axis]).toBeLessThan(BOUNDS_MIN[axis]+BOUNDS_SIZE[axis]-.3);
        }
      }
      expect(occupied).toBeGreaterThan(250);
      expect(occupied).toBeLessThan(24**3/2);
    }
  });
  it('does not introduce horizontal seams where base and anvil erosion change', () => {
    for(const height of [2,5.65]) expect(Math.abs(heightErosionScale(height+.001)-heightErosionScale(height-.001))).toBeLessThan(.02);
  });
  it('is deterministic and keeps all faces empty to avoid a clipped box silhouette', () => {
    const a = generateVolume(24, 71);
    const b = generateVolume(24, 71);
    expect(a.data).toEqual(b.data);
    let occupied = 0;
    for (let z = 0; z < 24; z++) for (let y = 0; y < 24; y++) for (let x = 0; x < 24; x++) {
      const d = a.data[((z * 24 + y) * 24 + x) * 4];
      if ([x,y,z].some(v => v === 0 || v === 23)) expect(d).toBe(0);
      if (d > 0) occupied++;
    }
    expect(occupied).toBeGreaterThan(300);
    expect(occupied).toBeLessThan(24 ** 3 / 2);
  });
  it('contains both deeply shadowed interior and transparent sunlit boundaries', () => {
    const { data } = generateVolume(32, 71);
    let minLight = 255, maxLight = 0;
    for (let i = 0; i < data.length; i += 4) if (data[i] > 20) {
      minLight = Math.min(minLight, Math.exp(-data[i+1]/255*16)*255); maxLight = Math.max(maxLight, Math.exp(-data[i+1]/255*16)*255);
    }
    expect(minLight).toBeLessThan(40);
    expect(maxLight).toBeGreaterThan(150);
  });
});
