import { describe, expect, it } from 'vitest';
import { generateVolume, heightErosionScale, cloudParameters, generateDetail, sampleDetail, erodeDensity, sampleCloudDensity, bakeOccupancy, voxelCenter, BOUNDS_MIN, BOUNDS_SIZE } from './volume';

describe('authored density volume', () => {
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
    expect(first.towerHeight).toBeGreaterThanOrEqual(.87);
    expect(first.towerHeight).toBeLessThanOrEqual(1.1);
    expect(generateVolume(24,71).data).not.toEqual(generateVolume(24,912).data);
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
