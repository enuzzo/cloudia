import { describe, expect, it } from 'vitest';
import { generateVolume, heightErosionScale, cloudParameters } from './volume';

describe('authored density volume', () => {
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
