import { describe, expect, it } from 'vitest';
import { prepareInclinedShoulder } from './inclinedShoulder';
import { generateVolume, sampleCloudDensity, iceHeights, BOUNDS_MIN, BOUNDS_SIZE } from './volume';

describe('inclined fed shoulder', () => {
  it('feeds the previously empty upper-body section after fine erosion', () => {
    const seed = 74, volume = generateVolume(64, seed);
    // This section was entirely empty after fine erosion in baseline08c33cb.
    // It is below the cap and inside the missing inclined upper-body shoulder.
    const x = .5609226029381325, y = 4.0458440042043025;
    const [start, end] = iceHeights(seed), t = Math.max(0, Math.min(1, (y - start) / (end - start)));
    const ice = t * t * (3 - 2 * t);
    let occupied = false;
    for (let i = 0; i < 96; i++) {
      const z = BOUNDS_MIN[2] + (i + .5) / 96 * BOUNDS_SIZE[2];
      if (sampleCloudDensity(volume, volume.detail, x, y, z, ice) > 0) occupied = true;
    }
    expect(occupied).toBe(true);
  });

  it('encloses its anchors and has the prescribed transverse sections', () => {
    const shape = prepareInclinedShoulder([0, 1, 0], [2, 3, 0], .7, 1.1);
    expect(shape.sample(0, 1, 0)).toBeGreaterThan(0);
    expect(shape.sample(2, 3, 0)).toBeGreaterThan(0);
    expect(shape.sample(1, 2, 0)).toBeCloseTo(.7, 12);
    expect(shape.sample(1 + .7 / Math.SQRT2, 2 - .7 / Math.SQRT2, 0)).toBeCloseTo(0, 12);
    expect(shape.sample(1, 2, 1.1)).toBeCloseTo(0, 12);
    expect(shape.sample(1, 2, 1.101)).toBeLessThan(0);
  });

  it('bounds world-space slope after a full 3D rotation and anisotropic scaling', () => {
    const shapes = [
      prepareInclinedShoulder([-.3, 2.8, -.4], [1.2, 4.7, .3], .7, 1.1),
      prepareInclinedShoulder([0, 0, 0], [0, 0, 2], .15, .9),
      prepareInclinedShoulder([0, 0, 0], [.001, .001, .001], .7, .3),
    ];
    let seed = 73, maxRatio = 0;
    const random = () => { seed = Math.imul(seed ^ seed >>> 15, 2246822519) | 0; return (seed >>> 0) / 4294967296; };
    for (const shape of shapes) for (let i = 0; i < 4000; i++) {
      const a = [random() * 8 - 3, random() * 7 - 1, random() * 8 - 3] as const;
      const step = 10 ** (-5 + random() * 5);
      const b = a.map(value => value + (random() - .5) * step) as [number, number, number];
      const distance = Math.hypot(...b.map((value, axis) => value - a[axis]));
      const difference = Math.abs(shape.sample(...a) - shape.sample(...b));
      expect(difference).toBeLessThanOrEqual(distance + 1e-12);
      maxRatio = Math.max(maxRatio, difference / distance);
    }
    expect(maxRatio).toBeGreaterThan(.8);
  });

  it('keeps positive support in the analytic rotated bounds', () => {
    const shape = prepareInclinedShoulder([-.3, 2.8, -.4], [1.2, 4.7, .3], .7, 1.1);
    let occupied = 0;
    for (let z = -20; z <= 20; z++) for (let y = 10; y <= 60; y++) for (let x = -20; x <= 30; x++) {
      const p = [x / 10, y / 10, z / 10] as const;
      if (shape.sample(...p) <= 0) continue;
      occupied++;
      p.forEach((value, axis) => {
        expect(value).toBeGreaterThanOrEqual(shape.min[axis]);
        expect(value).toBeLessThanOrEqual(shape.max[axis]);
      });
    }
    expect(occupied).toBeGreaterThan(500);
  });

  it('owns its prepared coordinates and rejects invalid geometry', () => {
    const start: [number, number, number] = [0, 1, 0], end: [number, number, number] = [2, 3, .2];
    const shape = prepareInclinedShoulder(start, end, .7, 1.1), before = shape.sample(.2, 1.3, .1);
    start[0] = -30; end[1] = 70;
    expect(shape.sample(.2, 1.3, .1)).toBe(before);
    expect(() => prepareInclinedShoulder([0, 0, 0], [0, 0, 0], 1, 1)).toThrow(RangeError);
    expect(() => prepareInclinedShoulder([0, 0, 0], [1, 1, 0], 0, 1)).toThrow(RangeError);
    expect(() => prepareInclinedShoulder([0, 0, 0], [1, Infinity, 0], 1, 1)).toThrow(RangeError);
  });
});
