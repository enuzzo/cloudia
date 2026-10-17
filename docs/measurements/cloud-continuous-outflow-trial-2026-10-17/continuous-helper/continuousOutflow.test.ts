import { describe, expect, it } from 'vitest';
import {
  CONTINUOUS_OUTFLOW_ROUNDOFF_SLACK_KM,
  forEachContinuousOutflowRow,
  prepareContinuousOutflow,
  type ContinuousOutflowKernel,
  type ContinuousOutflowOptions,
} from './continuousOutflow';

const options = (change: Partial<ContinuousOutflowOptions> = {}): ContinuousOutflowOptions => ({
  maxFieldErrorKm: .02, negativeBandKm: .35,
  grid: { min: [-5, -.5, -3.5], size: [10, 8.5, 7], resolution: 16 },
  maxKernels: 4096, maxRasterVoxelVisits: 256_000_000, maxEnvelopeBytes: 16 * 1024 * 1024,
  maxRowSetupCount: 16_000_000,
  ...change,
});
const sphereLine = [[0, 1, 0, .5, .5, .5], [2, 1, 0, .5, .5, .5], [3, 1, 0, .5, .5, .5]] as const;

// Independent sphere-line oracle: distance to the full centre segment [0,3].
const sphereLineOracle = (x: number, y: number, z: number) =>
  Math.max(-.35, .5 - Math.hypot(x - Math.max(0, Math.min(3, x)), y - 1, z));

describe('fixed-grid continuous upper outflow', () => {
  it('bounds the missing centreline maximum, where the worst error is linear in t spacing', () => {
    const prepared = prepareContinuousOutflow(sphereLine, options());
    const x = (prepared.kernels[0].lobe[0] + prepared.kernels[1].lobe[0]) / 2;
    const missing = sphereLineOracle(x, 1, 0) - prepared.sample(x, 1, 0);
    expect(missing).toBeGreaterThan(.015);
    expect(missing).toBeLessThanOrEqual(prepared.stats.analyticErrorBoundKm + 1e-12);
    expect(prepared.stats.fieldErrorBoundKm).toBeLessThanOrEqual(.02 + 1e-12);
    expect(prepared.stats.parameterIntervals.every(p => p.derivativeBoundKm > 0)).toBe(true);
  });

  it('never exceeds the analytic continuous sphere sweep at varied off-axis points', () => {
    const prepared = prepareContinuousOutflow(sphereLine, options());
    for (const p of [[.13, 1, 0], [1.01, 1.48, .1], [2.73, .6, -.25], [-.3, 1.2, .1], [3.2, .8, -.3]] as const) {
      const gap = sphereLineOracle(...p) - prepared.sample(...p);
      expect(gap).toBeGreaterThanOrEqual(-1e-12);
      expect(gap).toBeLessThanOrEqual(prepared.stats.analyticErrorBoundKm + 1e-12);
    }
  });

  it('inserts exact min-radius crossing keyframes and preserves all source endpoint tuples', () => {
    const frames = [[0, 1, 0, .4, 1, .8], [1, 2, .2, 1, .4, .8], [2, 2.5, .3, .9, .3, .7]] as const;
    const prepared = prepareContinuousOutflow(frames, options());
    expect(prepared.stats.parameterIntervals.some(p => p.segment === 0 && p.to === .5)).toBe(true);
    expect(prepared.kernels.some(k => k.lobe.every((v, i) => v === frames[1][i]))).toBe(true);
    expect(prepared.kernels[0].lobe).toEqual(frames[0]);
    expect(prepared.kernels.at(-1)!.lobe).toEqual(frames[2]);
    const snapshot = prepared.kernels.map(k => k.lobe);
    prepared.sample(.2, 1.3, .1); prepared.sample(1.2, 2.3, -.2);
    expect(prepared.kernels.map(k => k.lobe)).toEqual(snapshot);
  });

  it('encloses the anisotropic negative level that a Cartesian .35 halo would miss', () => {
    const frames = [[0, 2, 0, 2, .2, 1], [0, 2, 0, 2, .2, 1], [0, 2, 0, 2, .2, 1]] as const;
    const prepared = prepareContinuousOutflow(frames, options());
    expect(prepared.sample(4, 2, 0)).toBeCloseTo(-.2, 12);
    expect(4).toBeGreaterThan(2 + .35);
    expect(prepared.stats.negativeBounds.max[0]).toBeCloseTo(5.5, 12);
    expect(prepared.stats.negativeBounds.max[2]).toBeCloseTo(2.75, 12);
    expect(prepared.sample(5.51, 2, 0)).toBe(-.35);
  });

  it('retains proportional-radius cancellation in the derivative bound', () => {
    const frames = [[0, 2, 0, .4, .8, 1.2], [0, 2, 0, .8, 1.6, 2.4], [0, 2, 0, 1.2, 2.4, 3.6]] as const;
    const prepared = prepareContinuousOutflow(frames, options());
    // D=diag(min(r)/r) is constant, so only m changes: no p-distance penalty.
    for (const interval of prepared.stats.parameterIntervals)
      expect(interval.derivativeBoundKm).toBeCloseTo(.4, 12);
  });

  it('clips far-negative H exactly without asserting unclipped F-G error', () => {
    const prepared = prepareContinuousOutflow(sphereLine, options());
    expect(prepared.sample(100, 100, 100)).toBe(-.35);
    expect(prepared.stats.fieldFloorKm).toBe(-.35);
    expect(prepared.stats.errorScope).toBe('clipped-field-on-native-raster-domain');
    expect(prepared.stats.floatingPointGuardIsFormal).toBe(false);
    for (const p of prepared.stats.parameterIntervals) {
      expect(p.derivativeBoundKm).toBe(Math.min(p.boxDerivativeBoundKm, p.activeDerivativeBoundKm));
      expect(p.errorBoundKm).toBeLessThanOrEqual(.02);
    }
  });

  it('keeps finite MAX spatially 1-Lipschitz without asserting it for the trilinear bake', () => {
    const frames = [[-.2, 1, -.1, .4, .7, .5], [.3, 2, .1, .7, .5, .6], [1, 2.4, .2, 1.1, .3, .8]] as const;
    const prepared = prepareContinuousOutflow(frames, options());
    for (const [a, b] of [
      [[.1, 1.3, .2], [.12, 1.29, .19]],
      [[.8, 2.2, .3], [.81, 2.23, .28]],
      [[-1, 0, 1], [-.95, .04, 1.01]],
    ] as const) {
      const difference = Math.abs(prepared.sample(...a) - prepared.sample(...b));
      expect(difference).toBeLessThanOrEqual(Math.hypot(...a.map((v, i) => v - b[i])) + 1e-12);
    }
  });

  it('counts actual local raster boxes plus exactly one merge, and owns its source copies', () => {
    const frames: [number, number, number, number, number, number][] = sphereLine.map(k => [...k]);
    const prepared = prepareContinuousOutflow([frames[0], frames[1], frames[2]], options());
    let visits = 0, aabbVisits = 0, guards = 0, rowSetups = 0;
    for (const kernel of prepared.kernels) {
      const volume = kernel.end.reduce((n, v, i) => n * Math.max(0, v - kernel.start[i] + 1), 1);
      aabbVisits += volume;
      const work = forEachContinuousOutflowRow(kernel, options().grid, .35);
      visits += work.pointVisits; guards += work.guardEvaluations; rowSetups += work.rowSetupCount;
      for (let axis = 0; axis < 3; axis++) {
        expect(kernel.start[axis]).toBeGreaterThanOrEqual(prepared.raster.start[axis]);
        expect(kernel.end[axis]).toBeLessThanOrEqual(prepared.raster.end[axis]);
      }
    }
    expect(prepared.stats.kernelAabbVoxelVisits).toBe(aabbVisits);
    expect(prepared.stats.totalRasterVoxelVisits).toBe(visits + guards + prepared.raster.voxelCount);
    expect(prepared.stats.totalGenerationKernelEvaluations).toBe(visits + 2 * guards);
    expect(prepared.stats.rowSetupCount).toBe(rowSetups);
    expect(prepared.raster.bytes).toBe(prepared.raster.voxelCount * 4);
    const before = prepared.sample(.13, 1.02, .1);
    frames[0][0] = 100;
    expect(prepared.sample(.13, 1.02, .1)).toBe(before);
  });

  it('stops explicitly at the frozen preparation resource gates', () => {
    expect(() => prepareContinuousOutflow(sphereLine, options({ maxKernels: 2 }))).toThrow(/kernel budget/);
    expect(() => prepareContinuousOutflow(sphereLine, options({ maxRasterVoxelVisits: 1 }))).toThrow(/visit budget/);
    expect(() => prepareContinuousOutflow(sphereLine, options({ maxEnvelopeBytes: 1 }))).toThrow(/byte budget/);
    expect(() => prepareContinuousOutflow(sphereLine, options({ maxRowSetupCount: 1 }))).toThrow(/row setup budget/);
  });

  it('rejects invalid geometry, grids, error budgets and extreme numerical conditioning', () => {
    expect(() => prepareContinuousOutflow([[0, 1, 0, 0, .5, .5], sphereLine[1], sphereLine[2]], options())).toThrow(RangeError);
    expect(() => prepareContinuousOutflow([[NaN, 1, 0, .5, .5, .5], sphereLine[1], sphereLine[2]], options())).toThrow(RangeError);
    expect(() => prepareContinuousOutflow(sphereLine, options({ grid: { min: [0, 0, 0], size: [1, 1, 1], resolution: 3 } }))).toThrow(RangeError);
    expect(() => prepareContinuousOutflow(sphereLine, options({ maxFieldErrorKm: CONTINUOUS_OUTFLOW_ROUNDOFF_SLACK_KM }))).toThrow(RangeError);
    expect(() => prepareContinuousOutflow([[0, 1, 0, 1e-12, .5, .5], sphereLine[1], sphereLine[2]], options())).toThrow(/conditioning/);
  });
});

const scanGrid = { min: [-1, -1, -1] as const, size: [2, 2, 2] as const, resolution: 16 };
const canonical = (lobe: ContinuousOutflowKernel['lobe'], x: number, y: number, z: number) => {
  const [cx, cy, cz, rx, ry, rz] = lobe;
  return (1 - Math.sqrt(((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 + ((z - cz) / rz) ** 2)) * Math.min(rx, ry, rz);
};
const coordinate = (i: number, axis: number) => scanGrid.min[axis] + (i + .5) / scanGrid.resolution * scanGrid.size[axis];
function rasterFixture(kernels: readonly ContinuousOutflowKernel[], band: number, scan: boolean) {
  const field = new Float32Array(scanGrid.resolution ** 3); field.fill(-band);
  let points = 0, rowSetups = 0, guards = 0, rows = 0;
  const visit = (kernel: ContinuousOutflowKernel, z: number, y: number, x0: number, x1: number) => {
    for (let x = x0; x <= x1; x++) {
      const index = (z * scanGrid.resolution + y) * scanGrid.resolution + x;
      const sd = canonical(kernel.lobe, coordinate(x, 0), coordinate(y, 1), coordinate(z, 2));
      if (sd > field[index]) field[index] = sd;
      points++;
    }
  };
  for (const kernel of kernels) {
    if (scan) {
      const work = forEachContinuousOutflowRow(kernel, scanGrid, band, (z, y, x0, x1) => visit(kernel, z, y, x0, x1));
      expect(work.pointVisits).toBeGreaterThanOrEqual(0);
      rowSetups += work.rowSetupCount; guards += work.guardEvaluations; rows += work.rowCount;
    } else for (let z = kernel.start[2]; z <= kernel.end[2]; z++) for (let y = kernel.start[1]; y <= kernel.end[1]; y++)
      visit(kernel, z, y, kernel.start[0], kernel.end[0]);
  }
  return { bits: new Uint32Array(field.buffer), points, rowSetups, guards, rows };
}
const fixtureKernel = (lobe: ContinuousOutflowKernel['lobe']): ContinuousOutflowKernel =>
  ({ lobe, start: [1, 1, 1], end: [14, 14, 14] });

describe('negative-ellipsoid scanlines preserve the finite Float32 MAX', () => {
  it('matches all AABB bits for anisotropic, shifted, grazing and native-edge kernels', () => {
    const fixtures = [
      fixtureKernel([.03, -.02, .07, .53, .11, .29]),
      fixtureKernel([.9, .1, -.1, .19, .31, .23]),
      fixtureKernel([-.9, -.9, .9, .21, .13, .17]),
      fixtureKernel([0, .0625 + 1e-12, -.0625 - 1e-12, .125, .0625, .25]),
    ];
    for (const band of [.35, .125, 0]) {
      const box = rasterFixture(fixtures, band, false), scan = rasterFixture(fixtures, band, true);
      expect(scan.bits).toEqual(box.bits);
      expect(scan.points).toBeLessThan(box.points);
      expect(scan.rowSetups).toBe(fixtures.length * 14 * 14);
      expect(scan.guards).toBeGreaterThanOrEqual(scan.rowSetups);
    }
  });

  it('keeps near-frontier contributors around Float32 rounding boundaries', () => {
    const x = coordinate(10, 0), band = .35;
    const fixtures = [-1e-12, 0, 1e-12].map(shift => fixtureKernel([
      x - .2 * (1 + band / .1) + shift, coordinate(7, 1), coordinate(8, 2), .2, .1, .15,
    ]));
    expect(rasterFixture(fixtures, band, true).bits).toEqual(rasterFixture(fixtures, band, false).bits);
  });

  it('uses the forward-coordinate peak when its center is between native X samples', () => {
    const cx = (coordinate(7, 0) + coordinate(8, 0)) / 2 + Number.EPSILON;
    const kernel = fixtureKernel([cx, coordinate(7, 1), coordinate(7, 2), .13, .1, .1]);
    const work = forEachContinuousOutflowRow(kernel, scanGrid, .35);
    expect(work.xPeakSearchComparisons).toBeGreaterThan(0);
    expect(work.guardEvaluations).toBe(work.rowSetupCount + work.boundaryCheckCount);
    expect(work.analyticRootCount).toBe(work.rowCount);
    expect(rasterFixture([kernel], .35, true).bits).toEqual(rasterFixture([kernel], .35, false).bits);
  });

  it('handles empty boxes without rows or callbacks and rejects nonfinite inputs', () => {
    let called = false;
    const empty = { ...fixtureKernel([0, 0, 0, .2, .2, .2]), start: [2, 1, 1] as const, end: [1, 14, 14] as const };
    expect(forEachContinuousOutflowRow(empty, scanGrid, .35, () => { called = true; }).rowSetupCount).toBe(0);
    expect(called).toBe(false);
    expect(() => forEachContinuousOutflowRow(fixtureKernel([NaN, 0, 0, .2, .2, .2]), scanGrid, .35)).toThrow(RangeError);
  });
});
