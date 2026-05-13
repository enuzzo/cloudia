import { describe, expect, it } from "vitest";
import { mapHandLandmarks } from "./gestureMapper";

const openHand = [
  [0.5, 0.8],
  [0.45, 0.65],
  [0.42, 0.5],
  [0.4, 0.36],
  [0.38, 0.22],
  [0.5, 0.62],
  [0.5, 0.44],
  [0.5, 0.3],
  [0.5, 0.16],
  [0.56, 0.64],
  [0.58, 0.46],
  [0.6, 0.32],
  [0.62, 0.18],
  [0.61, 0.68],
  [0.66, 0.52],
  [0.7, 0.4],
  [0.74, 0.28],
  [0.42, 0.69],
  [0.34, 0.58],
  [0.28, 0.5],
  [0.22, 0.42],
] as const;

const fist = openHand.map(([x, y], index) => {
  if ([4, 8, 12, 16, 20].includes(index)) return [0.5, 0.62] as const;
  return [x, y] as const;
});

describe("gestureMapper", () => {
  it("maps an open hand to high openness and low compression", () => {
    const result = mapHandLandmarks(openHand, "Right");
    expect(result.openness).toBeGreaterThan(0.7);
    expect(result.compression).toBeLessThan(0.35);
    expect(result.leftHandClosed).toBe(false);
  });

  it("maps a left fist to storm intent", () => {
    const result = mapHandLandmarks(fist, "Left");
    expect(result.compression).toBeGreaterThan(0.65);
    expect(result.leftHandClosed).toBe(true);
    expect(result.stormIntent).toBeGreaterThan(0.65);
  });
});
