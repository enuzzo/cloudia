import { defaultPreset } from "../core/defaultPreset";
import { updateWeatherState, type WeatherRuntimeState } from "../core/stateMachine";
import type { CloudiaPreset } from "../core/types";
import { InputController } from "../input/inputController";
import { CloudEngine } from "../render/CloudEngine";
import { WeatherLayer } from "../weather/WeatherLayer";
import { LabUI } from "./LabUI";

export class LabApp {
  private readonly engine: CloudEngine;
  private readonly input: InputController;
  private readonly weather: WeatherLayer;
  private readonly ui: LabUI;
  private preset: CloudiaPreset = structuredClone(defaultPreset);
  private inputAnimationId = 0;
  private manualStorm = this.preset.weather.storm;
  private previousCompression = this.preset.cumulus.compression;
  private weatherState: WeatherRuntimeState = {
    storm: this.preset.weather.storm,
    rain: this.preset.weather.rain,
    droplets: this.preset.weather.droplets,
    mist: this.preset.weather.mist,
    blur: this.preset.weather.blur,
    burst: 0,
  };

  constructor(stage: HTMLElement) {
    this.engine = new CloudEngine(stage, this.preset);
    this.input = new InputController(stage);
    this.weather = new WeatherLayer(stage);
    this.ui = new LabUI(this.preset, {
      onPresetChanged: (preset) => {
        this.preset = structuredClone(preset);
        this.engine.setPreset(this.preset);
      },
      onStormChanged: (storm) => {
        this.manualStorm = storm;
      },
      onCompressionChanged: (compression) => {
        this.engine.setRuntime({ compression, expansion: 1 - compression * 0.5 });
      },
    });
  }

  start(): void {
    this.engine.start();
    this.weather.start();
    const tick = () => {
      this.inputAnimationId = requestAnimationFrame(tick);
      const gesture = this.input.getGesture();
      const released = this.previousCompression > 0.55 && gesture.compression < 0.24;
      this.weatherState = updateWeatherState(
        this.weatherState,
        {
          stormIntent: Math.max(this.manualStorm, gesture.stormIntent),
          compression: gesture.compression,
          release: released,
        },
        this.preset.weather.easing,
      );
      this.previousCompression = gesture.compression;

      this.engine.setRuntime({
        storm: this.weatherState.storm,
        compression: gesture.compression,
        expansion: 1 - gesture.compression * 0.45,
        primaryX: gesture.primaryX,
        primaryY: gesture.primaryY,
      });
      this.weather.setState(this.weatherState);
    };
    tick();
  }

  destroy(): void {
    cancelAnimationFrame(this.inputAnimationId);
    this.input.destroy();
    this.ui.destroy();
    this.weather.destroy();
    this.engine.destroy();
  }
}
