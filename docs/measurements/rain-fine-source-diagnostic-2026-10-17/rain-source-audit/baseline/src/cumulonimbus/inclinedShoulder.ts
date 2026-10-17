type Point3 = readonly [number, number, number];

/** A fed shoulder joins an upper updraft to its ice source through depth.
 * The orthonormal rotation preserves distance. Scaling normalized ellipsoid
 * distance by its smallest radius makes this positive-inside field at most
 * 1-Lipschitz, retaining the generator's fine-warp/light-bake support bound.
 */
export function prepareInclinedShoulder(start: Point3, end: Point3, width: number, depth: number) {
  if (![...start, ...end, width, depth].every(Number.isFinite) || width <= 0 || depth <= 0) {
    throw new RangeError('An inclined shoulder needs finite anchors and positive radii');
  }
  const delta = end.map((value, axis) => value - start[axis]);
  const length = Math.hypot(...delta);
  if (length < 1e-9) throw new RangeError('An inclined shoulder needs distinct anchors');
  const along = delta.map(value => value / length);
  const horizontal = Math.hypot(along[0], along[1]);
  const side = horizontal > 1e-9 ? [along[1] / horizontal, -along[0] / horizontal, 0] : [1, 0, 0];
  const through = [
    along[1] * side[2] - along[2] * side[1],
    along[2] * side[0] - along[0] * side[2],
    along[0] * side[1] - along[1] * side[0],
  ];
  const center = start.map((value, axis) => (value + end[axis]) * .5);
  const reach = length * .5 + Math.min(width, depth) * .32;
  const slope = Math.min(reach, width, depth);
  const radius = center.map((_, axis) => Math.hypot(reach * along[axis], width * side[axis], depth * through[axis]));
  return {
    min: center.map((value, axis) => value - radius[axis]),
    max: center.map((value, axis) => value + radius[axis]),
    sample(x: number, y: number, z: number) {
      const dx = x - center[0], dy = y - center[1], dz = z - center[2];
      return (1 - Math.hypot(
        (dx * along[0] + dy * along[1] + dz * along[2]) / reach,
        (dx * side[0] + dy * side[1] + dz * side[2]) / width,
        (dx * through[0] + dy * through[1] + dz * through[2]) / depth,
      )) * slope;
    },
  };
}
