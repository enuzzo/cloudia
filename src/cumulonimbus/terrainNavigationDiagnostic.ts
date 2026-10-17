/** Immutable path specification. elapsedMs is measured relative to the start
 * of the measured interval, after the two-second zero-offset warmup.
 */
export const TERRAIN_NAVIGATION_DIAGNOSTIC=Object.freeze({
 id:'terrain-yaw-sine-three-cycles-v1',
 warmupMs:2000,measuredDurationMs:30000,cycleMs:10000,cycles:3,amplitudeRadians:.16,
 elapsedOrigin:'measured-start-after-warmup',
 axis:'camera-yaw-offset-radians',
 outsideWindowYawRadians:0,
} as const);

/** Pure, clock-indexed diagnostic offset. This does not mutate camera input,
 * simulation time or OrbitView. A and B must receive the same elapsed clock.
 */
export function terrainNavigationYaw(elapsedMs:number):number{
 if(!Number.isFinite(elapsedMs))throw new RangeError('Terrain navigation elapsed time must be finite');
 if(elapsedMs<=0||elapsedMs>=TERRAIN_NAVIGATION_DIAGNOSTIC.measuredDurationMs)return 0;
 return TERRAIN_NAVIGATION_DIAGNOSTIC.amplitudeRadians*Math.sin(2*Math.PI*elapsedMs/TERRAIN_NAVIGATION_DIAGNOSTIC.cycleMs);
}
