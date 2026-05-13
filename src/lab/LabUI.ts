import GUI from "lil-gui";
import type { CloudiaPreset } from "../core/types";
import { copyPresetJson } from "../core/presetStore";

export interface LabUIEvents {
  onPresetChanged: (preset: CloudiaPreset) => void;
  onStormChanged: (storm: number) => void;
  onCompressionChanged: (compression: number) => void;
}

export class LabUI {
  private readonly gui = new GUI({ title: "Cloudia" });

  constructor(
    private readonly preset: CloudiaPreset,
    private readonly events: LabUIEvents,
  ) {
    this.gui.add(this.preset, "mode", ["flow", "cumulus"]).name("Mode").onChange(() => {
      this.events.onPresetChanged(this.preset);
    });

    const cloud = this.gui.addFolder("Cloud");
    cloud.add(this.preset.cloud, "density", 0, 1, 0.01).onChange(() => {
      this.events.onPresetChanged(this.preset);
    });
    cloud.add(this.preset.cloud, "coverage", 0, 1, 0.01).onChange(() => {
      this.events.onPresetChanged(this.preset);
    });

    const runtime = {
      storm: this.preset.weather.storm,
      compression: this.preset.cumulus.compression,
      copyParams: async () => {
        await copyPresetJson(this.preset);
      },
    };

    const weather = this.gui.addFolder("Runtime");
    weather.add(runtime, "storm", 0, 1, 0.01).onChange((value: number) => {
      this.events.onStormChanged(value);
    });
    weather.add(runtime, "compression", 0, 1, 0.01).onChange((value: number) => {
      this.events.onCompressionChanged(value);
    });

    this.gui.add(runtime, "copyParams").name("Copy params JSON");
  }

  destroy(): void {
    this.gui.destroy();
  }
}
