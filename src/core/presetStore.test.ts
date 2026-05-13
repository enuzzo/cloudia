import { describe, expect, it } from "vitest";
import { defaultPreset } from "./defaultPreset";
import { exportPresetJson, importPresetJson } from "./presetStore";

describe("presetStore", () => {
  it("exports stable pretty JSON for the active preset", () => {
    const json = exportPresetJson(defaultPreset);
    expect(json).toContain('"schemaVersion": 1');
    expect(json).toContain('"mode": "flow"');
    expect(json.endsWith("\n")).toBe(true);
  });

  it("round-trips a preset without losing nested weather settings", () => {
    const json = exportPresetJson({
      ...defaultPreset,
      weather: { ...defaultPreset.weather, storm: 0.72, mist: 0.44 },
    });
    const result = importPresetJson(json);
    expect(result.weather.storm).toBe(0.72);
    expect(result.weather.mist).toBe(0.44);
  });

  it("rejects preset JSON with an unsupported schema version", () => {
    const badJson = JSON.stringify({ ...defaultPreset, schemaVersion: 99 });
    expect(() => importPresetJson(badJson)).toThrow("Unsupported Cloudia preset schema");
  });
});
