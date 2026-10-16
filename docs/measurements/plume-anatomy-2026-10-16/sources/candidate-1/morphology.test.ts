import { describe, expect, it } from 'vitest';
import { preparePlumeSweep, type PlumeSweep, type Point3 } from './morphology';

const plume: PlumeSweep = {
  start: [0, 0, 0], end: [0, 4, 0], startRadius: .7, endRadius: .2,
  stretch: [2, .5, 1], blend: .075,
};

describe('continuous plume support', () => {
  it('tapers continuously between the authored sections and closes both ends', () => {
    const field = preparePlumeSweep(plume);
    for (const [height, radius] of [[0, .7], [1, .575], [2, .45], [4, .2]]) {
      expect(field.sample(radius * 2, height, 0)).toBeCloseTo(0, 12);
      expect(field.sample(radius * 1.9, height, 0)).toBeGreaterThan(0);
      expect(field.sample(radius * 2.1, height, 0)).toBeLessThan(0);
    }
    expect(field.sample(0, -.7 * .5, 0)).toBeCloseTo(0, 12);
    expect(field.sample(0, 4 + .2 * .5, 0)).toBeCloseTo(0, 12);
    expect(field.sample(0, -.36, 0)).toBeLessThan(0);
    expect(field.sample(0, 4.11, 0)).toBeLessThan(0);
  });

  it('keeps world-space changes below distance across taper, caps and anisotropy', () => {
    const sweeps: PlumeSweep[] = [
      plume,
      { ...plume, start: [-1, 2, -.5], end: [1, 3, .4], startRadius: .12, endRadius: 1.1, stretch: [.2, 1.6, .35] },
      { ...plume, start: [-.2, .7, 1], end: [-.19, .71, 1.01], startRadius: 1, endRadius: .05, stretch: [1.2, .1, 2.3] },
      { ...plume, end: [0, 0, 0], stretch: [.2, 1.8, .7] },
    ];
    let seed = 89179;
    const random = () => {
      seed = Math.imul(seed ^ seed >>> 15, 2246822519) | 0;
      return (seed >>> 0) / 4294967296;
    };
    let maximumRatio = 0;
    for (const sweep of sweeps) {
      const field = preparePlumeSweep(sweep);
      for (let i = 0; i < 4000; i++) {
        const a = [random() * 6 - 3, random() * 6 - 1, random() * 6 - 3] as Point3;
        const step = 10 ** (-5 + random() * 5);
        const b = a.map(v => v + (random() - .5) * step) as Point3;
        const distance = Math.hypot(...b.map((v, axis) => v - a[axis]));
        const difference = Math.abs(field.sample(...a) - field.sample(...b));
        expect(Number.isFinite(difference)).toBe(true);
        expect(difference).toBeLessThanOrEqual(distance + 1e-12);
        maximumRatio = Math.max(maximumRatio, difference / distance);
      }
    }
    // Ensure this also exercises a nonconstant field, not a degenerate zero.
    expect(maximumRatio).toBeGreaterThan(.7);
  });

  it('encloses all positive support in its rasterization bounds', () => {
    const sweep: PlumeSweep = {
      ...plume, start: [-1, .6, .4], end: [.8, 3.2, -.5], stretch: [.7, .4, 1.4],
    };
    const field = preparePlumeSweep(sweep);
    const center = field.min.map((v, i) => (v + field.max[i]) / 2) as Point3;
    for (const axis of [0, 1, 2]) for (const sign of [-1, 1]) {
      const point = [...center] as Point3;
      point[axis] = (sign < 0 ? field.min[axis] : field.max[axis]) + sign * .0001;
      expect(field.sample(...point)).toBeLessThan(0);
    }
    let positive = 0;
    for (let x = -20; x <= 20; x++) for (let y = -10; y <= 40; y++) for (let z = -20; z <= 20; z++) {
      const p: Point3 = [x / 10, y / 10, z / 10];
      if (field.sample(...p) <= 0) continue;
      positive++;
      p.forEach((value, axis) => {
        expect(value).toBeGreaterThanOrEqual(field.min[axis]);
        expect(value).toBeLessThanOrEqual(field.max[axis]);
      });
    }
    expect(positive).toBeGreaterThan(100);
  });

  it('reduces coincident sections to the larger closed ellipsoid', () => {
    const field = preparePlumeSweep({ ...plume, end: [0, 0, 0] });
    expect(field.sample(0, 0, 0)).toBeGreaterThan(0);
    expect(field.sample(1.4, 0, 0)).toBeCloseTo(0, 12);
    expect(field.sample(0, .35, 0)).toBeCloseTo(0, 12);
    expect(field.sample(0, 0, .701)).toBeLessThan(0);
  });

  it('rejects parameters that invalidate the finite support and slope bound', () => {
    for (const sweep of [
      { ...plume, startRadius: -1 }, { ...plume, endRadius: NaN },
      { ...plume, stretch: [1, 0, 1] as Point3 },
      { ...plume, start: [Infinity, 0, 0] as Point3 },
    ]) expect(() => preparePlumeSweep(sweep)).toThrow(RangeError);
  });
});
