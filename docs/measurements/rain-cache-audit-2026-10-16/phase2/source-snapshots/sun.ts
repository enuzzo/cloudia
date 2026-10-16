/** Shared directions for atmospheric radiance, phase and baked cloud visibility. */
export const SUN_LEFT = [-0.75, 0.8, 0.24] as const;
export const SUN_RIGHT = [0.75, 0.8, 0.24] as const;
export function solarDirection(side:number,sunset=false):number[]{
  const d:number[]=[...(side===0?SUN_LEFT:SUN_RIGHT)];
  if(sunset)d[1]=.025;
  const length=Math.hypot(...d);return d.map(v=>v/length);
}
