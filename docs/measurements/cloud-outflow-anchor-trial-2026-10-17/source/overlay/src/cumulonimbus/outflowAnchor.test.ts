import { describe, expect, it } from 'vitest';
import { outflowAnchorTranslation, type OutflowAnchorPoint } from './outflowAnchor';

describe('complete outflow source anchor', () => {
  it('places the proximal root on the extended feeding axis at its existing height', () => {
    const foundation = [1, 2, -3] as const, summit = [3, 6, 1] as const;
    const proximal = [.5, 8, 4] as const;
    const [dx, dz] = outflowAnchorTranslation(foundation, summit, proximal);
    // At y=8 the axis has passed the summit: its exact point is [4,8,3].
    expect([proximal[0] + dx, proximal[1], proximal[2] + dz]).toEqual([4, 8, 3]);
    expect(proximal[0] + dx).toBeGreaterThan(summit[0]);
  });

  it('leaves an already fed vertical outflow in place', () => {
    expect(outflowAnchorTranslation([2, 1, -1], [2, 5, -1], [2, 6, -1])).toEqual([0, 0]);
  });

  it('keeps the same horizontal correction after a common world translation', () => {
    const points = [[1, 2, -3], [3, 6, 1], [.5, 8, 4]] as const;
    const shifted = points.map(p => [p[0] + 8, p[1] - 4, p[2] + 16] as const);
    expect(outflowAnchorTranslation(shifted[0], shifted[1], shifted[2]))
      .toEqual(outflowAnchorTranslation(points[0], points[1], points[2]));
  });

  it('commutes with the existing center transform, using towerWidth for X and Z', () => {
    const foundation = [-1.4, 2.2, -.3] as const, summit = [-.7, 5.4, -.1] as const;
    const proximal = [-.25, 5.85, -.2] as const;
    const towerWidth = 1.07, towerHeight = .81, windLean = .23;
    const transform = (p: OutflowAnchorPoint): OutflowAnchorPoint => [
      p[0] * towerWidth + (p[1] - .72) * windLean,
      .72 + (p[1] - .72) * towerHeight,
      p[2] * towerWidth,
    ];
    const before = outflowAnchorTranslation(foundation, summit, proximal);
    const after = outflowAnchorTranslation(transform(foundation), transform(summit), transform(proximal));
    expect(after[0]).toBeCloseTo(before[0] * towerWidth, 13);
    expect(after[1]).toBeCloseTo(before[1] * towerWidth, 13);
    // Anvil spread changes radii, not the centers corrected by this helper.
    const corrected = transform([proximal[0] + before[0], proximal[1], proximal[2] + before[1]]);
    const original = transform(proximal);
    expect(corrected[0] - original[0]).toBeCloseTo(before[0] * towerWidth, 13);
    expect(corrected[2] - original[2]).toBeCloseTo(before[1] * towerWidth, 13);
  });

  it('preserves a rigid outflow layout when its single correction is shared', () => {
    const [dx, dz] = outflowAnchorTranslation([0, 1, 0], [2, 5, -2], [.5, 7, 1]);
    const proximal = [.5, 7, 1] as const, distal = [2.25, 7.25, -.5] as const;
    const movedProximal = [proximal[0] + dx, proximal[1], proximal[2] + dz];
    const movedDistal = [distal[0] + dx, distal[1], distal[2] + dz];
    expect(movedDistal.map((v, axis) => v - movedProximal[axis]))
      .toEqual(distal.map((v, axis) => v - proximal[axis]));
  });

  it('does not mutate or retain the anchors', () => {
    const foundation: [number, number, number] = [1, 2, -3];
    const summit: [number, number, number] = [3, 6, 1];
    const proximal: [number, number, number] = [.5, 8, 4];
    const result = outflowAnchorTranslation(foundation, summit, proximal);
    expect([foundation, summit, proximal]).toEqual([[1, 2, -3], [3, 6, 1], [.5, 8, 4]]);
    foundation[0] = 100; summit[2] = -100; proximal[0] = -100;
    expect(result).toEqual([3.5, -1]);
    expect(outflowAnchorTranslation([1, 2, -3], [3, 6, 1], [.5, 8, 4])).not.toBe(result);
  });

  it('rejects nonfinite anchors and a missing upward feeding direction', () => {
    for (const invalid of [NaN, Infinity, -Infinity]) {
      expect(() => outflowAnchorTranslation([invalid, 1, 0], [0, 5, 0], [0, 6, 0])).toThrow(RangeError);
      expect(() => outflowAnchorTranslation([0, 1, 0], [0, invalid, 0], [0, 6, 0])).toThrow(RangeError);
      expect(() => outflowAnchorTranslation([0, 1, 0], [0, 5, 0], [0, 6, invalid])).toThrow(RangeError);
    }
    expect(() => outflowAnchorTranslation([0, 1, 0], [0, 1, 0], [0, 6, 0])).toThrow(RangeError);
    expect(() => outflowAnchorTranslation([0, 2, 0], [0, 1, 0], [0, 6, 0])).toThrow(RangeError);
  });

  it('rejects overflowing geometry rather than emitting an infinite translation', () => {
    expect(() => outflowAnchorTranslation([0, 0, 0], [1, Number.MIN_VALUE, 0], [0, 1, 0]))
      .toThrow(RangeError);
    expect(() => outflowAnchorTranslation([0, -Number.MAX_VALUE, 0], [0, Number.MAX_VALUE, 0], [0, 1, 0]))
      .toThrow(RangeError);
  });
});
