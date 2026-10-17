export type OutflowVector = readonly [number, number, number];
export type ContinuousOutflowLobe = readonly [number, number, number, number, number, number, number?];
type KernelLobe = readonly [number, number, number, number, number, number];

/** A numerical reserve, not a change of the authored radii or of the field slope. */
export const CONTINUOUS_OUTFLOW_ROUNDOFF_SLACK_KM = 1e-6;

export interface ContinuousOutflowOptions {
  maxFieldErrorKm: number;
  negativeBandKm: number;
  grid: { min: OutflowVector; size: OutflowVector; resolution: number };
  maxKernels: number;
  maxRasterVoxelVisits: number;
  maxEnvelopeBytes: number;
  maxRowSetupCount: number;
}
export interface ContinuousOutflowKernel {
  readonly lobe: KernelLobe;
  readonly start: OutflowVector;
  readonly end: OutflowVector;
}
export interface ContinuousOutflowStats {
  kernelCount: number;
  kernelVoxelVisits: number;
  kernelAabbVoxelVisits: number;
  rowSetupCount: number;
  rowCount: number;
  rowBoundaryCheckCount: number;
  rowFallbackCount: number;
  xPeakSearchComparisons: number;
  guardEvaluations: number;
  rowAnalyticRootCount: number;
  totalGenerationKernelEvaluations: number;
  totalGenerationWork: number;
  totalGenerationRowSetupCount: number;
  mergeVoxelVisits: number;
  totalRasterVoxelVisits: number;
  envelopeBytes: number;
  analyticErrorBoundKm: number;
  floatingPointGuardKm: number;
  fieldErrorBoundKm: number;
  fieldFloorKm: number;
  errorScope: 'clipped-field-on-native-raster-domain';
  floatingPointGuardIsFormal: false;
  negativeBandKm: number;
  positiveBounds: { min: OutflowVector; max: OutflowVector };
  negativeBounds: { min: OutflowVector; max: OutflowVector };
  errorDomain: { min: OutflowVector; max: OutflowVector };
  parameterIntervals: readonly {
    segment: number; from: number; to: number; minAxis: number;
    derivativeBoundKm: number; boxDerivativeBoundKm: number; activeDerivativeBoundKm: number;
    steps: number; errorBoundKm: number;
  }[];
}
export interface PreparedContinuousOutflow {
  readonly kernels: readonly ContinuousOutflowKernel[];
  readonly raster: { readonly start: OutflowVector; readonly end: OutflowVector; readonly voxelCount: number; readonly bytes: number };
  readonly stats: ContinuousOutflowStats;
  /** MAX(-negativeBand, prepared kernels), without smooth union. */
  sample(x: number, y: number, z: number): number;
}

const vector = (v: readonly number[]): OutflowVector => [v[0], v[1], v[2]];
const finite = (v: readonly number[]) => v.every(Number.isFinite);
const count = (start: OutflowVector, end: OutflowVector) =>
  end.reduce((product, v, i) => product * Math.max(0, v - start[i] + 1), 1);

export interface ContinuousOutflowRows {
  rowSetupCount: number;
  rowCount: number;
  pointVisits: number;
  boundaryCheckCount: number;
  rowFallbackCount: number;
  xPeakSearchComparisons: number;
  guardEvaluations: number;
  analyticRootCount: number;
}

/** Stateless enumerator shared by preparation counts and the real raster.
 * The analytic ellipsoid slice is only a GUESS. Exact canonical sd checks at
 * the discrete peak and immediately outside the guessed interval make it
 * fail closed to the old AABB row; no accuracy assumption on inverse bounds.
 */
export function forEachContinuousOutflowRow(
  kernel: ContinuousOutflowKernel,
  grid: ContinuousOutflowOptions['grid'],
  negativeBandKm: number,
  visit?: (z: number, y: number, startX: number, endX: number) => void,
): ContinuousOutflowRows {
  const result: ContinuousOutflowRows = { rowSetupCount: 0, rowCount: 0, pointVisits: 0,
    boundaryCheckCount: 0, rowFallbackCount: 0, xPeakSearchComparisons: 0,
    guardEvaluations: 0, analyticRootCount: 0 };
  const { lobe, start, end } = kernel;
  if (!finite([...lobe, ...start, ...end, ...grid.min, ...grid.size, negativeBandKm]) ||
      lobe.length !== 6 || lobe.slice(3).some(r => r <= 0) || grid.size.some(v => v <= 0) || negativeBandKm < 0 ||
      !Number.isSafeInteger(grid.resolution) || grid.resolution < 4 || grid.resolution > 1024 ||
      [...start, ...end].some(v => !Number.isSafeInteger(v)))
    throw new RangeError('Outflow scanlines need finite ellipsoids, a native grid and integer bounds');
  if (end.some((v, axis) => v < start[axis])) return result;
  if (start.some(v => v < 1) || end.some(v => v > grid.resolution - 2))
    throw new RangeError('Outflow scanline bounds exceed the native interior');
  const [cx, cy, cz, rx, ry, rz] = lobe, m = Math.min(rx, ry, rz), floor = -negativeBandKm;
  // Same order as volume.voxelCenter, not min + i*(extent/resolution).
  const coordinate = (i: number, axis: number) => grid.min[axis] + (i + .5) / grid.resolution * grid.size[axis];
  const sd = (x: number, y: number, z: number) =>
    (1 - Math.sqrt(((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 + ((z - cz) / rz) ** 2)) * m;
  // A monotone forward-coordinate search finds the true discrete peak even
  // when inverse-coordinate rounding would choose the adjacent X sample.
  let lower = start[0], upper = end[0] + 1;
  while (lower < upper) {
    const middle = Math.floor((lower + upper) / 2);
    result.xPeakSearchComparisons++;
    if (coordinate(middle, 0) < cx) lower = middle + 1; else upper = middle;
  }
  const below = Math.max(start[0], Math.min(end[0], lower - 1));
  const above = Math.max(start[0], Math.min(end[0], lower));
  result.xPeakSearchComparisons++;
  const peak = Math.abs(coordinate(below, 0) - cx) <= Math.abs(coordinate(above, 0) - cx) ? below : above;
  const peakX = coordinate(peak, 0), xStep = grid.size[0] / grid.resolution;
  const threshold = 1 + negativeBandKm / m;
  for (let z = start[2]; z <= end[2]; z++) {
    const pz = coordinate(z, 2);
    for (let y = start[1]; y <= end[1]; y++) {
      const py = coordinate(y, 1);
      result.rowSetupCount++; result.guardEvaluations++;
      const peakValue = sd(peakX, py, pz);
      if (Number.isNaN(peakValue)) throw new RangeError('Outflow scanline peak produced NaN');
      // All values along X are <= the discrete peak. fround is monotone,
      // so omitting these rows cannot change a Float32 MAX starting at -b.
      if (peakValue <= floor) continue;
      result.analyticRootCount++;
      const extent = rx * Math.sqrt(Math.max(0, threshold * threshold - ((py - cy) / ry) ** 2 - ((pz - cz) / rz) ** 2));
      let x0 = start[0], x1 = end[0], fallback = !Number.isFinite(extent);
      if (!fallback) {
        // One extra X voxel is counted, not a change to geometry or to sd.
        x0 = Math.max(start[0], Math.min(peak, Math.floor((cx - extent - grid.min[0]) / xStep - .5) - 1));
        x1 = Math.min(end[0], Math.max(peak, Math.ceil((cx + extent - grid.min[0]) / xStep - .5) + 1));
        if (x0 > start[0]) {
          result.boundaryCheckCount++; result.guardEvaluations++;
          const value = sd(coordinate(x0 - 1, 0), py, pz);
          if (Number.isNaN(value) || value > floor) fallback = true;
        }
        if (x1 < end[0]) {
          result.boundaryCheckCount++; result.guardEvaluations++;
          const value = sd(coordinate(x1 + 1, 0), py, pz);
          if (Number.isNaN(value) || value > floor) fallback = true;
        }
      }
      if (fallback) { x0 = start[0]; x1 = end[0]; result.rowFallbackCount++; }
      result.rowCount++; result.pointVisits += x1 - x0 + 1;
      visit?.(z, y, x0, x1);
    }
  }
  return result;
}

/** Prepare one point-independent t-grid for neck -> top -> proximal cap.
 * Each kernel and their finite MAX remain 1-Lipschitz in real world coordinates.
 * The certificate compares H=max(-band,F) and Hgrid=max(-band,G) on
 * errorDomain. It is scalar-field error, not surface distance or unclipped F-G.
 * Rasterize these kernels with MAX; smooth-union the result only ONCE outside.
 */
export function prepareContinuousOutflow(
  keyframes: readonly [ContinuousOutflowLobe, ContinuousOutflowLobe, ContinuousOutflowLobe],
  options: ContinuousOutflowOptions,
): PreparedContinuousOutflow {
  const { grid, negativeBandKm: band, maxFieldErrorKm: epsilon } = options;
  if (!Array.isArray(keyframes) || keyframes.length !== 3 || keyframes.some(k => !Array.isArray(k) || k.length < 6 ||
      !finite([k[0], k[1], k[2], k[3], k[4], k[5]]) || [k[3], k[4], k[5]].some(r => r <= 0)))
    throw new RangeError('A continuous outflow needs three finite ellipsoids with positive radii');
  if (grid.min.length !== 3 || grid.size.length !== 3 || !finite([...grid.min, ...grid.size]) || grid.size.some(v => v <= 0) ||
      !Number.isSafeInteger(grid.resolution) || grid.resolution < 4 || grid.resolution > 1024)
    throw new RangeError('A continuous outflow needs a finite native grid with resolution 4..1024');
  if (!Number.isFinite(band) || band < 0 || !Number.isFinite(epsilon) || epsilon <= CONTINUOUS_OUTFLOW_ROUNDOFF_SLACK_KM)
    throw new RangeError('Outflow field error must exceed its numerical reserve and its negative band must be nonnegative');
  for (const [name, limit] of Object.entries({ maxKernels: options.maxKernels, maxRasterVoxelVisits: options.maxRasterVoxelVisits,
    maxEnvelopeBytes: options.maxEnvelopeBytes, maxRowSetupCount: options.maxRowSetupCount }))
    if (!Number.isSafeInteger(limit) || limit < 1) throw new RangeError(`Invalid outflow resource limit: ${name}`);
  if (options.maxKernels > 65536) throw new RangeError('Outflow kernel capacity exceeds the preparation safety cap');

  // Copies isolate the prepared grid from later mutation/contraction of source lobes.
  const frames = keyframes.map(k => k.slice(0, 6) as [number, number, number, number, number, number]);
  const positiveMin = [Infinity, Infinity, Infinity], positiveMax = [-Infinity, -Infinity, -Infinity];
  const ratio = [0, 0, 0];
  for (const k of frames) {
    const m = Math.min(k[3], k[4], k[5]);
    for (let axis = 0; axis < 3; axis++) {
      positiveMin[axis] = Math.min(positiveMin[axis], k[axis] - k[axis + 3]);
      positiveMax[axis] = Math.max(positiveMax[axis], k[axis] + k[axis + 3]);
      ratio[axis] = Math.max(ratio[axis], k[axis + 3] / m);
    }
  }
  // r_i/min(r) = max_j(r_i/r_j); ratios of positive affine functions have
  // endpoint extrema. This encloses the CONTINUOUS level F >= -band.
  const negativeMin = positiveMin.map((v, axis) => v - band * ratio[axis]);
  const negativeMax = positiveMax.map((v, axis) => v + band * ratio[axis]);
  if (!finite([...positiveMin, ...positiveMax, ...negativeMin, ...negativeMax]))
    throw new RangeError('Outflow bounds overflow finite coordinates');
  const voxel = grid.size.map(v => v / grid.resolution);
  const range = (lo: readonly number[], hi: readonly number[]) => ({
    start: vector(lo.map((v, axis) => Math.max(1, Math.floor((v - grid.min[axis]) / voxel[axis] - .5)))),
    end: vector(hi.map((v, axis) => Math.min(grid.resolution - 2, Math.ceil((v - grid.min[axis]) / voxel[axis] - .5)))),
  });
  const rasterRange = range(negativeMin, negativeMax);
  const mergeVisits = count(rasterRange.start, rasterRange.end);
  if (!mergeVisits) throw new RangeError('The outflow negative envelope misses the native interior grid');
  const envelopeBytes = mergeVisits * Float32Array.BYTES_PER_ELEMENT;
  if (!Number.isSafeInteger(envelopeBytes) || envelopeBytes > options.maxEnvelopeBytes)
    throw new RangeError(`Outflow envelope byte budget exceeded: ${envelopeBytes} > ${options.maxEnvelopeBytes}`);
  // Rounded raster bounds can include centres just outside the analytic box.
  // Use the ACTUAL whole tile domain, shared by both segment certificates.
  const domainMin = rasterRange.start.map((v, axis) => grid.min[axis] + (v + .5) * voxel[axis]);
  const domainMax = rasterRange.end.map((v, axis) => grid.min[axis] + (v + .5) * voxel[axis]);
  const mMax = Math.max(...frames.map(k => Math.min(k[3], k[4], k[5])));
  const mMin = Math.min(...frames.flatMap(k => k.slice(3, 6)));
  const scale = Math.max(1, ...frames.flat().map(Math.abs), ...domainMin.map(Math.abs), ...domainMax.map(Math.abs));
  // Explicit engineering guards for this f64 preparation + Float32 tile path.
  // They are not a GPU/Math.sqrt bit-parity proof; extreme conditioning fails.
  const condition = Math.max(1, scale / mMin);
  const f64Guard = 256 * Number.EPSILON * scale * condition * condition;
  const fieldMagnitude = Math.max(mMax, band);
  const f32Guard = 2 ** (Math.floor(Math.log2(fieldMagnitude)) - 24);
  if (!Number.isFinite(f64Guard + f32Guard) || f64Guard + f32Guard > CONTINUOUS_OUTFLOW_ROUNDOFF_SLACK_KM)
    throw new RangeError('Outflow numerical conditioning exceeds the frozen roundoff reserve');
  const samplingBudget = epsilon - CONTINUOUS_OUTFLOW_ROUNDOFF_SLACK_KM;
  const interpolate = (a: KernelLobe, b: KernelLobe, t: number): KernelLobe =>
    t === 0 ? [...a] : t === 1 ? [...b] : a.map((v, axis) => v + (b[axis] - v) * t) as [number, number, number, number, number, number];
  const plans: Array<ContinuousOutflowStats['parameterIntervals'][number]> = [];
  let expectedKernels = 1;
  for (let segment = 0; segment < 2; segment++) {
    const a = frames[segment], b = frames[segment + 1];
    const dc = a.slice(0, 3).map((v, axis) => b[axis] - v);
    const dr = a.slice(3, 6).map((v, axis) => b[axis + 3] - v);
    const knots = new Set([0, 1]);
    for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) {
      const denominator = dr[i] - dr[j];
      if (!denominator) continue;
      const t = (a[j + 3] - a[i + 3]) / denominator;
      if (t > 0 && t < 1) knots.add(t);
    }
    const ordered = [...knots].sort((x, y) => x - y);
    for (let interval = 0; interval < ordered.length - 1; interval++) {
      const from = ordered[interval], to = ordered[interval + 1];
      const left = interpolate(a, b, from), right = interpolate(a, b, to), middle = interpolate(a, b, (from + to) / 2);
      const minAxis = [0, 1, 2].reduce((i, j) => middle[i + 3] <= middle[j + 3] ? i : j);
      const ma = left[minAxis + 3], mb = right[minAxis + 3];
      // phi=m-|D(p-c)|, D=diag(m/r). Numerator of D_i' is constant
      // on each active-min interval. Keep proportional-radius cancellation.
      const terms = dc.map((change, axis) => {
        const rlo = Math.min(left[axis + 3], right[axis + 3]);
        const alpha = Math.min(1, Math.max(ma / left[axis + 3], mb / right[axis + 3]));
        const beta = Math.abs(dr[minAxis] * a[axis + 3] - a[minAxis + 3] * dr[axis]) / (rlo * rlo);
        const distance = Math.max(...[domainMin[axis], domainMax[axis]].flatMap(p => [Math.abs(p - left[axis]), Math.abs(p - right[axis])]));
        return alpha * Math.abs(change) + beta * distance;
      });
      const boxDerivativeBoundKm = Math.abs(dr[minAxis]) + Math.hypot(...terms);
      // For H=max(-band,phi), only phi>-band can vary. There
      // |u|=|(p-c)/r| < 1+band/m, giving a second bound independent of p.
      const centerTerms = dc.map((change, axis) =>
        Math.min(1, Math.max(ma / left[axis + 3], mb / right[axis + 3])) * Math.abs(change));
      const radiusTerms = dr.map((change, axis) =>
        Math.abs(dr[minAxis] * a[axis + 3] - a[minAxis + 3] * change) /
          Math.min(left[axis + 3], right[axis + 3]));
      const activeDerivativeBoundKm = Math.abs(dr[minAxis]) + Math.hypot(...centerTerms) +
        (1 + band / Math.min(ma, mb)) * Math.max(...radiusTerms);
      // Both bounds apply to clipped H on the common native raster domain.
      // The box bound is not claimed off-grid inside the analytic envelope.
      const derivativeBoundKm = Math.min(boxDerivativeBoundKm, activeDerivativeBoundKm);
      const steps = Math.max(1, Math.ceil(derivativeBoundKm * (to - from) / (2 * samplingBudget)));
      expectedKernels += steps;
      if (!Number.isFinite(derivativeBoundKm) || !Number.isSafeInteger(expectedKernels) || expectedKernels > options.maxKernels)
        throw new RangeError(`Outflow kernel budget exceeded: ${expectedKernels} > ${options.maxKernels}`);
      plans.push({ segment, from, to, minAxis, derivativeBoundKm, boxDerivativeBoundKm, activeDerivativeBoundKm,
        steps, errorBoundKm: derivativeBoundKm * (to - from) / (2 * steps) });
    }
  }
  const kernels: ContinuousOutflowKernel[] = [];
  let kernelVisits = 0, kernelAabbVisits = 0, rowSetups = 0, rows = 0, boundaryChecks = 0, rowFallbacks = 0;
  let peakSearchComparisons = 0, guardEvaluations = 0, analyticRoots = 0;
  const append = (lobe: KernelLobe) => {
    const m = Math.min(lobe[3], lobe[4], lobe[5]);
    const lo = lobe.slice(0, 3).map((v, axis) => v - lobe[axis + 3] * (1 + band / m));
    const hi = lobe.slice(0, 3).map((v, axis) => v + lobe[axis + 3] * (1 + band / m));
    const rawBounds = range(lo, hi);
    // Use the same tile even if equivalent endpoint-bound expressions round
    // to opposite sides of an integer grid edge. No out-of-tile indexing.
    const bounds = {
      start: vector(rawBounds.start.map((v, axis) => Math.max(v, rasterRange.start[axis]))),
      end: vector(rawBounds.end.map((v, axis) => Math.min(v, rasterRange.end[axis]))),
    };
    kernelAabbVisits += count(bounds.start, bounds.end);
    const candidateRows = bounds.end.some((v, axis) => v < bounds.start[axis]) ? 0 :
      (bounds.end[1] - bounds.start[1] + 1) * (bounds.end[2] - bounds.start[2] + 1);
    if (!Number.isSafeInteger(rowSetups + candidateRows) || rowSetups + candidateRows > options.maxRowSetupCount)
      throw new RangeError(`Outflow row setup budget exceeded: ${rowSetups + candidateRows} > ${options.maxRowSetupCount}`);
    const kernel = Object.freeze({ lobe: Object.freeze(lobe), start: Object.freeze(bounds.start), end: Object.freeze(bounds.end) });
    const work = forEachContinuousOutflowRow(kernel, grid, band);
    kernelVisits += work.pointVisits; rowSetups += work.rowSetupCount; rows += work.rowCount;
    boundaryChecks += work.boundaryCheckCount; rowFallbacks += work.rowFallbackCount;
    peakSearchComparisons += work.xPeakSearchComparisons; guardEvaluations += work.guardEvaluations; analyticRoots += work.analyticRootCount;
    if (!Number.isSafeInteger(kernelVisits + guardEvaluations) || kernelVisits + guardEvaluations + mergeVisits > options.maxRasterVoxelVisits)
      throw new RangeError(`Outflow raster visit budget exceeded (point + guard sd + merge): ${kernelVisits + guardEvaluations + mergeVisits} > ${options.maxRasterVoxelVisits}`);
    kernels.push(kernel);
  };
  append([...frames[0]]);
  for (const plan of plans) for (let j = 1; j <= plan.steps; j++) {
    const t = j === plan.steps ? plan.to : plan.from + (plan.to - plan.from) * j / plan.steps;
    append(interpolate(frames[plan.segment], frames[plan.segment + 1], t));
  }
  const analyticError = Math.max(...plans.map(p => p.errorBoundKm));
  return {
    kernels: Object.freeze(kernels),
    raster: Object.freeze({ ...rasterRange, voxelCount: mergeVisits, bytes: envelopeBytes }),
    stats: {
      kernelCount: kernels.length, kernelVoxelVisits: kernelVisits, kernelAabbVoxelVisits: kernelAabbVisits,
      rowSetupCount: rowSetups, rowCount: rows, rowBoundaryCheckCount: boundaryChecks, rowFallbackCount: rowFallbacks,
      xPeakSearchComparisons: peakSearchComparisons, guardEvaluations, rowAnalyticRootCount: analyticRoots,
      totalGenerationKernelEvaluations: kernelVisits + 2 * guardEvaluations,
      totalGenerationWork: kernelVisits + 2 * guardEvaluations + mergeVisits,
      totalGenerationRowSetupCount: 2 * rowSetups,
      mergeVoxelVisits: mergeVisits, totalRasterVoxelVisits: kernelVisits + guardEvaluations + mergeVisits, envelopeBytes,
      analyticErrorBoundKm: analyticError, floatingPointGuardKm: CONTINUOUS_OUTFLOW_ROUNDOFF_SLACK_KM,
      fieldErrorBoundKm: analyticError + CONTINUOUS_OUTFLOW_ROUNDOFF_SLACK_KM,
      fieldFloorKm: -band, errorScope: 'clipped-field-on-native-raster-domain', floatingPointGuardIsFormal: false,
      negativeBandKm: band,
      positiveBounds: { min: vector(positiveMin), max: vector(positiveMax) },
      negativeBounds: { min: vector(negativeMin), max: vector(negativeMax) },
      errorDomain: { min: vector(domainMin), max: vector(domainMax) }, parameterIntervals: plans,
    },
    sample(x: number, y: number, z: number) {
      if (!finite([x, y, z])) throw new RangeError('An outflow sample needs finite coordinates');
      let value = -band;
      for (const { lobe: [cx, cy, cz, rx, ry, rz] } of kernels) {
        const kernel = (1 - Math.sqrt(((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 + ((z - cz) / rz) ** 2)) * Math.min(rx, ry, rz);
        value = Math.max(value, kernel);
      }
      return value;
    },
  };
}
