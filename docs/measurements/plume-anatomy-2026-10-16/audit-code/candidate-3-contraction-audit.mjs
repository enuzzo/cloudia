// src/cumulonimbus/light.ts
function bakeOpticalDepth(density, size, dimensions, direction, extinction) {
  if (!Number.isInteger(size) || size < 1 || density.length !== size ** 3 || dimensions.length !== 3 || dimensions.some((v2) => !Number.isFinite(v2) || v2 <= 0) || direction.length !== 3 || direction.some((v2) => !Number.isFinite(v2)) || !Number.isFinite(extinction) || extinction < 0) throw new Error("Invalid optical-depth grid");
  const rates = direction.map((v2, i) => Math.abs(v2) / dimensions[i]);
  const axis = rates.indexOf(Math.max(...rates));
  if (rates[axis] === 0) throw new Error("Light direction must be nonzero");
  const others = [0, 1, 2].filter((i) => i !== axis), u = others[0], v = others[1];
  const major = Math.abs(direction[axis]), positive = direction[axis] > 0;
  const strides = [1, size, size * size];
  const index = (x, y, z) => x * strides[u] + (positive ? y : size - 1 - y) * strides[axis] + z * strides[v];
  const dy = dimensions[axis] / size;
  const dx = direction[u] / major * dimensions[axis] / dimensions[u];
  const dz = direction[v] / major * dimensions[axis] / dimensions[v];
  const ds = dy * Math.hypot(...direction) / major * extinction;
  const offsetX = -Math.max(0, dx * size), offsetZ = -Math.max(0, dz * size);
  const width = Math.ceil(size + Math.abs(dx) * size) + 2;
  const depth = Math.ceil(size + Math.abs(dz) * size) + 2;
  const rays = new Float32Array(width * depth), result = new Float32Array(size ** 3);
  const plane = (x, z) => x < 0 || x >= width || z < 0 || z >= depth ? 0 : rays[z * width + x];
  for (let y = size - 1; y >= 0; y--) {
    const shiftX = offsetX + dx * (y + 0.5), shiftZ = offsetZ + dz * (y + 0.5);
    for (let z = 0; z < size; z++) for (let x = 0; x < size; x++) {
      const u2 = x - shiftX, v2 = z - shiftZ, ix = Math.floor(u2), iz = Math.floor(v2), fx = u2 - ix, fz = v2 - iz;
      const upstream = plane(ix, iz) * (1 - fx) * (1 - fz) + plane(ix + 1, iz) * fx * (1 - fz) + plane(ix, iz + 1) * (1 - fx) * fz + plane(ix + 1, iz + 1) * fx * fz;
      const idx = index(x, y, z);
      result[idx] = upstream + density[idx] * ds * 0.5;
    }
    const sample = (x, z) => x < 0 || x >= size || z < 0 || z >= size ? 0 : density[index(x, y, z)];
    const x0 = Math.max(0, Math.floor(-shiftX) - 1), x1 = Math.min(width - 1, Math.ceil(size - shiftX));
    const z0 = Math.max(0, Math.floor(-shiftZ) - 1), z1 = Math.min(depth - 1, Math.ceil(size - shiftZ));
    for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
      const xx = x + shiftX, zz = z + shiftZ, ix = Math.floor(xx), iz = Math.floor(zz), fx = xx - ix, fz = zz - iz;
      const d = sample(ix, iz) * (1 - fx) * (1 - fz) + sample(ix + 1, iz) * fx * (1 - fz) + sample(ix, iz + 1) * (1 - fx) * fz + sample(ix + 1, iz + 1) * fx * fz;
      rays[z * width + x] += d * ds;
    }
  }
  return result;
}

// src/cumulonimbus/sun.ts
var SUN_LEFT = [-0.75, 0.8, 0.24];
var SUN_RIGHT = [0.75, 0.8, 0.24];
function solarDirection(side, sunset = false) {
  const d = [...side === 0 ? SUN_LEFT : SUN_RIGHT];
  if (sunset) d[1] = 0.025;
  const length = Math.hypot(...d);
  return d.map((v) => v / length);
}

// src/cumulonimbus/motion.ts
var THERMAL_DISPLACEMENT = [0.42, 0.82, 0.34];

// ../../../../../Documents/Codex/Cloudia-QA-2026-10-16-cycle13/anatomy/visual-candidate-3/morphology.ts
function createPlumeSweep(sweep) {
  return { ...sweep, start: [...sweep.start], end: [...sweep.end], stretch: [...sweep.stretch] };
}
function preparePlumeSweep(sweep) {
  const { start, end, startRadius, endRadius, stretch } = sweep;
  if (![...start, ...end, startRadius, endRadius, ...stretch].every(Number.isFinite) || startRadius < 0 || endRadius < 0 || stretch.some((v) => v <= 0)) {
    throw new RangeError("A plume needs finite endpoints, nonnegative radii and positive stretch");
  }
  const a = start.map((v, i) => v / stretch[i]);
  const direction = end.map((v, i) => v / stretch[i] - a[i]);
  const lengthSquared = direction.reduce((sum, v) => sum + v * v, 0);
  const radius = Math.max(startRadius, endRadius);
  const baseRadius = lengthSquared === 0 ? radius : startRadius;
  const radiusChange = lengthSquared === 0 ? 0 : endRadius - startRadius;
  const inverseSlope = Math.min(...stretch) / (1 + (lengthSquared === 0 ? 0 : Math.abs(radiusChange) / Math.sqrt(lengthSquared)));
  return {
    min: start.map((v, i) => Math.min(v, end[i]) - radius * stretch[i]),
    max: start.map((v, i) => Math.max(v, end[i]) + radius * stretch[i]),
    sample(x, y, z) {
      const qx = x / stretch[0] - a[0];
      const qy = y / stretch[1] - a[1];
      const qz = z / stretch[2] - a[2];
      const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(
        1,
        (qx * direction[0] + qy * direction[1] + qz * direction[2]) / lengthSquared
      ));
      return (baseRadius + radiusChange * t - Math.hypot(
        qx - direction[0] * t,
        qy - direction[1] * t,
        qz - direction[2] * t
      )) * inverseSlope;
    }
  };
}

// src/cumulonimbus/volume.ts
var BOUNDS_MIN = [-5, -0.5, -3.5];
var BOUNDS_SIZE = [10, 8.5, 7];
var EXTINCTION = 18;
var ICE_EXTINCTION = 6.5;
var materialExtinction = (ice) => EXTINCTION + (ICE_EXTINCTION - EXTINCTION) * ice;
var VOLUME_RESOLUTION = 256;
var DETAIL_RESOLUTION = 128;
var EMPTY_SKIP_LIMIT = 0.04;
var voxelCenter = (index, axis, size) => BOUNDS_MIN[axis] + (index + 0.5) / size * BOUNDS_SIZE[axis];
var heightErosionScale = (worldY) => (0.48 + 0.52 * smoothstep(1.6, 2.5, worldY)) * (1 - 0.55 * smoothstep(5.1, 6.2, worldY));
function densitySupportBounds(envelope) {
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (let z = 0; z < envelope.size; z++) for (let y = 0; y < envelope.size; y++) for (let x = 0; x < envelope.size; x++) {
    if (!envelope.data[((z * envelope.size + y) * envelope.size + x) * 4]) continue;
    const point = [x, y, z];
    for (let axis = 0; axis < 3; axis++) {
      min[axis] = Math.min(min[axis], point[axis]);
      max[axis] = Math.max(max[axis], point[axis]);
    }
  }
  if (!Number.isFinite(min[0])) return { min: [...BOUNDS_MIN], max: BOUNDS_MIN.map((v, i) => v + BOUNDS_SIZE[i]) };
  const anchor = [0, 0.72, 0];
  for (let axis = 0; axis < 3; axis++) {
    const voxel = BOUNDS_SIZE[axis] / envelope.size, pad = voxel + [0.08, 0.06, 0.08][axis] + THERMAL_DISPLACEMENT[axis];
    min[axis] = Math.max(BOUNDS_MIN[axis], Math.min(anchor[axis], BOUNDS_MIN[axis] + (min[axis] + 0.5) * voxel - pad));
    max[axis] = Math.min(BOUNDS_MIN[axis] + BOUNDS_SIZE[axis], Math.max(anchor[axis], BOUNDS_MIN[axis] + (max[axis] + 0.5) * voxel + pad));
  }
  return { min, max };
}
var morphologyFamily = (seed) => ["congestus", "multicell", "sheared"][(Math.trunc(seed) % 3 + 3) % 3];
var clamp = (v) => Math.max(0, Math.min(1, v));
var smoothstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
function random(seed) {
  return () => {
    seed |= 0;
    seed = seed + 1831565813 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t ^= t + Math.imul(t ^ t >>> 7, 61 | t);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function cloudParameters(seed) {
  const rng = random(seed ^ 1103547991), family = morphologyFamily(seed);
  const height = rng(), width = rng(), spread = rng(), lean = rng();
  if (family === "congestus") return { family, towerHeight: 0.65 + height * 0.09, towerWidth: 1 + width * 0.12, anvilSpread: 0.55 + spread * 0.16, windLean: (lean - 0.5) * 0.045 };
  if (family === "multicell") return { family, towerHeight: 0.78 + height * 0.12, towerWidth: 1 + width * 0.1, anvilSpread: 0.82 + spread * 0.18, windLean: 0.025 + lean * 0.045 };
  return { family, towerHeight: 0.73 + height * 0.13, towerWidth: 0.96 + width * 0.12, anvilSpread: 0.94 + spread * 0.12, windLean: 0.19 + lean * 0.07 };
}
function noise(x, y, z, seed, period = 0) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
  let fx = x - ix, fy = y - iy, fz = z - iz;
  fx = fx * fx * (3 - 2 * fx);
  fy = fy * fy * (3 - 2 * fy);
  fz = fz * fz * (3 - 2 * fz);
  const h = (a, b, c) => {
    if (period) {
      a &= period - 1;
      b &= period - 1;
      c &= period - 1;
    }
    let n = Math.imul(a, 73856093) ^ Math.imul(b, 19349663) ^ Math.imul(c, 83492791) ^ seed;
    n = Math.imul(n ^ n >>> 13, 1274126177);
    return (n >>> 0) / 4294967295;
  };
  const lerp = (a, b, t) => a + (b - a) * t;
  return lerp(
    lerp(lerp(h(ix, iy, iz), h(ix + 1, iy, iz), fx), lerp(h(ix, iy + 1, iz), h(ix + 1, iy + 1, iz), fx), fy),
    lerp(lerp(h(ix, iy, iz + 1), h(ix + 1, iy, iz + 1), fx), lerp(h(ix, iy + 1, iz + 1), h(ix + 1, iy + 1, iz + 1), fx), fy),
    fz
  );
}
function generateDetail(size = DETAIL_RESOLUTION, seed = 71) {
  const data = new Uint8Array(size ** 3 * 4), cellular = cellularNoise(seed + 513);
  for (let z = 0; z < size; z++) for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const px = (x + 0.5) / size, py = (y + 0.5) / size, pz = (z + 0.5) / size, i = ((z * size + y) * size + x) * 4;
    data[i] = Math.round((cellular(px * 32, py * 32, pz * 32) * 0.65 + noise(px * 8, py * 8, pz * 8, seed, 8) * 0.35) * 255);
    data[i + 1] = Math.round(noise(px * 16, py * 16, pz * 16, seed + 21, 16) * 255);
    data[i + 2] = Math.round(noise(px * 32, py * 32, pz * 32, seed + 39, 32) * 255);
    data[i + 3] = 255;
  }
  return { size, data };
}
function sampleDetail(detail, x, y, z, channel, repeat = true) {
  const normalize = (v) => repeat ? v - Math.floor(v) : clamp(v);
  const { size, data } = detail, px = normalize(x) * size - 0.5, py = normalize(y) * size - 0.5, pz = normalize(z) * size - 0.5;
  const ix = Math.floor(px), iy = Math.floor(py), iz = Math.floor(pz), fx = px - ix, fy = py - iy, fz = pz - iz;
  const index = (v) => repeat ? (v + size) % size : Math.max(0, Math.min(size - 1, v));
  const at = (a, b, c) => data[((index(c) * size + index(b)) * size + index(a)) * 4 + channel] / 255;
  let sum = 0;
  for (let dz = 0; dz < 2; dz++) for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) sum += at(ix + dx, iy + dy, iz + dz) * (dx ? fx : 1 - fx) * (dy ? fy : 1 - fy) * (dz ? fz : 1 - fz);
  return sum;
}
var erodeDensity = (density, erosion) => clamp((density - erosion) / (1 - erosion));
function iceHeights(seed) {
  const h = cloudParameters(seed).towerHeight;
  return [0.72 + (5.15 - 0.72) * h, 0.72 + (5.95 - 0.72) * h];
}
function sampleCloudDensity(envelope, detail, x, y, z, ice, additionalErosion = 0) {
  const r = sampleDetail(detail, x * 0.3, y * 0.3, z * 0.3, 0), g = sampleDetail(detail, x * 0.3, y * 0.3, z * 0.3, 1), b = sampleDetail(detail, x * 0.3, y * 0.3, z * 0.3, 2);
  const wx = (g - 0.5) * (0.16 - 0.08 * ice), wy = (b - 0.5) * (0.12 - 0.1 * ice), wz = (r - 0.5) * (0.16 - 0.06 * ice);
  const warped = sampleDetail(envelope, (x + wx - BOUNDS_MIN[0]) / 10, (y + wy - BOUNDS_MIN[1]) / 8.5, (z + wz - BOUNDS_MIN[2]) / 7, 0, false);
  let erosion = (1 - r) * 0.38 + (1 - b) * 0.08;
  let material = 1;
  if (ice > 0) {
    const bend = sampleDetail(detail, x * 0.12, y * 0.1, z * 0.06, 1);
    const ix = x * 0.055 + bend * 0.08, iy = y * 0.34 + x * 0.022 + (bend - 0.5) * 0.06, iz = z * 0.08 + (bend - 0.5) * 0.025;
    const wisps = sampleDetail(detail, ix, iy, iz, 0), breakup = sampleDetail(detail, ix, iy, iz, 2);
    erosion = erosion * (1 - ice) + (0.08 + (1 - wisps) * 0.5) * ice;
    const strand = smoothstep(0.3, 0.7, wisps);
    material = 1 - ice + (0.012 + 0.56 * strand ** 1.7) * (0.65 + 0.35 * smoothstep(0.25, 0.75, breakup)) * (1 - 0.7 * smoothstep(0.4, 3.8, x)) * ice;
  }
  return erodeDensity(warped, Math.min(0.92, erosion + additionalErosion)) * material;
}
function bakeOccupancy(envelope, detail, additional = [0, 0, 0]) {
  const coarse = detail.size, fine = envelope.size, mask = new Uint8Array(coarse ** 3);
  for (let z = 0; z < fine; z++) for (let y = 0; y < fine; y++) for (let x = 0; x < fine; x++) {
    if (envelope.data[((z * fine + y) * fine + x) * 4] === 0) continue;
    mask[(Math.floor(z * coarse / fine) * coarse + Math.floor(y * coarse / fine)) * coarse + Math.floor(x * coarse / fine)] = 1;
  }
  const radius = BOUNDS_SIZE.map((extent, axis) => Math.ceil(([0.08, 0.06, 0.08][axis] + additional[axis] + extent / fine) / (extent / coarse)));
  const edge = coarse + 1, difference = new Int32Array(edge ** 3);
  for (let z = 0; z < coarse; z++) for (let y = 0; y < coarse; y++) for (let x = 0; x < coarse; x++) {
    if (!mask[(z * coarse + y) * coarse + x]) continue;
    const lo = [Math.max(0, x - radius[0]), Math.max(0, y - radius[1]), Math.max(0, z - radius[2])];
    const hi = [Math.min(coarse, x + radius[0] + 1), Math.min(coarse, y + radius[1] + 1), Math.min(coarse, z + radius[2] + 1)];
    for (let c = 0; c < 2; c++) for (let b = 0; b < 2; b++) for (let a = 0; a < 2; a++)
      difference[((c ? hi[2] : lo[2]) * edge + (b ? hi[1] : lo[1])) * edge + (a ? hi[0] : lo[0])] += (a + b + c) % 2 ? -1 : 1;
  }
  for (let z = 0; z < edge; z++) for (let y = 0; y < edge; y++) for (let x = 1; x < edge; x++) difference[(z * edge + y) * edge + x] += difference[(z * edge + y) * edge + x - 1];
  for (let z = 0; z < edge; z++) for (let y = 1; y < edge; y++) for (let x = 0; x < edge; x++) difference[(z * edge + y) * edge + x] += difference[(z * edge + y - 1) * edge + x];
  for (let z = 1; z < edge; z++) for (let y = 0; y < edge; y++) for (let x = 0; x < edge; x++) difference[(z * edge + y) * edge + x] += difference[((z - 1) * edge + y) * edge + x];
  for (let z = 0; z < coarse; z++) for (let y = 0; y < coarse; y++) for (let x = 0; x < coarse; x++) detail.data[((z * coarse + y) * coarse + x) * 4 + 3] = difference[(z * edge + y) * edge + x] > 0 ? 255 : 0;
}
function cellularNoise(seed) {
  const rng = random(seed), points = new Float32Array(32 ** 3 * 3);
  for (let i = 0; i < points.length; i++) points[i] = rng();
  return (x, y, z) => {
    const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
    const fx = x - ix, fy = y - iy, fz = z - iz;
    let distance = 3;
    for (let dz = -1; dz <= 1; dz++) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const idx = (((iz + dz & 31) * 32 + (iy + dy & 31)) * 32 + (ix + dx & 31)) * 3;
      const ax = dx + points[idx] - fx, ay = dy + points[idx + 1] - fy, az = dz + points[idx + 2] - fz;
      distance = Math.min(distance, ax * ax + ay * ay + az * az);
    }
    return 1 - clamp(Math.sqrt(distance));
  };
}
function generateVolume(size = VOLUME_RESOLUTION, seed = 71, progress) {
  const n = size ** 3, field = new Float32Array(n), density = new Float32Array(n);
  field.fill(-10);
  const cellular = cellularNoise(seed + 137);
  const shape = cloudParameters(seed);
  const liquid = [], iceCores = [], summits = [], foundations = [];
  const columnProfiles = [];
  const capParents = /* @__PURE__ */ new Map();
  const anatomy = random(seed ^ 456640933);
  const turret = (x, z, height, width, lean) => {
    const siteX = x + (anatomy() - 0.5) * 0.28, siteZ = z + (anatomy() - 0.5) * 0.32;
    const lower = 2.25 + (anatomy() - 0.5) * 0.3, crest = height + (anatomy() - 0.5) * 0.42;
    const shoulder = lower + (crest - lower) * (0.43 + anatomy() * 0.16);
    const offset = (anatomy() - 0.5) * 0.34, depth = (anatomy() - 0.5) * 0.3;
    const girth = width * (0.91 + anatomy() * 0.18), tipWidth = girth * (0.67 + anatomy() * 0.2);
    const top = [siteX + lean + offset, crest, siteZ + depth, tipWidth, 0.65 + anatomy() * 0.24, tipWidth * (0.86 + anatomy() * 0.2)];
    const foundation = [siteX, lower, siteZ, girth * 1.2, 0.94 + anatomy() * 0.14, girth * 1.06];
    liquid.push(foundation);
    foundations.push(foundation);
    columnProfiles.push({ level: (shoulder - lower) / (crest - lower), expansion: 0.87 + anatomy() * 0.12 });
    liquid.push(top);
    summits.push(top);
    const shoulders = 2 + Math.floor(anatomy() * 2), phase = anatomy() * Math.PI * 2;
    for (let j = 0; j < shoulders; j++) {
      const angle = phase + j * (2.05 + anatomy() * 0.65), level = 0.3 + anatomy() * 0.38;
      const radius = girth * (0.62 + anatomy() * 0.24), bulge = girth * (0.45 + anatomy() * 0.2);
      liquid.push([
        siteX + lean * level + Math.cos(angle) * radius,
        lower + (crest - lower) * level,
        siteZ + depth * level + Math.sin(angle) * radius,
        bulge,
        bulge * (0.88 + anatomy() * 0.4),
        bulge * (0.82 + anatomy() * 0.3),
        0.16
      ]);
    }
  };
  if (shape.family === "congestus") {
    liquid.push([-0.25, 1.52, 0.1, 2.55, 0.76, 1.58], [-1.5, 2.1, -0.25, 1.38, 0.88, 1.2], [1.35, 1.97, 0.25, 1.34, 0.78, 1.1]);
    turret(-1.55, -0.35, 4.95, 1.04, -0.15);
    turret(0.15, 0.4, 5.35, 0.99, 0.1);
    turret(1.55, -0.25, 4.55, 0.88, 0.17);
  } else if (shape.family === "multicell") {
    liquid.push([-1.5, 1.48, -0.25, 1.86, 0.78, 1.36], [1.25, 1.5, 0.25, 1.78, 0.82, 1.39]);
    turret(-1.7, -0.35, 5.45, 0.98, -0.22);
    turret(1.25, 0.3, 4.5, 0.9, 0.25);
    const [older, younger] = summits;
    const pulseX = older[0] * 0.42 + younger[0] * 0.58, pulseZ = (older[2] + younger[2]) * 0.5 + Math.min(older[5], younger[5]) * 0.35;
    const pulseHeight = 0.72 + (Math.min(older[1], younger[1]) - 0.72) * (0.58 + anatomy() * 0.08);
    const pulseWidth = Math.min(older[3], younger[3]) * (0.72 + anatomy() * 0.16);
    liquid.push(
      [pulseX - 0.08, 1.95, pulseZ, pulseWidth * 1.22, (pulseHeight - 0.72) * 0.42, pulseWidth * 1.12, 0.18],
      [pulseX, (1.95 + pulseHeight) * 0.5, pulseZ, pulseWidth * 0.87, (pulseHeight - 1.95) * 0.5 + 0.32, pulseWidth * 0.9, 0.16],
      [pulseX + 0.08, pulseHeight, pulseZ + 0.05, pulseWidth * 0.9, pulseWidth * 0.98, pulseWidth * 0.94, 0.16]
    );
    for (const [i, top] of summits.entries()) {
      const cap = [
        top[0] + top[3] * (i === 0 ? 0.4 : 0.22),
        top[1] + top[4] * 0.4,
        top[2],
        top[3] * (i === 0 ? 1.7 : 1.22),
        top[4] * (i === 0 ? 0.78 : 0.82),
        top[5] * (i === 0 ? 1.24 : 1.05),
        0.055
      ];
      iceCores.push(cap);
      capParents.set(top, cap);
    }
  } else {
    liquid.push([-1.2, 1.5, 0, 2.18, 0.78, 1.51]);
    turret(-1.45, -0.3, 5.3, 1.05, 0.5);
    turret(0.75, 0.5, 4.35, 0.82, 0.24);
    liquid.push([-2.45, 2.7, 0.15, 0.82, 1, 0.83], [-2.15, 3.75, 0.1, 0.64, 0.72, 0.68]);
    const [a, b] = summits, rise = Math.min(a[1], b[1]) - 0.72;
    liquid.push([
      (a[0] + b[0]) * 0.5,
      0.72 + rise * 0.5,
      (a[2] + b[2]) * 0.5,
      Math.abs(a[0] - b[0]) * 0.5 + Math.min(a[3], b[3]) * 0.68,
      rise * 0.29 + 0.16,
      Math.max(a[5], b[5]) * 0.95 + Math.abs(a[2] - b[2]) * 0.35,
      0.18
    ]);
    const mature = summits.reduce((a2, b2) => a2[1] > b2[1] ? a2 : b2);
    const source = [
      mature[0] + mature[3] * 0.4,
      mature[1] + mature[4] * 0.42,
      mature[2],
      mature[3] * 1.7,
      mature[4] * 0.86,
      mature[5] * 1.32,
      0.07
    ];
    iceCores.push(source, [source[0] + 1.65, source[1] + 0.18, source[2] - 0.12, 2.12, 0.42, 1.16, 0.045]);
    capParents.set(mature, source);
  }
  const transform = (c, isIce) => {
    const width = isIce ? shape.anvilSpread : shape.towerWidth;
    c[0] = c[0] * shape.towerWidth + (c[1] - 0.72) * shape.windLean;
    c[1] = 0.72 + (c[1] - 0.72) * shape.towerHeight;
    c[2] *= shape.towerWidth;
    c[3] *= width * (isIce ? 1 : 1.16);
    c[4] *= shape.towerHeight * (isIce ? 1 : 1.1);
    c[5] *= shape.towerWidth * (isIce ? 1 : 1.16);
  };
  liquid.forEach((c) => transform(c, false));
  iceCores.forEach((c) => transform(c, true));
  const highest = Math.max(...summits.map((c) => c[1]));
  for (const top of summits) {
    if (shape.family === "congestus" && !capParents.has(top)) continue;
    if (shape.family !== "multicell" && top[1] < highest - 0.28 * shape.towerHeight) continue;
    const cap = capParents.get(top) ?? iceCores.reduce((a, b) => Math.hypot(a[0] - top[0], a[2] - top[2]) < Math.hypot(b[0] - top[0], b[2] - top[2]) ? a : b);
    const broadShoulder = shape.family === "sheared" && top[1] === highest;
    for (const t of broadShoulder ? [0.1, 0.42, 0.78] : [0.3, 0.72]) {
      const reach = broadShoulder ? Math.sqrt(t) : t * t;
      const rx = top[3] * (1 - reach) + Math.min(cap[3] * (broadShoulder ? 0.95 : 0.72), top[3] * (broadShoulder ? 2.05 : 1.65)) * reach;
      const rz = top[5] * (1 - reach) + cap[5] * (broadShoulder ? 0.9 : 0.72) * reach;
      liquid.push([
        top[0] + (cap[0] - top[0]) * t,
        top[1] + (cap[1] - top[1]) * t,
        top[2] + (cap[2] - top[2]) * t,
        rx,
        0.3 + (cap[1] - top[1]) * 0.48,
        rz,
        0.14
      ]);
    }
  }
  const contractionAudit = [];
  const lobes = [...liquid, ...iceCores], sweeps = [];
  const sweep = (start, end, r0, r1, stretch = [1, 1, 0.88], blend = 0.075) => sweeps.push(createPlumeSweep({ start, end, startRadius: r0, endRadius: r1, stretch, blend }));
  for (let i = 0; i < summits.length; i++) {
    const top = summits[i], foot = foundations[i], profile = columnProfiles[i];
    const lower = [foot[0], foot[1] - foot[4] * 0.48, foot[2]];
    const shoulder = [
      foot[0] + (top[0] - foot[0]) * 0.52,
      foot[1] + (top[1] - foot[1]) * profile.level,
      foot[2] + (top[2] - foot[2]) * 0.46
    ];
    const head = [top[0], top[1] - top[4] * 0.12, top[2]];
    const depth = (foot[5] / foot[3] + top[5] / top[3]) * 0.5;
    sweep(lower, shoulder, foot[3] * 0.8, foot[3] * profile.expansion, [1, 0.94, depth], 0.14);
    sweep(shoulder, head, foot[3] * profile.expansion, top[3] * 0.94, [1, 0.94, depth], 0.14);
  }
  const crownRng = random(seed ^ 972816823);
  for (let i = 0; i < summits.length; i++) {
    const top = summits[i], foot = foundations[i];
    const rise = top[1] - foot[1], girth = top[3], phase = crownRng() * Math.PI * 2;
    const count = i === 0 ? 4 : 3;
    for (let j = 0; j < count; j++) {
      const angle = phase + j * 2.399963229728653 + (crownRng() - 0.5) * 0.45;
      const dx = Math.cos(angle), dz = Math.sin(angle), age = 0.55 + crownRng() * 0.45;
      const level = 0.4 + crownRng() * 0.43, crest = top[1] + top[4] * (0.08 + crownRng() * 0.68);
      const r = girth * (0.32 + crownRng() * 0.34), outer = 0.66 + crownRng() * 0.34;
      const start = [
        foot[0] + (top[0] - foot[0]) * level + dx * girth * 0.58,
        foot[1] + rise * level,
        foot[2] + (top[2] - foot[2]) * level + dz * top[5] * 0.58
      ];
      const shoulder = [top[0] + dx * girth * 0.72, crest - r * 0.3, top[2] + dz * top[5] * 0.72];
      const turn = [top[0] + dx * girth * outer, crest, top[2] + dz * top[5] * outer];
      const fall = [
        top[0] + dx * girth * (outer + 0.12),
        crest - r * (0.8 + age),
        top[2] + dz * top[5] * (outer + 0.12)
      ];
      sweep(start, shoulder, r * 0.68, r, [1, 1.05, 0.92], 0.1);
      sweep(shoulder, turn, r, r * (0.8 + age * 0.1), [1, 1.05, 0.92], 0.1);
      if (j % 2 === 0) sweep(turn, fall, r * (0.8 + age * 0.1), r * 0.48, [1, 1.05, 0.92], 0.085);
    }
  }
  const capRng = random(seed ^ 2695083);
  for (const core of iceCores) for (let j = 0; j < 5; j++) {
    const side = capRng() * 2 - 1, reach = 0.5 + capRng() * 0.65;
    const start = [
      core[0] - core[3] * 0.25,
      core[1] + (capRng() - 0.5) * core[4] * 0.9,
      core[2] + side * core[5] * 0.48
    ];
    const end = [
      core[0] + core[3] * reach,
      start[1] + (capRng() - 0.5) * core[4] * 0.8,
      core[2] + side * core[5] * (0.8 + capRng() * 0.3)
    ];
    const r = Math.min(core[4] * 1.45, core[5] * 0.5);
    sweep(start, end, r, r * (0.35 + capRng() * 0.25), [1, 0.66, 0.82], 0.035);
  }
  const iceRng = random(seed ^ 1943411241);
  const streakCount = iceCores.length === 0 ? 0 : shape.family === "multicell" ? 36 : 48;
  for (let j = 0; j < streakCount; j++) {
    const core = iceCores[j % iceCores.length], reach = 0.45 + iceRng() * 0.72;
    lobes.push([
      core[0] + core[3] * reach,
      core[1] + (iceRng() - 0.5) * core[4] * 1.5 + reach * core[4] * 0.28,
      core[2] + (iceRng() - 0.5) * core[5] * 1.4,
      core[3] * (0.24 + iceRng() * 0.36),
      0.035 + iceRng() * 0.05,
      0.07 + iceRng() * 0.14,
      0.035
    ]);
  }
  for (const [axis, radius, limit] of [[0, 3, 4.35], [2, 5, 2.8]]) {
    const extent = Math.max(
      ...lobes.map((c) => Math.abs(c[axis]) + c[radius]),
      ...sweeps.map((s) => Math.max(Math.abs(s.start[axis]), Math.abs(s.end[axis])) + Math.max(s.startRadius, s.endRadius) * s.stretch[axis])
    );
    const scale = Math.min(1, limit / extent);
    const references = /* @__PURE__ */ new Map();
    for (const s of sweeps) for (const point of [s.start, s.end]) {
      const prior = references.get(point);
      if (prior) prior.count++;
      else references.set(point, { before: point[axis], count: 1 });
    }
    for (const c of lobes) {
      c[axis] *= scale;
      c[radius] *= scale;
    }
    for (const s of sweeps) {
      s.start[axis] *= scale;
      s.end[axis] *= scale;
      s.stretch[axis] *= scale;
    }
    const errors = [...references.entries()].map(([point, entry]) => ({ ...entry, actual: point[axis], expected: entry.before * scale, error: point[axis] - entry.before * scale }));
    contractionAudit.push({ axis, extent, limit, scale, vertices: references.size, sharedVertices: errors.filter((e) => e.count > 1).length, maximumApplications: Math.max(...errors.map((e) => e.count)), maximumPositionError: Math.max(...errors.map((e) => Math.abs(e.error))), examples: errors.filter((e) => Math.abs(e.error) > 1e-10).slice(0, 6) });
  }
  for (const [cx, cy, cz, rx, ry, rz, blend = 0.2] of lobes) {
    const lo = [cx - rx - 0.35, cy - ry - 0.35, cz - rz - 0.35], hi = [cx + rx + 0.35, cy + ry + 0.35, cz + rz + 0.35];
    const start = lo.map((v, i) => Math.max(1, Math.floor((v - BOUNDS_MIN[i]) / BOUNDS_SIZE[i] * size - 0.5)));
    const end = hi.map((v, i) => Math.min(size - 2, Math.ceil((v - BOUNDS_MIN[i]) / BOUNDS_SIZE[i] * size - 0.5)));
    for (let z = start[2]; z <= end[2]; z++) for (let y = start[1]; y <= end[1]; y++) for (let x = start[0]; x <= end[0]; x++) {
      const px = voxelCenter(x, 0, size), py = voxelCenter(y, 1, size), pz = voxelCenter(z, 2, size);
      const sd = (1 - Math.sqrt(((px - cx) / rx) ** 2 + ((py - cy) / ry) ** 2 + ((pz - cz) / rz) ** 2)) * Math.min(rx, ry, rz);
      const idx = (z * size + y) * size + x;
      const old = field[idx], h = clamp(0.5 + 0.5 * (old - sd) / blend);
      field[idx] = sd + (old - sd) * h + blend * h * (1 - h);
    }
  }
  for (const sweep2 of sweeps) {
    const plume = preparePlumeSweep(sweep2), { blend } = sweep2;
    const start = plume.min.map((v, i) => Math.max(1, Math.floor((v - 0.35 - BOUNDS_MIN[i]) / BOUNDS_SIZE[i] * size - 0.5)));
    const end = plume.max.map((v, i) => Math.min(size - 2, Math.ceil((v + 0.35 - BOUNDS_MIN[i]) / BOUNDS_SIZE[i] * size - 0.5)));
    for (let z = start[2]; z <= end[2]; z++) for (let y = start[1]; y <= end[1]; y++) for (let x = start[0]; x <= end[0]; x++) {
      const sd = plume.sample(voxelCenter(x, 0, size), voxelCenter(y, 1, size), voxelCenter(z, 2, size));
      const idx = (z * size + y) * size + x, old = field[idx], h = clamp(0.5 + 0.5 * (old - sd) / blend);
      field[idx] = sd + (old - sd) * h + blend * h * (1 - h);
    }
  }
  const [iceStart, iceEnd] = iceHeights(seed);
  for (let z = 1; z < size - 1; z++) {
    for (let y = 1; y < size - 1; y++) for (let x = 1; x < size - 1; x++) {
      const idx = (z * size + y) * size + x;
      if (field[idx] < -0.3) continue;
      const px = (x + 0.5) / size * 10, py = (y + 0.5) / size * 8.5, pz = (z + 0.5) / size * 7;
      const n1 = noise(px * 1.25, py * 1.25, pz * 1.25, seed), n2 = noise(px * 3.6, py * 3.6, pz * 3.6, seed + 12), n3 = noise(px * 9, py * 9, pz * 9, seed + 42);
      const c1 = cellular(px * 1.8, py * 1.8, pz * 1.8), c2 = cellular(px * 4.5, py * 4.5, pz * 4.5);
      const erosion = Math.min(0, (n1 - 0.5) * 0.2 - (1 - c1) * 0.52 - (1 - c2) * 0.2 + (n3 - 0.5) * 0.1);
      const baseFade = clamp((py + BOUNDS_MIN[1] - 0.72) / 0.24);
      const worldY = py + BOUNDS_MIN[1];
      const erosionScale = heightErosionScale(worldY);
      const ice = smoothstep(iceStart, iceEnd, worldY);
      const fibers = noise(px * 0.3 + py * 0.17, py * 5, pz * 1, seed + 81);
      const interior = 1 - 0.6 * smoothstep(0.04, 0.28, field[idx]);
      const carving = erosion * erosionScale * interior * (1 - ice) - (0.012 + (1 - fibers) * 0.045 + (1 - n1) * 0.07 + (1 - n2) * 0.025) * ice;
      density[idx] = clamp((field[idx] + carving - (0.025 - 0.017 * ice)) * (10 + ice * 4)) * (0.65 + 0.35 * n2) * (1 - ice * (1 - fibers) * 0.5) * baseFade;
    }
    if (z % 8 === 0) progress?.(0.1 + 0.45 * z / size);
  }
  const data = new Uint8Array(n * 4);
  for (let i = 0; i < n; i++) data[i * 4] = Math.round(density[i] * 255);
  const detailSize = Math.min(DETAIL_RESOLUTION, 2 ** Math.ceil(Math.log2(size)));
  const detail = generateDetail(detailSize, seed);
  const envelope = { size, data };
  const supportMargin = 0.13 + Math.hypot(...BOUNDS_SIZE) / size;
  for (let z = 1; z < size - 1; z++) for (let y = 1; y < size - 1; y++) for (let x = 1; x < size - 1; x++) {
    const i = (z * size + y) * size + x;
    if (field[i] < -supportMargin) {
      density[i] = 0;
      continue;
    }
    const px = voxelCenter(x, 0, size), py = voxelCenter(y, 1, size), pz = voxelCenter(z, 2, size);
    const ice = smoothstep(iceStart, iceEnd, py);
    density[i] = sampleCloudDensity(envelope, detail, px, py, pz, ice) * materialExtinction(ice) / EXTINCTION;
  }
  for (let channel = 1; channel <= 3; channel++) {
    const dir = channel === 1 ? SUN_LEFT : channel === 2 ? SUN_RIGHT : [0, 1, 0];
    const tau = bakeOpticalDepth(density, size, BOUNDS_SIZE, dir, EXTINCTION);
    for (let i = 0; i < n; i++) data[i * 4 + channel] = Math.round(clamp(tau[i] / 16) * 255);
    progress?.(0.55 + 0.09 * channel);
  }
  const sunsetLight = new Uint8Array(n * 2);
  for (let side = 0; side < 2; side++) {
    const tau = bakeOpticalDepth(density, size, BOUNDS_SIZE, solarDirection(side, true), EXTINCTION);
    for (let i = 0; i < n; i++) sunsetLight[i * 2 + side] = Math.round(clamp(tau[i] / 16) * 255);
    progress?.(0.82 + 0.09 * (side + 1));
  }
  bakeOccupancy(envelope, detail, THERMAL_DISPLACEMENT);
  return { size, data, sunsetLight, detail, contractionAudit, supportBounds: densitySupportBounds(envelope) };
}
export {
  BOUNDS_MIN,
  BOUNDS_SIZE,
  DETAIL_RESOLUTION,
  EMPTY_SKIP_LIMIT,
  EXTINCTION,
  ICE_EXTINCTION,
  SUN_LEFT,
  SUN_RIGHT,
  VOLUME_RESOLUTION,
  bakeOccupancy,
  cloudParameters,
  densitySupportBounds,
  erodeDensity,
  generateDetail,
  generateVolume,
  heightErosionScale,
  iceHeights,
  materialExtinction,
  morphologyFamily,
  sampleCloudDensity,
  sampleDetail,
  voxelCenter
};
