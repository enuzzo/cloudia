/** Authored homogeneous aerial perspective, in kilometres.
 * Shared by terrain, cloud and rain as a medium-consistency trial. This is
 * not an altitude-dependent atmospheric transport calculation.
 */
export const AERIAL_BASE_EXTINCTION=.006;
export const AERIAL_HAZE_EXTINCTION=.004;
export function aerialTransmittance(distanceKm:number,haze:number):number{
  return Math.exp(-distanceKm*(AERIAL_BASE_EXTINCTION+AERIAL_HAZE_EXTINCTION*haze));
}
export const AERIAL_WGSL=`
fn aerialTransmittance(distanceKm:f32,haze:f32)->f32{
  return exp(-distanceKm*(${AERIAL_BASE_EXTINCTION}+${AERIAL_HAZE_EXTINCTION}*haze));
}`;
