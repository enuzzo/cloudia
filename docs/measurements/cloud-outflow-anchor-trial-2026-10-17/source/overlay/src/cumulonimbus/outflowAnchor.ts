export type OutflowAnchorPoint = readonly [number, number, number];

/** Translate an outflow root onto its feeding axis at the root's existing height.
 * The axis extends beyond the summit: its height parameter is not clamped.
 * Only X/Z are returned; heights, radii and relative outflow offsets stay authored.
 */
export function outflowAnchorTranslation(
  foundation: OutflowAnchorPoint,
  summit: OutflowAnchorPoint,
  proximal: OutflowAnchorPoint,
): readonly [number, number] {
  if (![...foundation, ...summit, ...proximal].every(Number.isFinite)) {
    throw new RangeError('Outflow anchors need finite coordinates');
  }
  const rise = summit[1] - foundation[1];
  if (!(rise > 0) || !Number.isFinite(rise)) {
    throw new RangeError('An outflow feeding axis needs a summit above its foundation');
  }
  const t = (proximal[1] - foundation[1]) / rise;
  const dx = foundation[0] + t * (summit[0] - foundation[0]) - proximal[0];
  const dz = foundation[2] + t * (summit[2] - foundation[2]) - proximal[2];
  if (![t, dx, dz].every(Number.isFinite)) {
    throw new RangeError('Outflow anchor translation exceeds finite coordinates');
  }
  return [dx, dz];
}
