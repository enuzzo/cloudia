import type { WeatherRuntimeState } from "../core/stateMachine";
import { clamp01 } from "../core/easing";
import { resolveRenderPixelRatio } from "../core/renderQuality";

export interface WeatherViewport {
  width: number;
  height: number;
  pixelRatio: number;
}

export interface WeatherOverlayParams {
  canvasWidth: number;
  canvasHeight: number;
  rainOpacity: number;
  mistOpacity: number;
  blurPx: number;
  dropletCount: number;
}

export function computeWeatherOverlay(
  state: WeatherRuntimeState,
  viewport: WeatherViewport,
): WeatherOverlayParams {
  const pixelRatio = resolveRenderPixelRatio(viewport.pixelRatio, 1);
  const storm = clamp01(state.storm);
  const rain = clamp01(Math.max(state.rain, storm * 0.72));
  const droplets = clamp01(Math.max(state.droplets, storm * 0.62));
  const mist = clamp01(Math.max(state.mist, storm * 0.42));
  const blur = clamp01(Math.max(state.blur, storm * 0.28));
  const area = viewport.width * viewport.height;

  return {
    canvasWidth: Math.max(1, Math.round(viewport.width * pixelRatio)),
    canvasHeight: Math.max(1, Math.round(viewport.height * pixelRatio)),
    rainOpacity: rain * 0.82,
    mistOpacity: mist * 0.66,
    blurPx: blur * 12,
    dropletCount: Math.min(180, Math.ceil((area / 7200) * droplets)),
  };
}

export class WeatherLayer {
  private readonly canvas = document.createElement("canvas");
  private readonly context: CanvasRenderingContext2D;
  private readonly resizeObserver: ResizeObserver;
  private animationId = 0;
  private startedAt = performance.now();
  private canvasDirty = false;
  private state: WeatherRuntimeState = {
    storm: 0,
    rain: 0,
    droplets: 0,
    mist: 0,
    blur: 0,
    burst: 0,
  };

  constructor(private readonly host: HTMLElement) {
    const context = this.canvas.getContext("2d", { alpha: true });
    if (!context) {
      throw new Error("Cloudia weather layer requires CanvasRenderingContext2D.");
    }

    this.context = context;
    this.canvas.className = "cloudia-weather-layer";
    this.host.appendChild(this.canvas);

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.host);
    this.resize();
  }

  start(): void {
    this.startedAt = performance.now();
    const frame = () => {
      this.animationId = requestAnimationFrame(frame);
      this.draw((performance.now() - this.startedAt) / 1000);
    };
    frame();
  }

  stop(): void {
    cancelAnimationFrame(this.animationId);
  }

  destroy(): void {
    this.stop();
    this.resizeObserver.disconnect();
    this.canvas.remove();
  }

  setState(state: Partial<WeatherRuntimeState>): void {
    this.state = { ...this.state, ...state };
  }

  private resize(): void {
    const rect = this.host.getBoundingClientRect();
    const overlay = computeWeatherOverlay(this.state, {
      width: Math.max(1, Math.floor(rect.width)),
      height: Math.max(1, Math.floor(rect.height)),
      pixelRatio: devicePixelRatio,
    });

    if (this.canvas.width !== overlay.canvasWidth) {
      this.canvas.width = overlay.canvasWidth;
    }
    if (this.canvas.height !== overlay.canvasHeight) {
      this.canvas.height = overlay.canvasHeight;
    }
  }

  private draw(time: number): void {
    const width = this.canvas.width;
    const height = this.canvas.height;
    const overlay = computeWeatherOverlay(this.state, {
      width,
      height,
      pixelRatio: 1,
    });

    if (
      overlay.rainOpacity <= 0.001 &&
      overlay.mistOpacity <= 0.001 &&
      overlay.dropletCount === 0
    ) {
      if (this.canvasDirty) {
        this.context.clearRect(0, 0, width, height);
        this.canvasDirty = false;
      }
      return;
    }

    this.context.clearRect(0, 0, width, height);
    this.drawMist(width, height, overlay.mistOpacity);
    this.drawRain(width, height, overlay.rainOpacity, time);
    this.drawDroplets(width, height, overlay.dropletCount, overlay.blurPx, time);
    this.canvasDirty = true;
  }

  private drawMist(width: number, height: number, opacity: number): void {
    if (opacity <= 0.001) {
      return;
    }

    const gradient = this.context.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, `rgba(235, 241, 255, ${opacity * 0.15})`);
    gradient.addColorStop(0.48, `rgba(198, 207, 226, ${opacity * 0.34})`);
    gradient.addColorStop(1, `rgba(42, 48, 70, ${opacity * 0.24})`);

    this.context.fillStyle = gradient;
    this.context.fillRect(0, 0, width, height);
  }

  private drawRain(width: number, height: number, opacity: number, time: number): void {
    if (opacity <= 0.001) {
      return;
    }

    const streaks = Math.floor((width * height * opacity) / 5600);
    this.context.save();
    this.context.globalAlpha = opacity;
    this.context.strokeStyle = "rgba(223, 235, 255, 0.52)";
    this.context.lineWidth = Math.max(1, width / 1300);
    this.context.lineCap = "round";

    for (let index = 0; index < streaks; index += 1) {
      const seed = hash01(index * 23.17);
      const x = hash01(index * 7.91) * width;
      const fall = (time * (900 + seed * 420) + hash01(index * 3.33) * height) % height;
      const length = 22 + seed * 46;
      const slant = length * 0.16;
      this.context.beginPath();
      this.context.moveTo(x, fall);
      this.context.lineTo(x - slant, fall + length);
      this.context.stroke();
    }

    this.context.restore();
  }

  private drawDroplets(
    width: number,
    height: number,
    count: number,
    blurPx: number,
    time: number,
  ): void {
    if (count <= 0) {
      return;
    }

    this.context.save();
    this.context.filter = `blur(${Math.max(0, blurPx * 0.16)}px)`;

    for (let index = 0; index < count; index += 1) {
      const seed = hash01(index * 41.13);
      const x = hash01(index * 9.71) * width;
      const wobble = Math.sin(time * 0.9 + seed * 6.283) * 5 * seed;
      const y =
        (hash01(index * 15.37) * height + time * (12 + seed * 18) + wobble) %
        height;
      const radius = 3 + seed * 13 + blurPx * 0.18;
      const droplet = this.context.createRadialGradient(
        x - radius * 0.25,
        y - radius * 0.32,
        radius * 0.08,
        x,
        y,
        radius,
      );
      droplet.addColorStop(0, "rgba(255, 255, 255, 0.72)");
      droplet.addColorStop(0.28, "rgba(208, 225, 255, 0.24)");
      droplet.addColorStop(1, "rgba(160, 178, 212, 0.02)");

      this.context.fillStyle = droplet;
      this.context.beginPath();
      this.context.ellipse(x, y, radius * 0.72, radius * (1 + seed * 0.8), 0.1, 0, Math.PI * 2);
      this.context.fill();
    }

    this.context.restore();
  }
}

function hash01(value: number): number {
  return fract(Math.sin(value * 12.9898) * 43758.5453);
}

function fract(value: number): number {
  return value - Math.floor(value);
}
