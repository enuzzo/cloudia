import { defaultPreset } from "../core/defaultPreset";
import type { CloudiaPreset } from "../core/types";
import { CloudEngine } from "../render/CloudEngine";
import { LabUI } from "./LabUI";

export class LabApp {
  private readonly engine: CloudEngine;
  private readonly ui: LabUI;
  private preset: CloudiaPreset = structuredClone(defaultPreset);

  constructor(stage: HTMLElement) {
    this.engine = new CloudEngine(stage, this.preset);
    this.ui = new LabUI(this.preset, {
      onPresetChanged: (preset) => {
        this.preset = structuredClone(preset);
        this.engine.setPreset(this.preset);
      },
      onStormChanged: (storm) => {
        this.engine.setRuntime({ storm });
      },
      onCompressionChanged: (compression) => {
        this.engine.setRuntime({ compression, expansion: 1 - compression * 0.5 });
      },
    });
  }

  start(): void {
    this.engine.start();
  }

  destroy(): void {
    this.ui.destroy();
    this.engine.destroy();
  }
}
