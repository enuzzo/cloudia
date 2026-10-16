export type Point3 = [number, number, number];

/** A rising or overturning branch, with a continuous taper rather than beads. */
export interface PlumeSweep {
  start: Point3;
  end: Point3;
  startRadius: number;
  endRadius: number;
  stretch: Point3;
  blend: number;
}

/** Each sweep owns its vertices, even when adjacent sections share a position.
 * Axis contraction mutates the vertices in place; shared arrays would receive
 * the same scale twice and separate the joined sections from the authored path.
 */
export function createPlumeSweep(sweep: PlumeSweep): PlumeSweep {
  return { ...sweep, start: [...sweep.start], end: [...sweep.end], stretch: [...sweep.stretch] };
}

/** Positive inside a tapered, elliptically stretched capsule.
 *
 * In normalized coordinates the distance to the segment is 1-Lipschitz;
 * its clamped projection changes the radius by at most |dr| / length.
 * Dividing by that sum, then by the stretch operator norm, keeps this field
 * 1-Lipschitz in world space. Smooth union therefore preserves the existing
 * conservative fine-warp/light-bake support margin. This is a shape field,
 * not a fluid simulation or an exact signed distance to the tapered surface.
 */
export function preparePlumeSweep(sweep: PlumeSweep) {
  const { start, end, startRadius, endRadius, stretch } = sweep;
  if (![...start, ...end, startRadius, endRadius, ...stretch].every(Number.isFinite) ||
      startRadius < 0 || endRadius < 0 || stretch.some(v => v <= 0)) {
    throw new RangeError('A plume needs finite endpoints, nonnegative radii and positive stretch');
  }
  const a = start.map((v, i) => v / stretch[i]);
  const direction = end.map((v, i) => v / stretch[i] - a[i]);
  const lengthSquared = direction.reduce((sum, v) => sum + v * v, 0);
  const radius = Math.max(startRadius, endRadius);
  // Coincident sections reduce to the enclosing ellipsoid. There is no
  // projection direction from which to choose one of the two section radii.
  const baseRadius = lengthSquared === 0 ? radius : startRadius;
  const radiusChange = lengthSquared === 0 ? 0 : endRadius - startRadius;
  const inverseSlope = Math.min(...stretch) /
    (1 + (lengthSquared === 0 ? 0 : Math.abs(radiusChange) / Math.sqrt(lengthSquared)));
  return {
    min: start.map((v, i) => Math.min(v, end[i]) - radius * stretch[i]),
    max: start.map((v, i) => Math.max(v, end[i]) + radius * stretch[i]),
    sample(x: number, y: number, z: number) {
      const qx = x / stretch[0] - a[0];
      const qy = y / stretch[1] - a[1];
      const qz = z / stretch[2] - a[2];
      const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1,
        (qx * direction[0] + qy * direction[1] + qz * direction[2]) /
        lengthSquared));
      return (baseRadius + radiusChange * t - Math.hypot(
        qx - direction[0] * t, qy - direction[1] * t, qz - direction[2] * t,
      )) * inverseSlope;
    },
  };
}
