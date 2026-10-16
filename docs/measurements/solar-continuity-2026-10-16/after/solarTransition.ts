interface Direction {readonly x:number;readonly y:number;readonly z:number}
interface DirectionWriter {set(x:number,y:number,z:number):unknown}

/** Interpolate the sun's angles, preserving elevation during a side-only change.
 * This controls direction; blending baked visibility endpoints remains an
 * approximation to transport from an intermediate solar direction.
 */
export function interpolateSolarDirection(from:Direction,to:Direction,blend:number,out:DirectionWriter):void {
  if(blend<=0){out.set(from.x,from.y,from.z);return;}
  if(blend>=1){out.set(to.x,to.y,to.z);return;}
  const azimuthFrom=Math.atan2(from.x,from.z),azimuthTo=Math.atan2(to.x,to.z);
  const azimuthDelta=Math.atan2(Math.sin(azimuthTo-azimuthFrom),Math.cos(azimuthTo-azimuthFrom));
  const elevationFrom=Math.atan2(from.y,Math.hypot(from.x,from.z));
  const elevationTo=Math.atan2(to.y,Math.hypot(to.x,to.z));
  const azimuth=azimuthFrom+azimuthDelta*blend,elevation=elevationFrom+(elevationTo-elevationFrom)*blend;
  const horizontal=Math.cos(elevation);
  out.set(Math.sin(azimuth)*horizontal,Math.sin(elevation),Math.cos(azimuth)*horizontal);
}
