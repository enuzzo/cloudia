import { describe, expect, test } from "vitest";
import { computeWeatherOverlay } from "./WeatherLayer";

describe("computeWeatherOverlay", () => {
  test("maps storm state to bounded rain, droplet, mist, and blur parameters", () => {
    const overlay = computeWeatherOverlay(
      { storm: 1.4, rain: 0.8, droplets: 0.7, mist: 0.5, blur: 0.6 },
      { width: 1200, height: 800, pixelRatio: 2 },
    );

    expect(overlay.canvasWidth).toBe(2400);
    expect(overlay.canvasHeight).toBe(1600);
    expect(overlay.rainOpacity).toBeCloseTo(0.66, 2);
    expect(overlay.mistOpacity).toBeCloseTo(0.33, 2);
    expect(overlay.blurPx).toBeCloseTo(7.2, 2);
    expect(overlay.dropletCount).toBe(94);
  });

  test("keeps clear weather effectively transparent", () => {
    const overlay = computeWeatherOverlay(
      { storm: 0, rain: 0, droplets: 0, mist: 0, blur: 0 },
      { width: 1440, height: 900, pixelRatio: 1 },
    );

    expect(overlay.rainOpacity).toBe(0);
    expect(overlay.mistOpacity).toBe(0);
    expect(overlay.blurPx).toBe(0);
    expect(overlay.dropletCount).toBe(0);
  });
});
