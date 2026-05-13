import { defaultPreset } from "../core/defaultPreset";
import type { CloudiaPreset } from "../core/types";
import { CloudEngine } from "../render/CloudEngine";
import { WeatherLayer } from "../weather/WeatherLayer";

export interface CloudiaHeroInstance {
  destroy: () => void;
  setPreset: (preset: CloudiaPreset) => void;
  setWeather: (storm: number) => void;
}

export interface CloudiaHeroOptions {
  preset?: CloudiaPreset;
  handTracking?: boolean;
  autoplay?: boolean;
}

export function resolveMountElement(target: string | HTMLElement): HTMLElement {
  if (typeof target !== "string") {
    return target;
  }

  const element = document.querySelector<HTMLElement>(target);
  if (!element) {
    throw new Error(`Cloudia mount target not found: ${target}`);
  }
  return element;
}

export function mount(
  target: string | HTMLElement,
  options: CloudiaHeroOptions = {},
): CloudiaHeroInstance {
  const element = resolveMountElement(target);
  const preset = structuredClone(options.preset ?? defaultPreset);
  preset.input.handTracking = options.handTracking ?? false;
  preset.embed.handTracking = options.handTracking ?? false;
  preset.embed.autoplay = options.autoplay ?? preset.embed.autoplay;

  installEmbedStyles();
  element.classList.add("cloudia-embed-mount");

  const engine = new CloudEngine(element, preset);
  const weather = new WeatherLayer(element);

  if (preset.embed.autoplay) {
    engine.start();
    weather.start();
  }

  return {
    destroy: () => {
      weather.destroy();
      engine.destroy();
      element.classList.remove("cloudia-embed-mount");
    },
    setPreset: (nextPreset) => {
      engine.setPreset(nextPreset);
    },
    setWeather: (storm) => {
      const intensity = Math.max(0, Math.min(1, storm));
      engine.setRuntime({ storm: intensity });
      weather.setState({
        storm: intensity,
        rain: intensity,
        droplets: intensity,
        mist: intensity * 0.72,
        blur: intensity * 0.82,
      });
    },
  };
}

export const CloudiaHero = { mount };

function installEmbedStyles(): void {
  if (document.querySelector("style[data-cloudia-embed]")) {
    return;
  }

  const style = document.createElement("style");
  style.dataset.cloudiaEmbed = "true";
  style.textContent = `
.cloudia-embed-mount {
  position: relative;
  overflow: hidden;
}

.cloudia-embed-mount > canvas {
  position: absolute;
  inset: 0;
  display: block;
  width: 100%;
  height: 100%;
}

.cloudia-embed-mount > .cloudia-weather-layer {
  pointer-events: none;
  z-index: 2;
}
`;
  document.head.appendChild(style);
}
