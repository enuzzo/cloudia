import { describe, expect, it } from "vitest";
import { updateWeatherState } from "./stateMachine";

describe("stateMachine", () => {
  it("raises storm values when storm intent is active", () => {
    const next = updateWeatherState(
      { storm: 0, rain: 0, droplets: 0, mist: 0, blur: 0 },
      { stormIntent: 1, compression: 0.9, release: false },
      0.2,
    );
    expect(next.storm).toBeGreaterThan(0);
    expect(next.rain).toBeGreaterThan(0);
    expect(next.droplets).toBeGreaterThan(0);
  });

  it("creates a burst when a compressed cloud is released", () => {
    const next = updateWeatherState(
      { storm: 0, rain: 0, droplets: 0, mist: 0, blur: 0 },
      { stormIntent: 0, compression: 0.1, release: true },
      0.3,
    );
    expect(next.burst).toBeGreaterThan(0);
  });
});
