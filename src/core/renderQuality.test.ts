import { describe, expect, it } from "vitest";
import { resolveRenderPixelRatio } from "./renderQuality";

describe("resolveRenderPixelRatio", () => {
  it("caps retina displays to the requested performance budget", () => {
    expect(resolveRenderPixelRatio(2, 0.85)).toBe(0.85);
  });

  it("keeps render scale inside a usable range", () => {
    expect(resolveRenderPixelRatio(0.2, 0.2)).toBe(0.5);
    expect(resolveRenderPixelRatio(3, 8)).toBe(1.25);
  });
});
