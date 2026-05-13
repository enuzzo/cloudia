import { describe, expect, it } from "vitest";
import { clamp01, damp } from "./easing";

describe("easing", () => {
  it("clamps values to the 0..1 range", () => {
    expect(clamp01(-0.4)).toBe(0);
    expect(clamp01(0.6)).toBe(0.6);
    expect(clamp01(1.8)).toBe(1);
  });

  it("damps toward a target without overshooting", () => {
    expect(damp(0, 1, 0.25)).toBeCloseTo(0.25);
    expect(damp(0.9, 0.1, 0.5)).toBeCloseTo(0.5);
  });
});
