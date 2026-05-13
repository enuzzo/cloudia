export function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export function damp(current: number, target: number, amount: number): number {
  return current + (target - current) * clamp01(amount);
}

export function remap01(value: number, min: number, max: number): number {
  if (max === min) return 0;
  return clamp01((value - min) / (max - min));
}
