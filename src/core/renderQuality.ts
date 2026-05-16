export function resolveRenderPixelRatio(devicePixelRatio: number, pixelRatioCap: number): number {
  const safeDevicePixelRatio = Number.isFinite(devicePixelRatio) ? devicePixelRatio : 1;
  const safeCap = Number.isFinite(pixelRatioCap) ? pixelRatioCap : 1;
  return Math.max(0.5, Math.min(1.25, safeDevicePixelRatio, safeCap));
}
