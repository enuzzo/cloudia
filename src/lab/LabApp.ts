import { defaultPreset } from "../core/defaultPreset";
import type { CloudiaPreset } from "../core/types";
import { InputController } from "../input/inputController";
import { CloudEngine } from "../render/CloudEngine";
import { LabUI } from "./LabUI";

export class LabApp {
  private readonly engine: CloudEngine;
  private readonly input: InputController;
  private readonly ui: LabUI;
  private preset: CloudiaPreset = structuredClone(defaultPreset);
  private inputAnimationId = 0;

  constructor(stage: HTMLElement) {
    this.engine = new CloudEngine(stage, this.preset);
    this.input = new InputController(stage);
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
    const tick = () => {
      this.inputAnimationId = requestAnimationFrame(tick);
      const gesture = this.input.getGesture();
      this.engine.setRuntime({
        compression: gesture.compression,
        expansion: 1 - gesture.compression * 0.45,
        primaryX: gesture.primaryX,
        primaryY: gesture.primaryY,
      });
    };
    tick();
  }

  destroy(): void {
    cancelAnimationFrame(this.inputAnimationId);
    this.input.destroy();
    this.ui.destroy();
    this.engine.destroy();
  }
}
